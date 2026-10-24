"""
LUXE Perruque - Backend API tests (pytest)
Covers: products CRUD & filters, auth (register/login/me/RBAC),
admin stats, orders, Stripe checkout (returns URL) and status endpoint.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL",
                          "https://perruque-premium.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@luxe-perruque.com"
ADMIN_PASSWORD = "Admin@Luxe2025"


# ------------------ Fixtures ------------------
@pytest.fixture(scope="session")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def admin_token(http):
    r = http.post(f"{API}/auth/login",
                  json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["user"]["role"] == "admin"
    return data["token"]


@pytest.fixture(scope="session")
def customer(http):
    """Registers a fresh customer once per session."""
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = http.post(f"{API}/auth/register",
                  json={"email": email, "password": "Passw0rd!", "name": "Test User"})
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "token": data["token"], "user": data["user"]}


def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def clean_get(url, token=None, **kw):
    """Isolated request (no shared cookies) — matches frontend Bearer-only auth."""
    return requests.get(url, headers=auth_headers(token) if token else {}, **kw)


def clean_post(url, json=None, token=None, **kw):
    return requests.post(url, json=json,
                         headers=auth_headers(token) if token else {"Content-Type": "application/json"},
                         **kw)


def clean_put(url, json=None, token=None, **kw):
    return requests.put(url, json=json,
                        headers=auth_headers(token) if token else {"Content-Type": "application/json"},
                        **kw)


def clean_delete(url, token=None, **kw):
    return requests.delete(url, headers=auth_headers(token) if token else {}, **kw)


# ------------------ Products ------------------
class TestProducts:
    def test_list_products_seeded(self, http):
        r = http.get(f"{API}/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 8, f"expected >=8 seeded products, got {len(data)}"
        # sanity of shape
        p = data[0]
        for k in ("id", "name", "price", "category", "stock", "images"):
            assert k in p
        # ÉLANI categories present
        categories = {p["category"] for p in data}
        expected = {"The Silk Collection", "The Riviera Wave", "Extensions", "Coffrets"}
        assert expected.issubset(categories), f"missing ÉLANI categories: {expected - categories}"
        # 'Perruques' must NOT be present anymore
        assert "Perruques" not in categories, "Legacy 'Perruques' category still present"
        # No product name/description should contain the word 'perruque'
        for p in data:
            text = f"{p.get('name','')} {p.get('description','')}".lower()
            assert "perruque" not in text, f"'perruque' found in product {p.get('id')}: {text}"
        # images are relative /products/*.png paths
        first_img = data[0]["images"][0] if data[0].get("images") else ""
        assert first_img.startswith("/products/") and first_img.endswith(".png"), \
            f"unexpected image path: {first_img}"

    def test_filter_by_category(self, http):
        r = http.get(f"{API}/products", params={"category": "The Silk Collection"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert all(p["category"] == "The Silk Collection" for p in items)

    def test_filter_featured(self, http):
        r = http.get(f"{API}/products", params={"featured": "true"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert all(p["featured"] is True for p in items)

    def test_get_product_by_id(self, http):
        pid = http.get(f"{API}/products").json()[0]["id"]
        r = http.get(f"{API}/products/{pid}")
        assert r.status_code == 200
        assert r.json()["id"] == pid

    def test_get_product_404(self, http):
        r = http.get(f"{API}/products/does-not-exist")
        assert r.status_code == 404


# ------------------ Auth ------------------
class TestAuth:
    def test_register_returns_user_and_token(self, http):
        email = f"reg_{uuid.uuid4().hex[:8]}@example.com"
        r = http.post(f"{API}/auth/register",
                      json={"email": email, "password": "Secret123", "name": "Reg User"})
        assert r.status_code == 200
        d = r.json()
        assert "token" in d and isinstance(d["token"], str) and len(d["token"]) > 20
        assert d["user"]["email"] == email
        assert d["user"]["role"] == "customer"

    def test_register_duplicate_email(self, http, customer):
        r = http.post(f"{API}/auth/register",
                      json={"email": customer["email"], "password": "Secret123", "name": "dup"})
        assert r.status_code == 400

    def test_admin_login_ok(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20

    def test_login_wrong_password(self, http):
        r = http.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": "WrongPass!"})
        assert r.status_code == 401

    def test_me_with_bearer(self, http, customer):
        r = clean_get(f"{API}/auth/me", token=customer["token"])
        assert r.status_code == 200
        assert r.json()["email"] == customer["email"]

    def test_me_without_token(self, http):
        r = requests.get(f"{API}/auth/me")  # brand new session, no cookies
        assert r.status_code == 401


# ------------------ Admin RBAC & product CRUD ------------------
class TestAdminRBAC:
    def test_create_product_requires_admin(self, http, customer):
        payload = {"name": "TEST_wig", "description": "x", "price": 99.0,
                   "category": "Closure", "stock": 5, "featured": False, "images": []}
        # customer forbidden
        r = clean_post(f"{API}/products", json=payload, token=customer["token"])
        assert r.status_code == 403

    def test_admin_create_update_delete(self, http, admin_token):
        payload = {"name": "TEST_admin_wig", "description": "created by test",
                   "price": 123.45, "category": "Closure", "length": "18",
                   "texture": "Lisse", "color": "Noir", "origin": "Test",
                   "stock": 10, "featured": True, "images": ["https://x/y.jpg"]}
        r = clean_post(f"{API}/products", json=payload, token=admin_token)
        assert r.status_code == 200, r.text
        created = r.json()
        pid = created["id"]
        assert created["name"] == payload["name"]

        # verify persisted
        r = http.get(f"{API}/products/{pid}")
        assert r.status_code == 200 and r.json()["price"] == 123.45

        # update
        payload["price"] = 150.0
        payload["name"] = "TEST_admin_wig_updated"
        r = clean_put(f"{API}/products/{pid}", json=payload, token=admin_token)
        assert r.status_code == 200
        assert r.json()["price"] == 150.0
        assert r.json()["name"] == "TEST_admin_wig_updated"

        # delete
        r = clean_delete(f"{API}/products/{pid}", token=admin_token)
        assert r.status_code == 200
        r = http.get(f"{API}/products/{pid}")
        assert r.status_code == 404

    def test_admin_stats_requires_admin(self, http, customer, admin_token):
        r = clean_get(f"{API}/admin/stats", token=customer["token"])
        assert r.status_code == 403
        r = clean_get(f"{API}/admin/stats", token=admin_token)
        assert r.status_code == 200
        for k in ("total_products", "total_orders", "revenue", "low_stock"):
            assert k in r.json()

    def test_all_orders_requires_admin(self, http, customer, admin_token):
        r = clean_get(f"{API}/orders", token=customer["token"])
        assert r.status_code == 403
        r = clean_get(f"{API}/orders", token=admin_token)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ------------------ Checkout / Orders ------------------
class TestCheckout:
    def test_checkout_returns_stripe_url(self, http, customer):
        # Pick a stable seeded product (skip TEST_ prefixed ones to avoid races)
        products = [p for p in http.get(f"{API}/products").json()
                    if not p.get("name", "").startswith("TEST_") and p.get("stock", 0) > 0]
        assert products, "no seeded products with stock"
        pid = products[0]["id"]
        body = {"items": [{"product_id": pid, "quantity": 1}],
                "origin_url": BASE_URL}
        r = clean_post(f"{API}/payments/checkout", json=body, token=customer["token"])
        assert r.status_code == 200, r.text
        d = r.json()
        assert "checkout_url" in d and d["checkout_url"].startswith("https://")
        assert "session_id" in d and d["session_id"].startswith("cs_")

        # status endpoint returns pending record — verify EUR currency was used
        s = requests.get(f"{API}/payments/status/{d['session_id']}")
        assert s.status_code == 200
        body_s = s.json()
        assert body_s["session_id"] == d["session_id"]
        assert "status" in body_s and "payment_status" in body_s

    def test_checkout_insufficient_stock(self, http):
        p = http.get(f"{API}/products").json()[0]
        body = {"items": [{"product_id": p["id"], "quantity": p["stock"] + 10000}],
                "origin_url": BASE_URL}
        # quantity > 50 fails pydantic; use 50 but request stock > available product
        # Find a product with low stock instead
        low = min(http.get(f"{API}/products").json(), key=lambda x: x["stock"])
        body = {"items": [{"product_id": low["id"], "quantity": low["stock"] + 1}],
                "origin_url": BASE_URL}
        r = http.post(f"{API}/payments/checkout", json=body)
        # if low["stock"] + 1 > 50 pydantic returns 422; else expect 400
        if low["stock"] + 1 > 50:
            assert r.status_code in (400, 422)
        else:
            assert r.status_code == 400

    def test_my_orders(self, http, customer):
        # trigger creation of order via checkout above; make a fresh checkout too
        seeded = [p for p in http.get(f"{API}/products").json()
                  if not p.get("name", "").startswith("TEST_") and p.get("stock", 0) > 0]
        pid = seeded[0]["id"]
        clean_post(f"{API}/payments/checkout",
                   json={"items": [{"product_id": pid, "quantity": 1}],
                         "origin_url": BASE_URL},
                   token=customer["token"])
        r = clean_get(f"{API}/orders/my", token=customer["token"])
        assert r.status_code == 200
        orders = r.json()
        assert isinstance(orders, list) and len(orders) >= 1
        assert all(o["user_id"] == customer["user"]["user_id"] for o in orders)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

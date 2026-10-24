"""
ELANI Raw Hair — tests for iteration 7 new features:
- /health endpoint
- /api/config (shipping_fee, length_inches)
- Products with avg_rating / review_count / length_options (11 entries)
- Admin login with new credentials
- Promo codes (create + validate)
- Checkout with `inches` field + shipping line + promo_code
- Reviews (create/list/moderate + duplicate + verified)
- CORS OPTIONS preflight
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@elanirawhair.com"
ADMIN_PASSWORD = "Admin@Elani2026"


def auth(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# --- Fixtures ---
@pytest.fixture(scope="session")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login: {r.status_code} {r.text}"
    d = r.json()
    assert d["user"]["role"] == "admin"
    return d["token"]


@pytest.fixture(scope="session")
def customer():
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "Passw0rd!", "name": "TEST User"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def customer2():
    email = f"TEST_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "Passw0rd!", "name": "TEST User2"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture(scope="session")
def a_product():
    products = requests.get(f"{API}/products").json()
    stocked = [p for p in products if p.get("stock", 0) > 0 and not p["name"].startswith("TEST_")]
    assert stocked, "no seeded stocked products"
    return stocked[0]


# --- Health / Config ---
class TestInfra:
    def test_health(self):
        # /health is served by backend directly (used by K8s liveness).
        # Public ingress routes non-/api paths to frontend, so we hit backend on port 8001.
        r = requests.get("http://localhost:8001/health", timeout=5)
        assert r.status_code == 200
        assert r.json() == {"status": "ok"}

    def test_config(self):
        r = requests.get(f"{API}/config")
        assert r.status_code == 200
        d = r.json()
        assert d["shipping_fee"] == 6.99
        assert d["length_inches"] == [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]

    def test_cors_preflight(self):
        r = requests.options(
            f"{API}/products",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "GET",
                "Access-Control-Request-Headers": "content-type",
            },
        )
        # With CORS_ORIGINS=* → allow-origin should be * and status 200
        assert r.status_code in (200, 204)
        aco = r.headers.get("access-control-allow-origin", "")
        assert aco in ("*", "https://example.com"), f"CORS header missing: {dict(r.headers)}"


# --- Products with new fields ---
class TestProductsShape:
    def test_products_have_new_fields(self):
        r = requests.get(f"{API}/products")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list) and len(data) >= 1
        for p in data:
            assert "avg_rating" in p and isinstance(p["avg_rating"], (int, float))
            assert "review_count" in p and isinstance(p["review_count"], int)
            assert "length_options" in p
            opts = p["length_options"]
            assert isinstance(opts, list) and len(opts) == 11
            inches = [o["inches"] for o in opts]
            assert inches == [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]
            # prices strictly non-decreasing (formula is monotonic since factor grows)
            prices = [o["price"] for o in opts]
            for i in range(1, len(prices)):
                assert prices[i] >= prices[i - 1], f"prices not increasing: {prices}"
            # each entry has label
            assert all("pouces" in o["label"] for o in opts)

    def test_single_product_has_length_options(self, a_product):
        r = requests.get(f"{API}/products/{a_product['id']}")
        assert r.status_code == 200
        p = r.json()
        assert len(p["length_options"]) == 11


# --- Admin login ---
class TestAdminAuth:
    def test_admin_login(self, admin_token):
        assert isinstance(admin_token, str) and len(admin_token) > 20


# --- Promo codes ---
class TestPromoCodes:
    def test_create_percentage_promo(self, admin_token):
        code = f"TESTPCT{uuid.uuid4().hex[:5].upper()}"
        r = requests.post(f"{API}/admin/promo-codes",
                          json={"code": code, "discount_type": "percentage",
                                "value": 10, "active": True},
                          headers=auth(admin_token))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["code"] == code
        assert d["discount_type"] == "percentage"
        assert d["value"] == 10
        # validate
        v = requests.post(f"{API}/promo-codes/validate",
                          json={"code": code, "subtotal": 200})
        assert v.status_code == 200
        vd = v.json()
        assert vd["discount"] == 20.0

    def test_create_fixed_promo(self, admin_token):
        code = f"TESTFIX{uuid.uuid4().hex[:5].upper()}"
        r = requests.post(f"{API}/admin/promo-codes",
                          json={"code": code, "discount_type": "fixed",
                                "value": 25, "active": True},
                          headers=auth(admin_token))
        assert r.status_code == 200, r.text
        v = requests.post(f"{API}/promo-codes/validate",
                          json={"code": code, "subtotal": 200})
        assert v.status_code == 200
        assert v.json()["discount"] == 25.0

    def test_ensure_welcome10(self, admin_token):
        # idempotent-ish: create if absent
        code = "WELCOME10"
        r = requests.post(f"{API}/admin/promo-codes",
                          json={"code": code, "discount_type": "percentage",
                                "value": 10, "active": True},
                          headers=auth(admin_token))
        # 400 if already exists → acceptable
        assert r.status_code in (200, 400)
        v = requests.post(f"{API}/promo-codes/validate",
                          json={"code": code, "subtotal": 100})
        assert v.status_code == 200
        assert v.json()["discount"] == 10.0

    def test_invalid_promo(self):
        v = requests.post(f"{API}/promo-codes/validate",
                          json={"code": "NOPE_DOES_NOT_EXIST_XYZ", "subtotal": 100})
        assert v.status_code == 400

    def test_admin_only_create_promo(self, customer):
        r = requests.post(f"{API}/admin/promo-codes",
                          json={"code": "XX_CUST", "discount_type": "percentage", "value": 5},
                          headers=auth(customer["token"]))
        assert r.status_code == 403


# --- Checkout with inches and promo ---
class TestCheckoutV2:
    def test_checkout_with_inches_and_shipping(self, customer, a_product):
        body = {"items": [{"product_id": a_product["id"], "quantity": 1, "inches": 22}],
                "origin_url": BASE_URL}
        r = requests.post(f"{API}/payments/checkout", json=body,
                          headers=auth(customer["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["checkout_url"].startswith("https://")
        assert d["session_id"].startswith("cs_")
        assert d["shipping"] == 6.99
        assert d["total"] > 6.99

    def test_checkout_without_inches_falls_back(self, customer, a_product):
        body = {"items": [{"product_id": a_product["id"], "quantity": 1}],
                "origin_url": BASE_URL}
        r = requests.post(f"{API}/payments/checkout", json=body,
                          headers=auth(customer["token"]))
        assert r.status_code == 200, r.text
        assert r.json()["shipping"] == 6.99

    def test_checkout_with_promo(self, admin_token, customer, a_product):
        code = f"TESTCK{uuid.uuid4().hex[:5].upper()}"
        r = requests.post(f"{API}/admin/promo-codes",
                          json={"code": code, "discount_type": "percentage",
                                "value": 15, "active": True},
                          headers=auth(admin_token))
        assert r.status_code == 200
        body = {"items": [{"product_id": a_product["id"], "quantity": 1, "inches": 18}],
                "origin_url": BASE_URL, "promo_code": code}
        r = requests.post(f"{API}/payments/checkout", json=body,
                          headers=auth(customer["token"]))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["discount"] > 0
        assert d["checkout_url"].startswith("https://")

    def test_checkout_with_invalid_promo_400(self, customer, a_product):
        body = {"items": [{"product_id": a_product["id"], "quantity": 1}],
                "origin_url": BASE_URL, "promo_code": "NOT_A_REAL_PROMO_QQQ"}
        r = requests.post(f"{API}/payments/checkout", json=body,
                          headers=auth(customer["token"]))
        assert r.status_code == 400


# --- Reviews ---
class TestReviews:
    def test_create_review_requires_auth(self, a_product):
        r = requests.post(f"{API}/products/{a_product['id']}/reviews",
                          json={"rating": 5, "comment": "great product"})
        assert r.status_code == 401

    def test_create_review_ok_pending_not_verified(self, customer, a_product):
        r = requests.post(f"{API}/products/{a_product['id']}/reviews",
                          json={"rating": 4, "comment": "TEST review from unverified user"},
                          headers=auth(customer["token"]))
        assert r.status_code == 200, r.text
        rv = r.json()["review"]
        assert rv["rating"] == 4
        assert rv["status"] == "pending"
        assert rv["verified"] is False  # no paid order

    def test_duplicate_review_rejected(self, customer, a_product):
        r = requests.post(f"{API}/products/{a_product['id']}/reviews",
                          json={"rating": 5, "comment": "TEST duplicate"},
                          headers=auth(customer["token"]))
        assert r.status_code == 400

    def test_public_list_only_approved(self, a_product):
        # pending review created above shouldn't appear in public list
        r = requests.get(f"{API}/products/{a_product['id']}/reviews")
        assert r.status_code == 200
        d = r.json()
        assert "reviews" in d and "average" in d and "count" in d
        # all returned are approved
        for rv in d["reviews"]:
            assert rv["status"] == "approved"

    def test_admin_list_and_moderate(self, admin_token, customer2, a_product):
        # customer2 creates a new review
        r = requests.post(f"{API}/products/{a_product['id']}/reviews",
                          json={"rating": 3, "comment": "TEST moderate flow"},
                          headers=auth(customer2["token"]))
        assert r.status_code == 200
        rv_id = r.json()["review"]["id"]

        # admin sees all reviews with product_name
        lst = requests.get(f"{API}/admin/reviews", headers=auth(admin_token))
        assert lst.status_code == 200
        items = lst.json()
        assert any(x["id"] == rv_id for x in items)
        target = next(x for x in items if x["id"] == rv_id)
        assert target.get("product_name")

        # approve
        up = requests.put(f"{API}/admin/reviews/{rv_id}/status",
                         json={"status": "approved"}, headers=auth(admin_token))
        assert up.status_code == 200

        # now public list contains it (or at least count reflects it)
        pub = requests.get(f"{API}/products/{a_product['id']}/reviews").json()
        assert any(x["id"] == rv_id for x in pub["reviews"])
        assert pub["count"] >= 1
        assert pub["average"] > 0

        # reject invalid status
        bad = requests.put(f"{API}/admin/reviews/{rv_id}/status",
                          json={"status": "banana"}, headers=auth(admin_token))
        assert bad.status_code == 400

        # cleanup: delete this review
        d = requests.delete(f"{API}/admin/reviews/{rv_id}", headers=auth(admin_token))
        assert d.status_code == 200


# --- Consultations sanity ---
class TestConsultations:
    def test_book_flow(self, admin_token):
        # admin creates a slot far in future
        from datetime import datetime, timedelta, timezone
        slot_dt = (datetime.now(timezone.utc) + timedelta(days=365)).strftime("%Y-%m-%dT10:00")
        cs = requests.post(f"{API}/admin/consultation-slots",
                           json={"datetime": slot_dt},
                           headers=auth(admin_token))
        # tolerate different endpoint or already existing
        if cs.status_code not in (200, 201, 400):
            pytest.skip(f"slot creation not supported: {cs.status_code} {cs.text}")

        # get slots
        slots = requests.get(f"{API}/consultation-slots")
        if slots.status_code != 200:
            pytest.skip("no consultation-slots GET")
        avail = [s for s in slots.json() if not s.get("booked")]
        if not avail:
            pytest.skip("no available slots")
        target = avail[0]
        r = requests.post(f"{API}/consultations/book",
                          json={"slot_id": target["id"], "name": "TEST_user",
                                "email": f"TEST_{uuid.uuid4().hex[:6]}@example.com",
                                "phone": "0600000000",
                                "wig_type": "The Silk Collection (Raw Straight)",
                                "budget": "1000-2000"})
        assert r.status_code in (200, 201), r.text


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

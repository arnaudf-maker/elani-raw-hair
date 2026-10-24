"""Backend tests for PayPal integration + regression checks (iteration 10)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    # Read from frontend/.env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').strip("'")
                break
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ----- /api/config -----
def test_config_exposes_empty_paypal_client_id(s):
    r = s.get(f"{API}/config", timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "paypal_client_id" in data
    assert data["paypal_client_id"] == ""
    assert data.get("paypal_mode") == "sandbox"
    assert data.get("shipping_fee") == 6.99


# ----- /health -----
def test_health(s):
    # /health at root, not /api
    r = s.get(f"{BASE_URL}/api/health", timeout=15)
    # Fallback: try /health
    if r.status_code == 404:
        r = s.get(f"{BASE_URL}/health", timeout=15)
    assert r.status_code == 200


# ----- Products regression -----
def test_products_have_length_options(s):
    r = s.get(f"{API}/products", timeout=30)
    assert r.status_code == 200
    products = r.json()
    assert isinstance(products, list) and len(products) > 0
    # At least one non-accessory product should have length_options
    hair = [p for p in products if not p.get("is_accessory")]
    assert hair, "no hair products found"
    assert "length_options" in hair[0]
    assert isinstance(hair[0]["length_options"], list)


def test_closure_hd_category_returns_two(s):
    r = s.get(f"{API}/products", params={"category": "Closure HD"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert len(data) == 2, f"expected 2 Closure HD products, got {len(data)}"


# ----- PayPal endpoints must return 503 without keys -----
def _sample_checkout_body(product_id):
    return {
        "items": [{"product_id": product_id, "quantity": 1, "inches": 16}],
        "origin_url": "https://example.com",
    }


@pytest.fixture(scope="module")
def sample_product(s):
    r = s.get(f"{API}/products", timeout=30)
    products = r.json()
    hair = [p for p in products if not p.get("is_accessory")]
    return hair[0]


def test_paypal_create_order_503_without_keys(s, sample_product):
    body = _sample_checkout_body(sample_product["id"])
    r = s.post(f"{API}/paypal/create-order", json=body, timeout=30)
    assert r.status_code == 503, f"expected 503, got {r.status_code}: {r.text}"
    data = r.json()
    assert data.get("detail") == "PayPal non configuré"


def test_paypal_capture_order_503_without_keys(s):
    r = s.post(f"{API}/paypal/capture-order/FAKE_ORDER_ID", timeout=30)
    assert r.status_code == 503
    assert r.json().get("detail") == "PayPal non configuré"


def test_paypal_create_order_validates_body_but_still_503(s):
    # Even with empty body, since PAYPAL_ENABLED False check may/may not run first.
    # Accept 503 (preferred: fail fast) or 422 (pydantic validates first).
    r = s.post(f"{API}/paypal/create-order", json={}, timeout=30)
    assert r.status_code in (422, 503)


# ----- Stripe checkout regression -----
def test_stripe_checkout_still_works(s, sample_product):
    body = _sample_checkout_body(sample_product["id"])
    r = s.post(f"{API}/payments/checkout", json=body, timeout=45)
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("checkout_url", "session_id", "discount", "shipping", "total"):
        assert k in data, f"missing key {k}"
    assert data["shipping"] == 6.99
    assert data["discount"] == 0.0
    # subtotal should be product's base price * 1 + shipping (approx)
    assert data["total"] > 0
    assert data["checkout_url"].startswith("http")


def test_stripe_checkout_invalid_promo(s, sample_product):
    body = _sample_checkout_body(sample_product["id"])
    body["promo_code"] = "NOPE_INVALID_XYZ"
    r = s.post(f"{API}/payments/checkout", json=body, timeout=30)
    assert r.status_code == 400
    assert "promo" in r.json().get("detail", "").lower() or "invalide" in r.json().get("detail", "").lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

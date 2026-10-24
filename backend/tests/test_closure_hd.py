"""Tests for Closure HD restructure with texture selector and length grid."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://perruque-premium.preview.emergentagent.com").rstrip("/")

EXPECTED_PRICES = {
    "closure_5x5": {
        "straight": {10: 50, 12: 60, 14: 70, 16: 80, 18: 90, 20: 100},
        "body_wave": {10: 55, 12: 65, 14: 75, 16: 85, 18: 95, 20: 105},
    },
    "closure_6x6": {
        "straight": {10: 70, 12: 80, 14: 90, 16: 100, 18: 110, 20: 120},
        "body_wave": {10: 75, 12: 85, 14: 95, 16: 105, 18: 115, 20: 125},
    },
    "frontal_13x6": {
        "straight": {10: 120, 12: 130, 14: 140, 16: 150, 18: 160, 20: 170},
        "body_wave": {10: 125, 12: 135, 14: 145, 16: 155, 18: 165, 20: 175},
    },
}

EXPECTED_NAMES = {
    "closure_5x5": "Lace Closure HD 5×5",
    "closure_6x6": "Lace Closure HD 6×6",
    "frontal_13x6": "Lace Frontal HD 13×6",
}


@pytest.fixture(scope="module")
def closure_products():
    r = requests.get(f"{BASE_URL}/api/products", params={"category": "Closure HD"}, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


def test_closure_hd_returns_exactly_3_products(closure_products):
    assert len(closure_products) == 3, f"Expected 3 products, got {len(closure_products)}: {[p['name'] for p in closure_products]}"
    types = {p.get("closure_type") for p in closure_products}
    assert types == {"closure_5x5", "closure_6x6", "frontal_13x6"}


def test_closure_hd_names_match(closure_products):
    for p in closure_products:
        ct = p["closure_type"]
        assert p["name"] == EXPECTED_NAMES[ct], f"{ct}: {p['name']}"


def test_no_old_hd_lace_closure(closure_products):
    for p in closure_products:
        assert p["name"] != "HD Lace Closure"


@pytest.mark.parametrize("ctype", ["closure_5x5", "closure_6x6", "frontal_13x6"])
def test_length_options_structure(closure_products, ctype):
    product = next(p for p in closure_products if p["closure_type"] == ctype)
    opts = product.get("length_options", [])
    assert len(opts) == 12, f"{ctype} expected 12 options, got {len(opts)}"
    inches_seen = {o["inches"] for o in opts}
    assert inches_seen == {10, 12, 14, 16, 18, 20}
    textures = {o["texture"] for o in opts}
    assert textures == {"straight", "body_wave"}
    for o in opts:
        assert set(["inches", "cm", "label", "texture", "texture_label", "price"]).issubset(o.keys())


@pytest.mark.parametrize("ctype", ["closure_5x5", "closure_6x6", "frontal_13x6"])
def test_prices_match_table(closure_products, ctype):
    product = next(p for p in closure_products if p["closure_type"] == ctype)
    for o in product["length_options"]:
        expected = EXPECTED_PRICES[ctype][o["texture"]][o["inches"]]
        assert o["price"] == expected, f"{ctype} {o['texture']} {o['inches']}: got {o['price']} expected {expected}"


def test_checkout_closure_5x5_body_wave_18():
    r = requests.get(f"{BASE_URL}/api/products", params={"category": "Closure HD"}, timeout=30)
    products = r.json()
    prod = next(p for p in products if p["closure_type"] == "closure_5x5")
    payload = {
        "items": [{"product_id": prod["id"], "quantity": 1, "inches": 18, "texture": "body_wave"}],
        "customer_email": "test_closure@example.com",
        "origin_url": BASE_URL,
        "success_url": f"{BASE_URL}/success",
        "cancel_url": f"{BASE_URL}/cancel",
    }
    r = requests.post(f"{BASE_URL}/api/payments/checkout", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # total = 95 + 6.99 = 101.99
    assert abs(data["total"] - 101.99) < 0.01, f"total={data.get('total')}"


def test_checkout_frontal_13x6_straight_20():
    r = requests.get(f"{BASE_URL}/api/products", params={"category": "Closure HD"}, timeout=30)
    products = r.json()
    prod = next(p for p in products if p["closure_type"] == "frontal_13x6")
    payload = {
        "items": [{"product_id": prod["id"], "quantity": 1, "inches": 20, "texture": "straight"}],
        "customer_email": "test_frontal@example.com",
        "origin_url": BASE_URL,
        "success_url": f"{BASE_URL}/success",
        "cancel_url": f"{BASE_URL}/cancel",
    }
    r = requests.post(f"{BASE_URL}/api/payments/checkout", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert abs(data["total"] - 176.99) < 0.01, f"total={data.get('total')}"


def test_paypal_regression_503():
    r = requests.post(
        f"{BASE_URL}/api/paypal/create-order",
        json={"items": [{"product_id": "x", "quantity": 1}], "customer_email": "x@y.com", "origin_url": BASE_URL, "success_url": "http://x", "cancel_url": "http://x"},
        timeout=30,
    )
    assert r.status_code == 503


def test_health_and_config():
    r = requests.get(f"{BASE_URL}/api/health", timeout=15)
    # Some apps expose /health, others /api/health
    if r.status_code == 404:
        r = requests.get(f"{BASE_URL}/health", timeout=15)
    assert r.status_code == 200

    r = requests.get(f"{BASE_URL}/api/config", timeout=15)
    assert r.status_code == 200
    cfg = r.json()
    assert cfg.get("shipping_fee") == 6.99
    assert cfg.get("paypal_client_id") == ""

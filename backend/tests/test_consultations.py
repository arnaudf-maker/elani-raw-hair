"""
LUXE / ÉLANI - Consultation booking backend tests
Covers: /api/consultations/availability, /consultations/slots (create/list/delete),
/consultations/book, /consultations (list & status), admin_stats.consultations count.
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


# ---------------- Fixtures ----------------
@pytest.fixture(scope="module")
def admin_token():
    r = requests.post(f"{API}/auth/login",
                      json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"admin login failed: {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="module")
def customer_token():
    email = f"consult_{uuid.uuid4().hex[:8]}@example.com"
    r = requests.post(f"{API}/auth/register",
                      json={"email": email, "password": "Passw0rd!", "name": "Consult Cust"})
    assert r.status_code == 200
    return r.json()["token"]


def h(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------- Availability (public) ----------------
class TestAvailability:
    def test_availability_public_returns_list(self):
        r = requests.get(f"{API}/consultations/availability")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        # All returned slots must be future & not booked
        from datetime import datetime, timezone
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        for s in data:
            assert s["is_booked"] is False, f"booked slot leaked: {s}"
            assert s["date"] >= today, f"past slot leaked: {s['date']}"
            for k in ("id", "date", "time", "is_booked"):
                assert k in s
        # Verify sort order by (date, time)
        keys = [(s["date"], s["time"]) for s in data]
        assert keys == sorted(keys), "slots not sorted by date,time"

    def test_availability_has_seeded_slots(self):
        """Review request notes: 2026-07-25, 2026-07-28, 2026-08-01 are seeded."""
        r = requests.get(f"{API}/consultations/availability")
        assert r.status_code == 200
        dates = {s["date"] for s in r.json()}
        # At least one of the seeded future dates should be present
        assert any(d in dates for d in ("2026-07-25", "2026-07-28", "2026-08-01")), \
            f"none of the seeded dates in availability: {sorted(dates)[:10]}"


# ---------------- Slot management (admin RBAC) ----------------
class TestSlotAdminCRUD:
    def test_create_slots_requires_admin(self, customer_token):
        r = requests.post(f"{API}/consultations/slots",
                          json={"date": "2027-01-15", "times": ["10:00"]},
                          headers=h(customer_token))
        assert r.status_code == 403

    def test_create_slots_no_auth(self):
        r = requests.post(f"{API}/consultations/slots",
                          json={"date": "2027-01-15", "times": ["10:00"]})
        assert r.status_code in (401, 403)

    def test_list_all_slots_requires_admin(self, customer_token):
        r = requests.get(f"{API}/consultations/slots", headers=h(customer_token))
        assert r.status_code == 403

    def test_admin_create_and_dedupe(self, admin_token):
        date = "2027-03-14"
        times = ["09:00", "11:30"]
        r = requests.post(f"{API}/consultations/slots",
                          json={"date": date, "times": times},
                          headers=h(admin_token))
        assert r.status_code == 200
        created = r.json()["created"]
        assert len(created) == 2
        assert {c["time"] for c in created} == set(times)

        # duplicate call must skip existing
        r2 = requests.post(f"{API}/consultations/slots",
                          json={"date": date, "times": times + ["13:00"]},
                          headers=h(admin_token))
        assert r2.status_code == 200
        created2 = r2.json()["created"]
        assert [c["time"] for c in created2] == ["13:00"], \
            f"expected only new time to be created, got {created2}"

        # list should include the 3 new slots
        r3 = requests.get(f"{API}/consultations/slots", headers=h(admin_token))
        assert r3.status_code == 200
        all_slots = r3.json()
        target = [s for s in all_slots if s["date"] == date]
        assert len(target) == 3
        for s in target:
            assert s["is_booked"] is False
            assert "id" in s

        # cleanup
        for s in target:
            d = requests.delete(f"{API}/consultations/slots/{s['id']}", headers=h(admin_token))
            assert d.status_code == 200


# ---------------- Booking (public) ----------------
class TestBooking:
    def test_book_flow_full(self, admin_token):
        # Admin creates a fresh slot to book
        date = "2027-05-20"
        r = requests.post(f"{API}/consultations/slots",
                          json={"date": date, "times": ["10:00"]},
                          headers=h(admin_token))
        assert r.status_code == 200
        slot_id = r.json()["created"][0]["id"]

        # It should be in public availability
        avail = requests.get(f"{API}/consultations/availability").json()
        assert any(s["id"] == slot_id for s in avail)

        # Public booking (no auth required)
        booking_payload = {
            "slot_id": slot_id,
            "name": "TEST_Alice",
            "wig_type": "The Silk Collection (Raw Straight)",
            "budget": "400 € – 700 €",
            "phone": "+33612345678",
            "message": "Preference for morning"
        }
        rb = requests.post(f"{API}/consultations/book", json=booking_payload)
        assert rb.status_code == 200, rb.text
        booking = rb.json()["booking"]
        for k in ("id", "slot_id", "date", "time", "name", "wig_type",
                  "budget", "phone", "message", "status", "created_at"):
            assert k in booking
        assert booking["slot_id"] == slot_id
        assert booking["date"] == date
        assert booking["time"] == "10:00"
        assert booking["status"] == "pending"

        # Slot should have disappeared from public availability
        avail_after = requests.get(f"{API}/consultations/availability").json()
        assert not any(s["id"] == slot_id for s in avail_after), \
            "booked slot still visible in availability"

        # And is_booked = True in admin list
        all_slots = requests.get(f"{API}/consultations/slots", headers=h(admin_token)).json()
        s = next((x for x in all_slots if x["id"] == slot_id), None)
        assert s and s["is_booked"] is True

        # Rebooking same slot => 400
        rr = requests.post(f"{API}/consultations/book", json=booking_payload)
        assert rr.status_code == 400

        # Admin sees the booking in listing
        rlist = requests.get(f"{API}/consultations", headers=h(admin_token))
        assert rlist.status_code == 200
        bookings = rlist.json()
        found = next((b for b in bookings if b["id"] == booking["id"]), None)
        assert found is not None
        assert found["name"] == "TEST_Alice"

        # Update status
        rs = requests.put(f"{API}/consultations/{booking['id']}/status",
                          json={"status": "confirmed"}, headers=h(admin_token))
        assert rs.status_code == 200
        # Verify persisted
        bookings2 = requests.get(f"{API}/consultations", headers=h(admin_token)).json()
        found2 = next(b for b in bookings2 if b["id"] == booking["id"])
        assert found2["status"] == "confirmed"

        # cleanup slot
        requests.delete(f"{API}/consultations/slots/{slot_id}", headers=h(admin_token))

    def test_book_unknown_slot_404(self):
        r = requests.post(f"{API}/consultations/book",
                          json={"slot_id": "nonexistent-xyz", "name": "X",
                                "wig_type": "Perruque sur mesure", "budget": "Moins de 200 €"})
        assert r.status_code == 404


# ---------------- Consultations admin listing / RBAC ----------------
class TestConsultationsRBAC:
    def test_list_requires_admin(self, customer_token):
        r = requests.get(f"{API}/consultations", headers=h(customer_token))
        assert r.status_code == 403

    def test_status_update_requires_admin(self, customer_token):
        r = requests.put(f"{API}/consultations/whatever/status",
                        json={"status": "confirmed"}, headers=h(customer_token))
        assert r.status_code == 403


# ---------------- admin_stats includes consultations ----------------
class TestAdminStatsWithConsultations:
    def test_stats_has_consultations(self, admin_token):
        r = requests.get(f"{API}/admin/stats", headers=h(admin_token))
        assert r.status_code == 200
        data = r.json()
        assert "consultations" in data
        assert isinstance(data["consultations"], int)
        assert data["consultations"] >= 0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import logging
import uuid
import bcrypt
import jwt
import secrets
import urllib.request
import json
import httpx
from datetime import datetime, timezone, timedelta
import stripe

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"

# ---------- PayPal config ----------
PAYPAL_CLIENT_ID = os.environ.get("PAYPAL_CLIENT_ID", "")
PAYPAL_SECRET = os.environ.get("PAYPAL_SECRET", "")
PAYPAL_MODE = os.environ.get("PAYPAL_MODE", "sandbox")
PAYPAL_BASE = ("https://api-m.sandbox.paypal.com" if PAYPAL_MODE == "sandbox"
               else "https://api-m.paypal.com")
PAYPAL_ENABLED = bool(PAYPAL_CLIENT_ID and PAYPAL_SECRET)
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# Emergent managed email (Resend). EMAIL_BASE_URL is a constant (survives deploy).
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "ÉLANI Raw Hair")
OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "")

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def set_auth_cookie(response: Response, token: str):
    response.set_cookie(key="access_token", value=token, httponly=True,
                        secure=True, samesite="none", max_age=604800, path="/")

def public_user(u: dict) -> dict:
    return {"user_id": u["user_id"], "email": u["email"], "name": u.get("name", ""),
            "role": u.get("role", "customer"), "picture": u.get("picture", "")}


# ---------------------------------------------------------------------------
# Email (Emergent-managed Resend) — non-blocking, never raises
# ---------------------------------------------------------------------------
async def send_email_safe(to: str, subject: str, html: str, reply_to: str = None) -> bool:
    if not EMAIL_KEY or not to:
        return False
    payload = {"to": [to], "subject": subject, "html": html, "from_name": EMAIL_FROM_NAME}
    if reply_to:
        payload["contact_email"] = reply_to
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.post(f"{EMAIL_BASE_URL}/api/v1/email/send",
                                   headers={"X-Email-Key": EMAIL_KEY}, json=payload)
        resp.raise_for_status()
        return True
    except Exception as e:
        logger.error(f"Email send error to {to}: {e}")
        return False


def _email_shell(inner: str) -> str:
    return f"""<div style="margin:0;padding:0;background:#F4F3ED;font-family:Georgia,'Times New Roman',serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F3ED;padding:32px 0;">
        <tr><td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FAFAF7;border:1px solid #E0DACD;">
            <tr><td style="background:#171311;padding:34px;text-align:center;">
              <div style="color:#C49A45;font-size:13px;letter-spacing:3px;">&#9819;</div>
              <div style="color:#F4F3ED;font-size:30px;letter-spacing:8px;margin-top:6px;">ÉLANI</div>
              <div style="color:#C49A45;font-size:10px;letter-spacing:5px;margin-top:8px;">RAW HAIR</div>
            </td></tr>
            <tr><td style="padding:40px 44px;color:#171311;">{inner}</td></tr>
            <tr><td style="background:#171311;padding:24px;text-align:center;color:#8a8378;font-size:11px;font-family:Arial,sans-serif;">
              ÉLANI — Raw Hair · elanirawhair.com<br/>L'élégance commence ici.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </div>"""


def _order_rows(items):
    rows = ""
    for it in items:
        line = float(it.get("price", 0)) * it.get("quantity", 1)
        rows += (f'<tr><td style="padding:10px 0;border-bottom:1px solid #E0DACD;font-size:15px;">{it.get("name","")} '
                 f'&times; {it.get("quantity",1)}</td>'
                 f'<td style="padding:10px 0;border-bottom:1px solid #E0DACD;text-align:right;font-size:15px;color:#A37C2E;">'
                 f'{line:.2f} &euro;</td></tr>')
    return rows


async def _send_order_emails(session_id: str, order: dict):
    customer_email = ""
    try:
        s = stripe.checkout.Session.retrieve(session_id)
        details = s.get("customer_details") or {}
        customer_email = details.get("email") or ""
    except Exception:
        pass
    if not customer_email and order.get("user_id"):
        u = await db.users.find_one({"user_id": order["user_id"]}, {"_id": 0})
        customer_email = (u or {}).get("email", "")
    rows = _order_rows(order.get("items", []))
    total = float(order.get("total", 0))
    ref = order.get("id", "")[:8]
    if customer_email:
        inner = (f'<h1 style="font-size:26px;font-weight:normal;margin:0 0 8px;">Merci pour votre commande</h1>'
                 f'<p style="color:#C49A45;font-size:22px;font-family:cursive;margin:0 0 20px;">Merci</p>'
                 f'<p style="font-size:15px;color:#4A463F;font-family:Arial,sans-serif;line-height:1.6;">Votre commande '
                 f'<strong>#{ref}</strong> est confirmée. Notre équipe prépare votre commande avec le plus grand soin.</p>'
                 f'<table width="100%" style="margin:24px 0;">{rows}'
                 f'<tr><td style="padding-top:14px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Total</td>'
                 f'<td style="padding-top:14px;text-align:right;font-size:20px;color:#A37C2E;">{total:.2f} &euro;</td></tr></table>'
                 f'<p style="font-size:13px;color:#8a8378;font-family:Arial,sans-serif;">Une question ? Répondez simplement à cet email.</p>')
        await send_email_safe(customer_email, "Votre commande ÉLANI est confirmée", _email_shell(inner), reply_to=OWNER_EMAIL)
    if OWNER_EMAIL:
        inner = (f'<h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;">Nouvelle commande &#128142;</h1>'
                 f'<p style="font-size:15px;color:#4A463F;font-family:Arial,sans-serif;">Commande <strong>#{ref}</strong>'
                 f'{" — " + customer_email if customer_email else ""}</p>'
                 f'<table width="100%" style="margin:20px 0;">{rows}'
                 f'<tr><td style="padding-top:14px;font-size:12px;letter-spacing:2px;text-transform:uppercase;">Total</td>'
                 f'<td style="padding-top:14px;text-align:right;font-size:20px;color:#A37C2E;">{total:.2f} &euro;</td></tr></table>')
        await send_email_safe(OWNER_EMAIL, f"Nouvelle commande ÉLANI #{ref}", _email_shell(inner))


async def _send_booking_emails(b: dict, client_email: str):
    try:
        d = datetime.fromisoformat(b["date"] + "T00:00:00").strftime("%d/%m/%Y")
    except Exception:
        d = b.get("date", "")
    detail = (f'<table width="100%" style="margin:22px 0;font-family:Arial,sans-serif;font-size:15px;color:#4A463F;">'
              f'<tr><td style="padding:8px 0;border-bottom:1px solid #E0DACD;">Date</td><td style="padding:8px 0;border-bottom:1px solid #E0DACD;text-align:right;color:#171311;">{d}</td></tr>'
              f'<tr><td style="padding:8px 0;border-bottom:1px solid #E0DACD;">Heure</td><td style="padding:8px 0;border-bottom:1px solid #E0DACD;text-align:right;color:#171311;">{b.get("time","")}</td></tr>'
              f'<tr><td style="padding:8px 0;border-bottom:1px solid #E0DACD;">Type souhaité</td><td style="padding:8px 0;border-bottom:1px solid #E0DACD;text-align:right;color:#171311;">{b.get("wig_type","")}</td></tr>'
              f'<tr><td style="padding:8px 0;">Budget</td><td style="padding:8px 0;text-align:right;color:#171311;">{b.get("budget","")}</td></tr></table>')
    if client_email:
        inner = (f'<h1 style="font-size:26px;font-weight:normal;margin:0 0 8px;">Votre consultation est confirmée</h1>'
                 f'<p style="color:#C49A45;font-size:22px;font-family:cursive;margin:0 0 18px;">À très bientôt, {b.get("name","").split(" ")[0]}</p>'
                 f'<p style="font-size:15px;color:#4A463F;font-family:Arial,sans-serif;line-height:1.6;">Merci pour votre confiance. Voici le récapitulatif de votre rendez-vous ÉLANI :</p>'
                 f'{detail}'
                 f'<p style="font-size:13px;color:#8a8378;font-family:Arial,sans-serif;">Notre équipe vous contactera pour finaliser les détails. Pour toute question, répondez à cet email.</p>')
        await send_email_safe(client_email, "Votre consultation ÉLANI est confirmée", _email_shell(inner), reply_to=OWNER_EMAIL)
    if OWNER_EMAIL:
        contact = f'{b.get("phone") or "—"} · {client_email or "email non fourni"}'
        inner = (f'<h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;">Nouvelle réservation &#128197;</h1>'
                 f'<p style="font-size:15px;color:#171311;font-family:Arial,sans-serif;"><strong>{b.get("name","")}</strong></p>'
                 f'<p style="font-size:14px;color:#4A463F;font-family:Arial,sans-serif;">{contact}</p>'
                 f'{detail}'
                 f'{("<p style=font-family:Arial,sans-serif;font-size:14px;color:#4A463F;>Message : " + b.get("message") + "</p>") if b.get("message") else ""}')
        await send_email_safe(OWNER_EMAIL, "Nouvelle réservation de consultation ÉLANI", _email_shell(inner))


async def _send_custom_order_emails(o: dict):
    rows = [
        ("Texture", o.get("texture", "")),
        ("Longueur", o.get("length", "")),
        ("Couleur", o.get("color", "")),
        ("Bonnet", o.get("cap_size", "") or "—"),
        ("Lace", o.get("lace_type", "") or "—"),
        ("Budget", o.get("budget", "")),
        ("Deadline", o.get("deadline", "") or "—"),
    ]
    detail = '<table width="100%" style="margin:22px 0;font-family:Arial,sans-serif;font-size:15px;color:#4A463F;">'
    for k, v in rows:
        detail += (f'<tr><td style="padding:8px 0;border-bottom:1px solid #E0DACD;">{k}</td>'
                   f'<td style="padding:8px 0;border-bottom:1px solid #E0DACD;text-align:right;color:#171311;">{v}</td></tr>')
    detail += "</table>"
    style_note = ""
    if o.get("style"):
        style_note = (f'<p style="font-family:Arial,sans-serif;font-size:14px;color:#4A463F;line-height:1.6;">'
                      f'<strong style="color:#171311;">Style / inspiration :</strong> {o.get("style")}</p>')
    extra = ""
    if o.get("message"):
        extra = (f'<p style="font-family:Arial,sans-serif;font-size:14px;color:#4A463F;line-height:1.6;">'
                 f'<strong style="color:#171311;">Message :</strong> {o.get("message")}</p>')
    if o.get("email"):
        inner = (f'<h1 style="font-size:26px;font-weight:normal;margin:0 0 8px;">Votre projet sur mesure est reçu</h1>'
                 f'<p style="color:#C49A45;font-size:22px;font-family:cursive;margin:0 0 18px;">Merci, {o.get("name","").split(" ")[0]}</p>'
                 f'<p style="font-size:15px;color:#4A463F;font-family:Arial,sans-serif;line-height:1.6;">'
                 f'Notre équipe ÉLANI va étudier votre brief avec soin et vous répondra sous 48h avec un devis personnalisé.'
                 f'</p>{detail}{style_note}{extra}'
                 f'<p style="font-size:13px;color:#8a8378;font-family:Arial,sans-serif;">Pour toute question, répondez à cet email.</p>')
        await send_email_safe(o["email"], "Votre projet sur mesure ÉLANI", _email_shell(inner), reply_to=OWNER_EMAIL)
    if OWNER_EMAIL:
        contact = f'{o.get("phone") or "—"} · {o.get("email") or "—"}'
        inner = (f'<h1 style="font-size:24px;font-weight:normal;margin:0 0 16px;">Nouvelle perruque sur mesure &#128142;</h1>'
                 f'<p style="font-size:15px;color:#171311;font-family:Arial,sans-serif;"><strong>{o.get("name","")}</strong></p>'
                 f'<p style="font-size:14px;color:#4A463F;font-family:Arial,sans-serif;">{contact}</p>'
                 f'{detail}{style_note}{extra}')
        await send_email_safe(OWNER_EMAIL, f'Sur mesure — {o.get("name","")} · {o.get("budget","")}', _email_shell(inner))


WELCOME_CODE = "BIENVENUE10"

async def _send_welcome_email(user: dict):
    """Send a one-time welcome email with a 10% promo code."""
    if not user.get("email"):
        return
    first = (user.get("name") or user["email"].split("@")[0]).split(" ")[0]
    inner = (f'<h1 style="font-size:26px;font-weight:normal;margin:0 0 8px;">Bienvenue chez ÉLANI</h1>'
             f'<p style="color:#C49A45;font-size:22px;font-family:cursive;margin:0 0 22px;">L\'élégance commence ici, {first}.</p>'
             f'<p style="font-size:15px;color:#4A463F;font-family:Arial,sans-serif;line-height:1.6;">'
             f'Nous sommes ravis de vous accueillir dans notre cercle. Pour célébrer votre arrivée, profitez de '
             f'<strong style="color:#171311;">−10%</strong> sur votre première commande avec le code&nbsp;:</p>'
             f'<div style="text-align:center;margin:26px 0;">'
             f'<div style="display:inline-block;border:2px dashed #C49A45;padding:16px 40px;font-family:monospace;'
             f'font-size:24px;letter-spacing:6px;color:#A37C2E;background:#F4F3ED;">{WELCOME_CODE}</div></div>'
             f'<p style="font-size:14px;color:#4A463F;font-family:Arial,sans-serif;line-height:1.6;">'
             f'Explorez nos cheveux bruts, nos coffrets signature et confectionnez la pièce qui vous ressemble. '
             f'À très vite dans votre atelier ÉLANI 💛</p>'
             f'<p style="font-size:12px;color:#8a8378;font-family:Arial,sans-serif;margin-top:22px;">'
             f'Code valable une fois par cliente, sur toute la boutique.</p>')
    await send_email_safe(user["email"], "Bienvenue chez ÉLANI — votre code −10%", _email_shell(inner))


async def _lookup_session(session_token: str):
    sess = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not sess:
        return None
    exp = sess["expires_at"]
    if isinstance(exp, str):
        exp = datetime.fromisoformat(exp)
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < datetime.now(timezone.utc):
        return None
    return await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})


async def get_current_user(request: Request) -> dict:
    # Prefer Authorization Bearer (Bearer-only design), fallback to cookies
    token = None
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
    if not token:
        token = request.cookies.get("access_token") or request.cookies.get("session_token")
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    # Try JWT (email/password) first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        u = await db.users.find_one({"user_id": payload["sub"]}, {"_id": 0})
        if u:
            return u
    except jwt.InvalidTokenError:
        pass
    # Fallback: Emergent Google session token
    u = await _lookup_session(token)
    if u:
        return u
    raise HTTPException(status_code=401, detail="Session invalide ou expirée")


async def get_admin_user(request: Request) -> dict:
    u = await get_current_user(request)
    if u.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès administrateur requis")
    return u


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class ProductInput(BaseModel):
    name: str
    description: str
    price: float
    category: str
    length: Optional[str] = ""
    texture: Optional[str] = ""
    color: Optional[str] = ""
    origin: Optional[str] = ""
    stock: int = 0
    featured: bool = False
    images: List[str] = []

class CartItem(BaseModel):
    product_id: str
    quantity: int = Field(ge=1, le=50)
    inches: Optional[int] = None
    texture: Optional[str] = None  # for HD closure: "straight" | "body_wave"

class CheckoutInput(BaseModel):
    items: List[CartItem]
    origin_url: str
    promo_code: Optional[str] = ""

class PromoCodeInput(BaseModel):
    code: str
    discount_type: str  # "percentage" | "fixed"
    value: float = Field(gt=0)
    expires_at: Optional[str] = ""   # ISO date "YYYY-MM-DD" or empty
    max_uses: int = 0                # 0 = unlimited
    active: bool = True

class PromoValidateInput(BaseModel):
    code: str
    subtotal: float = Field(ge=0)

class ReviewInput(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: str = Field(min_length=3, max_length=1500)

class ReviewStatusInput(BaseModel):
    status: str  # "approved" | "rejected" | "pending"

class CustomOrderInput(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = ""
    texture: str
    length: str
    color: str
    cap_size: Optional[str] = ""
    lace_type: Optional[str] = ""       # None / Closure / Frontal HD / Full Lace
    style: Optional[str] = ""           # style/inspiration details
    budget: str
    deadline: Optional[str] = ""
    message: Optional[str] = ""


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(inp: RegisterInput, response: Response):
    email = inp.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé")
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    doc = {"user_id": user_id, "email": email, "name": inp.name,
           "password_hash": hash_password(inp.password), "role": "customer",
           "picture": "", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(doc)
    try:
        await _send_welcome_email(doc)
    except Exception as e:
        logger.error(f"Welcome email error: {e}")
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return {"user": public_user(doc), "token": token}

@api_router.post("/auth/login")
async def login(inp: LoginInput, response: Response):
    email = inp.email.lower()
    u = await db.users.find_one({"email": email})
    if not u or not u.get("password_hash") or not verify_password(inp.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect")
    token = create_access_token(u["user_id"], email)
    set_auth_cookie(response, token)
    return {"user": public_user(u), "token": token}

@api_router.post("/auth/session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID manquant")
    req = urllib.request.Request(
        "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
        headers={"X-Session-ID": session_id})
    try:
        with urllib.request.urlopen(req) as r:
            data = json.load(r)
    except Exception:
        raise HTTPException(status_code=401, detail="Session Google invalide")
    email = data["email"].lower()
    u = await db.users.find_one({"email": email})
    is_new_user = False
    if not u:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        u = {"user_id": user_id, "email": email, "name": data.get("name", ""),
             "picture": data.get("picture", ""), "role": "customer",
             "created_at": datetime.now(timezone.utc).isoformat()}
        await db.users.insert_one(u)
        is_new_user = True
    if is_new_user:
        try:
            await _send_welcome_email(u)
        except Exception as e:
            logger.error(f"Welcome email error: {e}")
    session_token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": u["user_id"], "session_token": session_token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()})
    response.set_cookie(key="session_token", value=session_token, httponly=True,
                        secure=True, samesite="none", max_age=604800, path="/")
    return {"user": public_user(u), "token": session_token}

@api_router.get("/auth/me")
async def me(request: Request):
    u = await get_current_user(request)
    return public_user(u)

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    st = request.cookies.get("session_token")
    if st:
        await db.user_sessions.delete_one({"session_token": st})
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


# ---------------------------------------------------------------------------
# Product routes
# ---------------------------------------------------------------------------
async def _attach_ratings(products: list) -> list:
    if not products:
        return products
    pipeline = [
        {"$match": {"status": "approved", "product_id": {"$in": [p["id"] for p in products]}}},
        {"$group": {"_id": "$product_id", "avg": {"$avg": "$rating"}, "count": {"$sum": 1}}},
    ]
    stats = {r["_id"]: r async for r in db.reviews.aggregate(pipeline)}
    for p in products:
        s = stats.get(p["id"])
        p["avg_rating"] = round(s["avg"], 2) if s else 0
        p["review_count"] = s["count"] if s else 0
        p["length_options"] = _length_options(p)
    return products


@api_router.get("/config")
async def public_config():
    return {
        "shipping_fee": SHIPPING_FEE,
        "length_inches": LENGTH_INCHES,
        "paypal_client_id": PAYPAL_CLIENT_ID if PAYPAL_ENABLED else "",
        "paypal_mode": PAYPAL_MODE,
    }


@api_router.get("/products")
async def list_products(category: Optional[str] = None, featured: Optional[bool] = None):
    q = {}
    if category:
        q["category"] = category
    if featured is not None:
        q["featured"] = featured
    items = await db.products.find(q, {"_id": 0}).sort("created_at", -1).to_list(200)
    return await _attach_ratings(items)

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    await _attach_ratings([p])
    return p

@api_router.post("/products")
async def create_product(inp: ProductInput, admin=Depends(get_admin_user)):
    doc = inp.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.products.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.put("/products/{product_id}")
async def update_product(product_id: str, inp: ProductInput, admin=Depends(get_admin_user)):
    res = await db.products.update_one({"id": product_id}, {"$set": inp.model_dump()})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    return p

@api_router.delete("/products/{product_id}")
async def delete_product(product_id: str, admin=Depends(get_admin_user)):
    await db.products.delete_one({"id": product_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Length variants & shipping
# ---------------------------------------------------------------------------
SHIPPING_FEE = 6.99
LENGTH_INCHES = [10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 34, 36]
LENGTH_CM = {10: 25, 12: 30, 14: 35, 16: 40, 18: 45, 20: 50, 22: 55, 24: 60,
             26: 65, 28: 70, 30: 75, 34: 80, 36: 90}

# Fixed price grid (EUR) — Straight / Body Wave / Wavy (Burmese) columns.
PRICE_GRID = {
    "straight":  {10: 80,  12: 90,  14: 100, 16: 110, 18: 120, 20: 130, 22: 140,
                  24: 150, 26: 160, 28: 170, 30: 180, 34: 200, 36: 210},
    "body_wave": {10: 85,  12: 95,  14: 105, 16: 115, 18: 125, 20: 135, 22: 145,
                  24: 155, 26: 165, 28: 175, 30: 185, 34: 205, 36: 215},
    "wavy":      {10: 90,  12: 100, 14: 110, 16: 120, 18: 130, 20: 140, 22: 150,
                  24: 160, 26: 170, 28: 180, 30: 190, 34: 200, 36: 220},
}

def _texture_category(texture: str) -> str:
    t = (texture or "").lower()
    if "body" in t:
        return "body_wave"
    if "wavy" in t or "burmese" in t:
        return "wavy"
    # straight, deep wave, deep curl, loose wave, straight, curly bob → straight column
    return "straight"

def _parse_base_inches(product: dict) -> int:
    """Extract the integer inches from a length string like '18 pouces'."""
    import re
    txt = str(product.get("length", ""))
    m = re.search(r"(\d+)", txt)
    if m:
        try:
            n = int(m.group(1))
            if 8 <= n <= 40:
                return n
        except ValueError:
            pass
    return 18

def _price_for_inches(product: dict, inches: int, texture_key: Optional[str] = None) -> float:
    # Accessories always use base price
    if product.get("category") == "Accessoires" or product.get("is_accessory"):
        return float(product.get("price", 0))
    # HD Closure grid
    ck = product.get("closure_type")
    if ck and ck in CLOSURE_PRICES:
        tk = texture_key if texture_key in ("straight", "body_wave") else "straight"
        grid = CLOSURE_PRICES[ck][tk]
        if inches in grid:
            return float(grid[inches])
        # Beyond 20" for closures → sur commande, fallback to base
        return float(product.get("price", 0))
    # Extensions default grid
    cat = _texture_category(product.get("texture", ""))
    grid = PRICE_GRID[cat]
    if inches in grid:
        return float(grid[inches])
    return float(product.get("price", 0))

def _length_options(product: dict) -> list:
    # Accessories don't have length variants
    if product.get("category") == "Accessoires" or product.get("is_accessory"):
        return []
    # HD Closure products: fixed 10-20" grid per texture from the price table
    ck = product.get("closure_type")
    if ck and ck in CLOSURE_PRICES:
        grid = CLOSURE_PRICES[ck]
        opts = []
        for texture_key in ("straight", "body_wave"):
            texture_label = "Straight (lisse)" if texture_key == "straight" else "Body Wave (ondulé)"
            for n in [10, 12, 14, 16, 18, 20]:
                cm = LENGTH_CM.get(n)
                opts.append({
                    "inches": n, "cm": cm,
                    "label": f"{n} pouces" + (f" ({cm} cm)" if cm else ""),
                    "texture": texture_key, "texture_label": texture_label,
                    "price": float(grid[texture_key][n]),
                })
        return opts
    # Default extensions: full 10-36" grid, texture inferred from product.texture
    cat = _texture_category(product.get("texture", ""))
    grid = PRICE_GRID[cat]
    opts = []
    for n in LENGTH_INCHES:
        cm = LENGTH_CM.get(n)
        opts.append({
            "inches": n, "cm": cm,
            "label": f"{n} pouces" + (f" ({cm} cm)" if cm else ""),
            "price": float(grid[n]),
        })
    return opts


# HD Closure price grid (matches the tableau des prix from the user's brief)
CLOSURE_PRICES = {
    "closure_5x5":  {"straight": {10:50, 12:60, 14:70, 16:80, 18:90, 20:100},
                     "body_wave": {10:55, 12:65, 14:75, 16:85, 18:95, 20:105}},
    "closure_6x6":  {"straight": {10:70, 12:80, 14:90, 16:100, 18:110, 20:120},
                     "body_wave": {10:75, 12:85, 14:95, 16:105, 18:115, 20:125}},
    "frontal_13x6": {"straight": {10:120, 12:130, 14:140, 16:150, 18:160, 20:170},
                     "body_wave": {10:125, 12:135, 14:145, 16:155, 18:165, 20:175}},
}


# ---------------------------------------------------------------------------
# Promo codes helpers
# ---------------------------------------------------------------------------
async def _validate_promo(code: str, subtotal: float) -> Optional[dict]:
    """Return promo dict + computed discount amount, or None if invalid."""
    if not code:
        return None
    promo = await db.promo_codes.find_one({"code": code.strip().upper(), "active": True}, {"_id": 0})
    if not promo:
        return None
    # expiry
    exp = promo.get("expires_at") or ""
    if exp:
        try:
            if datetime.fromisoformat(exp) < datetime.now(timezone.utc).replace(tzinfo=None) \
                    and datetime.fromisoformat(exp).date() < datetime.now(timezone.utc).date():
                return None
        except Exception:
            try:
                if datetime.strptime(exp, "%Y-%m-%d").date() < datetime.now(timezone.utc).date():
                    return None
            except Exception:
                pass
    # usage limit
    if promo.get("max_uses", 0) and promo.get("uses", 0) >= promo["max_uses"]:
        return None
    # compute discount
    if promo["discount_type"] == "percentage":
        discount = round(subtotal * float(promo["value"]) / 100.0, 2)
    else:
        discount = float(promo["value"])
    if discount > subtotal:
        discount = subtotal
    return {"promo": promo, "discount": round(discount, 2)}


# ---------------------------------------------------------------------------
# Checkout / Orders
# ---------------------------------------------------------------------------
@api_router.post("/payments/checkout")
async def create_checkout(inp: CheckoutInput, request: Request):
    # user is optional (guest checkout allowed)
    user_id = None
    try:
        u = await get_current_user(request)
        user_id = u["user_id"]
    except HTTPException:
        pass

    line_items = []
    order_items = []
    total = 0.0
    # Batch-fetch all products in one query
    ids = list({item.product_id for item in inp.items})
    products_map = {p["id"]: p async for p in db.products.find({"id": {"$in": ids}}, {"_id": 0})}
    for item in inp.items:
        p = products_map.get(item.product_id)
        if not p:
            raise HTTPException(status_code=400, detail=f"Produit introuvable: {item.product_id}")
        if p.get("stock", 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuffisant pour {p['name']}")
        # Determine unit price based on selected length & texture (if any)
        base_inches = _parse_base_inches(p)
        chosen_inches = item.inches if item.inches in LENGTH_INCHES else base_inches
        unit_price = _price_for_inches(p, chosen_inches, item.texture)
        texture_suffix = ""
        if p.get("closure_type") and item.texture:
            texture_suffix = " · " + ("Straight" if item.texture == "straight" else "Body Wave")
        line_name = f"{p['name']} — {chosen_inches} pouces{texture_suffix}"
        amount_cents = int(round(unit_price * 100))
        line_items.append({
            "price_data": {
                "currency": "eur",
                "unit_amount": amount_cents,
                "product_data": {"name": line_name},
            },
            "quantity": item.quantity,
        })
        total += unit_price * item.quantity
        order_items.append({"product_id": p["id"], "name": line_name,
                            "price": unit_price, "quantity": item.quantity,
                            "inches": chosen_inches, "texture": item.texture or ""})

    # Shipping fee (flat rate)
    line_items.append({
        "price_data": {
            "currency": "eur",
            "unit_amount": int(round(SHIPPING_FEE * 100)),
            "product_data": {"name": "Livraison"},
        },
        "quantity": 1,
    })

    session_kwargs = dict(
        line_items=line_items,
        mode="payment",
        success_url=f"{inp.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{inp.origin_url}/panier",
        metadata={"user_id": user_id or "", "promo_code": ""},
    )

    # Apply promo code (Stripe coupon) if valid
    applied_promo = None
    discount_amount = 0.0
    if inp.promo_code:
        valid = await _validate_promo(inp.promo_code, total)
        if not valid:
            raise HTTPException(status_code=400, detail="Code promo invalide ou expiré")
        promo = valid["promo"]
        discount_amount = valid["discount"]
        try:
            if promo["discount_type"] == "percentage":
                coupon = stripe.Coupon.create(
                    percent_off=float(promo["value"]),
                    duration="once",
                    name=f"ELANI {promo['code']}",
                )
            else:
                coupon = stripe.Coupon.create(
                    amount_off=int(round(float(promo["value"]) * 100)),
                    currency="eur",
                    duration="once",
                    name=f"ELANI {promo['code']}",
                )
            session_kwargs["discounts"] = [{"coupon": coupon.id}]
            session_kwargs["metadata"]["promo_code"] = promo["code"]
            applied_promo = promo["code"]
        except stripe.error.StripeError as e:
            logger.error(f"Stripe coupon error: {e}")

    session = stripe.checkout.Session.create(**session_kwargs)
    now = datetime.now(timezone.utc).isoformat()
    order_total = round(max(total - discount_amount, 0) + SHIPPING_FEE, 2)
    await db.payment_transactions.insert_one({
        "session_id": session.id, "user_id": user_id, "amount": order_total,
        "currency": "eur", "status": "initiated", "payment_status": "pending",
        "created_at": now, "updated_at": now})
    await db.orders.insert_one({
        "id": str(uuid.uuid4()), "session_id": session.id, "user_id": user_id,
        "items": order_items, "subtotal": total, "discount": discount_amount,
        "shipping": SHIPPING_FEE, "promo_code": applied_promo or "",
        "total": order_total, "status": "pending",
        "payment_status": "pending", "created_at": now})
    return {"checkout_url": session.url, "session_id": session.id,
            "discount": discount_amount, "shipping": SHIPPING_FEE, "total": order_total}


# ---------------------------------------------------------------------------
# PayPal Checkout
# ---------------------------------------------------------------------------
async def _paypal_access_token() -> str:
    if not PAYPAL_ENABLED:
        raise HTTPException(status_code=503, detail="PayPal non configuré")
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{PAYPAL_BASE}/v1/oauth2/token",
            auth=(PAYPAL_CLIENT_ID, PAYPAL_SECRET),
            headers={"Accept": "application/json", "Accept-Language": "en_US"},
            data={"grant_type": "client_credentials"},
        )
        if r.status_code != 200:
            logger.error(f"PayPal token error: {r.status_code} {r.text}")
            raise HTTPException(status_code=502, detail="PayPal auth failed")
        return r.json()["access_token"]


async def _cart_totals(items: List[CartItem], promo_code: str, user_id: Optional[str]):
    """Compute server-side totals shared by Stripe & PayPal (never trust client amount)."""
    ids = list({i.product_id for i in items})
    products_map = {p["id"]: p async for p in db.products.find({"id": {"$in": ids}}, {"_id": 0})}
    order_items = []
    subtotal = 0.0
    for item in items:
        p = products_map.get(item.product_id)
        if not p:
            raise HTTPException(status_code=400, detail=f"Produit introuvable: {item.product_id}")
        if p.get("stock", 0) < item.quantity:
            raise HTTPException(status_code=400, detail=f"Stock insuffisant pour {p['name']}")
        base_inches = _parse_base_inches(p)
        chosen = item.inches if item.inches in LENGTH_INCHES else base_inches
        unit = _price_for_inches(p, chosen, item.texture)
        texture_suffix = ""
        if p.get("closure_type") and item.texture:
            texture_suffix = " · " + ("Straight" if item.texture == "straight" else "Body Wave")
        line_name = f"{p['name']} — {chosen} pouces{texture_suffix}" if not p.get("is_accessory") else p["name"]
        subtotal += unit * item.quantity
        order_items.append({"product_id": p["id"], "name": line_name,
                            "price": unit, "quantity": item.quantity,
                            "inches": chosen, "texture": item.texture or ""})
    discount = 0.0
    applied_code = ""
    if promo_code:
        v = await _validate_promo(promo_code, subtotal)
        if not v:
            raise HTTPException(status_code=400, detail="Code promo invalide ou expiré")
        discount = v["discount"]
        applied_code = v["promo"]["code"]
    total = round(max(subtotal - discount, 0) + SHIPPING_FEE, 2)
    return {"subtotal": round(subtotal, 2), "discount": round(discount, 2),
            "shipping": SHIPPING_FEE, "total": total, "items": order_items,
            "promo_code": applied_code}


@api_router.post("/paypal/create-order")
async def paypal_create_order(inp: CheckoutInput, request: Request):
    user_id = None
    try:
        u = await get_current_user(request)
        user_id = u["user_id"]
    except Exception:
        pass
    if not PAYPAL_ENABLED:
        raise HTTPException(status_code=503, detail="PayPal non configuré")
    totals = await _cart_totals(inp.items, inp.promo_code or "", user_id)

    token = await _paypal_access_token()
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{PAYPAL_BASE}/v2/checkout/orders",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
            json={
                "intent": "CAPTURE",
                "purchase_units": [{
                    "reference_id": "elani",
                    "description": "Commande ÉLANI Raw Hair",
                    "amount": {
                        "currency_code": "EUR",
                        "value": f"{totals['total']:.2f}",
                        "breakdown": {
                            "item_total": {"currency_code": "EUR", "value": f"{totals['subtotal']:.2f}"},
                            "shipping": {"currency_code": "EUR", "value": f"{totals['shipping']:.2f}"},
                            "discount": {"currency_code": "EUR", "value": f"{totals['discount']:.2f}"},
                        },
                    },
                    "items": [{
                        "name": it["name"][:127],
                        "quantity": str(it["quantity"]),
                        "unit_amount": {"currency_code": "EUR", "value": f"{it['price']:.2f}"},
                    } for it in totals["items"]],
                }],
                "application_context": {
                    "brand_name": "ÉLANI Raw Hair",
                    "user_action": "PAY_NOW",
                    "shipping_preference": "GET_FROM_FILE",
                },
            },
        )
        if r.status_code not in (200, 201):
            logger.error(f"PayPal create order error: {r.status_code} {r.text}")
            raise HTTPException(status_code=502, detail="PayPal order creation failed")
        pp_order = r.json()

    now = datetime.now(timezone.utc).isoformat()
    internal_id = str(uuid.uuid4())
    await db.orders.insert_one({
        "id": internal_id, "session_id": f"pp_{pp_order['id']}", "paypal_order_id": pp_order["id"],
        "provider": "paypal", "user_id": user_id, "items": totals["items"],
        "subtotal": totals["subtotal"], "discount": totals["discount"],
        "shipping": totals["shipping"], "promo_code": totals["promo_code"],
        "total": totals["total"], "status": "pending",
        "payment_status": "pending", "created_at": now,
    })
    return {"id": pp_order["id"], "total": totals["total"],
            "discount": totals["discount"], "shipping": totals["shipping"]}


@api_router.post("/paypal/capture-order/{paypal_order_id}")
async def paypal_capture_order(paypal_order_id: str):
    if not PAYPAL_ENABLED:
        raise HTTPException(status_code=503, detail="PayPal non configuré")
    token = await _paypal_access_token()
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{PAYPAL_BASE}/v2/checkout/orders/{paypal_order_id}/capture",
            headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
            json={},
        )
        if r.status_code not in (200, 201):
            logger.error(f"PayPal capture error: {r.status_code} {r.text}")
            raise HTTPException(status_code=502, detail="PayPal capture failed")
        capture = r.json()

    if capture.get("status") == "COMPLETED":
        session_id = f"pp_{paypal_order_id}"
        await _fulfill_order(session_id)
    return {"status": capture.get("status"), "paypal_order_id": paypal_order_id}


async def _fulfill_order(session_id: str):
    order = await db.orders.find_one({"session_id": session_id}, {"_id": 0})
    if not order or order.get("payment_status") == "paid":
        return
    for it in order.get("items", []):
        await db.products.update_one({"id": it["product_id"]},
                                     {"$inc": {"stock": -it["quantity"]}})
    res = await db.orders.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": {"status": "confirmed", "payment_status": "paid"}})
    if res.modified_count == 1:
        # increment promo usage if present
        if order.get("promo_code"):
            await db.promo_codes.update_one(
                {"code": order["promo_code"]}, {"$inc": {"uses": 1}})
        try:
            await _send_order_emails(session_id, order)
        except Exception as e:
            logger.error(f"Order email error: {e}")


@api_router.get("/payments/status/{session_id}")
async def payment_status(session_id: str):
    record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    if record.get("payment_status") != "paid":
        try:
            s = stripe.checkout.Session.retrieve(session_id)
            if s.payment_status == "paid" or s.status == "complete":
                await db.payment_transactions.update_one(
                    {"session_id": session_id, "payment_status": {"$ne": "paid"}},
                    {"$set": {"status": "completed", "payment_status": "paid",
                              "updated_at": datetime.now(timezone.utc).isoformat()}})
                await _fulfill_order(session_id)
                record = await db.payment_transactions.find_one({"session_id": session_id}, {"_id": 0})
        except stripe.error.StripeError:
            pass
    return {"session_id": record["session_id"], "status": record["status"],
            "payment_status": record["payment_status"]}


@api_router.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Signature invalide")
    obj, t = event["data"]["object"], event["type"]
    if t == "checkout.session.completed":
        await db.payment_transactions.update_one(
            {"session_id": obj["id"], "payment_status": {"$ne": "paid"}},
            {"$set": {"status": "completed", "payment_status": obj.get("payment_status", "paid"),
                      "updated_at": datetime.now(timezone.utc).isoformat()}})
        await _fulfill_order(obj["id"])
    return {"status": "ok"}


@api_router.get("/orders/my")
async def my_orders(request: Request):
    u = await get_current_user(request)
    orders = await db.orders.find({"user_id": u["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@api_router.get("/orders")
async def all_orders(admin=Depends(get_admin_user)):
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

@api_router.put("/orders/{order_id}/status")
async def update_order_status(order_id: str, body: dict, admin=Depends(get_admin_user)):
    status = body.get("status")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": status}})
    return {"ok": True}

@api_router.get("/admin/stats")
async def admin_stats(admin=Depends(get_admin_user)):
    total_products = await db.products.count_documents({})
    total_orders = await db.orders.count_documents({})
    # Use MongoDB aggregation for revenue (no fetch of full docs)
    revenue = 0.0
    async for r in db.orders.aggregate([
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "sum": {"$sum": "$total"}}},
    ]):
        revenue = r.get("sum", 0.0)
    low_stock = await db.products.count_documents({"stock": {"$lt": 5}})
    consultations = await db.consultations.count_documents({})
    return {"total_products": total_products, "total_orders": total_orders,
            "revenue": round(revenue, 2), "low_stock": low_stock,
            "consultations": consultations}


# ---------------------------------------------------------------------------
# Promo codes routes
# ---------------------------------------------------------------------------
@api_router.post("/admin/promo-codes")
async def create_promo(inp: PromoCodeInput, admin=Depends(get_admin_user)):
    if inp.discount_type not in ("percentage", "fixed"):
        raise HTTPException(status_code=400, detail="Type de réduction invalide")
    if inp.discount_type == "percentage" and inp.value > 100:
        raise HTTPException(status_code=400, detail="Le pourcentage ne peut dépasser 100")
    code = inp.code.strip().upper()
    if not code:
        raise HTTPException(status_code=400, detail="Code requis")
    if await db.promo_codes.find_one({"code": code}):
        raise HTTPException(status_code=400, detail="Ce code existe déjà")
    doc = {
        "id": str(uuid.uuid4()), "code": code, "discount_type": inp.discount_type,
        "value": float(inp.value), "expires_at": inp.expires_at or "",
        "max_uses": int(inp.max_uses), "uses": 0, "active": bool(inp.active),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.promo_codes.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api_router.get("/admin/promo-codes")
async def list_promos(admin=Depends(get_admin_user)):
    codes = await db.promo_codes.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return codes

@api_router.delete("/admin/promo-codes/{promo_id}")
async def delete_promo(promo_id: str, admin=Depends(get_admin_user)):
    await db.promo_codes.delete_one({"id": promo_id})
    return {"ok": True}

@api_router.put("/admin/promo-codes/{promo_id}")
async def toggle_promo(promo_id: str, body: dict, admin=Depends(get_admin_user)):
    await db.promo_codes.update_one({"id": promo_id}, {"$set": {"active": bool(body.get("active", True))}})
    return {"ok": True}

@api_router.post("/promo-codes/validate")
async def validate_promo_endpoint(inp: PromoValidateInput):
    valid = await _validate_promo(inp.code, inp.subtotal)
    if not valid:
        raise HTTPException(status_code=400, detail="Code promo invalide ou expiré")
    p = valid["promo"]
    return {"code": p["code"], "discount_type": p["discount_type"], "value": p["value"],
            "discount": valid["discount"]}

@api_router.get("/promo-codes/active")
async def active_promo_public():
    """Return the most recent active promo code (for banner)."""
    promo = await db.promo_codes.find_one(
        {"active": True}, {"_id": 0}, sort=[("created_at", -1)]
    )
    if not promo:
        return {"promo": None}
    # respect expiry & usage
    exp = promo.get("expires_at") or ""
    if exp:
        try:
            if datetime.strptime(exp, "%Y-%m-%d").date() < datetime.now(timezone.utc).date():
                return {"promo": None}
        except Exception:
            pass
    if promo.get("max_uses", 0) and promo.get("uses", 0) >= promo["max_uses"]:
        return {"promo": None}
    return {"promo": {"code": promo["code"], "discount_type": promo["discount_type"],
                     "value": promo["value"]}}


# ---------------------------------------------------------------------------
# Reviews routes
# ---------------------------------------------------------------------------
def _public_review(r: dict) -> dict:
    return {"id": r["id"], "product_id": r["product_id"], "user_name": r.get("user_name", ""),
            "rating": r["rating"], "comment": r["comment"], "verified": r.get("verified", False),
            "status": r.get("status", "pending"), "created_at": r.get("created_at", "")}

@api_router.get("/products/{product_id}/reviews")
async def product_reviews(product_id: str):
    reviews = await db.reviews.find(
        {"product_id": product_id, "status": "approved"}, {"_id": 0}
    ).sort("created_at", -1).to_list(200)
    if not reviews:
        return {"reviews": [], "average": 0, "count": 0}
    avg = sum(r["rating"] for r in reviews) / len(reviews)
    return {"reviews": [_public_review(r) for r in reviews],
            "average": round(avg, 2), "count": len(reviews)}

@api_router.post("/products/{product_id}/reviews")
async def create_review(product_id: str, inp: ReviewInput, request: Request):
    u = await get_current_user(request)
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Produit introuvable")
    # verified if user has a paid order containing product
    verified = False
    if await db.orders.find_one({"user_id": u["user_id"], "payment_status": "paid",
                                  "items.product_id": product_id}):
        verified = True
    # prevent multiple reviews per user per product
    existing = await db.reviews.find_one({"product_id": product_id, "user_id": u["user_id"]})
    if existing:
        raise HTTPException(status_code=400, detail="Vous avez déjà déposé un avis pour ce produit")
    doc = {
        "id": str(uuid.uuid4()), "product_id": product_id, "user_id": u["user_id"],
        "user_name": u.get("name") or u.get("email", "").split("@")[0],
        "rating": int(inp.rating), "comment": inp.comment.strip(),
        "verified": verified, "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.reviews.insert_one(doc)
    doc.pop("_id", None)
    return {"review": _public_review(doc)}

@api_router.get("/admin/reviews")
async def admin_reviews(admin=Depends(get_admin_user)):
    items = await db.reviews.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    # enrich with product name
    prods = {p["id"]: p["name"] for p in await db.products.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)}
    for r in items:
        r["product_name"] = prods.get(r["product_id"], "")
    return items

@api_router.put("/admin/reviews/{review_id}/status")
async def moderate_review(review_id: str, inp: ReviewStatusInput, admin=Depends(get_admin_user)):
    if inp.status not in ("approved", "rejected", "pending"):
        raise HTTPException(status_code=400, detail="Statut invalide")
    await db.reviews.update_one({"id": review_id}, {"$set": {"status": inp.status}})
    return {"ok": True}

@api_router.delete("/admin/reviews/{review_id}")
async def delete_review(review_id: str, admin=Depends(get_admin_user)):
    await db.reviews.delete_one({"id": review_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Custom orders (Perruque sur mesure)
# ---------------------------------------------------------------------------
@api_router.post("/custom-orders")
async def create_custom_order(inp: CustomOrderInput):
    doc = {
        "id": str(uuid.uuid4()),
        "name": inp.name.strip(), "email": inp.email.lower(), "phone": inp.phone or "",
        "texture": inp.texture, "length": inp.length, "color": inp.color,
        "cap_size": inp.cap_size or "", "lace_type": inp.lace_type or "",
        "style": inp.style or "", "budget": inp.budget,
        "deadline": inp.deadline or "", "message": inp.message or "",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.custom_orders.insert_one(doc)
    doc.pop("_id", None)
    # Fire-and-forget emails (client + owner)
    try:
        await _send_custom_order_emails(doc)
    except Exception as e:
        logger.error(f"Custom order email error: {e}")
    return {"order": doc}

@api_router.get("/admin/custom-orders")
async def list_custom_orders(admin=Depends(get_admin_user)):
    items = await db.custom_orders.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return items

@api_router.put("/admin/custom-orders/{order_id}/status")
async def update_custom_order_status(order_id: str, body: dict, admin=Depends(get_admin_user)):
    await db.custom_orders.update_one({"id": order_id}, {"$set": {"status": body.get("status")}})
    return {"ok": True}

@api_router.delete("/admin/custom-orders/{order_id}")
async def delete_custom_order(order_id: str, admin=Depends(get_admin_user)):
    await db.custom_orders.delete_one({"id": order_id})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Consultations (personalized appointments)
# ---------------------------------------------------------------------------
class SlotInput(BaseModel):
    date: str          # "YYYY-MM-DD"
    times: List[str]   # ["10:00", "14:30"]

class BookingInput(BaseModel):
    slot_id: str
    name: str
    wig_type: str
    budget: str
    phone: Optional[str] = ""
    email: Optional[str] = ""
    message: Optional[str] = ""

@api_router.get("/consultations/availability")
async def availability():
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    slots = await db.consultation_slots.find(
        {"is_booked": False, "date": {"$gte": today}}, {"_id": 0}
    ).sort([("date", 1), ("time", 1)]).to_list(500)
    return slots

@api_router.post("/consultations/slots")
async def create_slots(inp: SlotInput, admin=Depends(get_admin_user)):
    created = []
    for t in inp.times:
        exists = await db.consultation_slots.find_one({"date": inp.date, "time": t})
        if exists:
            continue
        doc = {"id": str(uuid.uuid4()), "date": inp.date, "time": t,
               "is_booked": False, "created_at": datetime.now(timezone.utc).isoformat()}
        await db.consultation_slots.insert_one(doc)
        doc.pop("_id", None)
        created.append(doc)
    return {"created": created}

@api_router.get("/consultations/slots")
async def all_slots(admin=Depends(get_admin_user)):
    slots = await db.consultation_slots.find({}, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(1000)
    return slots

@api_router.delete("/consultations/slots/{slot_id}")
async def delete_slot(slot_id: str, admin=Depends(get_admin_user)):
    await db.consultation_slots.delete_one({"id": slot_id})
    return {"ok": True}

@api_router.post("/consultations/book")
async def book_consultation(inp: BookingInput):
    # Atomically claim the slot only if it exists and is not already booked.
    slot = await db.consultation_slots.find_one_and_update(
        {"id": inp.slot_id, "is_booked": False},
        {"$set": {"is_booked": True}},
    )
    if not slot:
        existing = await db.consultation_slots.find_one({"id": inp.slot_id})
        if not existing:
            raise HTTPException(status_code=404, detail="Créneau introuvable")
        raise HTTPException(status_code=400, detail="Ce créneau vient d'être réservé. Veuillez en choisir un autre.")
    booking = {
        "id": str(uuid.uuid4()), "slot_id": inp.slot_id,
        "date": slot["date"], "time": slot["time"],
        "name": inp.name, "wig_type": inp.wig_type, "budget": inp.budget,
        "phone": inp.phone or "", "email": inp.email or "", "message": inp.message or "",
        "status": "pending", "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.consultations.insert_one(booking)
    booking.pop("_id", None)
    try:
        await _send_booking_emails(booking, inp.email or "")
    except Exception as e:
        logger.error(f"Booking email error: {e}")
    return {"booking": booking}

@api_router.get("/consultations")
async def list_consultations(admin=Depends(get_admin_user)):
    items = await db.consultations.find({}, {"_id": 0}).sort([("date", 1), ("time", 1)]).to_list(1000)
    return items

@api_router.put("/consultations/{booking_id}/status")
async def update_consultation_status(booking_id: str, body: dict, admin=Depends(get_admin_user)):
    await db.consultations.update_one({"id": booking_id}, {"$set": {"status": body.get("status")}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
SEED_PRODUCTS = [
    {"name": "Vague Riviera — Raw Wavy", "price": 189.0, "category": "The Riviera Wave",
     "length": "20 pouces", "texture": "Raw Wavy", "color": "Noir naturel", "origin": "Cheveux bruts 100% naturels",
     "stock": 14, "featured": True,
     "description": "La signature ÉLANI. Une mèche de cheveux bruts aux ondulations naturelles et voluptueuses, d'une brillance incomparable. Non transformés, doux et durables — pour une élégance qui dure.",
     "images": ["/products/riviera_wave.png", "/products/wavy_portrait.png"]},
    {"name": "Soie de Nice — Raw Straight", "price": 169.0, "category": "The Silk Collection",
     "length": "22 pouces", "texture": "Raw Straight", "color": "Noir naturel", "origin": "Cheveux bruts 100% naturels",
     "stock": 16, "featured": True,
     "description": "Le lisse absolu. Des cheveux bruts naturellement raides, soyeux et lumineux, pour un tombé parfait et une allure intemporelle. L'essence de la Silk Collection.",
     "images": ["/products/silk_straight.png", "/products/straight_back.png"]},
    {"name": "Cannes Deep Curl", "price": 209.0, "category": "The Riviera Wave",
     "length": "18 pouces", "texture": "Deep Curl", "color": "Noir naturel", "origin": "Cheveux bruts 100% naturels",
     "stock": 9, "featured": True,
     "description": "Des boucles profondes, définies et pleines de volume. Une texture spectaculaire qui capte la lumière et affirme le caractère.",
     "images": ["/products/deep_curl.png", "/products/riviera_wave.png"]},
    {"name": "Monaco Blonde Miel", "price": 249.0, "category": "The Silk Collection",
     "length": "22 pouces", "texture": "Raw Straight", "color": "Blond miel", "origin": "Cheveux bruts 100% naturels",
     "stock": 5, "featured": True,
     "description": "Un blond miel lumineux obtenu avec le plus grand soin, préservant l'intégrité de la fibre. Une pièce statement pour les femmes qui définissent l'élégance.",
     "images": ["/products/honey_blonde.png", "/products/silk_straight.png"]},
    {"name": "Longueur Infinie — Raw Straight", "price": 229.0, "category": "The Silk Collection",
     "length": "26 pouces", "texture": "Raw Straight", "color": "Noir naturel", "origin": "Cheveux bruts 100% naturels",
     "stock": 7, "featured": False,
     "description": "La longueur du rêve. Des cheveux bruts lisses tombant jusqu'aux reins, épais de la racine aux pointes, pour un effet couture saisissant.",
     "images": ["/products/straight_back.png", "/products/silk_straight.png"]},
    {"name": "Peigne Doré ÉLANI", "price": 29.0, "category": "Accessoires",
     "length": "", "texture": "", "color": "Or brossé", "origin": "Métal doré finition premium",
     "stock": 40, "featured": False, "is_accessory": True,
     "description": "Le peigne signature ÉLANI, finition or brossé, gravé de notre monogramme. Idéal pour démêler nos mèches en douceur et sublimer votre gestuelle beauté du quotidien.",
     "images": ["/products/elani_comb.png"]},
    {"name": "Écrin Signature ÉLANI", "price": 49.0, "category": "Accessoires",
     "length": "", "texture": "", "color": "Noir & or", "origin": "Cuir vegan · finition or",
     "stock": 30, "featured": False, "is_accessory": True,
     "description": "L'écrin ÉLANI — boîte de rangement luxe pour conserver vos mèches à l'abri de la lumière et de l'humidité. Idéal pour offrir, ou pour prolonger la durée de vie de votre chevelure.",
     "images": ["/products/elani_box.png"]},
    {"name": "Lace Closure HD 5×5", "price": 50.0, "category": "Closure HD",
     "length": "10 pouces", "texture": "Raw Straight", "color": "Noir naturel", "origin": "100% Raw Human Hair · HD Swiss Lace",
     "stock": 25, "featured": True, "closure_type": "closure_5x5",
     "description": "La signature ÉLANI en format 5×5 — l'essentiel pour une raie centrale ou latérale invisible. Tulle HD Swiss ultra-fin, cheveux bruts naturels 100% humains, disponible en Straight (lisse) et Body Wave (ondulé). Longueurs de 10 à 20 pouces — au-delà, pièces sur commande.",
     "images": ["/products/closure_5x5_worn.png", "/products/closure_5x5_product.png"]},
    {"name": "Lace Closure HD 6×6", "price": 70.0, "category": "Closure HD",
     "length": "10 pouces", "texture": "Raw Straight", "color": "Noir naturel", "origin": "100% Raw Human Hair · HD Swiss Lace",
     "stock": 20, "featured": True, "closure_type": "closure_6x6",
     "description": "La closure 6×6 ÉLANI — surface de parting plus généreuse pour une polyvalence stylistique totale. Tulle HD invisible, densité 150%, cheveux bruts 100% humains. Straight ou Body Wave, 10 à 20 pouces.",
     "images": ["/products/closure_6x6_worn.png", "/products/closure_6x6_product.png"]},
    {"name": "Lace Frontal HD 13×6", "price": 120.0, "category": "Closure HD",
     "length": "10 pouces", "texture": "Raw Straight", "color": "Noir naturel", "origin": "100% Raw Human Hair · HD Swiss Lace",
     "stock": 15, "featured": True, "closure_type": "frontal_13x6",
     "description": "Le frontal 13×6 ÉLANI — pièce d'exception ear-to-ear pour une ligne de front totalement modulable. Tulle HD Swiss ultra-fin, cheveux bruts 100% humains, effet cuir chevelu ultra-réaliste. Straight ou Body Wave, 10 à 20 pouces.",
     "images": ["/products/frontal_13x6_worn.png", "/products/frontal_13x6_product.png"]},
]


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id")
    await db.products.create_index("id")
    await db.orders.create_index("session_id")
    await db.reviews.create_index([("product_id", 1), ("user_id", 1)], unique=True)
    await db.reviews.create_index("status")
    await db.promo_codes.create_index("code", unique=True)
    # seed admin
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@example.com").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "user_id": f"user_{uuid.uuid4().hex[:12]}", "email": admin_email,
            "password_hash": hash_password(admin_password), "name": "Administratrice",
            "role": "admin", "picture": "", "created_at": datetime.now(timezone.utc).isoformat()})
    elif not verify_password(admin_password, existing.get("password_hash", "")):
        await db.users.update_one({"email": admin_email},
                                  {"$set": {"password_hash": hash_password(admin_password), "role": "admin"}})
    # seed products
    if await db.products.count_documents({}) == 0:
        for p in SEED_PRODUCTS:
            doc = dict(p)
            doc["id"] = str(uuid.uuid4())
            doc["created_at"] = datetime.now(timezone.utc).isoformat()
            await db.products.insert_one(doc)
        logger.info("Seeded %d products", len(SEED_PRODUCTS))


    # Migration: reprice products to match the new fixed grid at their base length
    mig = await db.migrations.find_one({"name": "price_grid_v1"})
    if not mig:
        prods = await db.products.find({}, {"_id": 0}).to_list(500)
        for p in prods:
            new_price = _price_for_inches(p, _parse_base_inches(p))
            if new_price and abs(new_price - float(p.get("price", 0))) > 0.5:
                await db.products.update_one({"id": p["id"]}, {"$set": {"price": new_price}})
        await db.migrations.insert_one({"name": "price_grid_v1",
                                        "at": datetime.now(timezone.utc).isoformat()})
        logger.info("Migration price_grid_v1 applied")

    # Migration: ensure accessories exist (Peigne + Écrin)
    mig2 = await db.migrations.find_one({"name": "seed_accessories_v1"})
    if not mig2:
        for p in SEED_PRODUCTS:
            if p.get("is_accessory") and not await db.products.find_one({"name": p["name"]}):
                doc = dict(p)
                doc["id"] = str(uuid.uuid4())
                doc["created_at"] = datetime.now(timezone.utc).isoformat()
                await db.products.insert_one(doc)
        await db.migrations.insert_one({"name": "seed_accessories_v1",
                                        "at": datetime.now(timezone.utc).isoformat()})
        logger.info("Migration seed_accessories_v1 applied")

    # Migration: seed HD Lace Closure collection
    mig3 = await db.migrations.find_one({"name": "seed_hd_closure_v1"})
    if not mig3:
        for p in SEED_PRODUCTS:
            if p.get("category") == "Closure HD" and not await db.products.find_one({"name": p["name"]}):
                doc = dict(p)
                doc["id"] = str(uuid.uuid4())
                doc["created_at"] = datetime.now(timezone.utc).isoformat()
                await db.products.insert_one(doc)
        await db.migrations.insert_one({"name": "seed_hd_closure_v1",
                                        "at": datetime.now(timezone.utc).isoformat()})
        logger.info("Migration seed_hd_closure_v1 applied")

    # Migration: replace old HD Lace Closure products with new 3-tier structure
    mig4 = await db.migrations.find_one({"name": "hd_closure_grid_v2"})
    if not mig4:
        await db.products.delete_many({"category": "Closure HD"})
        for p in SEED_PRODUCTS:
            if p.get("category") == "Closure HD":
                doc = dict(p)
                doc["id"] = str(uuid.uuid4())
                doc["created_at"] = datetime.now(timezone.utc).isoformat()
                await db.products.insert_one(doc)
        await db.migrations.insert_one({"name": "hd_closure_grid_v2",
                                        "at": datetime.now(timezone.utc).isoformat()})
        logger.info("Migration hd_closure_grid_v2 applied")

    # Migration: permanently remove discontinued products (Carré Éclat, Coffret Signature)
    mig5 = await db.migrations.find_one({"name": "remove_discontinued_v1"})
    if not mig5:
        res = await db.products.delete_many(
            {"name": {"$regex": "Carré Éclat|Coffret Signature", "$options": "i"}})
        await db.migrations.insert_one({"name": "remove_discontinued_v1",
                                        "at": datetime.now(timezone.utc).isoformat()})
        logger.info("Migration remove_discontinued_v1 applied (%d products removed)", res.deleted_count)

    # Migration: fix accessory images (Peigne = comb, Écrin = box)
    mig6 = await db.migrations.find_one({"name": "fix_accessory_images_v1"})
    if not mig6:
        await db.products.update_one({"name": "Peigne Doré ÉLANI"},
                                     {"$set": {"images": ["/products/elani_comb.png"]}})
        await db.products.update_one({"name": "Écrin Signature ÉLANI"},
                                     {"$set": {"images": ["/products/elani_box.png"]}})
        await db.migrations.insert_one({"name": "fix_accessory_images_v1",
                                        "at": datetime.now(timezone.utc).isoformat()})
        logger.info("Migration fix_accessory_images_v1 applied")

    # Migration: remove Vague Dorée (Body Wave wig) + dedupe Longueur Infinie and Closure 5×5
    mig7 = await db.migrations.find_one({"name": "dedupe_catalog_v1"})
    if not mig7:
        removed = 0
        res = await db.products.delete_many(
            {"name": {"$regex": "Vague Dorée|Perruque Body Wave", "$options": "i"}})
        removed += res.deleted_count
        for flt in ({"name": {"$regex": "Longueur Infinie", "$options": "i"}},
                    {"$or": [{"closure_type": "closure_5x5"},
                             {"name": {"$regex": "5\\s*[x×]\\s*5", "$options": "i"}}]}):
            dupes = await db.products.find(flt, {"_id": 0, "id": 1, "created_at": 1}).to_list(50)
            if len(dupes) > 1:
                dupes.sort(key=lambda d: d.get("created_at", ""), reverse=True)
                ids = [d["id"] for d in dupes[1:]]
                res = await db.products.delete_many({"id": {"$in": ids}})
                removed += res.deleted_count
        await db.migrations.insert_one({"name": "dedupe_catalog_v1",
                                        "at": datetime.now(timezone.utc).isoformat()})
        logger.info("Migration dedupe_catalog_v1 applied (%d products removed)", removed)

    # Ensure welcome promo code exists (percentage 10%)
    if not await db.promo_codes.find_one({"code": WELCOME_CODE}):
        await db.promo_codes.insert_one({
            "id": str(uuid.uuid4()), "code": WELCOME_CODE, "discount_type": "percentage",
            "value": 10.0, "expires_at": "", "max_uses": 0, "uses": 0, "active": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info(f"Seeded welcome promo {WELCOME_CODE}")


@app.on_event("shutdown")
async def shutdown():
    client.close()


@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"status": "ok", "service": "elani-raw-hair-api"}


app.include_router(api_router)

_cors_origins_env = os.environ.get("CORS_ORIGINS", "*")
_cors_origins = ["*"] if _cors_origins_env.strip() == "*" else [o.strip() for o in _cors_origins_env.split(",") if o.strip()]
_allow_credentials = False if _cors_origins == ["*"] else True

app.add_middleware(
    CORSMiddleware,
    allow_credentials=_allow_credentials,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, User, Menu, X, Crown, Heart } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";

const links = [
  { to: "/boutique", label: "Boutique" },
  { to: "/boutique?category=The Silk Collection", label: "Silk Collection" },
  { to: "/boutique?category=The Riviera Wave", label: "Riviera Wave" },
  { to: "/boutique?category=Closure%20HD", label: "Closure HD" },
  { to: "/sur-mesure", label: "Sur Mesure" },
  { to: "/histoire", label: "Notre Histoire" },
  { to: "/reservation", label: "Consultation" },
  { to: "/contact", label: "Contact" },
];

export default function Nav() {
  const { count, setOpen } = useCart();
  const { user } = useAuth();
  const { count: wcount } = useWishlist();
  const [scrolled, setScrolled] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [hasBanner, setHasBanner] = useState(false);
  const loc = useLocation();
  const onHome = loc.pathname === "/";

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 40);
    on();
    window.addEventListener("scroll", on);
    return () => window.removeEventListener("scroll", on);
  }, []);
  useEffect(() => { setMobile(false); }, [loc]);
  useEffect(() => {
    const check = () => setHasBanner(!!document.querySelector('[data-testid="announcement-bar"]'));
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, []);

  // On home hero (not scrolled) use light text over the photo; elsewhere dark on cream.
  const light = onHome && !scrolled;
  const txt = light ? "text-[#F4F3ED]" : "text-[#171311]";
  const sub = light ? "text-[#F4F3ED]/80" : "text-[#4A463F]";

  return (
    <header
      data-testid="main-nav"
      style={{ top: hasBanner ? "36px" : "0" }}
      className={`fixed left-0 right-0 z-50 transition-[background,top] duration-500 ${
        scrolled ? "bg-[#F4F3ED]/80 backdrop-blur-xl border-b border-[#171311]/10" : "bg-transparent"
      }`}
    >
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 h-20 flex items-center justify-between gap-6">
        <Link to="/" data-testid="logo-link" className={`flex items-center gap-3 shrink-0 ${txt}`}>
          <Crown size={24} strokeWidth={1.1} style={{ color: "#C49A45" }} fill="#C49A45" fillOpacity={0.18} />
          <span className="flex flex-col leading-none py-1">
            <span
              className="font-serif text-xl md:text-2xl tracking-[0.24em] pl-[0.24em]"
              style={{ fontWeight: 500 }}
            >
              ÉLANI
            </span>
            <span
              className="overline mt-1.5 hidden sm:block tracking-[0.4em]"
              style={{ fontSize: "8px", color: "#C49A45" }}
            >
              RAW HAIR
            </span>
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-9">
          {links.map((l) => (
            <Link key={l.label} to={l.to} data-testid={`nav-${l.label.toLowerCase().replace(/\s/g, "-")}`}
              className={`overline ${sub} hover-gold link-underline`}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-6">
          <Link to="/compte#wishlist" data-testid="wishlist-link" className={`relative ${txt} hover-gold hidden sm:block`} title="Mes favoris">
            <Heart strokeWidth={1.2} size={20} />
            {wcount > 0 && (
              <span data-testid="wishlist-count" className="absolute -top-2 -right-2 bg-[#C49A45] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
                {wcount}
              </span>
            )}
          </Link>
          <Link to={user ? "/compte" : "/auth"} data-testid="account-link" className={`${txt} hover-gold hidden sm:block`}>
            <User strokeWidth={1.2} size={20} />
          </Link>
          <button data-testid="cart-toggle" onClick={() => setOpen(true)} className={`relative ${txt} hover-gold`}>
            <ShoppingBag strokeWidth={1.2} size={20} />
            {count > 0 && (
              <span data-testid="cart-count" className="absolute -top-2 -right-2 bg-[#C49A45] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-medium">
                {count}
              </span>
            )}
          </button>
          <button data-testid="mobile-menu-toggle" className={`lg:hidden ${txt}`} onClick={() => setMobile(!mobile)}>
            {mobile ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobile && (
        <div className="lg:hidden bg-[#F4F3ED]/97 backdrop-blur-xl border-t border-[#171311]/10 px-6 py-8 flex flex-col gap-5">
          {links.map((l) => (
            <Link key={l.label} to={l.to} className="font-serif text-2xl text-[#171311]">{l.label}</Link>
          ))}
          <Link to={user ? "/compte" : "/auth"} className="font-serif text-2xl text-[#A37C2E]">
            {user ? "Mon compte" : "Connexion"}
          </Link>
        </div>
      )}
    </header>
  );
}

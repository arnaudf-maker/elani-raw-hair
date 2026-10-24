import React, { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import Lenis from "lenis";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { WishlistProvider } from "./context/WishlistContext";
import { api } from "./lib/api";
import Nav from "./components/Nav";
import Footer from "./components/Footer";
import CartDrawer from "./components/CartDrawer";
import WhatsAppFab from "./components/WhatsAppFab";
import AnnouncementBar from "./components/AnnouncementBar";
import Home from "./pages/Home";
import Boutique from "./pages/Boutique";
import ProductDetail from "./pages/ProductDetail";
import Histoire from "./pages/Histoire";
import Auth from "./pages/Auth";
import Compte from "./pages/Compte";
import PaymentSuccess from "./pages/PaymentSuccess";
import Contact from "./pages/Contact";
import Reservation from "./pages/Reservation";
import SurMesure from "./pages/SurMesure";
import Admin from "./pages/Admin";
import "./App.css";

function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    let raf;
    const loop = (t) => { lenis.raf(t); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); lenis.destroy(); };
  }, []);
  return null;
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
function AuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const hash = window.location.hash;
    const sid = new URLSearchParams(hash.replace("#", "")).get("session_id");
    (async () => {
      let ok = false;
      let target = "/compte";
      try {
        const { data } = await api.post("/auth/session", {}, { headers: { "X-Session-ID": sid } });
        login(data);
        ok = true;
        if (data.user?.role === "admin") target = "/admin";
      } catch { /* noop */ }
      window.history.replaceState(null, "", window.location.pathname);
      navigate(ok ? target : "/auth?error=session");
    })();
  }, [navigate, login]);
  return <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center text-[#A37C2E] font-serif text-2xl">Connexion à ÉLANI…</div>;
}

function ProtectedAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-[#050505]" />;
  if (!user || user.role !== "admin") { window.location.href = "/auth"; return null; }
  return children;
}

function Shell() {
  const loc = useLocation();
  const isAdmin = loc.pathname.startsWith("/admin");
  return (
    <>
      {!isAdmin && <AnnouncementBar />}
      {!isAdmin && <Nav />}
      {!isAdmin && <CartDrawer />}
      {!isAdmin && <WhatsAppFab />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/boutique" element={<Boutique />} />
        <Route path="/produit/:id" element={<ProductDetail />} />
        <Route path="/histoire" element={<Histoire />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/reservation" element={<Reservation />} />
        <Route path="/sur-mesure" element={<SurMesure />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/compte" element={<Compte />} />
        <Route path="/payment/success" element={<PaymentSuccess />} />
        <Route path="/admin" element={<ProtectedAdmin><Admin /></ProtectedAdmin>} />
      </Routes>
      {!isAdmin && <Footer />}
    </>
  );
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <>
      <ScrollTop />
      <Shell />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>
            <SmoothScroll />
            <Toaster position="top-center" theme="dark" richColors />
            <AppRouter />
          </WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

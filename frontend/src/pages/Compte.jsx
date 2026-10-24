import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api, eur } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useWishlist } from "../context/WishlistContext";
import { Heart, Trash2 } from "lucide-react";
import { useCart } from "../context/CartContext";
import { toast } from "sonner";

const STATUS_LABEL = { pending: "En attente", confirmed: "Confirmée", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée" };

export default function Compte() {
  const { user, loading, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [wishProducts, setWishProducts] = useState([]);
  const [tab, setTab] = useState(() => window.location.hash === "#wishlist" ? "wishlist" : "orders");
  const { ids: wishIds, remove: unwish } = useWishlist();
  const { add } = useCart();
  const navigate = useNavigate();

  useEffect(() => { if (!loading && !user) navigate("/auth"); }, [loading, user, navigate]);
  useEffect(() => { if (user) api.get("/orders/my").then(({ data }) => setOrders(data)).catch(() => {}); }, [user]);

  useEffect(() => {
    if (wishIds.length === 0) { setWishProducts([]); return; }
    Promise.all(wishIds.map((id) => api.get(`/products/${id}`).then((r) => r.data).catch(() => null)))
      .then((res) => setWishProducts(res.filter(Boolean)));
  }, [wishIds]);

  if (loading || !user) return <div className="min-h-screen bg-[#F4F3ED]" />;

  return (
    <div className="min-h-screen bg-[#F4F3ED] pt-32" data-testid="compte-page">
      <div className="max-w-[1100px] mx-auto px-6 lg:px-12 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b border-[#171311]/10 pb-10 mb-8 gap-6">
          <div>
            <p className="overline text-[#A37C2E] mb-4">Mon espace</p>
            <h1 className="font-serif text-5xl md:text-6xl tracking-tight text-[#171311]">Bonjour, {user.name?.split(" ")[0] || "Madame"}</h1>
            <p className="text-[#4A463F] text-sm mt-3">{user.email}</p>
          </div>
          <div className="flex gap-4">
            {user.role === "admin" && (
              <Link to="/admin" data-testid="admin-link" className="overline border border-[#C49A45] text-[#A37C2E] px-6 py-3 hover:bg-[#C49A45]/10 transition-colors">Admin</Link>
            )}
            <button data-testid="logout-button" onClick={() => { logout(); navigate("/"); }}
              className="overline border border-[#171311]/15 text-[#4A463F] px-6 py-3 hover:border-[#C49A45] hover:text-[#A37C2E] transition-colors">Déconnexion</button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 mb-10 border-b border-[#171311]/10">
          {[["orders", "Mes commandes"], ["wishlist", `Mes favoris${wishIds.length ? ` (${wishIds.length})` : ""}`]].map(([k, l]) => (
            <button key={k} data-testid={`compte-tab-${k}`} onClick={() => setTab(k)}
              className={`overline px-2 py-3 -mb-px border-b-2 transition-colors ${tab === k ? "border-[#C49A45] text-[#A37C2E]" : "border-transparent text-[#4A463F] hover:text-[#171311]"}`}>{l}</button>
          ))}
        </div>

        {tab === "orders" && (orders.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[#4A463F] mb-6">Vous n'avez pas encore passé de commande.</p>
            <Link to="/boutique" className="inline-block bg-[#171311] text-[#F4F3ED] overline px-10 py-4 hover:bg-[#C49A45] hover:text-white transition-colors">Découvrir la boutique</Link>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((o) => (
              <div key={o.id} data-testid={`order-${o.id}`} className="border border-[#171311]/10 bg-[#FAFAF7] p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                  <div>
                    <p className="text-sm text-[#171311]">Commande #{o.id.slice(0, 8)}</p>
                    <p className="text-xs text-[#737373]">{new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                  </div>
                  <span className={`overline px-4 py-2 border ${o.payment_status === "paid" ? "border-[#C49A45] text-[#A37C2E]" : "border-[#171311]/15 text-[#4A463F]"}`}>
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                </div>
                <div className="space-y-2">
                  {o.items.map((it, i) => (
                    <div key={i} className="flex justify-between text-sm text-[#4A463F]">
                      <span>{it.name} × {it.quantity}</span>
                      <span>{eur(it.price * it.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between border-t border-[#171311]/10 mt-4 pt-4">
                  <span className="overline text-[#4A463F]">Total</span>
                  <span className="font-serif text-xl text-[#A37C2E]">{eur(o.total)}</span>
                </div>
              </div>
            ))}
          </div>
        ))}

        {tab === "wishlist" && (wishProducts.length === 0 ? (
          <div className="py-20 text-center" data-testid="wishlist-empty">
            <Heart size={36} strokeWidth={1.1} className="mx-auto mb-5" style={{ color: "#C49A45" }} />
            <p className="text-[#4A463F] mb-6">Aucun favori pour le moment. Cliquez sur le cœur d'un produit pour le sauvegarder.</p>
            <Link to="/boutique" className="inline-block bg-[#171311] text-[#F4F3ED] overline px-10 py-4 hover:bg-[#C49A45] hover:text-white transition-colors">Parcourir la boutique</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6" data-testid="wishlist-list">
            {wishProducts.map((p) => (
              <div key={p.id} data-testid={`wish-item-${p.id}`} className="flex gap-5 border border-[#171311]/10 bg-[#FAFAF7] p-4">
                <Link to={`/produit/${p.id}`} className="shrink-0">
                  <img src={p.images?.[0]} alt={p.name} className="w-24 h-32 object-cover border border-[#C49A45]/15" />
                </Link>
                <div className="flex-1 flex flex-col">
                  <p className="overline text-[#A37C2E] mb-1">{p.category}</p>
                  <Link to={`/produit/${p.id}`} className="font-serif text-lg text-[#171311] leading-tight hover-gold">{p.name}</Link>
                  <p className="text-[#A37C2E] mt-1 mb-auto">{eur(p.price)}</p>
                  <div className="flex items-center gap-3 mt-3">
                    <button
                      data-testid={`wish-add-${p.id}`}
                      onClick={() => { add(p, 1); toast.success("Ajouté au panier"); }}
                      className="overline text-xs px-4 py-2 bg-[#171311] text-[#F4F3ED] hover:bg-[#C49A45] transition-colors"
                    >Ajouter au panier</button>
                    <button
                      data-testid={`wish-remove-${p.id}`}
                      onClick={() => unwish(p.id)}
                      className="text-[#4A463F] hover:text-red-500"
                      aria-label="Retirer"
                    ><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

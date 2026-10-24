import React, { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, eur, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { Package, ShoppingCart, TrendingUp, AlertTriangle, Plus, Pencil, Trash2, X, CalendarDays, Clock, Tag, MessageSquare, Check } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";

const EMPTY = { name: "", description: "", price: "", category: "The Silk Collection", length: "", texture: "", color: "", origin: "", stock: "", featured: false, images: "" };
const CATEGORIES = ["The Silk Collection", "The Riviera Wave", "Closure HD", "Extensions", "Coffrets", "Accessoires"];
const STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
const STATUS_LABEL = { pending: "En attente", confirmed: "Confirmée", shipped: "Expédiée", delivered: "Livrée", cancelled: "Annulée" };
const CONSULT_STATUSES = ["pending", "confirmed", "completed", "cancelled"];
const CONSULT_LABEL = { pending: "En attente", confirmed: "Confirmée", completed: "Terminée", cancelled: "Annulée" };

export default function Admin() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("products");
  const [stats, setStats] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [slots, setSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({ date: "", times: "" });
  const [promos, setPromos] = useState([]);
  const [newPromo, setNewPromo] = useState({ code: "", discount_type: "percentage", value: "", expires_at: "", max_uses: "", active: true });
  const [reviews, setReviews] = useState([]);
  const [customOrders, setCustomOrders] = useState([]);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const load = useCallback(async () => {
    const [s, p, o, c, sl, pr, rv, co] = await Promise.all([
      api.get("/admin/stats"), api.get("/products"), api.get("/orders"),
      api.get("/consultations"), api.get("/consultations/slots"),
      api.get("/admin/promo-codes"), api.get("/admin/reviews"),
      api.get("/admin/custom-orders"),
    ]);
    setStats(s.data); setProducts(p.data); setOrders(o.data);
    setConsultations(c.data); setSlots(sl.data);
    setPromos(pr.data); setReviews(rv.data); setCustomOrders(co.data);
  }, []);

  useEffect(() => { load().catch(() => toast.error("Erreur de chargement")); }, [load]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModal(true); };
  const openEdit = (p) => {
    setEditing(p.id);
    setForm({ ...p, price: String(p.price), stock: String(p.stock), images: (p.images || []).join("\n") });
    setModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = {
      ...form, price: parseFloat(form.price) || 0, stock: parseInt(form.stock) || 0,
      images: form.images.split("\n").map((s) => s.trim()).filter(Boolean),
    };
    try {
      if (editing) await api.put(`/products/${editing}`, payload);
      else await api.post("/products", payload);
      toast.success(editing ? "Produit mis à jour" : "Produit ajouté");
      setModal(false); load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const del = async (id) => {
    if (!window.confirm("Supprimer ce produit ?")) return;
    await api.delete(`/products/${id}`);
    toast.success("Produit supprimé"); load();
  };

  const setStatus = async (id, status) => {
    await api.put(`/orders/${id}/status`, { status });
    toast.success("Statut mis à jour");
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
  };

  const setConsultStatus = async (id, status) => {
    await api.put(`/consultations/${id}/status`, { status });
    toast.success("Statut mis à jour");
    setConsultations((prev) => prev.map((c) => c.id === id ? { ...c, status } : c));
  };

  const addSlots = async (e) => {
    e.preventDefault();
    const times = newSlot.times.split(",").map((t) => t.trim()).filter(Boolean);
    if (!newSlot.date || times.length === 0) { toast.error("Renseignez une date et au moins un horaire"); return; }
    try {
      await api.post("/consultations/slots", { date: newSlot.date, times });
      toast.success("Créneaux ajoutés");
      setNewSlot({ date: "", times: "" });
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const delSlot = async (id) => {
    await api.delete(`/consultations/slots/${id}`);
    toast.success("Créneau supprimé"); load();
  };

  const createPromo = async (e) => {
    e.preventDefault();
    if (!newPromo.code.trim() || !newPromo.value) { toast.error("Code et valeur requis"); return; }
    try {
      await api.post("/admin/promo-codes", {
        code: newPromo.code.trim().toUpperCase(),
        discount_type: newPromo.discount_type,
        value: parseFloat(newPromo.value) || 0,
        expires_at: newPromo.expires_at || "",
        max_uses: parseInt(newPromo.max_uses) || 0,
        active: !!newPromo.active,
      });
      toast.success("Code promo créé");
      setNewPromo({ code: "", discount_type: "percentage", value: "", expires_at: "", max_uses: "", active: true });
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const togglePromo = async (id, active) => {
    await api.put(`/admin/promo-codes/${id}`, { active });
    toast.success("Statut mis à jour"); load();
  };
  const delPromo = async (id) => {
    if (!window.confirm("Supprimer ce code ?")) return;
    await api.delete(`/admin/promo-codes/${id}`);
    toast.success("Code supprimé"); load();
  };

  const moderateReview = async (id, status) => {
    await api.put(`/admin/reviews/${id}/status`, { status });
    toast.success("Avis modéré");
    setReviews((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  };
  const delReview = async (id) => {
    if (!window.confirm("Supprimer cet avis ?")) return;
    await api.delete(`/admin/reviews/${id}`);
    toast.success("Avis supprimé");
    setReviews((prev) => prev.filter((r) => r.id !== id));
  };

  const CUSTOM_STATUSES = ["pending", "quoted", "confirmed", "in_production", "shipped", "completed", "cancelled"];
  const CUSTOM_LABEL = { pending: "En attente", quoted: "Devis envoyé", confirmed: "Confirmé", in_production: "En atelier", shipped: "Expédié", completed: "Livré", cancelled: "Annulé" };
  const setCustomStatus = async (id, status) => {
    await api.put(`/admin/custom-orders/${id}/status`, { status });
    toast.success("Statut mis à jour");
    setCustomOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
  };
  const delCustom = async (id) => {
    if (!window.confirm("Supprimer ce brief ?")) return;
    await api.delete(`/admin/custom-orders/${id}`);
    setCustomOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const prettyDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

  const STAT_CARDS = stats ? [
    { icon: Package, label: "Produits", value: stats.total_products },
    { icon: ShoppingCart, label: "Commandes", value: stats.total_orders },
    { icon: TrendingUp, label: "Chiffre d'affaires", value: eur(stats.revenue) },
    { icon: CalendarDays, label: "Consultations", value: stats.consultations ?? 0 },
    { icon: AlertTriangle, label: "Stock faible", value: stats.low_stock },
  ] : [];

  return (
    <div className="min-h-screen bg-[#050505] text-[#F5F5F0]" data-testid="admin-page">
      <header className="border-b border-white/10 px-8 h-20 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-xl z-40">
        <div className="flex items-center gap-4">
          <span className="font-serif text-2xl" style={{ letterSpacing: "0.2em", paddingLeft: "0.2em" }}>ÉLANI</span>
          <span className="overline text-[#737373]">Administration</span>
        </div>
        <div className="flex gap-3">
          <Link to="/" className="overline text-[#A3A3A3] hover-gold px-4 py-2">Voir le site</Link>
          <button data-testid="admin-logout" onClick={() => { logout(); navigate("/"); }} className="overline border border-white/15 px-5 py-2 hover:border-[#D4AF37] transition-colors">Déconnexion</button>
        </div>
      </header>

      <div className="max-w-[1500px] mx-auto px-8 py-12">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-5 mb-12">
          {STAT_CARDS.map((c) => (
            <div key={c.label} data-testid={`stat-${c.label}`} className="bg-[#0A0A0A] border border-white/5 p-6">
              <c.icon className="text-[#D4AF37] mb-4" size={22} strokeWidth={1.2} />
              <p className="font-serif text-3xl mb-1">{c.value}</p>
              <p className="overline text-[#737373]">{c.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-white/10 overflow-x-auto">
          {[["products", "Produits"], ["orders", "Commandes"], ["consultations", "Consultations"], ["slots", "Créneaux"], ["promos", "Codes promo"], ["reviews", "Avis"], ["custom", "Sur mesure"]].map(([k, l]) => (
            <button key={k} data-testid={`tab-${k}`} onClick={() => setTab(k)}
              className={`overline px-6 py-4 border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === k ? "border-[#D4AF37] text-[#D4AF37]" : "border-transparent text-[#737373] hover:text-[#F5F5F0]"}`}>
              {l}
            </button>
          ))}
        </div>

        {tab === "products" && (
          <div>
            <div className="flex justify-end mb-6">
              <button data-testid="add-product-button" onClick={openNew} className="flex items-center gap-2 bg-[#D4AF37] text-black overline px-6 py-3 hover:bg-[#F2CA44] transition-colors">
                <Plus size={16} /> Ajouter un produit
              </button>
            </div>
            <div className="overflow-x-auto border border-white/5">
              <table className="w-full text-sm">
                <thead className="bg-[#0A0A0A] text-[#737373]">
                  <tr className="text-left overline">
                    <th className="p-4">Produit</th><th className="p-4">Catégorie</th><th className="p-4">Prix</th><th className="p-4">Stock</th><th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} data-testid={`admin-product-${p.id}`} className="border-t border-white/5">
                      <td className="p-4 flex items-center gap-3">
                        <img src={p.images?.[0]} alt="" className="w-10 h-12 object-cover" />
                        <span className="font-serif text-base">{p.name}</span>
                      </td>
                      <td className="p-4 text-[#A3A3A3]">{p.category}</td>
                      <td className="p-4 text-[#D4AF37]">{eur(p.price)}</td>
                      <td className="p-4"><span className={p.stock < 5 ? "text-red-400" : "text-[#A3A3A3]"}>{p.stock}</span></td>
                      <td className="p-4 text-right">
                        <button data-testid={`edit-product-${p.id}`} onClick={() => openEdit(p)} className="text-[#A3A3A3] hover-gold mr-4"><Pencil size={16} /></button>
                        <button data-testid={`delete-product-${p.id}`} onClick={() => del(p.id)} className="text-[#737373] hover:text-red-400"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "orders" && (
          <div className="overflow-x-auto border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-[#0A0A0A] text-[#737373]">
                <tr className="text-left overline">
                  <th className="p-4">Commande</th><th className="p-4">Articles</th><th className="p-4">Total</th><th className="p-4">Paiement</th><th className="p-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 && <tr><td colSpan="5" className="p-10 text-center text-[#737373]">Aucune commande.</td></tr>}
                {orders.map((o) => (
                  <tr key={o.id} data-testid={`admin-order-${o.id}`} className="border-t border-white/5">
                    <td className="p-4">
                      <p>#{o.id.slice(0, 8)}</p>
                      <p className="text-xs text-[#737373]">{new Date(o.created_at).toLocaleDateString("fr-FR")}</p>
                    </td>
                    <td className="p-4 text-[#A3A3A3]">{o.items.map((it) => `${it.name} ×${it.quantity}`).join(", ")}</td>
                    <td className="p-4 text-[#D4AF37]">{eur(o.total)}</td>
                    <td className="p-4"><span className={o.payment_status === "paid" ? "text-[#D4AF37]" : "text-[#737373]"}>{o.payment_status === "paid" ? "Payé" : "En attente"}</span></td>
                    <td className="p-4">
                      <Select value={o.status} onValueChange={(v) => setStatus(o.id, v)}>
                        <SelectTrigger data-testid={`order-status-${o.id}`} className="w-36 bg-[#0A0A0A] border-white/10 text-[#F5F5F0]"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0]">
                          {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "consultations" && (
          <div className="overflow-x-auto border border-white/5">
            <table className="w-full text-sm">
              <thead className="bg-[#0A0A0A] text-[#737373]">
                <tr className="text-left overline">
                  <th className="p-4">Date & heure</th><th className="p-4">Cliente</th><th className="p-4">Type souhaité</th><th className="p-4">Budget</th><th className="p-4">Contact</th><th className="p-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {consultations.length === 0 && <tr><td colSpan="6" className="p-10 text-center text-[#737373]">Aucune réservation.</td></tr>}
                {consultations.map((c) => (
                  <tr key={c.id} data-testid={`admin-consultation-${c.id}`} className="border-t border-white/5">
                    <td className="p-4">
                      <p className="text-[#F5F5F0]">{prettyDate(c.date)}</p>
                      <p className="text-xs text-[#D4AF37]">{c.time}</p>
                    </td>
                    <td className="p-4 text-[#F5F5F0]">{c.name}</td>
                    <td className="p-4 text-[#A3A3A3]">{c.wig_type}</td>
                    <td className="p-4 text-[#A3A3A3]">{c.budget}</td>
                    <td className="p-4 text-[#A3A3A3] text-xs">{c.phone || "—"}<br />{c.email || ""}</td>
                    <td className="p-4">
                      <Select value={c.status} onValueChange={(v) => setConsultStatus(c.id, v)}>
                        <SelectTrigger data-testid={`consult-status-${c.id}`} className="w-36 bg-[#0A0A0A] border-white/10 text-[#F5F5F0]"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0]">
                          {CONSULT_STATUSES.map((s) => <SelectItem key={s} value={s}>{CONSULT_LABEL[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "slots" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <form onSubmit={addSlots} className="bg-[#0A0A0A] border border-white/5 p-6 space-y-5">
                <h3 className="font-serif text-2xl">Ajouter des créneaux</h3>
                <div>
                  <label className="overline text-[#737373] block mb-2">Date</label>
                  <input data-testid="slot-date" type="date" value={newSlot.date} onChange={(e) => setNewSlot({ ...newSlot, date: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="overline text-[#737373] block mb-2">Horaires (séparés par des virgules)</label>
                  <input data-testid="slot-times" placeholder="10:00, 14:30, 16:00" value={newSlot.times} onChange={(e) => setNewSlot({ ...newSlot, times: e.target.value })} className={inputCls} />
                </div>
                <button data-testid="add-slot-button" type="submit" className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] text-black overline py-3 hover:bg-[#F2CA44] transition-colors">
                  <Plus size={16} /> Ajouter
                </button>
              </form>
            </div>
            <div className="lg:col-span-2">
              <div className="overflow-x-auto border border-white/5">
                <table className="w-full text-sm">
                  <thead className="bg-[#0A0A0A] text-[#737373]">
                    <tr className="text-left overline"><th className="p-4">Date</th><th className="p-4">Heure</th><th className="p-4">État</th><th className="p-4 text-right">Action</th></tr>
                  </thead>
                  <tbody>
                    {slots.length === 0 && <tr><td colSpan="4" className="p-10 text-center text-[#737373]">Aucun créneau. Ajoutez-en pour ouvrir les réservations.</td></tr>}
                    {slots.map((s) => (
                      <tr key={s.id} data-testid={`admin-slot-${s.id}`} className="border-t border-white/5">
                        <td className="p-4 text-[#F5F5F0]">{prettyDate(s.date)}</td>
                        <td className="p-4 flex items-center gap-2 text-[#A3A3A3]"><Clock size={14} /> {s.time}</td>
                        <td className="p-4"><span className={s.is_booked ? "text-[#D4AF37]" : "text-green-400"}>{s.is_booked ? "Réservé" : "Disponible"}</span></td>
                        <td className="p-4 text-right"><button data-testid={`delete-slot-${s.id}`} onClick={() => delSlot(s.id)} className="text-[#737373] hover:text-red-400"><Trash2 size={16} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
        {tab === "promos" && (
          <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-8">
            <form onSubmit={createPromo} className="bg-[#0A0A0A] border border-white/5 p-6 space-y-5 h-fit" data-testid="promo-form">
              <h3 className="font-serif text-2xl flex items-center gap-2"><Tag size={18} className="text-[#D4AF37]" /> Nouveau code</h3>
              <div>
                <label className="overline text-[#737373] block mb-2">Code</label>
                <input data-testid="promo-code" value={newPromo.code} onChange={(e) => setNewPromo({ ...newPromo, code: e.target.value.toUpperCase() })} className={inputCls} placeholder="WELCOME10" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="overline text-[#737373] block mb-2">Type</label>
                  <Select value={newPromo.discount_type} onValueChange={(v) => setNewPromo({ ...newPromo, discount_type: v })}>
                    <SelectTrigger data-testid="promo-type" className={inputCls}><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0]">
                      <SelectItem value="percentage">Pourcentage %</SelectItem>
                      <SelectItem value="fixed">Montant fixe €</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="overline text-[#737373] block mb-2">Valeur</label>
                  <input data-testid="promo-value" type="number" step="0.01" value={newPromo.value} onChange={(e) => setNewPromo({ ...newPromo, value: e.target.value })} className={inputCls} placeholder={newPromo.discount_type === "percentage" ? "10" : "20"} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="overline text-[#737373] block mb-2">Expire le</label>
                  <input data-testid="promo-expiry" type="date" value={newPromo.expires_at} onChange={(e) => setNewPromo({ ...newPromo, expires_at: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="overline text-[#737373] block mb-2">Utilisations max</label>
                  <input data-testid="promo-max" type="number" value={newPromo.max_uses} onChange={(e) => setNewPromo({ ...newPromo, max_uses: e.target.value })} className={inputCls} placeholder="0 = illimité" />
                </div>
              </div>
              <button data-testid="create-promo" type="submit" className="w-full flex items-center justify-center gap-2 bg-[#D4AF37] text-black overline py-3 hover:bg-[#F2CA44] transition-colors">
                <Plus size={16} /> Créer le code
              </button>
              <p className="text-[10px] text-[#737373]">Le dernier code actif s'affiche automatiquement dans le bandeau haut du site.</p>
            </form>
            <div className="overflow-x-auto border border-white/5">
              <table className="w-full text-sm">
                <thead className="bg-[#0A0A0A] text-[#737373]">
                  <tr className="text-left overline">
                    <th className="p-4">Code</th><th className="p-4">Type</th><th className="p-4">Valeur</th>
                    <th className="p-4">Usage</th><th className="p-4">Expire</th><th className="p-4">Actif</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.length === 0 && <tr><td colSpan="7" className="p-10 text-center text-[#737373]">Aucun code promo. Créez-en un.</td></tr>}
                  {promos.map((p) => (
                    <tr key={p.id} data-testid={`admin-promo-${p.id}`} className="border-t border-white/5">
                      <td className="p-4 font-mono text-[#D4AF37]">{p.code}</td>
                      <td className="p-4 text-[#A3A3A3]">{p.discount_type === "percentage" ? "%" : "€ fixe"}</td>
                      <td className="p-4 text-[#F5F5F0]">{p.discount_type === "percentage" ? `${p.value}%` : eur(p.value)}</td>
                      <td className="p-4 text-[#A3A3A3]">{p.uses}{p.max_uses ? ` / ${p.max_uses}` : ""}</td>
                      <td className="p-4 text-[#A3A3A3]">{p.expires_at || "—"}</td>
                      <td className="p-4">
                        <button data-testid={`toggle-promo-${p.id}`} onClick={() => togglePromo(p.id, !p.active)}
                          className={`overline px-3 py-1 border transition-colors ${p.active ? "border-green-500/40 text-green-400" : "border-white/15 text-[#737373]"}`}>
                          {p.active ? "Actif" : "Inactif"}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <button data-testid={`delete-promo-${p.id}`} onClick={() => delPromo(p.id)} className="text-[#737373] hover:text-red-400"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "reviews" && (
          <div className="overflow-x-auto border border-white/5" data-testid="reviews-table">
            <table className="w-full text-sm">
              <thead className="bg-[#0A0A0A] text-[#737373]">
                <tr className="text-left overline">
                  <th className="p-4">Produit</th><th className="p-4">Cliente</th><th className="p-4">Note</th>
                  <th className="p-4">Avis</th><th className="p-4">Statut</th><th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {reviews.length === 0 && <tr><td colSpan="6" className="p-10 text-center text-[#737373]">Aucun avis pour le moment.</td></tr>}
                {reviews.map((r) => (
                  <tr key={r.id} data-testid={`admin-review-${r.id}`} className="border-t border-white/5 align-top">
                    <td className="p-4 text-[#F5F5F0]">{r.product_name || "—"}</td>
                    <td className="p-4 text-[#A3A3A3]">
                      {r.user_name}
                      {r.verified && <span className="ml-2 text-[10px] uppercase tracking-widest text-[#D4AF37]">Vérifié</span>}
                    </td>
                    <td className="p-4 text-[#D4AF37]">{"★".repeat(r.rating)}<span className="text-[#3a3a3a]">{"★".repeat(5 - r.rating)}</span></td>
                    <td className="p-4 text-[#A3A3A3] max-w-md">{r.comment}</td>
                    <td className="p-4">
                      <span className={`overline ${r.status === "approved" ? "text-green-400" : r.status === "rejected" ? "text-red-400" : "text-[#D4AF37]"}`}>
                        {r.status === "approved" ? "Publié" : r.status === "rejected" ? "Rejeté" : "En attente"}
                      </span>
                    </td>
                    <td className="p-4 text-right whitespace-nowrap">
                      {r.status !== "approved" && (
                        <button data-testid={`approve-review-${r.id}`} onClick={() => moderateReview(r.id, "approved")} className="text-green-400 hover:text-green-300 mr-3" title="Approuver"><Check size={16} /></button>
                      )}
                      {r.status !== "rejected" && (
                        <button data-testid={`reject-review-${r.id}`} onClick={() => moderateReview(r.id, "rejected")} className="text-[#737373] hover:text-red-300 mr-3" title="Rejeter"><X size={16} /></button>
                      )}
                      <button data-testid={`delete-review-${r.id}`} onClick={() => delReview(r.id)} className="text-[#737373] hover:text-red-400"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab === "custom" && (
          <div className="overflow-x-auto border border-white/5" data-testid="custom-orders-table">
            <table className="w-full text-sm">
              <thead className="bg-[#0A0A0A] text-[#737373]">
                <tr className="text-left overline">
                  <th className="p-4">Cliente</th><th className="p-4">Brief</th><th className="p-4">Budget</th>
                  <th className="p-4">Deadline</th><th className="p-4">Statut</th><th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {customOrders.length === 0 && <tr><td colSpan="6" className="p-10 text-center text-[#737373]">Aucun brief sur mesure.</td></tr>}
                {customOrders.map((c) => (
                  <tr key={c.id} data-testid={`admin-custom-${c.id}`} className="border-t border-white/5 align-top">
                    <td className="p-4">
                      <p className="text-[#F5F5F0]">{c.name}</p>
                      <p className="text-xs text-[#A3A3A3]">{c.email}</p>
                      {c.phone && <p className="text-xs text-[#A3A3A3]">{c.phone}</p>}
                    </td>
                    <td className="p-4 text-xs text-[#A3A3A3] max-w-md">
                      <p><span className="text-[#D4AF37]">{c.texture}</span> · {c.length} · {c.color}</p>
                      {(c.lace_type || c.cap_size) && <p className="mt-1">Lace: {c.lace_type || "—"} · Bonnet: {c.cap_size || "—"}</p>}
                      {c.style && <p className="mt-2 italic">« {c.style} »</p>}
                      {c.message && <p className="mt-2 text-[#737373]">{c.message}</p>}
                    </td>
                    <td className="p-4 text-[#D4AF37] whitespace-nowrap">{c.budget}</td>
                    <td className="p-4 text-[#A3A3A3] whitespace-nowrap">{c.deadline || "—"}</td>
                    <td className="p-4">
                      <Select value={c.status} onValueChange={(v) => setCustomStatus(c.id, v)}>
                        <SelectTrigger data-testid={`custom-status-${c.id}`} className="w-40 bg-[#0A0A0A] border-white/10 text-[#F5F5F0]"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0]">
                          {CUSTOM_STATUSES.map((s) => <SelectItem key={s} value={s}>{CUSTOM_LABEL[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="p-4 text-right">
                      <a href={`mailto:${c.email}`} className="text-[#D4AF37] hover:text-[#F2CA44] mr-3 text-xs overline" title="Répondre par email">Email</a>
                      <button data-testid={`delete-custom-${c.id}`} onClick={() => delCustom(c.id)} className="text-[#737373] hover:text-red-400"><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Product modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6" onClick={() => setModal(false)}>
          <div data-testid="product-modal" className="bg-[#0A0A0A] border border-white/10 w-full max-w-2xl max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="font-serif text-3xl">{editing ? "Modifier le produit" : "Nouveau produit"}</h2>
              <button onClick={() => setModal(false)} className="hover-gold"><X size={22} /></button>
            </div>
            <form onSubmit={save} className="grid grid-cols-2 gap-5">
              <Field label="Nom" span><input data-testid="form-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} /></Field>
              <Field label="Description" span><textarea data-testid="form-description" required rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={inputCls} /></Field>
              <Field label="Prix (€)"><input data-testid="form-price" required type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className={inputCls} /></Field>
              <Field label="Stock"><input data-testid="form-stock" required type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className={inputCls} /></Field>
              <Field label="Catégorie">
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger data-testid="form-category" className={inputCls}><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-[#0A0A0A] border-white/10 text-[#F5F5F0]">
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Longueur"><input value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} className={inputCls} /></Field>
              <Field label="Texture"><input value={form.texture} onChange={(e) => setForm({ ...form, texture: e.target.value })} className={inputCls} /></Field>
              <Field label="Couleur"><input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className={inputCls} /></Field>
              <Field label="Origine" span><input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} className={inputCls} /></Field>
              <Field label="Images (une URL par ligne)" span><textarea data-testid="form-images" rows={2} value={form.images} onChange={(e) => setForm({ ...form, images: e.target.value })} className={inputCls} /></Field>
              <label className="col-span-2 flex items-center gap-3 text-sm text-[#A3A3A3]">
                <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="accent-[#D4AF37]" />
                Mettre en avant (page d'accueil)
              </label>
              <button data-testid="save-product-button" type="submit" className="col-span-2 bg-[#D4AF37] text-black overline py-4 hover:bg-[#F2CA44] transition-colors mt-2">
                {editing ? "Enregistrer" : "Ajouter"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full bg-[#121212] border border-white/10 px-4 py-3 outline-none focus:border-[#D4AF37] transition-colors text-[#F5F5F0] text-sm";
function Field({ label, span, children }) {
  return (
    <div className={span ? "col-span-2" : ""}>
      <label className="overline text-[#737373] block mb-2">{label}</label>
      {children}
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api, eur } from "../lib/api";
import { useCart } from "../context/CartContext";
import { toast } from "sonner";
import { Minus, Plus, ArrowLeft, Truck, ShieldCheck, Sparkles, MessageCircle, Heart } from "lucide-react";
import { CONTACT } from "../lib/brand";
import LengthGuide from "../components/LengthGuide";
import LaceGuide from "../components/LaceGuide";
import ProductReviews from "../components/ProductReviews";
import Stars from "../components/Stars";
import { useWishlist } from "../context/WishlistContext";

export default function ProductDetail() {
  const { id } = useParams();
  const [p, setP] = useState(null);
  const [img, setImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [selectedInches, setSelectedInches] = useState(null);
  const [selectedTexture, setSelectedTexture] = useState(null);
  const { add } = useCart();
  const { has, toggle } = useWishlist();

  useEffect(() => {
    api.get(`/products/${id}`).then(({ data }) => {
      setP(data); setImg(0);
      const opts = data.length_options || [];
      if (opts.length > 0) {
        // For HD Closure products: pick smallest length + straight by default
        if (data.closure_type) {
          setSelectedTexture("straight");
          setSelectedInches(opts.find((o) => o.texture === "straight")?.inches ?? 10);
        } else {
          const base = opts.find((o) => Math.abs(o.price - data.price) < 0.5);
          setSelectedInches(base?.inches ?? opts[Math.floor(opts.length / 2)]?.inches ?? null);
          setSelectedTexture(null);
        }
      } else {
        setSelectedInches(null);
        setSelectedTexture(null);
      }
    }).catch(() => setP(false));
  }, [id]);

  if (p === false) return <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center font-serif text-2xl text-[#4A463F]">Produit introuvable.</div>;
  if (!p) return <div className="min-h-screen bg-[#F4F3ED]" />;

  // For HD closures, filter options by selected texture
  const isClosure = !!p.closure_type;
  const filteredOptions = isClosure && p.length_options
    ? p.length_options.filter((o) => o.texture === selectedTexture)
    : p.length_options;
  const selectedOption = filteredOptions?.find((o) => o.inches === selectedInches);
  const currentPrice = selectedOption?.price ?? p.price;
  const currentLabel = selectedOption?.label ?? p.length;
  const currentTextureLabel = isClosure ? (selectedTexture === "straight" ? "Straight (lisse)" : "Body Wave (ondulé)") : p.texture;

  const specs = [
    ["Longueur", currentLabel || p.length],
    ["Texture", currentTextureLabel],
    ["Couleur", p.color],
    ["Origine", p.origin],
  ].filter(([, v]) => v);

  const waMessage = `Bonjour ÉLANI 💛, je souhaite commander : ${p.name} — ${currentLabel} (${eur(currentPrice)}). ${window.location.href}`;
  const waHref = `${CONTACT.whatsappHref}?text=${encodeURIComponent(waMessage)}`;

  return (
    <div className="bg-[#F4F3ED] min-h-screen pt-28" data-testid="product-detail-page">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-10">
        <Link to="/boutique" className="inline-flex items-center gap-2 overline text-[#4A463F] hover-gold mb-10">
          <ArrowLeft size={14} /> Retour
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          <div className="flex flex-col-reverse lg:flex-row gap-5">
            <div className="flex lg:flex-col gap-4">
              {p.images?.map((im, i) => (
                <button key={i} onClick={() => setImg(i)} data-testid={`thumb-${i}`}
                  className={`w-20 h-24 overflow-hidden border ${img === i ? "border-[#C49A45]" : "border-[#171311]/10"}`}>
                  <img src={im} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <motion.div key={img} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
              className="flex-1 overflow-hidden aspect-[3/4] bg-[#EBE8DF] border border-[#C49A45]/15">
              <img src={p.images?.[img]} alt={p.name} className="w-full h-full object-cover" />
            </motion.div>
          </div>

          <div className="lg:py-6">
            <div className="flex items-start justify-between gap-6 mb-4">
              <p className="overline text-[#A37C2E]">{p.category}</p>
              <button
                data-testid="wishlist-toggle-detail"
                onClick={() => toggle(p.id)}
                aria-label="Ajouter aux favoris"
                className={`flex items-center justify-center w-11 h-11 border transition-colors ${
                  has(p.id) ? "bg-[#C49A45] border-[#C49A45] text-white" : "border-[#171311]/15 text-[#171311] hover:border-[#C49A45] hover:text-[#C49A45]"
                }`}
              >
                <Heart size={18} strokeWidth={1.3} fill={has(p.id) ? "currentColor" : "transparent"} />
              </button>
            </div>
            <h1 className="font-serif text-4xl md:text-6xl leading-[1] tracking-tight mb-4 text-[#171311]">{p.name}</h1>
            {p.review_count > 0 && (
              <div className="flex items-center gap-2 mb-4">
                <Stars value={p.avg_rating} size={14} />
                <span className="text-xs text-[#4A463F]">{p.avg_rating.toFixed(1)} · {p.review_count} avis</span>
              </div>
            )}
            <p data-testid="product-price" className="font-serif text-3xl text-[#A37C2E] mb-8 transition-colors">{eur(currentPrice)}</p>
            <p className="text-[#4A463F] leading-relaxed mb-10 max-w-lg">{p.description}</p>

            {/* Length selector */}
            {p.length_options?.length > 0 && (
              <div className="mb-10 max-w-lg" data-testid="length-selector">
                {isClosure && (
                  <div className="mb-6" data-testid="texture-selector">
                    <p className="overline text-[#A37C2E] mb-3">Texture — <span className="text-[#171311]">{currentTextureLabel}</span></p>
                    <div className="grid grid-cols-2 gap-2">
                      {[["straight", "Straight", "(lisse)"], ["body_wave", "Body Wave", "(ondulé)"]].map(([k, l, s]) => {
                        const on = selectedTexture === k;
                        return (
                          <button
                            key={k}
                            data-testid={`texture-${k}`}
                            onClick={() => setSelectedTexture(k)}
                            className={`py-3 text-sm border transition-colors ${on ? "bg-[#171311] text-[#F4F3ED] border-[#171311]" : "bg-white border-[#171311]/15 text-[#171311] hover:border-[#C49A45]"}`}
                          >
                            <span className="block font-serif text-base leading-none">{l}</span>
                            <span className={`block mt-1 text-[10px] ${on ? "text-[#C49A45]" : "text-[#4A463F]"}`}>{s}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between mb-4">
                  <p className="overline text-[#A37C2E]">Longueur — <span className="text-[#171311]">{currentLabel}</span></p>
                  {!isClosure && <LengthGuide selectedInches={selectedInches} onSelect={setSelectedInches} />}
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {filteredOptions.map((o) => {
                    const on = o.inches === selectedInches;
                    return (
                      <button
                        key={`${o.inches}-${o.texture || ""}`}
                        data-testid={`length-${o.inches}`}
                        onClick={() => setSelectedInches(o.inches)}
                        className={`py-3 text-xs border transition-colors ${
                          on
                            ? "bg-[#171311] text-[#F4F3ED] border-[#171311]"
                            : "bg-white border-[#171311]/15 text-[#171311] hover:border-[#C49A45] hover:text-[#A37C2E]"
                        }`}>
                        <span className="block font-serif text-base leading-none">{o.inches}"</span>
                        <span className={`block mt-1 ${on ? "text-[#C49A45]" : "text-[#4A463F]"}`}>{eur(o.price).replace(/\s?€/, "€")}</span>
                      </button>
                    );
                  })}
                </div>
                {isClosure && (
                  <a
                    href="/sur-mesure"
                    data-testid="beyond-20-link"
                    className="mt-4 inline-flex items-center gap-2 text-xs text-[#A37C2E] underline underline-offset-4 decoration-[#C49A45]/40 hover:text-[#171311]"
                  >
                    <Sparkles size={12} /> Au-delà de 20 pouces&nbsp;: pièces sur commande
                  </a>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-8 gap-y-5 mb-10 max-w-lg">
              {specs.map(([k, v]) => (
                <div key={k} className="border-t border-[#171311]/10 pt-4">
                  <p className="overline text-[#A37C2E] mb-1">{k}</p>
                  <p className="text-sm text-[#171311]">{v}</p>
                </div>
              ))}
            </div>

            {p.stock > 0 ? (
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center max-w-lg">
                <div className="flex items-center border border-[#171311]/15 justify-between px-5 py-4 sm:w-32">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="text-[#4A463F] hover-gold"><Minus size={16} /></button>
                  <span data-testid="qty-value" className="text-[#171311]">{qty}</span>
                  <button onClick={() => setQty(qty + 1)} className="text-[#4A463F] hover-gold"><Plus size={16} /></button>
                </div>
                <button
                  data-testid="add-to-cart-button"
                  onClick={() => {
                    const displayName = isClosure
                      ? `${p.name} — ${currentLabel} · ${currentTextureLabel.split(" ")[0]}`
                      : `${p.name} — ${currentLabel}`;
                    add({ ...p, price: currentPrice, name: displayName }, qty, { inches: selectedInches, texture: isClosure ? selectedTexture : null });
                    toast.success(`${displayName} ajouté au panier`);
                  }}
                  className="flex-1 bg-[#171311] text-[#F4F3ED] overline py-4 hover:bg-[#C49A45] hover:text-white transition-colors"
                >
                  Ajouter au panier
                </button>
              </div>
            ) : (
              <p className="overline text-[#4A463F] border border-[#171311]/15 inline-block px-8 py-4">Épuisé</p>
            )}

            <a
              data-testid="whatsapp-order-button"
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex items-center justify-center gap-3 w-full max-w-lg border border-[#171311] text-[#171311] overline py-4 hover:bg-[#171311] hover:text-[#F4F3ED] transition-colors"
            >
              <MessageCircle size={16} /> Commander sur WhatsApp
            </a>

            <div className="flex flex-wrap gap-6 mt-8 text-xs text-[#4A463F]">
              <span className="flex items-center gap-2"><Truck size={15} style={{ color: "#C49A45" }} /> Livraison 6,99 €</span>
              <span className="flex items-center gap-2"><ShieldCheck size={15} style={{ color: "#C49A45" }} /> Paiement sécurisé</span>
              <span className="flex items-center gap-2"><Sparkles size={15} style={{ color: "#C49A45" }} /> {p.stock} en stock</span>
            </div>

            {p.category === "Closure HD" && (
              <div className="mt-8 border-t border-[#171311]/10 pt-6">
                <LaceGuide />
              </div>
            )}
          </div>
        </div>

        <ProductReviews productId={p.id} />
      </div>
    </div>
  );
}

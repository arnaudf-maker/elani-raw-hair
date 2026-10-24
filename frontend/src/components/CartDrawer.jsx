import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Minus, Plus, Trash2, Tag, Truck } from "lucide-react";
import { useCart } from "../context/CartContext";
import { api, eur, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

const SHIPPING_FEE = 6.99;

export default function CartDrawer() {
  const { items, open, setOpen, remove, setQty, total, count } = useCart();
  const [loading, setLoading] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [applied, setApplied] = useState(null); // {code, discount}
  const [validating, setValidating] = useState(false);
  const [shipping, setShipping] = useState(SHIPPING_FEE);
  const [paypalClientId, setPaypalClientId] = useState("");

  useEffect(() => {
    api.get("/config").then(({ data }) => {
      setShipping(data.shipping_fee ?? SHIPPING_FEE);
      setPaypalClientId(data.paypal_client_id || "");
    }).catch(() => {});
  }, []);

  // Reset promo if items or subtotal invalidate it
  useEffect(() => {
    if (applied && items.length === 0) setApplied(null);
  }, [items, applied]);

  const applyPromo = async () => {
    const code = promoInput.trim();
    if (!code) return;
    setValidating(true);
    try {
      const { data } = await api.post("/promo-codes/validate", { code, subtotal: total });
      setApplied({ code: data.code, discount: data.discount, discount_type: data.discount_type, value: data.value });
      toast.success(`Code ${data.code} appliqué`);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      setApplied(null);
    } finally {
      setValidating(false);
    }
  };

  const removePromo = () => { setApplied(null); setPromoInput(""); };

  const discount = applied?.discount || 0;
  const grandTotal = Math.max(0, total - discount) + (items.length ? shipping : 0);

  const checkout = async () => {
    setLoading(true);
    try {
      const { data } = await api.post("/payments/checkout", {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, inches: i.inches ?? null, texture: i.texture ?? null })),
        origin_url: window.location.origin,
        promo_code: applied?.code || "",
      });
      window.location.href = data.checkout_url;
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-[#171311]/50 z-[60]" data-testid="cart-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.aside
            data-testid="cart-drawer"
            className="fixed top-0 right-0 h-full w-full sm:w-[460px] bg-[#FAFAF7] border-l border-[#C49A45]/25 z-[61] flex flex-col"
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex items-center justify-between px-8 py-7 border-b border-[#171311]/10">
              <h2 className="font-serif text-2xl text-[#171311]">Panier <span className="text-[#A37C2E] text-lg">({count})</span></h2>
              <button data-testid="cart-close" onClick={() => setOpen(false)} className="text-[#171311] hover-gold"><X size={22} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-6">
              {items.length === 0 ? (
                <p className="text-[#4A463F] text-sm mt-10 text-center">Votre panier est vide.</p>
              ) : items.map((i) => (
                <div key={`${i.product_id}-${i.inches ?? "d"}-${i.texture ?? "d"}`} data-testid={`cart-item-${i.product_id}`} className="flex gap-4 py-5 border-b border-[#171311]/5">
                  <img src={i.image} alt={i.name} className="w-20 h-24 object-cover" />
                  <div className="flex-1">
                    <h4 className="font-serif text-lg leading-tight text-[#171311]">{i.name}</h4>
                    <p className="text-[#A37C2E] text-sm mt-1">{eur(i.price)}</p>
                    <div className="flex items-center gap-3 mt-3">
                      <button onClick={() => setQty(i.product_id, i.quantity - 1, i.inches, i.texture)} className="text-[#4A463F] hover-gold"><Minus size={14} /></button>
                      <span className="text-sm w-5 text-center text-[#171311]">{i.quantity}</span>
                      <button onClick={() => setQty(i.product_id, i.quantity + 1, i.inches, i.texture)} className="text-[#4A463F] hover-gold"><Plus size={14} /></button>
                      <button data-testid={`cart-remove-${i.product_id}`} onClick={() => remove(i.product_id, i.inches, i.texture)} className="ml-auto text-[#A3A3A3] hover:text-red-500"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {items.length > 0 && (
              <div className="px-8 py-6 border-t border-[#171311]/10 bg-[#F4F3ED]">
                {/* Promo code */}
                {applied ? (
                  <div data-testid="promo-applied" className="flex items-center gap-2 mb-4 bg-[#C49A45]/10 border border-[#C49A45]/30 px-3 py-2.5">
                    <Tag size={14} className="text-[#A37C2E]" />
                    <span className="text-xs text-[#171311]">
                      <b>{applied.code}</b> · {applied.discount_type === "percentage" ? `-${applied.value}%` : `-${eur(applied.value)}`}
                    </span>
                    <button data-testid="remove-promo" onClick={removePromo} className="ml-auto text-[#4A463F] hover:text-red-500"><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex gap-2 mb-4">
                    <input
                      data-testid="promo-input"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Code promo"
                      className="flex-1 bg-white border border-[#171311]/15 px-3 py-2.5 text-sm outline-none focus:border-[#C49A45] text-[#171311] placeholder:text-[#A3A3A3]"
                    />
                    <button
                      data-testid="apply-promo"
                      onClick={applyPromo}
                      disabled={validating || !promoInput.trim()}
                      className="overline text-xs px-4 border border-[#171311] text-[#171311] hover:bg-[#171311] hover:text-[#F4F3ED] transition-colors disabled:opacity-40">
                      {validating ? "…" : "Appliquer"}
                    </button>
                  </div>
                )}

                {/* Totals */}
                <div className="space-y-1.5 mb-4 text-sm text-[#4A463F]">
                  <div className="flex justify-between">
                    <span>Sous-total</span>
                    <span data-testid="cart-subtotal" className="text-[#171311]">{eur(total)}</span>
                  </div>
                  {applied && (
                    <div className="flex justify-between text-[#A37C2E]">
                      <span>Réduction</span>
                      <span data-testid="cart-discount">− {eur(discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5"><Truck size={13} /> Livraison</span>
                    <span data-testid="cart-shipping" className="text-[#171311]">{eur(shipping)}</span>
                  </div>
                </div>
                <div className="flex justify-between items-baseline mb-5 pt-3 border-t border-[#171311]/15">
                  <span className="overline text-[#4A463F]">Total</span>
                  <span data-testid="cart-total" className="font-serif text-2xl text-[#171311]">{eur(grandTotal)}</span>
                </div>
                <button
                  data-testid="checkout-button" onClick={checkout} disabled={loading}
                  className="w-full bg-[#171311] text-[#F4F3ED] overline py-4 hover:bg-[#C49A45] hover:text-white transition-colors disabled:opacity-50"
                >
                  {loading ? "Redirection..." : "Passer commande"}
                </button>

                {/* PayPal option */}
                {paypalClientId && (
                  <div data-testid="paypal-container" className="mt-3">
                    <div className="text-center relative py-2 mb-1">
                      <span className="text-[10px] tracking-widest text-[#A3A3A3] bg-[#F4F3ED] px-3 relative z-10">OU</span>
                      <div className="absolute top-1/2 left-0 right-0 h-px bg-[#171311]/10 -z-0" />
                    </div>
                    <PayPalScriptProvider options={{ clientId: paypalClientId, currency: "EUR", intent: "capture" }}>
                      <PayPalButtons
                        style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal", height: 46 }}
                        forceReRender={[items.length, applied?.code || "", total]}
                        createOrder={async () => {
                          const { data } = await api.post("/paypal/create-order", {
                            items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, inches: i.inches ?? null, texture: i.texture ?? null })),
                            origin_url: window.location.origin,
                            promo_code: applied?.code || "",
                          });
                          return data.id;
                        }}
                        onApprove={async (data) => {
                          const { data: res } = await api.post(`/paypal/capture-order/${data.orderID}`);
                          if (res.status === "COMPLETED") {
                            window.location.href = `/payment/success?paypal_order_id=${data.orderID}`;
                          } else {
                            toast.error("Paiement PayPal non complété");
                          }
                        }}
                        onError={(err) => {
                          console.error("PayPal error:", err);
                          toast.error("Erreur PayPal, veuillez réessayer");
                        }}
                      />
                    </PayPalScriptProvider>
                  </div>
                )}
                <p className="text-[10px] text-[#737373] text-center mt-3">Paiement sécurisé via Stripe{paypalClientId ? " ou PayPal" : ""}</p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

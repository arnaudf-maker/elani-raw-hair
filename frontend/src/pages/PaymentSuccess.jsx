import React, { useEffect, useState, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const paypalOrderId = params.get("paypal_order_id");
  const effectiveSession = sessionId || (paypalOrderId ? `pp_${paypalOrderId}` : null);
  const [status, setStatus] = useState("checking");
  const { clear } = useCart();
  const attempts = useRef(0);
  const cleared = useRef(false);

  useEffect(() => {
    if (!effectiveSession) { setStatus("error"); return; }
    // PayPal is already captured server-side, mark paid immediately
    if (paypalOrderId) {
      setStatus("paid");
      if (!cleared.current) { clear(); cleared.current = true; }
      return;
    }
    let timer;
    const poll = async () => {
      if (attempts.current >= 8) { setStatus("timeout"); return; }
      attempts.current += 1;
      try {
        const { data } = await api.get(`/payments/status/${effectiveSession}`);
        if (data.payment_status === "paid") {
          setStatus("paid");
          if (!cleared.current) { clear(); cleared.current = true; }
          return;
        }
        if (data.status === "expired" || data.payment_status === "failed") { setStatus("error"); return; }
      } catch { /* noop */ }
      timer = setTimeout(poll, 2000);
    };
    poll();
    return () => clearTimeout(timer);
  }, [effectiveSession, paypalOrderId, clear]);

  return (
    <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center px-6" data-testid="payment-success-page">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center max-w-lg">
        {status === "checking" && (
          <>
            <p className="font-serif text-3xl text-[#A37C2E] mb-4">Confirmation en cours…</p>
            <p className="text-[#4A463F] text-sm">Nous vérifions votre paiement.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <div className="w-20 h-20 rounded-full border border-[#C49A45] flex items-center justify-center mx-auto mb-8">
              <Check className="text-[#C49A45]" size={36} strokeWidth={1.2} />
            </div>
            <p className="overline text-[#A37C2E] mb-4">Paiement confirmé</p>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-4 text-[#171311]">Merci pour votre commande</h1>
            <p className="font-script text-3xl text-[#C49A45] mb-6">Merci</p>
            <p className="text-[#4A463F] mb-10">Votre commande est confirmée. Vous recevrez bientôt un email de suivi.</p>
            <div className="flex gap-4 justify-center">
              <Link to="/compte" className="bg-[#171311] text-[#F4F3ED] overline px-8 py-4 hover:bg-[#C49A45] hover:text-white transition-colors">Mes commandes</Link>
              <Link to="/boutique" className="border border-[#171311]/15 text-[#171311] overline px-8 py-4 hover:border-[#C49A45] transition-colors">Continuer</Link>
            </div>
          </>
        )}
        {(status === "error" || status === "timeout") && (
          <>
            <h1 className="font-serif text-4xl tracking-tight mb-6 text-[#171311]">Paiement en attente</h1>
            <p className="text-[#4A463F] mb-10">Si le montant a été débité, votre commande sera confirmée sous peu. Consultez votre espace client.</p>
            <Link to="/compte" className="bg-[#171311] text-[#F4F3ED] overline px-8 py-4 hover:bg-[#C49A45] hover:text-white transition-colors">Mon compte</Link>
          </>
        )}
      </motion.div>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X } from "lucide-react";
import { CONTACT } from "../lib/brand";

// Floating WhatsApp button (bottom-right) with a small "Une question ?" bubble.
export default function WhatsAppFab({ message }) {
  const text = message || "Bonjour ÉLANI, je souhaite passer commande. 💛";
  const href = `${CONTACT.whatsappHref}?text=${encodeURIComponent(text)}`;
  const [bubble, setBubble] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [hover, setHover] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setBubble(true), 1400);
    return () => clearTimeout(t);
  }, []);

  const showBubble = (bubble && !dismissed) || hover;

  return (
    <div className="fixed bottom-6 right-6 z-[55] flex flex-col items-end gap-3">
      <AnimatePresence>
        {showBubble && (
          <motion.div
            data-testid="whatsapp-bubble"
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="relative bg-[#FAFAF7] text-[#171311] pl-5 pr-9 py-3 rounded-2xl rounded-br-sm shadow-[0_10px_35px_rgba(23,19,17,0.22)] border border-[#C49A45]/30 max-w-[220px]"
          >
            <p className="font-serif text-lg leading-tight">Une question ?</p>
            <p className="text-xs text-[#4A463F] mt-0.5">Écrivez-nous, réponse rapide 7j/7.</p>
            <button
              data-testid="whatsapp-bubble-close"
              onClick={() => { setDismissed(true); setHover(false); }}
              className="absolute top-2 right-2 text-[#737373] hover:text-[#171311]"
              aria-label="Fermer"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.a
        data-testid="whatsapp-fab"
        href={href}
        target="_blank"
        rel="noreferrer"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        initial={{ opacity: 0, scale: 0.6, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-3 bg-[#171311] text-[#F4F3ED] pl-4 pr-5 py-3.5 rounded-full shadow-[0_10px_40px_rgba(23,19,17,0.35)] border border-[#C49A45]/40 group"
        aria-label="Commander sur WhatsApp"
      >
        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-[#25D366]">
          <MessageCircle size={17} className="text-white" fill="white" strokeWidth={0} />
        </span>
        <span className="overline hidden sm:block group-hover:text-[#E5C88F] transition-colors">Commander</span>
      </motion.a>
    </div>
  );
}

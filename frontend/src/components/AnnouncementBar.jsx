import React, { useEffect, useState } from "react";
import { X, Tag, Copy, Check } from "lucide-react";
import { api } from "../lib/api";

const STORAGE_KEY = "elani_promo_banner_dismissed";

export default function AnnouncementBar() {
  const [promo, setPromo] = useState(null);
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(STORAGE_KEY) === "1");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    api.get("/promo-codes/active").then(({ data }) => setPromo(data?.promo || null)).catch(() => {});
  }, [dismissed]);

  const dismiss = () => { sessionStorage.setItem(STORAGE_KEY, "1"); setDismissed(true); };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  if (dismissed || !promo) return null;

  const label = promo.discount_type === "percentage" ? `-${promo.value}%` : `-${promo.value}€`;

  return (
    <div
      data-testid="announcement-bar"
      className="fixed top-0 left-0 right-0 z-[55] h-9 bg-gradient-to-r from-[#171311] via-[#2a1e14] to-[#171311] text-[#F4F3ED] flex items-center justify-center px-4"
    >
      <div className="flex items-center gap-3 text-[11px] tracking-[0.14em] uppercase">
        <Tag size={13} className="text-[#C49A45]" />
        <span className="hidden sm:inline text-[#F4F3ED]/80">Offre du moment ·</span>
        <span className="text-[#F4F3ED]">{label} avec le code</span>
        <button
          data-testid="promo-code-copy"
          onClick={copy}
          className="inline-flex items-center gap-1.5 border border-[#C49A45]/50 text-[#C49A45] hover:bg-[#C49A45] hover:text-[#171311] px-2.5 py-0.5 transition-colors font-medium"
          title="Copier"
        >
          {promo.code}
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>
      <button
        data-testid="dismiss-announcement"
        onClick={dismiss}
        className="absolute right-3 text-[#F4F3ED]/60 hover:text-[#F4F3ED]"
        aria-label="Fermer"
      >
        <X size={15} />
      </button>
    </div>
  );
}

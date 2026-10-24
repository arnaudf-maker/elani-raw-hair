import React from "react";
import { Crown } from "lucide-react";

// ÉLANI — RAW HAIR lockup with a prominent crown above the wordmark.
// tone: "dark" (espresso text, for cream) or "light" (cream text, for photos/dark)
export default function Logo({ tone = "dark", size = "md", tagline = false, className = "" }) {
  const color = tone === "light" ? "#F4F3ED" : "#171311";
  const gold = "#C49A45";
  // brighter gold for legibility over photos; dark shadow when placed on imagery
  const rawGold = tone === "light" ? "#F0D9A0" : gold;
  const shadow = tone === "light" ? "0 2px 18px rgba(0,0,0,0.65)" : "none";
  const sizes = {
    sm: { crown: 14, name: "text-lg", track: "0.42em", sub: "text-[7px]" },
    md: { crown: 20, name: "text-2xl md:text-3xl", track: "0.5em", sub: "text-[9px] md:text-[10px]" },
    lg: { crown: 44, name: "text-5xl md:text-7xl lg:text-8xl", track: "0.4em", sub: "text-xs md:text-sm" },
    xl: { crown: 60, name: "text-7xl md:text-8xl lg:text-9xl", track: "0.36em", sub: "text-sm md:text-base" },
  };
  const s = sizes[size] || sizes.md;
  return (
    <div className={`flex flex-col items-center ${className}`} style={{ color }}>
      <Crown size={s.crown} strokeWidth={1.1} className="mb-2" style={{ color: rawGold, filter: tone === "light" ? "drop-shadow(0 2px 10px rgba(0,0,0,0.6))" : "drop-shadow(0 1px 6px rgba(196,154,69,0.35))" }} fill={rawGold} fillOpacity={0.2} />
      <div className={`font-serif ${s.name} leading-none`} style={{ letterSpacing: s.track, paddingLeft: s.track, fontWeight: 500, textShadow: shadow }}>
        ÉLANI
      </div>
      <div className="flex items-center gap-3 mt-3 w-full justify-center" style={{ maxWidth: "16em" }}>
        <span className="rule-line flex-1" style={{ background: rawGold, opacity: tone === "light" ? 0.9 : 0.6, boxShadow: tone === "light" ? "0 1px 6px rgba(0,0,0,0.5)" : "none" }} />
        <span className={`overline ${s.sub}`} style={{ letterSpacing: "0.4em", color: rawGold, textShadow: shadow }}>RAW HAIR</span>
        <span className="rule-line flex-1" style={{ background: rawGold, opacity: tone === "light" ? 0.9 : 0.6, boxShadow: tone === "light" ? "0 1px 6px rgba(0,0,0,0.5)" : "none" }} />
      </div>
      {tagline && (
        <p className="font-script mt-5 text-3xl md:text-5xl" style={{ color: rawGold, textShadow: shadow }}>
          L'élégance commence ici.
        </p>
      )}
    </div>
  );
}

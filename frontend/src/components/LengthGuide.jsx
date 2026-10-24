import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Ruler, X } from "lucide-react";

// SVG silhouette: length lines indicating where each inch tier falls on the body
const TIERS = [
  { inches: 10, label: "Épaules courtes", y: 168, note: "Style graphique, lace bob" },
  { inches: 14, label: "Épaules", y: 210, note: "Carré long, sophistiqué" },
  { inches: 18, label: "Poitrine", y: 258, note: "Sensualité maîtrisée" },
  { inches: 22, label: "Taille", y: 308, note: "Notre longueur signature" },
  { inches: 26, label: "Hanches", y: 358, note: "Volume glamour à 360°" },
  { inches: 30, label: "Reins", y: 408, note: "Effet couture, spectaculaire" },
];

export default function LengthGuide({ selectedInches, onSelect }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        data-testid="open-length-guide"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-[11px] text-[#A37C2E] hover:text-[#171311] underline underline-offset-4 decoration-[#C49A45]/40"
      >
        <Ruler size={13} /> Quelle longueur pour moi ?
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              data-testid="length-guide-overlay"
              className="fixed inset-0 bg-[#171311]/60 z-[70]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              data-testid="length-guide-modal"
              className="fixed inset-0 z-[71] flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 30, opacity: 0 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                className="relative bg-[#FAFAF7] border border-[#C49A45]/25 w-full max-w-3xl max-h-[90vh] overflow-y-auto pointer-events-auto"
              >
                <button
                  onClick={() => setOpen(false)}
                  data-testid="close-length-guide"
                  className="absolute top-4 right-4 text-[#4A463F] hover:text-[#171311] z-10"
                >
                  <X size={22} />
                </button>

                <div className="grid grid-cols-1 md:grid-cols-[280px_1fr]">
                  {/* Silhouette panel */}
                  <div className="bg-gradient-to-b from-[#F4F3ED] to-[#EBE8DF] p-6 flex items-center justify-center">
                    <svg viewBox="0 0 200 480" className="w-full max-w-[220px]" aria-hidden="true">
                      {/* Simple female silhouette */}
                      <defs>
                        <linearGradient id="skin" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#8B5A3C" />
                          <stop offset="100%" stopColor="#5C3A26" />
                        </linearGradient>
                      </defs>
                      {/* head */}
                      <ellipse cx="100" cy="55" rx="26" ry="34" fill="url(#skin)" />
                      {/* neck */}
                      <rect x="90" y="82" width="20" height="14" fill="url(#skin)" />
                      {/* torso trapezoid */}
                      <path d="M62 96 Q100 90 138 96 L146 200 Q135 232 100 232 Q65 232 54 200 Z" fill="url(#skin)" />
                      {/* waist */}
                      <path d="M62 232 Q100 220 138 232 L142 310 Q100 322 58 310 Z" fill="url(#skin)" />
                      {/* hips */}
                      <path d="M56 310 Q100 300 144 310 L156 400 Q100 412 44 400 Z" fill="url(#skin)" />
                      {/* legs */}
                      <path d="M56 400 L64 460 L92 460 L94 405 Z" fill="url(#skin)" />
                      <path d="M144 400 L136 460 L108 460 L106 405 Z" fill="url(#skin)" />
                      {/* hair — flowing behind body */}
                      <path
                        d="M74 76 Q40 130 44 200 Q42 300 60 400"
                        stroke="#171311" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.85"
                      />
                      <path
                        d="M126 76 Q160 130 156 200 Q158 300 140 400"
                        stroke="#171311" strokeWidth="14" strokeLinecap="round" fill="none" opacity="0.85"
                      />

                      {/* Tier marks */}
                      {TIERS.map((t) => {
                        const active = selectedInches === t.inches;
                        return (
                          <g key={t.inches}>
                            <line
                              x1="30" x2="170" y1={t.y} y2={t.y}
                              stroke={active ? "#C49A45" : "#A37C2E"} strokeDasharray="3 3"
                              strokeWidth={active ? 1.6 : 0.8} opacity={active ? 1 : 0.55}
                            />
                            <circle cx="26" cy={t.y} r={active ? 5 : 3.5}
                                    fill={active ? "#C49A45" : "#171311"} />
                            <text
                              x="174" y={t.y + 3} fontSize="10"
                              fill={active ? "#C49A45" : "#4A463F"}
                              fontWeight={active ? 600 : 400}
                            >
                              {t.inches}"
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Guide content */}
                  <div className="p-8 md:p-10">
                    <p className="overline text-[#A37C2E] mb-3">Guide des longueurs</p>
                    <h3 className="font-serif text-3xl text-[#171311] leading-tight mb-4">
                      Quelle longueur <span className="font-script text-[#C49A45]">vous ressemble</span>&nbsp;?
                    </h3>
                    <p className="text-sm text-[#4A463F] mb-6 leading-relaxed">
                      Nos extensions sont mesurées en pouces (10&quot; à 30&quot;), tirées à plat. Une fois ondulées ou bouclées, la longueur visible est d&apos;environ 10–15% plus courte. Repérez la ligne qui vous parle sur la silhouette.
                    </p>
                    <ul className="space-y-3">
                      {TIERS.map((t) => {
                        const active = selectedInches === t.inches;
                        return (
                          <li
                            key={t.inches}
                            data-testid={`guide-tier-${t.inches}`}
                            className={`flex items-start gap-3 p-3 border cursor-pointer transition-colors ${
                              active ? "border-[#C49A45] bg-[#C49A45]/8" : "border-[#171311]/10 hover:border-[#C49A45]/40"
                            }`}
                            onClick={() => { if (onSelect) onSelect(t.inches); setOpen(false); }}
                          >
                            <span className={`font-serif text-lg leading-none pt-0.5 ${active ? "text-[#C49A45]" : "text-[#171311]"}`}>
                              {t.inches}&quot;
                            </span>
                            <div className="flex-1">
                              <p className="text-sm text-[#171311] font-medium">{t.label}</p>
                              <p className="text-xs text-[#4A463F]">{t.note}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="mt-6 text-[11px] text-[#737373]">
                      Astuce : pour un premier essai, la longueur signature ÉLANI est 22&quot; — équilibre parfait entre volume, mouvement et facilité de coiffage.
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

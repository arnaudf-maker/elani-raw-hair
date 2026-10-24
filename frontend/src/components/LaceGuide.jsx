import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Scissors, Droplets, Layers, Wind, Sparkles, X, PlayCircle } from "lucide-react";

const STEPS = [
  {
    n: "01",
    icon: Scissors,
    title: "Préparez votre lace",
    body: "Dégagez la ligne de tulle avec des ciseaux fins en suivant la naissance des cheveux. Coupez très près sans entamer les baby hairs. Testez toujours à sec avant application.",
    tip: "Astuce : découpez en 3-4 petites sections plutôt qu'en un seul geste.",
  },
  {
    n: "02",
    icon: Droplets,
    title: "Préparez le cuir chevelu",
    body: "Nettoyez et dégraissez la ligne de front avec un tonique alcoolisé. Appliquez un scalp protector pour créer une barrière protectrice, laissez sécher complètement.",
    tip: "Peau sensible ? Faites toujours un patch-test 24h avant.",
  },
  {
    n: "03",
    icon: Layers,
    title: "Appliquez la colle",
    body: "Utilisez une colle waterproof adaptée aux HD lace. Appliquez en 2 à 3 fines couches en attendant que chaque couche devienne translucide (tack).",
    tip: "Fines couches > couche épaisse. C'est le secret d'une tenue longue durée.",
  },
  {
    n: "04",
    icon: Wind,
    title: "Fixez la lace",
    body: "Positionnez la lace en la tirant légèrement vers l'arrière. Appuyez délicatement avec le peigne ÉLANI ou un rat-tail comb. Utilisez un sèche-cheveux à froid pour figer.",
    tip: "Pressez uniformément 30 secondes. La lace doit fondre sur le cuir chevelu.",
  },
  {
    n: "05",
    icon: Sparkles,
    title: "Coiffage & finitions",
    body: "Créez vos baby hairs à l'edge control, tracez votre raie, brossez et coiffez normalement. La lace HD ÉLANI se fond intégralement à toutes les carnations.",
    tip: "Un léger fond de teint sur la lace peut parfaire l'illusion.",
  },
];

export default function LaceGuide({ triggerClass = "", triggerLabel = "Comment poser sa Lace HD ?" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-testid="open-lace-guide"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-2 text-sm text-[#A37C2E] hover:text-[#171311] underline underline-offset-4 decoration-[#C49A45]/40 ${triggerClass}`}
      >
        <PlayCircle size={16} /> {triggerLabel}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              data-testid="lace-guide-overlay"
              className="fixed inset-0 bg-[#171311]/70 z-[70]"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              data-testid="lace-guide-modal"
              className="fixed inset-0 z-[71] flex items-start justify-center p-4 overflow-y-auto pointer-events-none"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 40, opacity: 0 }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                className="relative bg-[#FAFAF7] border border-[#C49A45]/25 w-full max-w-4xl my-8 pointer-events-auto"
              >
                <button
                  onClick={() => setOpen(false)}
                  data-testid="close-lace-guide"
                  className="absolute top-5 right-5 text-[#4A463F] hover:text-[#171311] z-10"
                >
                  <X size={22} />
                </button>

                {/* Header */}
                <div className="p-8 md:p-12 border-b border-[#171311]/10 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-6 items-end">
                  <div>
                    <p className="overline text-[#A37C2E] mb-3">Guide pratique</p>
                    <h3 className="font-serif text-3xl md:text-4xl leading-tight text-[#171311] pb-2">
                      Comment poser <span className="font-script text-[#C49A45] text-4xl md:text-5xl block leading-[1.15] pb-2">votre Lace HD</span>
                    </h3>
                    <p className="text-sm text-[#4A463F] mt-1 max-w-lg">5 étapes clés pour une pose parfaite, invisible et durable. À la maison ou avec votre coiffeuse habituelle.</p>
                  </div>
                  <div className="text-center">
                    <p className="font-serif text-4xl text-[#C49A45]">05</p>
                    <p className="overline text-[10px] text-[#4A463F]">étapes</p>
                  </div>
                </div>

                {/* Steps */}
                <div className="p-8 md:p-12 space-y-6">
                  {STEPS.map((s, i) => (
                    <motion.div
                      key={s.n}
                      data-testid={`lace-step-${s.n}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * i, duration: 0.5 }}
                      className="grid grid-cols-[auto_1fr] gap-6 items-start border-b border-[#171311]/6 pb-6 last:border-b-0"
                    >
                      <div className="flex flex-col items-center pt-1">
                        <div className="w-12 h-12 border border-[#C49A45]/40 bg-[#C49A45]/8 flex items-center justify-center">
                          <s.icon size={20} strokeWidth={1.2} style={{ color: "#A37C2E" }} />
                        </div>
                        <p className="font-serif text-lg text-[#C49A45] mt-2">{s.n}</p>
                      </div>
                      <div>
                        <p className="font-serif text-xl text-[#171311] mb-2 leading-tight">{s.title}</p>
                        <p className="text-sm text-[#4A463F] leading-relaxed mb-2">{s.body}</p>
                        <p className="text-xs text-[#A37C2E] italic">{s.tip}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Footer */}
                <div className="bg-[#F4F3ED] border-t border-[#171311]/10 p-6 md:p-8 text-center">
                  <p className="font-script text-2xl text-[#A37C2E] mb-2">Besoin d'aide ?</p>
                  <p className="text-sm text-[#4A463F] max-w-lg mx-auto">Réservez une <a href="/reservation" className="underline underline-offset-4 hover:text-[#171311]">consultation personnalisée</a> — nous vous guidons pas à pas ou vous recommandons notre poseuse partenaire près de chez vous.</p>
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

import React from "react";
import { MessageCircle, Mail, Instagram, Ghost, ShoppingBag, CreditCard, Truck } from "lucide-react";
import { MaskedReveal, Reveal } from "../components/Reveal";
import { CONTACT, IMG } from "../lib/brand";

const CHANNELS = [
  { icon: MessageCircle, label: "WhatsApp", value: CONTACT.whatsapp, sub: "Réponse rapide, 7j/7", href: CONTACT.whatsappHref, testid: "contact-whatsapp" },
  { icon: Mail, label: "Email", value: CONTACT.email, sub: "Pour toute demande", href: `mailto:${CONTACT.email}`, testid: "contact-email" },
  { icon: Instagram, label: "Instagram", value: `@${CONTACT.instagram}`, sub: "Nos dernières créations", href: CONTACT.instagramHref, testid: "contact-instagram" },
  { icon: Ghost, label: "Snapchat", value: CONTACT.snapchat, sub: "En coulisses", href: null, testid: "contact-snapchat" },
];

const ORDER_STEPS = [
  { icon: ShoppingBag, t: "Choisissez", d: "Sélectionnez votre texture, longueur et couleur dans la boutique." },
  { icon: CreditCard, t: "Commandez", d: "Paiement 100% sécurisé via Stripe, en quelques secondes." },
  { icon: Truck, t: "Recevez", d: "Livraison soignée directement chez vous, emballage signature ÉLANI." },
];

const CARE = [
  "Lavez délicatement avec un shampoing doux, sans sulfates.",
  "Appliquez un soin hydratant régulièrement pour préserver la brillance.",
  "Séchez à l'air libre et évitez la chaleur excessive.",
  "Conservez vos mèches dans leur pochette satin lorsqu'elles ne sont pas portées.",
];

export default function Contact() {
  return (
    <div className="bg-[#F4F3ED] min-h-screen pt-32" data-testid="contact-page">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
        <div className="pt-10 pb-16 border-b border-[#171311]/10">
          <p className="overline text-[#A37C2E] mb-6">À votre écoute</p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-[6vw] leading-[0.9] tracking-tighter text-[#171311]">
            <MaskedReveal lines={["Contactez", <span key="i" className="font-script text-[#C49A45] text-6xl md:text-8xl">nous</span>]} />
          </h1>
        </div>

        {/* Channels */}
        <Reveal>
          <div className="mt-12 flex flex-col items-center">
            <p className="overline text-[#A37C2E] mb-6">Grille tarifaire — Luxury Collection</p>
            <div className="overflow-hidden border border-[#C49A45]/25 shadow-[0_20px_60px_rgba(23,19,17,0.12)] max-w-lg w-full">
              <img src={IMG.brandContact} alt="ÉLANI — Luxury Collection, grille tarifaire" className="w-full h-auto" />
            </div>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 py-20">
          {CHANNELS.map((c, i) => {
            const Inner = (
              <>
                <c.icon size={24} strokeWidth={1.2} style={{ color: "#C49A45" }} className="mb-5" />
                <p className="overline text-[#A37C2E] mb-2">{c.label}</p>
                <p className="font-serif text-2xl text-[#171311] mb-1">{c.value}</p>
                <p className="text-xs text-[#737373]">{c.sub}</p>
              </>
            );
            return (
              <Reveal key={c.label} delay={i * 0.07}>
                {c.href ? (
                  <a href={c.href} target="_blank" rel="noreferrer" data-testid={c.testid}
                    className="block bg-[#FAFAF7] border border-[#C49A45]/20 p-8 h-full hover:border-[#C49A45] transition-colors">{Inner}</a>
                ) : (
                  <div data-testid={c.testid} className="bg-[#FAFAF7] border border-[#C49A45]/20 p-8 h-full">{Inner}</div>
                )}
              </Reveal>
            );
          })}
        </div>
      </div>

      {/* How to order */}
      <section className="bg-[#171311] py-28 md:py-36">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
          <Reveal><p className="overline text-[#C49A45] mb-4">Simple & rapide</p></Reveal>
          <Reveal delay={0.1}><h2 className="font-serif text-4xl md:text-6xl text-[#F4F3ED] mb-16">Comment commander</h2></Reveal>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {ORDER_STEPS.map((s, i) => (
              <Reveal key={s.t} delay={i * 0.1}>
                <div className="border-t border-white/10 pt-8">
                  <s.icon size={26} strokeWidth={1.1} style={{ color: "#C49A45" }} className="mb-5" />
                  <h3 className="font-serif text-2xl text-[#F4F3ED] mb-3">{s.t}</h3>
                  <p className="text-[#A3A3A3] text-sm leading-relaxed">{s.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Care tips */}
      <section className="max-w-[1600px] mx-auto px-6 lg:px-12 py-28 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <Reveal><div className="overflow-hidden aspect-[4/5]"><img src={IMG.wavyPortrait || IMG.rivieraWave} alt="" className="w-full h-full object-cover" /></div></Reveal>
        <div>
          <Reveal><p className="overline text-[#A37C2E] mb-4">Conseils d'entretien</p></Reveal>
          <Reveal delay={0.1}><h2 className="font-serif text-4xl md:text-5xl text-[#171311] mb-10">Sublimez la durée de vie de vos cheveux</h2></Reveal>
          <ul className="space-y-6">
            {CARE.map((c, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <li className="flex gap-5 border-t border-[#171311]/10 pt-5">
                  <span className="font-serif text-xl text-[#C49A45]">{String(i + 1).padStart(2, "0")}</span>
                  <p className="text-[#4A463F] text-sm leading-relaxed">{c}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Univers ÉLANI — brand planche */}
      <section className="bg-[#171311] py-24 md:py-32">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-12 text-center">
          <Reveal><p className="overline text-[#C49A45] mb-4">Nos tarifs</p></Reveal>
          <Reveal delay={0.1}><h2 className="font-serif text-4xl md:text-5xl text-[#F4F3ED] mb-12">Lace Closure &amp; Frontal <span className="font-script text-[#E5C88F] text-5xl md:text-6xl">HD</span></h2></Reveal>
          <Reveal delay={0.15}>
            <div className="overflow-hidden border border-[#C49A45]/25 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              <img src={IMG.brandGrid} alt="ÉLANI — Grille tarifaire Lace Closure et Frontal HD" className="w-full h-auto" />
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

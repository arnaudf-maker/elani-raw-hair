import React, { useState } from "react";
import { motion } from "framer-motion";
import { api, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Sparkles, Crown, Check, ArrowRight } from "lucide-react";
import { Reveal, MaskedReveal } from "../components/Reveal";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { IMG } from "../lib/brand";

const TEXTURES = ["Raw Straight", "Raw Wavy", "Body Wave", "Deep Wave", "Deep Curl", "Loose Wave", "Kinky Curly"];
const LACE_TYPES = ["Sans lace (mèches)", "Closure 5×5", "Closure 6×6", "Frontal HD 13×4", "Frontal HD 13×6", "Full Lace"];
const CAP_SIZES = ["Petit (54 cm)", "Standard (56 cm)", "Grand (58 cm)", "Sur mesure — à préciser"];
const BUDGETS = ["300 – 500 €", "500 – 800 €", "800 – 1 200 €", "1 200 – 2 000 €", "Plus de 2 000 €"];

const EMPTY = { name: "", email: "", phone: "", texture: "", length: "", color: "",
                cap_size: "", lace_type: "", style: "", budget: "", deadline: "", message: "" };

const PROMISES = [
  { icon: Crown, title: "Confection artisanale", body: "Chaque perruque est montée main dans notre atelier avec des cheveux bruts sélectionnés." },
  { icon: Sparkles, title: "Devis en 48h", body: "Nous étudions votre brief et vous adressons un devis détaillé sous 48 heures ouvrées." },
  { icon: Check, title: "Ajustements offerts", body: "Retouches d'ajustement du bonnet incluses à la livraison, en boutique ou à distance." },
];

export default function SurMesure() {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e?.target ? e.target.value : e });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.texture || !form.length || !form.color || !form.budget) {
      toast.error("Merci de remplir les champs obligatoires"); return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/custom-orders", form);
      setDone(data.order);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  return (
    <div className="bg-[#F4F3ED] min-h-screen pt-32" data-testid="sur-mesure-page">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
        {/* Hero */}
        <div className="pt-8 pb-16 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span data-testid="made-to-order-badge" className="inline-flex items-center gap-2 overline text-[10px] text-[#A37C2E] border border-[#C49A45]/50 bg-[#C49A45]/8 px-3 py-1.5 mb-6">
              <Sparkles size={12} /> Perruques faites sur commande
            </span>
            <h1 className="font-serif text-5xl md:text-7xl lg:text-[6vw] leading-[1.05] tracking-tighter text-[#171311] mb-8 pb-2">
              <MaskedReveal lines={["Confection"]} />
              <motion.span
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="font-script text-[#C49A45] text-5xl md:text-7xl lg:text-[6vw] block leading-[1.2] pb-3"
              >
                sur commande
              </motion.span>
            </h1>
            <Reveal delay={0.5}>
              <p className="text-[#4A463F] leading-relaxed max-w-md mb-4">
                Chaque perruque ÉLANI est <strong className="text-[#171311]">confectionnée à la main sur commande</strong>, spécifiquement pour vous. Aucun stock — chaque pièce est pensée pour votre morphologie, votre style et votre lumière.
              </p>
              <p className="text-sm text-[#4A463F] leading-relaxed max-w-md mb-8">
                Délai de confection&nbsp;: 3 à 6 semaines selon les finitions. Devis personnalisé sous 48h.
              </p>
            </Reveal>
            <ul className="space-y-4">
              {PROMISES.map((p, i) => (
                <Reveal key={p.title} delay={0.7 + i * 0.1}>
                  <li className="flex items-start gap-4">
                    <p.icon size={22} className="mt-1 shrink-0" style={{ color: "#C49A45" }} strokeWidth={1.2} />
                    <div>
                      <p className="font-serif text-lg text-[#171311]">{p.title}</p>
                      <p className="text-sm text-[#4A463F] leading-relaxed">{p.body}</p>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
          <Reveal delay={0.3}>
            <div className="relative w-full aspect-[3/4] max-h-[680px] overflow-hidden border border-[#C49A45]/25">
              <img src="/products/wavy_portrait.png" alt="Perruque ÉLANI sur mesure" className="w-full h-full object-cover" onError={(e) => { e.target.src = IMG.brandStone; }} />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171311]/55 via-transparent to-transparent" />
              <div className="absolute top-6 right-6">
                <span className="inline-block bg-[#171311] text-[#F0D9A0] overline text-[10px] px-4 py-2 border border-[#C49A45]/40">
                  Made to order
                </span>
              </div>
              <div className="absolute bottom-6 left-6 text-[#F4F3ED]">
                <p className="overline mb-2 text-[#F0D9A0]">Atelier ÉLANI</p>
                <p className="font-script text-3xl leading-[1.15] pb-1">Une pièce unique, votre signature.</p>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Made-to-order strip */}
        <div className="border-y border-[#171311]/10 py-8 mb-16 grid grid-cols-1 md:grid-cols-3 gap-6 text-center" data-testid="made-to-order-strip">
          {[
            { n: "01", t: "Vous partagez votre brief", s: "Texture, longueur, couleur, style" },
            { n: "02", t: "Devis + confection main", s: "3 à 6 semaines dans notre atelier" },
            { n: "03", t: "Livraison discrète", s: "Écrin ÉLANI + peigne signature" },
          ].map((x) => (
            <div key={x.n}>
              <p className="font-script text-2xl text-[#C49A45] mb-1">{x.n}</p>
              <p className="font-serif text-lg text-[#171311]">{x.t}</p>
              <p className="text-xs text-[#4A463F] mt-1">{x.s}</p>
            </div>
          ))}
        </div>

        {/* Form / Success */}
        {done ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
            className="max-w-2xl mx-auto text-center py-20"
            data-testid="custom-order-success"
          >
            <Check size={48} strokeWidth={1.1} className="mx-auto mb-6" style={{ color: "#C49A45" }} />
            <p className="overline text-[#A37C2E] mb-4">Brief reçu</p>
            <h2 className="font-serif text-4xl md:text-5xl leading-tight text-[#171311] mb-6">
              Merci, <span className="font-script text-[#C49A45]">{done.name.split(" ")[0]}</span>
            </h2>
            <p className="text-[#4A463F] leading-relaxed max-w-lg mx-auto mb-2">
              Nous étudions votre projet et vous adressons un devis personnalisé sous 48 heures ouvrées à l'adresse&nbsp;
              <span className="text-[#171311] font-medium">{done.email}</span>.
            </p>
            <p className="text-sm text-[#4A463F] mb-8">Réf. #{done.id.slice(0, 8).toUpperCase()}</p>
            <button
              data-testid="new-brief"
              onClick={() => { setDone(null); setForm(EMPTY); }}
              className="overline text-xs border border-[#171311] text-[#171311] px-6 py-3 hover:bg-[#171311] hover:text-[#F4F3ED] transition-colors"
            >
              Envoyer un nouveau brief
            </button>
          </motion.div>
        ) : (
          <form onSubmit={submit} className="max-w-4xl mx-auto bg-white/60 border border-[#171311]/10 p-8 md:p-12 mb-24" data-testid="custom-order-form">
            <p className="overline text-[#A37C2E] mb-3">Votre brief</p>
            <h2 className="font-serif text-3xl md:text-4xl text-[#171311] mb-10 leading-tight">Racontez-nous votre pièce&nbsp;idéale.</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Field label="Nom complet *"><input data-testid="cf-name" required value={form.name} onChange={set("name")} className={inp} /></Field>
              <Field label="Email *"><input data-testid="cf-email" required type="email" value={form.email} onChange={set("email")} className={inp} /></Field>
              <Field label="Téléphone / WhatsApp"><input data-testid="cf-phone" value={form.phone} onChange={set("phone")} className={inp} placeholder="+33 …" /></Field>
              <Field label="Deadline souhaitée"><input data-testid="cf-deadline" type="date" value={form.deadline} onChange={set("deadline")} className={inp} /></Field>

              <Field label="Texture *">
                <Select value={form.texture} onValueChange={set("texture")}>
                  <SelectTrigger data-testid="cf-texture" className={inp}><SelectValue placeholder="Choisir une texture" /></SelectTrigger>
                  <SelectContent className={sel}>{TEXTURES.map((t) => <SelectItem key={t} value={t} className={selItem}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>

              <Field label="Longueur *"><input data-testid="cf-length" required value={form.length} onChange={set("length")} className={inp} placeholder="Ex : 24 pouces / 60 cm" /></Field>

              <Field label="Couleur *"><input data-testid="cf-color" required value={form.color} onChange={set("color")} className={inp} placeholder="Noir naturel, blond miel…" /></Field>

              <Field label="Bonnet">
                <Select value={form.cap_size} onValueChange={set("cap_size")}>
                  <SelectTrigger data-testid="cf-cap" className={inp}><SelectValue placeholder="Choisir un bonnet" /></SelectTrigger>
                  <SelectContent className={sel}>{CAP_SIZES.map((t) => <SelectItem key={t} value={t} className={selItem}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>

              <Field label="Type de lace">
                <Select value={form.lace_type} onValueChange={set("lace_type")}>
                  <SelectTrigger data-testid="cf-lace" className={inp}><SelectValue placeholder="Choisir la lace" /></SelectTrigger>
                  <SelectContent className={sel}>{LACE_TYPES.map((t) => <SelectItem key={t} value={t} className={selItem}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>

              <Field label="Budget *">
                <Select value={form.budget} onValueChange={set("budget")}>
                  <SelectTrigger data-testid="cf-budget" className={inp}><SelectValue placeholder="Choisir un budget" /></SelectTrigger>
                  <SelectContent className={sel}>{BUDGETS.map((t) => <SelectItem key={t} value={t} className={selItem}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </Field>

              <Field span label="Style & inspiration"><textarea data-testid="cf-style" rows={3} value={form.style} onChange={set("style")} className={inp} placeholder="Description du look souhaité, célébrités inspirantes, photos de référence à envoyer par email…" /></Field>
              <Field span label="Message additionnel"><textarea data-testid="cf-message" rows={2} value={form.message} onChange={set("message")} className={inp} placeholder="Attentes, allergies, contraintes…" /></Field>
            </div>

            <button
              data-testid="cf-submit"
              type="submit" disabled={loading}
              className="mt-10 w-full sm:w-auto inline-flex items-center justify-center gap-3 bg-[#171311] text-[#F4F3ED] overline px-10 py-4 hover:bg-[#C49A45] transition-colors disabled:opacity-50"
            >
              {loading ? "Envoi…" : (<><Sparkles size={14} /> Envoyer mon brief <ArrowRight size={14} /></>)}
            </button>
            <p className="text-[11px] text-[#737373] mt-4">Nous vous répondons sous 48h avec un devis détaillé et un délai de confection.</p>
          </form>
        )}
      </div>
    </div>
  );
}

const inp = "w-full bg-white border border-[#171311]/15 px-4 py-3 outline-none focus:border-[#C49A45] transition-colors text-[#171311] text-sm placeholder:text-[#A3A3A3]";
const sel = "bg-white border border-[#171311]/15 text-[#171311] shadow-lg z-[80]";
const selItem = "text-sm text-[#171311] focus:bg-[#F4F3ED] focus:text-[#A37C2E] cursor-pointer";
function Field({ label, span, children }) {
  return (
    <div className={span ? "md:col-span-2" : ""}>
      <label className="overline text-[#A37C2E] block mb-2 text-[11px]">{label}</label>
      {children}
    </div>
  );
}

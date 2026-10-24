import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, CalendarDays, Clock, ArrowLeft } from "lucide-react";
import { api, formatApiErrorDetail } from "../lib/api";
import { toast } from "sonner";
import { Calendar } from "../components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { MaskedReveal, Reveal } from "../components/Reveal";
import { IMG } from "../lib/brand";

const WIG_TYPES = ["The Silk Collection (Raw Straight)", "The Riviera Wave (Raw Wavy)", "Lace Closure / Frontal HD", "Coffret / Mèches", "Je ne sais pas encore"];
const BUDGETS = ["Moins de 200 €", "200 € – 400 €", "400 € – 700 €", "Plus de 700 €"];

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const prettyDate = (s) => new Date(s + "T00:00:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function Reservation() {
  const [slots, setSlots] = useState([]);
  const [date, setDate] = useState(null);
  const [slotId, setSlotId] = useState(null);
  const [form, setForm] = useState({ name: "", wig_type: "", budget: "", phone: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    api.get("/consultations/availability").then(({ data }) => setSlots(data)).catch(() => {});
  }, []);

  const availableDates = useMemo(() => new Set(slots.map((s) => s.date)), [slots]);
  const daySlots = useMemo(() => {
    if (!date) return [];
    const key = fmt(date);
    return slots.filter((s) => s.date === key);
  }, [date, slots]);

  const selectedSlot = slots.find((s) => s.id === slotId);

  const submit = async (e) => {
    e.preventDefault();
    if (!slotId) return;
    setLoading(true);
    try {
      const { data } = await api.post("/consultations/book", { slot_id: slotId, ...form });
      setDone(data.booking);
      window.scrollTo(0, 0);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-[#F4F3ED] flex items-center justify-center px-6 pt-24" data-testid="reservation-confirmed">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="text-center max-w-lg">
          <div className="w-20 h-20 rounded-full border border-[#C49A45] flex items-center justify-center mx-auto mb-8">
            <Check className="text-[#C49A45]" size={36} strokeWidth={1.2} />
          </div>
          <p className="overline text-[#A37C2E] mb-4">Réservation confirmée</p>
          <h1 className="font-serif text-4xl md:text-5xl tracking-tight mb-4 text-[#171311]">À très bientôt, {done.name.split(" ")[0]}</h1>
          <p className="font-script text-3xl text-[#C49A45] mb-8">Merci</p>
          <div className="bg-[#FAFAF7] border border-[#C49A45]/25 p-8 text-left space-y-3 mb-10">
            <p className="flex items-center gap-3 text-[#171311]"><CalendarDays size={18} style={{ color: "#C49A45" }} /> {prettyDate(done.date)}</p>
            <p className="flex items-center gap-3 text-[#171311]"><Clock size={18} style={{ color: "#C49A45" }} /> {done.time}</p>
            <p className="text-sm text-[#4A463F] pt-2 border-t border-[#171311]/10">Type souhaité : {done.wig_type}</p>
            <p className="text-sm text-[#4A463F]">Budget : {done.budget}</p>
          </div>
          <p className="text-[#4A463F] text-sm mb-8">Notre équipe vous contactera pour confirmer les détails de votre consultation personnalisée.</p>
          <a href="/boutique" className="inline-block bg-[#171311] text-[#F4F3ED] overline px-10 py-4 hover:bg-[#C49A45] hover:text-white transition-colors">Découvrir la boutique</a>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-[#F4F3ED] min-h-screen pt-32" data-testid="reservation-page">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
        <div className="pt-6 pb-12 border-b border-[#171311]/10">
          <p className="overline text-[#A37C2E] mb-6">Sur rendez-vous</p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-[6vw] leading-[1.05] tracking-tighter text-[#171311] pb-3">
            <MaskedReveal lines={["Consultation"]} />
            <motion.span
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
              className="font-script text-[#C49A45] text-6xl md:text-8xl block leading-[1.15] pb-4"
            >
              personnalisée
            </motion.span>
          </h1>
          <p className="text-[#4A463F] mt-6 max-w-xl">Un accompagnement sur mesure pour trouver la pièce ÉLANI qui vous ressemble. Choisissez votre créneau, nous nous occupons du reste.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 py-16">
          {/* LEFT: date + slots */}
          <Reveal>
            <div className="bg-[#FAFAF7] border border-[#C49A45]/20 p-8">
              <p className="overline text-[#A37C2E] mb-6">1 · Choisissez une date</p>
              {availableDates.size === 0 ? (
                <p className="text-[#4A463F] text-sm py-10 text-center">Aucun créneau disponible pour le moment. Revenez bientôt ou contactez-nous via WhatsApp.</p>
              ) : (
                <div className="flex justify-center">
                  <Calendar
                    data-testid="reservation-calendar"
                    mode="single"
                    selected={date}
                    onSelect={(d) => { setDate(d); setSlotId(null); }}
                    fromDate={new Date()}
                    disabled={(d) => !availableDates.has(fmt(d))}
                    classNames={{
                      caption_label: "text-sm font-medium text-[#171311] capitalize",
                      head_cell: "text-[#A37C2E] rounded-md w-9 font-normal text-[0.8rem]",
                      day: "h-9 w-9 p-0 font-normal rounded-full text-[#171311] hover:bg-[#EBE8DF] transition-colors",
                      day_selected: "bg-[#171311] text-[#F4F3ED] hover:bg-[#171311] hover:text-[#F4F3ED] focus:bg-[#171311]",
                      day_today: "text-[#A37C2E] font-semibold",
                      day_disabled: "text-[#171311]/20 hover:bg-transparent cursor-not-allowed",
                      nav_button: "h-7 w-7 bg-transparent p-0 border border-[#171311]/15 rounded-full hover:border-[#C49A45] inline-flex items-center justify-center",
                    }}
                  />
                </div>
              )}

              {date && (
                <div className="mt-8">
                  <p className="overline text-[#A37C2E] mb-4">2 · Créneaux du {prettyDate(fmt(date))}</p>
                  <div className="flex flex-wrap gap-3">
                    {daySlots.length === 0 && <p className="text-sm text-[#4A463F]">Aucun créneau ce jour-là.</p>}
                    {daySlots.map((s) => (
                      <button key={s.id} data-testid={`slot-${s.id}`} onClick={() => setSlotId(s.id)}
                        className={`overline px-5 py-3 border transition-colors ${
                          slotId === s.id ? "bg-[#171311] text-[#F4F3ED] border-[#171311]" : "border-[#171311]/15 text-[#4A463F] hover:border-[#C49A45] hover:text-[#A37C2E]"
                        }`}>
                        {s.time}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Reveal>

          {/* RIGHT: form */}
          <Reveal delay={0.1}>
            <div className="relative">
              <AnimatePresence mode="wait">
                {!slotId ? (
                  <motion.div key="ph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="h-full min-h-[400px] flex flex-col items-center justify-center text-center border border-dashed border-[#171311]/15 p-10">
                    <img src={IMG.wavyPortrait || IMG.rivieraWave} alt="" className="w-24 h-24 object-cover rounded-full mb-6 opacity-80" />
                    <p className="font-serif text-2xl text-[#171311] mb-2">Votre consultation privée</p>
                    <p className="text-sm text-[#4A463F] max-w-xs">Sélectionnez une date puis un créneau pour compléter votre demande.</p>
                  </motion.div>
                ) : (
                  <motion.form key="form" onSubmit={submit} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="bg-[#FAFAF7] border border-[#C49A45]/20 p-8 space-y-6" data-testid="reservation-form">
                    <button type="button" onClick={() => setSlotId(null)} className="inline-flex items-center gap-2 overline text-[#4A463F] hover-gold">
                      <ArrowLeft size={13} /> Modifier le créneau
                    </button>
                    <div className="border-l-2 border-[#C49A45] pl-4">
                      <p className="text-sm text-[#171311]">{prettyDate(selectedSlot.date)}</p>
                      <p className="text-sm text-[#A37C2E]">{selectedSlot.time}</p>
                    </div>

                    <div>
                      <label className="overline text-[#A37C2E] block mb-2">Nom complet</label>
                      <input data-testid="res-name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full bg-transparent border-b border-[#171311]/20 py-3 outline-none focus:border-[#C49A45] transition-colors text-[#171311]" />
                    </div>

                    <div>
                      <label className="overline text-[#A37C2E] block mb-2">Type d'extensions souhaité</label>
                      <Select value={form.wig_type} onValueChange={(v) => setForm({ ...form, wig_type: v })}>
                        <SelectTrigger data-testid="res-wig-type" className="w-full bg-transparent border-[#171311]/20 text-[#171311]"><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                        <SelectContent>{WIG_TYPES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="overline text-[#A37C2E] block mb-2">Budget approximatif</label>
                      <Select value={form.budget} onValueChange={(v) => setForm({ ...form, budget: v })}>
                        <SelectTrigger data-testid="res-budget" className="w-full bg-transparent border-[#171311]/20 text-[#171311]"><SelectValue placeholder="Sélectionnez" /></SelectTrigger>
                        <SelectContent>{BUDGETS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="overline text-[#A37C2E] block mb-2">Téléphone (optionnel)</label>
                      <input data-testid="res-phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full bg-transparent border-b border-[#171311]/20 py-3 outline-none focus:border-[#C49A45] transition-colors text-[#171311]" />
                    </div>

                    <div>
                      <label className="overline text-[#A37C2E] block mb-2">Message (optionnel)</label>
                      <textarea data-testid="res-message" rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="w-full bg-transparent border-b border-[#171311]/20 py-3 outline-none focus:border-[#C49A45] transition-colors text-[#171311]" />
                    </div>

                    <button data-testid="res-submit" type="submit" disabled={loading || !form.wig_type || !form.budget}
                      className="w-full bg-[#171311] text-[#F4F3ED] overline py-4 hover:bg-[#C49A45] hover:text-white transition-colors disabled:opacity-40">
                      {loading ? "Envoi..." : "Confirmer ma réservation"}
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

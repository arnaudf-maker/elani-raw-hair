import React, { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import Stars from "./Stars";
import { ShieldCheck, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

function formatDate(iso) {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }); }
  catch { return ""; }
}

export default function ProductReviews({ productId }) {
  const { user } = useAuth();
  const [data, setData] = useState({ reviews: [], average: 0, count: 0 });
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const load = () => {
    setLoading(true);
    api.get(`/products/${productId}/reviews`)
      .then(({ data }) => setData(data))
      .catch(() => setData({ reviews: [], average: 0, count: 0 }))
      .finally(() => setLoading(false));
  };
  useEffect(load, [productId]);

  const submit = async (e) => {
    e.preventDefault();
    if (comment.trim().length < 3) { toast.error("Merci d'écrire un avis un peu plus détaillé"); return; }
    setSubmitting(true);
    try {
      await api.post(`/products/${productId}/reviews`, { rating, comment: comment.trim() });
      toast.success("Merci ! Votre avis est en attente de modération.");
      setSubmitted(true);
      setComment("");
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section data-testid="product-reviews" className="mt-24 border-t border-[#171311]/10 pt-16">
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-14">
        {/* Aggregate */}
        <div>
          <p className="overline text-[#A37C2E] mb-4">Avis vérifiés</p>
          <h2 className="font-serif text-4xl text-[#171311] mb-6 leading-none">Elles en parlent</h2>
          <div className="flex items-baseline gap-3 mb-3">
            <span className="font-serif text-5xl text-[#171311]">{data.count > 0 ? data.average.toFixed(1) : "—"}</span>
            <span className="text-sm text-[#4A463F]">/ 5</span>
          </div>
          <Stars value={data.average} size={18} />
          <p className="text-xs text-[#4A463F] mt-3">
            {data.count === 0 ? "Aucun avis pour le moment." : `${data.count} avis`}
          </p>

          {/* Form */}
          <div className="mt-10 border-t border-[#171311]/10 pt-8">
            {!user ? (
              <div className="text-sm text-[#4A463F]">
                <Link to="/auth" className="underline underline-offset-4 hover-gold">Connectez-vous</Link> pour déposer un avis.
              </div>
            ) : submitted ? (
              <p data-testid="review-thanks" className="text-sm text-[#A37C2E]">Merci, votre avis sera publié après modération.</p>
            ) : (
              <form onSubmit={submit} className="space-y-4" data-testid="review-form">
                <p className="overline text-[#A37C2E]">Votre note</p>
                <Stars value={rating} onChange={setRating} size={22} />
                <textarea
                  data-testid="review-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Partagez votre expérience ÉLANI — texture, brillance, tenue…"
                  rows={4}
                  maxLength={1500}
                  className="w-full bg-white border border-[#171311]/15 px-4 py-3 text-sm outline-none focus:border-[#C49A45] text-[#171311] placeholder:text-[#A3A3A3]"
                />
                <button
                  data-testid="submit-review"
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 bg-[#171311] text-[#F4F3ED] overline px-6 py-3 hover:bg-[#C49A45] transition-colors disabled:opacity-50"
                >
                  <MessageSquare size={14} /> {submitting ? "Envoi…" : "Déposer mon avis"}
                </button>
                <p className="text-[10px] text-[#737373]">Publié après validation. Les avis provenant d'un achat sont marqués « Achat vérifié ».</p>
              </form>
            )}
          </div>
        </div>

        {/* Reviews list */}
        <div>
          {loading ? (
            <p className="text-sm text-[#4A463F]">Chargement…</p>
          ) : data.reviews.length === 0 ? (
            <div className="border border-dashed border-[#171311]/15 p-12 text-center">
              <p className="font-serif text-2xl text-[#171311] mb-2">Soyez la première.</p>
              <p className="text-sm text-[#4A463F]">Aucun avis publié pour cette pièce.</p>
            </div>
          ) : (
            <ul className="space-y-8">
              {data.reviews.map((r) => (
                <li key={r.id} data-testid={`review-${r.id}`} className="border-b border-[#171311]/8 pb-8 last:border-b-0">
                  <div className="flex items-center gap-3 mb-2">
                    <Stars value={r.rating} size={13} />
                    {r.verified && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-[#A37C2E] bg-[#C49A45]/10 border border-[#C49A45]/30 px-2 py-0.5">
                        <ShieldCheck size={11} /> Achat vérifié
                      </span>
                    )}
                  </div>
                  <p className="text-[#171311] leading-relaxed mb-2">{r.comment}</p>
                  <p className="text-xs text-[#4A463F]">— {r.user_name || "Cliente ÉLANI"} · {formatDate(r.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

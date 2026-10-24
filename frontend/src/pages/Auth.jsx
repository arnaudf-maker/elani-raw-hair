import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { api, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import Logo from "../components/Logo";
import { IMG } from "../lib/brand";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [params] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (params.get("error") === "session") {
      toast.error("La connexion Google a échoué. Merci de réessayer.");
    }
  }, [params]);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const path = mode === "login" ? "/auth/login" : "/auth/register";
      const payload = mode === "login" ? { email: form.email, password: form.password } : form;
      const { data } = await api.post(path, payload);
      login(data);
      toast.success(mode === "login" ? "Bienvenue chez ÉLANI" : "Compte créé avec succès");
      navigate(data.user.role === "admin" ? "/admin" : "/compte");
    } catch (e) {
      setError(formatApiErrorDetail(e.response?.data?.detail));
    } finally { setLoading(false); }
  };

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/compte";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen bg-[#F4F3ED] grid grid-cols-1 lg:grid-cols-2" data-testid="auth-page">
      <div className="hidden lg:flex flex-col items-center justify-center relative overflow-hidden bg-[#171311] p-10">
        <img src={IMG.brandStone} alt="ÉLANI" className="max-w-full max-h-[76vh] w-auto object-contain" />
        <p className="font-script text-4xl text-[#E5C88F] mt-8">L'élégance commence ici.</p>
      </div>

      <div className="flex items-center justify-center px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="w-full max-w-sm">
          <div className="mb-10"><Logo tone="dark" size="md" /></div>
          <p className="overline text-[#A37C2E] mb-3 text-center">{mode === "login" ? "Connexion" : "Inscription"}</p>
          <h1 className="font-serif text-3xl md:text-4xl tracking-tight mb-10 text-[#171311] text-center">
            {mode === "login" ? "Ravie de vous revoir" : "Rejoignez le cercle"}
          </h1>

          <form onSubmit={submit} className="space-y-6">
            {mode === "register" && (
              <input data-testid="name-input" required placeholder="Nom complet" value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full bg-transparent border-b border-[#171311]/20 py-3 outline-none focus:border-[#C49A45] transition-colors text-[#171311] placeholder:text-[#737373]" />
            )}
            <input data-testid="email-input" required type="email" placeholder="Adresse email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-transparent border-b border-[#171311]/20 py-3 outline-none focus:border-[#C49A45] transition-colors text-[#171311] placeholder:text-[#737373]" />
            <input data-testid="password-input" required type="password" placeholder="Mot de passe" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full bg-transparent border-b border-[#171311]/20 py-3 outline-none focus:border-[#C49A45] transition-colors text-[#171311] placeholder:text-[#737373]" />

            {error && <p data-testid="auth-error" className="text-red-500 text-sm">{error}</p>}

            <button data-testid="auth-submit" type="submit" disabled={loading}
              className="w-full bg-[#171311] text-[#F4F3ED] overline py-4 hover:bg-[#C49A45] hover:text-white transition-colors disabled:opacity-50">
              {loading ? "..." : mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <div className="flex items-center gap-4 my-8">
            <div className="flex-1 h-px bg-[#171311]/10" />
            <span className="overline text-[#737373]">ou</span>
            <div className="flex-1 h-px bg-[#171311]/10" />
          </div>

          <button data-testid="google-login" onClick={google}
            className="w-full border border-[#171311]/15 py-4 overline text-[#171311] hover:border-[#C49A45] hover:text-[#A37C2E] transition-colors">
            Continuer avec Google
          </button>

          <p className="text-sm text-[#4A463F] mt-8 text-center">
            {mode === "login" ? "Pas encore de compte ?" : "Déjà inscrite ?"}{" "}
            <button data-testid="toggle-mode" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-[#A37C2E] link-underline">
              {mode === "login" ? "Créer un compte" : "Se connecter"}
            </button>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

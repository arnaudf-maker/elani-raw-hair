import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import { Gem, Sparkles, ShieldCheck, HeartHandshake, Crown } from "lucide-react";
import { api } from "../lib/api";
import { IMG } from "../lib/brand";
import { MaskedReveal, Reveal } from "../components/Reveal";
import Logo from "../components/Logo";
import ProductCard from "../components/ProductCard";

const VALUES = [
  { icon: Sparkles, t: "Cheveux bruts 100% naturels" },
  { icon: Gem, t: "Qualité premium" },
  { icon: ShieldCheck, t: "Durabilité & résistance" },
  { icon: HeartHandshake, t: "Éthique & respect" },
  { icon: Crown, t: "Élégance intemporelle" },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["0%", "22%"]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const opacity = useTransform(scrollYProgress, [0, 0.85], [1, 0]);

  useEffect(() => {
    api.get("/products", { params: { featured: true } }).then(({ data }) => setFeatured(data.slice(0, 4)));
  }, []);

  return (
    <div className="bg-[#F4F3ED]" data-testid="home-page">
      {/* HERO */}
      <section ref={heroRef} className="relative h-screen overflow-hidden">
        <motion.div style={{ y, scale }} className="absolute inset-0">
          <img src={IMG.heroRiviera} alt="Riviera" className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-[#171311]/45" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#171311]/85 via-[#171311]/25 to-[#171311]/40" />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 48% at 50% 44%, rgba(23,19,17,0.55) 0%, rgba(23,19,17,0) 72%)" }} />
        </motion.div>

        <motion.div style={{ opacity }} className="relative h-full max-w-[1600px] mx-auto px-6 lg:px-12 flex flex-col items-center justify-center text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}>
            <Logo tone="light" size="xl" />
          </motion.div>
          <h1 className="sr-only">ÉLANI Raw Hair</h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 1, ease: [0.22, 1, 0.36, 1] }}
            className="font-script text-[#F0D9A0] text-4xl md:text-6xl lg:text-7xl mt-10 leading-[1.35] pb-3"
            style={{ textShadow: "0 2px 18px rgba(0,0,0,0.6)" }}
          >
            L'élégance commence ici.
          </motion.p>
          <Reveal delay={1.4} className="mt-10 flex flex-col sm:flex-row gap-5 sm:items-center">
            <Link to="/boutique" data-testid="hero-cta" className="bg-[#E5C88F] text-[#171311] overline px-12 py-4 hover:bg-white transition-colors">
              Découvrir la collection
            </Link>
            <Link to="/reservation" className="overline text-[#F4F3ED] link-underline">Prendre rendez-vous</Link>
          </Reveal>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8, duration: 1 }}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 overline text-[#F4F3ED]/70">
          Défiler
        </motion.div>
      </section>

      {/* VALUES */}
      <section className="bg-[#171311] text-[#F4F3ED] py-10 border-b border-[#C49A45]/20">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 grid grid-cols-2 md:grid-cols-5 gap-8">
          {VALUES.map((v, i) => (
            <Reveal key={v.t} delay={i * 0.06}>
              <div className="flex flex-col items-center text-center gap-3">
                <v.icon size={22} strokeWidth={1.1} style={{ color: "#C49A45" }} />
                <span className="overline text-[#A3A3A3] leading-relaxed">{v.t}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* BRAND STATEMENT — full-bleed flagship creative (logo + crown) */}
      <section className="relative">
        <Link to="/histoire" className="group block relative overflow-hidden" data-testid="brand-statement">
          <img src={IMG.brandHistoire} alt="ÉLANI Raw Hair — Notre histoire" className="w-full h-auto" />
        </Link>
      </section>

      {/* MARQUEE */}
      <section className="py-8 overflow-hidden bg-[#EBE8DF] border-b border-[#171311]/5">
        <div className="marquee-track">
          {[...Array(2)].map((_, k) => (
            <div key={k} className="flex items-center">
              {["Luxury is a lifestyle", "Hair is the signature", "Raw Hair 100% naturel", "The Silk Collection", "The Riviera Wave", "For women who define elegance"].map((w, i) => (
                <span key={i} className="font-serif italic text-2xl md:text-4xl text-[#171311] mx-8 flex items-center gap-8">
                  {w} <span className="text-[#C49A45] not-italic">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED */}
      <section className="max-w-[1600px] mx-auto px-6 lg:px-12 py-28 md:py-40">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div>
            <Reveal><p className="overline text-[#A37C2E] mb-4">La sélection</p></Reveal>
            <Reveal delay={0.1}>
              <h2 className="font-serif text-4xl md:text-6xl tracking-tight text-[#171311]">Pièces signatures</h2>
            </Reveal>
          </div>
          <Reveal delay={0.2}>
            <Link to="/boutique" className="overline text-[#4A463F] hover-gold link-underline">Voir toute la boutique →</Link>
          </Reveal>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {featured.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        </div>
      </section>

      {/* COLLECTIONS SPLIT */}
      <section className="max-w-[1600px] mx-auto px-6 lg:px-12 pb-28 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {[
          { img: IMG.silkStraight, over: "Raw Straight", title: "The Silk Collection", to: "/boutique?category=The Silk Collection", d: "Le lisse absolu, soyeux et lumineux." },
          { img: IMG.rivieraWave, over: "Raw Wavy", title: "The Riviera Wave", to: "/boutique?category=The Riviera Wave", d: "Des ondulations naturelles et voluptueuses." },
        ].map((c, i) => (
          <Reveal key={c.title} delay={i * 0.1}>
            <Link to={c.to} className="group relative block overflow-hidden aspect-[4/5] lg:aspect-[3/4]">
              <img src={c.img} alt={c.title} className="w-full h-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#171311]/70 via-[#171311]/10 to-transparent" />
              <div className="absolute bottom-0 left-0 p-10">
                <p className="overline text-[#E5C88F] mb-3">{c.over}</p>
                <h3 className="font-serif text-4xl md:text-5xl text-[#F4F3ED] mb-3">{c.title}</h3>
                <p className="text-[#F4F3ED]/80 text-sm max-w-xs mb-5">{c.d}</p>
                <span className="overline text-[#F4F3ED] link-underline">Explorer →</span>
              </div>
            </Link>
          </Reveal>
        ))}
      </section>

      {/* NOTRE HISTOIRE — brand creative */}
      <section className="bg-[#171311] py-28 md:py-40">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          <Reveal className="lg:col-span-7">
            <div className="overflow-hidden border border-[#C49A45]/25 bg-[#0A0A0A] shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              <img src={IMG.brandStone} alt="ÉLANI — logo gravé" className="w-full h-auto" />
            </div>
          </Reveal>
          <div className="text-[#F4F3ED] lg:col-span-5">
            <Reveal><p className="overline text-[#C49A45] mb-6">Notre histoire</p></Reveal>
            <Reveal delay={0.1}>
              <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] tracking-tight mb-8">
                Pour les femmes qui<br /><span className="font-script text-[#E5C88F] text-5xl md:text-7xl">définissent l'élégance</span>
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="text-[#A3A3A3] leading-relaxed max-w-lg mb-6">
                ÉLANI est née d'une vision simple : offrir aux femmes des cheveux bruts d'exception, dans le respect de leur beauté naturelle. Plus qu'une marque, ÉLANI est une célébration de l'élégance, de la confiance et de l'authenticité.
              </p>
            </Reveal>
            <Reveal delay={0.3}>
              <Link to="/histoire" className="inline-block border border-[#E5C88F] text-[#E5C88F] overline px-10 py-4 hover:bg-[#E5C88F]/10 transition-colors">
                Découvrir la maison
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* MONACO LIFESTYLE — full brand creative (both models fully visible) */}
      <section className="bg-[#171311] py-20 md:py-28">
        <div className="max-w-5xl mx-auto px-6">
          <Reveal>
            <div className="overflow-hidden border border-[#C49A45]/25 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
              <img src={IMG.brandMonaco} alt="ÉLANI — Luxury is a lifestyle" className="w-full h-auto" />
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            <div className="text-center mt-12">
              <Link to="/boutique" data-testid="cta-shop" className="inline-block bg-[#E5C88F] text-[#171311] overline px-12 py-5 hover:bg-white transition-colors">
                Explorer la collection
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

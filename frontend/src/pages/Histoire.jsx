import React from "react";
import { Link } from "react-router-dom";
import { MaskedReveal, Reveal } from "../components/Reveal";
import { IMG } from "../lib/brand";

const STEPS = [
  { n: "01", t: "Sélection", d: "Des cheveux bruts 100% naturels, choisis à la main pour leur pureté et leur éclat." },
  { n: "02", t: "Savoir-faire", d: "Un traitement délicat qui préserve la fibre, sa force et sa longévité." },
  { n: "03", t: "Élégance", d: "Une finition couture, pensée pour la femme qui définit l'élégance." },
];

export default function Histoire() {
  return (
    <div className="bg-[#F4F3ED] min-h-screen" data-testid="histoire-page">
      <section className="relative h-[85vh] overflow-hidden">
        <img src={IMG.silkStraight} alt="" className="absolute inset-0 w-full h-full object-cover object-top" />
        <div className="absolute inset-0 bg-[#171311]/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#F4F3ED] via-transparent to-[#171311]/30" />
        <div className="relative h-full max-w-[1600px] mx-auto px-6 lg:px-12 flex flex-col justify-end pb-20 items-center text-center">
          <p className="overline text-[#E5C88F] mb-6">La Maison ÉLANI</p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-[6vw] leading-[0.9] tracking-tighter text-[#F4F3ED]">
            <MaskedReveal lines={["Notre histoire"]} />
          </h1>
          <p className="font-script text-[#E5C88F] text-3xl md:text-5xl mt-6">L'élégance commence ici.</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-28 md:py-40">
        <Reveal>
          <p className="font-serif text-2xl md:text-4xl leading-[1.4] tracking-tight text-[#171311]">
            ÉLANI est née d'une <span className="font-script text-[#C49A45] text-4xl md:text-5xl">vision</span> simple : offrir aux femmes des cheveux bruts d'exception, dans le respect de leur beauté naturelle. Chaque mèche raconte notre engagement envers la qualité, le détail et l'amour du travail bien fait.
          </p>
        </Reveal>
      </section>

      <section className="bg-[#171311] py-28 md:py-40">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-12 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <Reveal><div className="overflow-hidden aspect-[4/5]"><img src={IMG.rivieraWave} alt="" className="w-full h-full object-cover" /></div></Reveal>
          <div className="text-[#F4F3ED]">
            <Reveal><p className="overline text-[#C49A45] mb-6">L'engagement ÉLANI</p></Reveal>
            <Reveal delay={0.1}>
              <h2 className="font-serif text-4xl md:text-6xl tracking-tight mb-10">Plus qu'une marque,<br />une <span className="font-script text-[#E5C88F] text-5xl md:text-7xl">célébration</span></h2>
            </Reveal>
            <div className="space-y-8">
              {STEPS.map((s, i) => (
                <Reveal key={s.n} delay={0.1 * i}>
                  <div className="flex gap-6 border-t border-white/10 pt-6">
                    <span className="font-serif text-2xl text-[#C49A45]">{s.n}</span>
                    <div>
                      <h3 className="font-serif text-2xl mb-2">{s.t}</h3>
                      <p className="text-[#A3A3A3] text-sm leading-relaxed max-w-md">{s.d}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
            <Reveal delay={0.3}>
              <Link to="/boutique" className="inline-block mt-10 bg-[#E5C88F] text-[#171311] overline px-10 py-4 hover:bg-white transition-colors">
                Découvrir nos créations
              </Link>
            </Reveal>
          </div>
        </div>
      </section>
    </div>
  );
}

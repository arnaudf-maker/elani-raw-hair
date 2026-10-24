import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../lib/api";
import ProductCard from "../components/ProductCard";
import { MaskedReveal } from "../components/Reveal";
import LaceGuide from "../components/LaceGuide";
import { SlidersHorizontal, X } from "lucide-react";

const CATEGORIES = ["Tout", "The Silk Collection", "The Riviera Wave", "Closure HD", "Accessoires"];

// Texture -> normalized keywords (matched case-insensitive on product.texture)
const TEXTURES = [
  { key: "lisse", label: "Lisse", match: ["straight", "lisse"] },
  { key: "ondulee", label: "Ondulée", match: ["wavy", "wave", "ondul"] },
  { key: "bouclee", label: "Bouclée", match: ["curl", "curly", "boucl"] },
];

// Length buckets in inches
const LENGTHS = [
  { key: "courte", label: "Courte (10–14\")", min: 10, max: 14 },
  { key: "milongue", label: "Mi-longue (16–20\")", min: 16, max: 20 },
  { key: "longue", label: "Longue (22–30\")", min: 22, max: 30 },
];

function extractInches(str) {
  const m = String(str || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export default function Boutique() {
  const [params, setParams] = useSearchParams();
  const active = params.get("category") || "Tout";
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [textures, setTextures] = useState([]);
  const [lengths, setLengths] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/products").then(({ data }) => { setAllProducts(data); setLoading(false); });
  }, []);

  const setCat = (c) => { if (c === "Tout") setParams({}); else setParams({ category: c }); };

  const toggle = (arr, setArr, key) =>
    setArr(arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);

  const products = useMemo(() => {
    return allProducts.filter((p) => {
      if (active !== "Tout" && p.category !== active) return false;
      if (textures.length) {
        const tx = String(p.texture || "").toLowerCase();
        const ok = textures.some((k) => {
          const spec = TEXTURES.find((t) => t.key === k);
          return spec && spec.match.some((m) => tx.includes(m));
        });
        if (!ok) return false;
      }
      if (lengths.length) {
        const inches = extractInches(p.length);
        if (inches == null) return false;
        const ok = lengths.some((k) => {
          const spec = LENGTHS.find((l) => l.key === k);
          return spec && inches >= spec.min && inches <= spec.max;
        });
        if (!ok) return false;
      }
      return true;
    });
  }, [allProducts, active, textures, lengths]);

  const activeCount = textures.length + lengths.length;
  const clearAll = () => { setTextures([]); setLengths([]); };

  return (
    <div className="bg-[#F4F3ED] min-h-screen pt-32" data-testid="boutique-page">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
        <div className="pt-10 pb-16 border-b border-[#171311]/10">
          <p className="overline text-[#A37C2E] mb-6">La boutique</p>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-[6.5vw] leading-[0.9] tracking-tighter text-[#171311]">
            <MaskedReveal lines={["Notre", <span key="i" className="font-script text-[#C49A45] text-6xl md:text-8xl lg:text-[7vw]">collection</span>]} />
          </h1>
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-3 pt-10 pb-6">
          {CATEGORIES.map((c) => (
            <button key={c} data-testid={`filter-${c.toLowerCase().replace(/\s/g, "-")}`} onClick={() => setCat(c)}
              className={`overline px-5 py-2.5 border transition-colors text-xs ${
                active === c ? "border-[#171311] text-[#F4F3ED] bg-[#171311]" : "border-[#171311]/15 text-[#4A463F] hover:border-[#C49A45] hover:text-[#A37C2E]"
              }`}>
              {c}
            </button>
          ))}
          <button
            data-testid="toggle-filters"
            onClick={() => setShowFilters((v) => !v)}
            className={`ml-auto flex items-center gap-2 overline px-5 py-2.5 border transition-colors text-xs ${
              showFilters || activeCount ? "border-[#C49A45] text-[#A37C2E] bg-[#C49A45]/10" : "border-[#171311]/15 text-[#4A463F] hover:border-[#C49A45]"
            }`}>
            <SlidersHorizontal size={14} />
            Filtres{activeCount ? ` (${activeCount})` : ""}
          </button>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div data-testid="filter-panel" className="mb-10 bg-white/50 border border-[#171311]/10 p-6 lg:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <p className="overline text-[#A37C2E] mb-4">Texture</p>
                <div className="flex flex-wrap gap-2">
                  {TEXTURES.map((t) => {
                    const on = textures.includes(t.key);
                    return (
                      <button
                        key={t.key}
                        data-testid={`filter-texture-${t.key}`}
                        onClick={() => toggle(textures, setTextures, t.key)}
                        className={`px-4 py-2 text-xs overline border transition-colors ${
                          on ? "bg-[#171311] text-[#F4F3ED] border-[#171311]" : "border-[#171311]/15 text-[#4A463F] hover:border-[#C49A45]"
                        }`}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="overline text-[#A37C2E] mb-4">Longueur</p>
                <div className="flex flex-wrap gap-2">
                  {LENGTHS.map((l) => {
                    const on = lengths.includes(l.key);
                    return (
                      <button
                        key={l.key}
                        data-testid={`filter-length-${l.key}`}
                        onClick={() => toggle(lengths, setLengths, l.key)}
                        className={`px-4 py-2 text-xs overline border transition-colors ${
                          on ? "bg-[#171311] text-[#F4F3ED] border-[#171311]" : "border-[#171311]/15 text-[#4A463F] hover:border-[#C49A45]"
                        }`}>
                        {l.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            {activeCount > 0 && (
              <button
                data-testid="clear-filters"
                onClick={clearAll}
                className="mt-6 inline-flex items-center gap-2 text-xs text-[#4A463F] hover-gold overline">
                <X size={13} /> Effacer les filtres
              </button>
            )}
          </div>
        )}

        {active === "Closure HD" && (
          <div className="mb-8 flex items-center justify-between bg-white/60 border border-[#C49A45]/25 px-6 py-4" data-testid="hd-closure-guide-banner">
            <div>
              <p className="overline text-[#A37C2E] text-[10px]">Nouvelle collection</p>
              <p className="font-serif text-lg text-[#171311]">Cheveux bruts 100% humains · Tulle HD invisible</p>
            </div>
            <LaceGuide />
          </div>
        )}

        {loading ? (
          <div className="py-40 text-center text-[#A37C2E] font-serif text-2xl">Chargement…</div>
        ) : products.length === 0 ? (
          <div className="py-40 text-center text-[#4A463F] font-serif text-2xl">Aucune extension ne correspond à ces filtres.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 pb-32">
            {products.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
        )}
      </div>
    </div>
  );
}

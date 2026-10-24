import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Heart } from "lucide-react";
import { eur } from "../lib/api";
import Stars from "./Stars";
import { useWishlist } from "../context/WishlistContext";
import { toast } from "sonner";

export default function ProductCard({ product, index = 0 }) {
  const { has, toggle } = useWishlist();
  const wished = has(product.id);
  const onWish = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product.id);
    toast.success(wished ? "Retiré des favoris" : "Ajouté aux favoris");
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.8, delay: (index % 4) * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link to={`/produit/${product.id}`} data-testid={`product-card-${product.id}`} className="group block">
        <div className="relative overflow-hidden bg-[#EBE8DF] aspect-[3/4] mb-5 border border-[#C49A45]/15">
          <img
            src={product.images?.[0]} alt={product.name}
            className="w-full h-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-105"
          />
          <button
            data-testid={`wishlist-toggle-${product.id}`}
            onClick={onWish}
            aria-label={wished ? "Retirer des favoris" : "Ajouter aux favoris"}
            className={`absolute top-4 right-4 w-9 h-9 flex items-center justify-center backdrop-blur-sm transition-colors ${
              wished ? "bg-[#C49A45] text-white" : "bg-white/70 text-[#171311] hover:bg-white"
            }`}
          >
            <Heart size={16} strokeWidth={1.4} fill={wished ? "currentColor" : "transparent"} />
          </button>
          {product.stock < 5 && product.stock > 0 && (
            <span className="absolute top-4 left-4 overline text-white bg-[#171311]/70 backdrop-blur-sm px-3 py-1">
              Édition limitée
            </span>
          )}
          {product.stock === 0 && (
            <span className="absolute top-4 left-4 overline text-white bg-[#171311]/70 backdrop-blur-sm px-3 py-1">
              Épuisé
            </span>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#171311]/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end justify-center pb-6">
            <span className="overline text-white border border-[#E5C88F] px-6 py-3">Découvrir</span>
          </div>
        </div>
        <p className="overline text-[#A37C2E] mb-2">{product.category}</p>
        <h3 className="font-serif text-xl text-[#171311] mb-1 leading-tight">{product.name}</h3>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-sm text-[#4A463F]">{eur(product.price)}</p>
          {product.review_count > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-[#4A463F]">
              <Stars value={product.avg_rating} size={11} />
              <span>({product.review_count})</span>
            </span>
          )}
        </div>
      </Link>
    </motion.div>
  );
}

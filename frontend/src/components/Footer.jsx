import React, { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Crown, Instagram, Mail, MessageCircle, Ghost } from "lucide-react";
import { CONTACT } from "../lib/brand";

export default function Footer() {
  const [email, setEmail] = useState("");
  return (
    <footer data-testid="footer" className="bg-[#171311] text-[#F4F3ED] pt-24 pb-10">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 pb-20">
          <div className="lg:col-span-5">
            <h3 className="font-serif text-4xl md:text-5xl leading-[1] mb-6">
              Le cercle privé<br /><span className="font-script text-[#E5C88F] text-5xl md:text-6xl">ÉLANI</span>
            </h3>
            <p className="text-[#A3A3A3] text-sm max-w-md mb-8 leading-relaxed">
              Recevez nos nouveautés, exclusivités et l'essence de l'élégance, directement dans votre boîte mail.
            </p>
            <form
              className="flex items-center border-b border-white/20 max-w-md pb-3"
              onSubmit={(e) => { e.preventDefault(); if (email) { toast.success("Merci ! Vous rejoignez le cercle ÉLANI."); setEmail(""); } }}
            >
              <input
                data-testid="newsletter-input" type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)} placeholder="Votre adresse email"
                className="bg-transparent flex-1 outline-none text-[#F4F3ED] placeholder:text-[#737373] text-sm"
              />
              <button data-testid="newsletter-submit" type="submit" className="overline text-[#E5C88F]">S'inscrire →</button>
            </form>
          </div>

          <div className="lg:col-span-3 lg:col-start-7">
            <p className="overline text-[#A37C2E] mb-6">Maison</p>
            <ul className="space-y-4 text-sm text-[#A3A3A3]">
              <li><Link to="/boutique" className="hover-gold">Boutique</Link></li>
              <li><Link to="/histoire" className="hover-gold">Notre histoire</Link></li>
              <li><Link to="/contact" className="hover-gold">Contact & commande</Link></li>
              <li><Link to="/compte" className="hover-gold">Mon compte</Link></li>
            </ul>
          </div>
          <div className="lg:col-span-3">
            <p className="overline text-[#A37C2E] mb-6">Nous contacter</p>
            <ul className="space-y-4 text-sm text-[#A3A3A3]">
              <li><a href={CONTACT.whatsappHref} target="_blank" rel="noreferrer" data-testid="footer-whatsapp" className="flex items-center gap-3 hover-gold"><MessageCircle size={16} /> {CONTACT.whatsapp}</a></li>
              <li><a href={`mailto:${CONTACT.email}`} className="flex items-center gap-3 hover-gold"><Mail size={16} /> {CONTACT.email}</a></li>
              <li><a href={CONTACT.instagramHref} target="_blank" rel="noreferrer" className="flex items-center gap-3 hover-gold"><Instagram size={16} /> @{CONTACT.instagram}</a></li>
              <li><span className="flex items-center gap-3"><Ghost size={16} /> {CONTACT.snapchat}</span></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between border-t border-white/10 pt-8 gap-4">
          <div className="flex items-center gap-2">
            <Crown size={16} strokeWidth={1.2} style={{ color: "#C49A45" }} />
            <span className="font-serif text-xl" style={{ letterSpacing: "0.25em", paddingLeft: "0.25em" }}>ÉLANI</span>
          </div>
          <p className="text-xs text-[#737373]">© {new Date().getFullYear()} ÉLANI — Raw Hair · elanirawhair.com · Cheveux bruts 100% naturels. L'élégance commence ici.</p>
        </div>
      </div>
    </footer>
  );
}

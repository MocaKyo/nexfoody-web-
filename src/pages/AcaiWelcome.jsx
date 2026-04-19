import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";

const LOGO_URL = "https://i.ibb.co/Z1R8Y83G/Whats-App-Image-2026-03-20-at-20-32-27.jpg";
const BANNER_URL = "https://i.ibb.co/rGw2tF2x/Essa-fruta-tipica-da-Amazonia-ajuda-o-cerebro-e-fortalece-a-memoria.jpg";

export default function AcaiWelcome() {
  const { user } = useAuth();
  const { config } = useStore();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (user) { navigate("/"); return; }
    setTimeout(() => setVisible(true), 100);
  }, [user, navigate]);

  return (
    <div style={{
      minHeight: "100vh",
      position: "relative",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      fontFamily: "'Outfit', sans-serif",
    }}>
      {/* Foto de fundo */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0,
        backgroundImage: `url(${config.imagemCapa || config.bannerUrl || BANNER_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center 30%",
        transform: visible ? "scale(1)" : "scale(1.08)",
        transition: "transform 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }} />
      {/* Gradiente sobre a foto */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 1,
        background: "linear-gradient(to bottom, rgba(10,4,20,0.3) 0%, rgba(10,4,20,0.15) 30%, rgba(10,4,20,0.7) 65%, rgba(10,4,20,0.97) 100%)",
      }} />
      {/* Partículas decorativas */}
      <div style={{ position: "absolute", inset: 0, zIndex: 2, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            position: "absolute",
            width: `${8 + i * 4}px`, height: `${8 + i * 4}px`,
            borderRadius: "50%",
            background: `rgba(124, 77, 189, ${0.15 + i * 0.05})`,
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 3) * 20}%`,
            animation: `floatParticle${i} ${4 + i}s ease-in-out infinite`,
            animationDelay: `${i * 0.5}s`,
          }} />
        ))}
      </div>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900;1,700&family=Outfit:wght@300;400;500;600;700&display=swap');
        @keyframes floatParticle0 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-20px) scale(1.1)} }
        @keyframes floatParticle1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(15px)} }
        @keyframes floatParticle2 { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-25px) rotate(180deg)} }
        @keyframes floatParticle3 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(20px)} }
        @keyframes floatParticle4 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-15px) scale(0.9)} }
        @keyframes floatParticle5 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(10px)} }
        @keyframes shimmer { 0%,100%{opacity:0.6} 50%{opacity:1} }
      `}</style>
      {/* Conteúdo */}
      <div style={{
        position: "relative", zIndex: 10,
        flex: 1, display: "flex", flexDirection: "column",
        justifyContent: "space-between", padding: "0",
      }}>
        {/* Topo — Logo */}
        <div style={{
          padding: "56px 28px 0",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(-20px)",
          transition: "all 0.8s ease 0.2s",
        }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            background: "rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 50, padding: "10px 20px",
          }}>
            <img src={config.logoUrl || LOGO_URL} alt="Logo" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />
            <span style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: "1rem", fontWeight: 700, color: "#fff",
              letterSpacing: "0.5px",
            }}>
              {config.nomeLoja || "Açaí Puro Gosto"}
            </span>
          </div>
        </div>
        {/* Centro — Texto principal */}
        <div style={{ padding: "0 28px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "rgba(124,77,189,0.3)",
            border: "1px solid rgba(124,77,189,0.5)",
            borderRadius: 50, padding: "6px 16px",
            marginBottom: 20,
            opacity: visible ? 1 : 0,
            transition: "all 0.8s ease 0.4s",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", animation: "shimmer 2s infinite" }} />
            <span style={{ fontSize: "0.72rem", color: "#c4b5fd", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>
              {config.descricao || "Polpa Natural da Amazônia"}
            </span>
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif",
            fontSize: "clamp(2.8rem, 8vw, 4rem)",
            fontWeight: 900, lineHeight: 1.1,
            color: "#ffffff", marginBottom: 16,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(30px)",
            transition: "all 0.9s ease 0.5s",
          }}>
            O sabor que<br />
            <em style={{ fontStyle: "italic", color: "#c4b5fd", textShadow: "0 0 40px rgba(196,181,253,0.4)" }}>
              você merece
            </em>
          </h1>
          <p style={{
            fontSize: "1rem", color: "rgba(255,255,255,0.65)",
            lineHeight: 1.7, marginBottom: 0, maxWidth: 320,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(20px)",
            transition: "all 0.9s ease 0.65s",
          }}>
            Peça sua polpa de açaí fresquinha com facilidade e ganhe pontos a cada compra.
          </p>
        </div>
        {/* Rodapé — Botões */}
        <div style={{
          padding: "32px 28px 48px",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0)" : "translateY(30px)",
          transition: "all 0.9s ease 0.8s",
        }}>
          <button
            onClick={() => navigate("/login")}
            style={{ width: "100%", padding: "17px", background: "linear-gradient(135deg, #7c4dbd, #5a2d91)", border: "none", borderRadius: 16, color: "#fff", fontSize: "1.05rem", fontWeight: 700, fontFamily: "'Outfit', sans-serif", cursor: "pointer", marginBottom: 12, boxShadow: "0 8px 32px rgba(124,77,189,0.45)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s", letterSpacing: "0.3px" }}
            onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            Entrar na conta
          </button>
          <button
            onClick={() => navigate("/cadastro")}
            style={{ width: "100%", padding: "17px", background: "rgba(255,255,255,0.08)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16, color: "#fff", fontSize: "1.05rem", fontWeight: 600, fontFamily: "'Outfit', sans-serif", cursor: "pointer", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.14)"}
            onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.08)"}
          >
            Criar conta grátis
          </button>
          <button
            onClick={() => navigate("/")}
            style={{ width: "100%", padding: "13px 24px", background: "transparent", border: "none", borderRadius: 16, color: "rgba(255,255,255,0.45)", fontSize: "0.88rem", fontFamily: "'Outfit', sans-serif", cursor: "pointer", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, textDecoration: "underline", textDecorationColor: "rgba(255,255,255,0.2)" }}
          >
            👀 Ver cardápio
          </button>
          <div style={{ display: "flex", justifyContent: "center", gap: 24, borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: 20 }}>
            {[{ icon: "🏆", text: "Programa de pontos" }, { icon: "📱", text: "PIX instantâneo" }, { icon: "🛵", text: "Delivery rápido" }].map((item, i) => (
              <div key={i} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.1rem", marginBottom: 4 }}>{item.icon}</div>
                <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", fontWeight: 500, lineHeight: 1.3 }}>{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
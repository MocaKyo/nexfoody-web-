import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const FOOD_EMOJIS = ["🍕","🍔","🌮","🍜","🍣","🥗","🍓","🧁","🍦","🥩","🍱","🥐","🫕","🍛","🧆","🥙"];

const FEATURES = [
  { icon: "🎬", title: "Feed TikTok", desc: "Veja posts de comida em vídeo e foto" },
  { icon: "🏪", title: "Delivery rápido", desc: "Peça de restaurantes e lojas locais" },
  { icon: "💬", title: "Chat com lojas", desc: "Fale direto com quem prepara seu pedido" },
  { icon: "🏆", title: "Pontos & cashback", desc: "Ganhe a cada compra e troque por prêmios" },
];

const STATS = [
  { val: "2.4k+", label: "Posts publicados" },
  { val: "48",    label: "Lojas parceiras" },
  { val: "12k+",  label: "Fãs na plataforma" },
];

// Partícula flutuante de emoji
function FloatingEmoji({ emoji, style }: { emoji: string; style: React.CSSProperties }) {
  return (
    <div style={{
      position: "absolute",
      fontSize: "1.6rem",
      opacity: 0.18,
      userSelect: "none",
      pointerEvents: "none",
      filter: "blur(0.5px)",
      ...style,
    }}>
      {emoji}
    </div>
  );
}

export default function NexfoodyWelcome() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    if (user) { navigate("/app"); return; }
    setTimeout(() => setVisible(true), 80);
  }, [user, navigate]);

  // Rotaciona feature em destaque
  useEffect(() => {
    const t = setInterval(() => setActiveFeature(p => (p + 1) % FEATURES.length), 2800);
    return () => clearInterval(t);
  }, []);

  const tr = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? "translateY(0)" : "translateY(28px)",
    transition: `all 0.8s cubic-bezier(.22,.68,0,1.2) ${delay}s`,
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#07030f",
      fontFamily: "'Outfit', sans-serif",
      display: "flex",
      flexDirection: "column",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @keyframes spin-slow { to { transform: rotate(360deg); } }
        @keyframes float-0 { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(8deg)} }
        @keyframes float-1 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(14px)} }
        @keyframes float-2 { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-22px) scale(1.1)} }
        @keyframes float-3 { 0%,100%{transform:translateY(0)} 60%{transform:translateY(16px) rotate(-6deg)} }
        @keyframes float-4 { 0%,100%{transform:translateY(0)} 45%{transform:translateY(-12px)} }
        @keyframes float-5 { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(20px) rotate(10deg)} }
        @keyframes glow-pulse { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes slide-feature { 0%{opacity:0;transform:translateX(12px)} 15%,85%{opacity:1;transform:translateX(0)} 100%{opacity:0;transform:translateX(-12px)} }
        @keyframes badge-pop { 0%{transform:scale(.8);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes shimmer-bar { 0%{background-position:200% center} 100%{background-position:-200% center} }
      `}</style>

      {/* ── GLOW DE FUNDO ── */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none", overflow:"hidden" }}>
        <div style={{ position:"absolute", top:"-15%", left:"50%", transform:"translateX(-50%)", width:480, height:480, borderRadius:"50%", background:"radial-gradient(circle, rgba(245,197,24,.13) 0%, transparent 70%)", animation:"glow-pulse 4s ease-in-out infinite" }} />
        <div style={{ position:"absolute", bottom:"-10%", left:"-10%", width:340, height:340, borderRadius:"50%", background:"radial-gradient(circle, rgba(124,58,237,.12) 0%, transparent 70%)" }} />
        <div style={{ position:"absolute", top:"40%", right:"-8%", width:260, height:260, borderRadius:"50%", background:"radial-gradient(circle, rgba(236,72,153,.08) 0%, transparent 70%)" }} />
      </div>

      {/* ── EMOJIS FLUTUANTES ── */}
      {FOOD_EMOJIS.slice(0, 10).map((em, i) => (
        <FloatingEmoji key={i} emoji={em} style={{
          left: `${5 + (i * 9.5) % 90}%`,
          top: `${8 + (i * 13) % 80}%`,
          animation: `float-${i % 6} ${4 + (i % 4)}s ease-in-out infinite`,
          animationDelay: `${i * 0.4}s`,
          fontSize: i % 3 === 0 ? "2rem" : "1.4rem",
        }} />
      ))}

      {/* ── HEADER ── */}
      <div style={{ ...tr(0), position:"relative", zIndex:10, padding:"52px 28px 0", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"linear-gradient(135deg,#f5c518,#e6a817)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", boxShadow:"0 4px 20px rgba(245,197,24,.4)" }}>
            🍓
          </div>
          <span style={{ fontFamily:"'Fraunces',serif", fontWeight:900, fontSize:"1.3rem", color:"#fff", letterSpacing:"-0.01em" }}>
            Nex<span style={{ color:"#f5c518" }}>Foody</span>
          </span>
        </div>
        <Link to="/lojista/login" style={{ fontSize:"0.72rem", fontWeight:700, color:"rgba(255,255,255,.4)", textDecoration:"none", border:"1px solid rgba(255,255,255,.1)", borderRadius:20, padding:"6px 14px", backdropFilter:"blur(8px)", background:"rgba(255,255,255,.04)" }}>
          Sou lojista →
        </Link>
      </div>

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <div style={{ flex:1, position:"relative", zIndex:10, display:"flex", flexDirection:"column", justifyContent:"center", padding:"40px 28px 0" }}>

        {/* Badge */}
        <div style={{ ...tr(0.15), display:"inline-flex", alignItems:"center", gap:7, background:"rgba(245,197,24,.1)", border:"1px solid rgba(245,197,24,.25)", borderRadius:50, padding:"6px 14px", marginBottom:22, width:"fit-content", animation: visible ? "badge-pop .5s .15s both" : "none" }}>
          <span style={{ width:6, height:6, borderRadius:"50%", background:"#f5c518", boxShadow:"0 0 8px #f5c518", display:"inline-block" }} />
          <span style={{ fontSize:"0.68rem", fontWeight:700, color:"#f5c518", textTransform:"uppercase", letterSpacing:"0.08em" }}>A rede social da comida</span>
        </div>

        {/* Headline */}
        <div style={tr(0.25)}>
          <h1 style={{ fontFamily:"'Fraunces',serif", fontSize:"clamp(2.6rem,10vw,3.8rem)", fontWeight:900, lineHeight:1.05, color:"#fff", margin:0, marginBottom:18 }}>
            Descubra,<br />
            <span style={{ WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundImage:"linear-gradient(135deg,#f5c518 30%,#ec4899 100%)", backgroundClip:"text" }}>
              peça
            </span>
            {" "}e<br />
            compartilhe.
          </h1>
        </div>

        {/* Sub */}
        <p style={{ ...tr(0.35), fontSize:"0.97rem", color:"rgba(255,255,255,.5)", lineHeight:1.65, marginBottom:28, maxWidth:320 }}>
          Feed de comidas no estilo TikTok, delivery de restaurantes locais e uma comunidade de fãs gastronômicos.
        </p>

        {/* Feature em destaque */}
        <div style={{ ...tr(0.42), marginBottom:32, height:64, display:"flex", alignItems:"center" }}>
          <div key={activeFeature} style={{ display:"flex", alignItems:"center", gap:14, background:"rgba(255,255,255,.05)", border:"1px solid rgba(255,255,255,.09)", borderRadius:16, padding:"12px 16px", animation:"slide-feature 2.8s ease-in-out forwards", minWidth:0 }}>
            <div style={{ width:40, height:40, borderRadius:12, background:"rgba(245,197,24,.12)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.3rem", flexShrink:0 }}>
              {FEATURES[activeFeature].icon}
            </div>
            <div style={{ minWidth:0 }}>
              <div style={{ fontWeight:800, fontSize:"0.88rem", color:"#fff", marginBottom:2 }}>{FEATURES[activeFeature].title}</div>
              <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,.4)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{FEATURES[activeFeature].desc}</div>
            </div>
          </div>
          {/* Dots */}
          <div style={{ display:"flex", gap:5, marginLeft:14, flexShrink:0 }}>
            {FEATURES.map((_,i) => (
              <div key={i} onClick={() => setActiveFeature(i)} style={{ width: i===activeFeature?18:5, height:5, borderRadius:3, background:i===activeFeature?"#f5c518":"rgba(255,255,255,.15)", transition:"all .3s", cursor:"pointer" }} />
            ))}
          </div>
        </div>

        {/* Stats */}
        <div style={{ ...tr(0.5), display:"flex", gap:0, marginBottom:36, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.07)", borderRadius:18, overflow:"hidden" }}>
          {STATS.map((s,i) => (
            <div key={i} style={{ flex:1, textAlign:"center", padding:"14px 8px", borderRight:i<STATS.length-1?"1px solid rgba(255,255,255,.07)":"none" }}>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:"1.25rem", fontWeight:900, color:"#f5c518", marginBottom:3 }}>{s.val}</div>
              <div style={{ fontSize:"0.58rem", color:"rgba(255,255,255,.35)", textTransform:"uppercase", letterSpacing:"0.05em", fontWeight:600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── BOTÕES ── */}
      <div style={{ ...tr(0.6), position:"relative", zIndex:10, padding:"0 28px 52px" }}>

        {/* Entrar na conta */}
        <button
          onClick={() => navigate("/nexfoody/login")}
          style={{ width:"100%", padding:"17px", marginBottom:12, background:"linear-gradient(135deg,#f5c518,#e6a817)", border:"none", borderRadius:18, color:"#0a0414", fontSize:"1.05rem", fontWeight:800, cursor:"pointer", boxShadow:"0 8px 32px rgba(245,197,24,.35)", display:"flex", alignItems:"center", justifyContent:"center", gap:8, letterSpacing:"0.01em", transition:"all .2s" }}
          onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow="0 12px 40px rgba(245,197,24,.5)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow="0 8px 32px rgba(245,197,24,.35)"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
          Entrar na conta
        </button>

        {/* Criar conta grátis */}
        <button
          onClick={() => navigate("/nexfoody/cadastro")}
          style={{ width:"100%", padding:"17px", marginBottom:12, background:"rgba(255,255,255,.07)", backdropFilter:"blur(12px)", border:"1px solid rgba(255,255,255,.14)", borderRadius:18, color:"#fff", fontSize:"1.05rem", fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all .2s" }}
          onMouseEnter={e => { e.currentTarget.style.background="rgba(255,255,255,.13)"; e.currentTarget.style.transform="translateY(-2px)"; }}
          onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,.07)"; e.currentTarget.style.transform="translateY(0)"; }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Criar conta grátis
        </button>

        {/* Entrar como visitante */}
        <button
          onClick={() => navigate("/app")}
          style={{ width:"100%", padding:"13px", background:"transparent", border:"none", borderRadius:16, color:"rgba(255,255,255,.4)", fontSize:"0.9rem", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7, transition:"color .2s", marginBottom:24 }}
          onMouseEnter={e => e.currentTarget.style.color="rgba(255,255,255,.7)"}
          onMouseLeave={e => e.currentTarget.style.color="rgba(255,255,255,.4)"}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          Entrar como visitante
        </button>

        {/* Divisor + termos */}
        <p style={{ textAlign:"center", fontSize:"0.65rem", color:"rgba(255,255,255,.2)", lineHeight:1.7 }}>
          Ao continuar você concorda com os{" "}
          <span style={{ color:"rgba(255,255,255,.4)", textDecoration:"underline", cursor:"pointer" }}>Termos de uso</span>
          {" "}e a{" "}
          <span style={{ color:"rgba(255,255,255,.4)", textDecoration:"underline", cursor:"pointer" }}>Política de privacidade</span>
          {" "}da NexFoody.
        </p>
      </div>
    </div>
  );
}

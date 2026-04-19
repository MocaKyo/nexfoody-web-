// src/pages/nexfoody/NexfoodyLojas.tsx
// Feed TikTok de lojas não-comida — o "outro mundo" do NexFoody
import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { collection, query, orderBy, limit, onSnapshot, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";

// ─── TIPOS ───────────────────────────────────────────────────
interface LojaPost {
  id: string;
  lojaSlug: string;
  lojaNome: string;
  lojaCategoria: string;
  foto?: string | null;
  legenda?: string;
  produtoNome?: string;
  userNome?: string;
  bgGradient?: string;
  _sortTs?: number;
}

interface LojaCard {
  id: string;
  slug: string;
  nome: string;
  categoria: string;
  logo?: string;
  cidade?: string;
  estado?: string;
  desc?: string;
}

// ─── HELPERS ─────────────────────────────────────────────────
const CATS_COMIDA = ["açaí","pizza","hamburguer","burger","lanches","sorvetes","sorvete","sucos","doces","comida","lanche","restaurante","food"];
const isNaoComida = (cat: string) => !CATS_COMIDA.some(c => (cat||"").toLowerCase().includes(c));

function timeAgo(ts: number | null) {
  if (!ts) return "agora";
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return "agora";
  if (d < 3600) return `${Math.floor(d/60)}min`;
  if (d < 86400) return `${Math.floor(d/3600)}h`;
  return `${Math.floor(d/86400)}d`;
}

function avatarBg(nome: string) {
  return ["#6366f1","#8b5cf6","#ec4899","#14b8a6","#f59e0b","#10b981"][(nome?.charCodeAt(0)||0) % 6];
}

const BG_GRADIENTS = [
  "linear-gradient(160deg,#0f0c29,#302b63,#24243e)",
  "linear-gradient(160deg,#0d0d1a,#1a1a3e,#2d1b69)",
  "linear-gradient(160deg,#0a0a0a,#1a0a2e,#2d0a4e)",
  "linear-gradient(160deg,#0f2027,#203a43,#2c5364)",
  "linear-gradient(160deg,#1a0533,#2d1b69,#0d001a)",
];

// ─── CARD: POST ───────────────────────────────────────────────
function PostCard({ post, isCurrent }: { post: LojaPost; isCurrent: boolean }) {
  const bg = post.bgGradient || BG_GRADIENTS[post.id.charCodeAt(0) % BG_GRADIENTS.length];
  return (
    <div style={{ position:"relative", width:"100%", height:"100%", overflow:"hidden" }}>
      {post.foto
        ? <img src={post.foto} alt="" style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover" }} />
        : <div style={{ position:"absolute", inset:0, background: bg }} />
      }
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,.1) 0%,transparent 25%,transparent 45%,rgba(0,0,0,.7) 75%,rgba(0,0,0,.95) 100%)", pointerEvents:"none" }} />

      {/* Badge categoria */}
      <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
        style={{ position:"absolute", top:14, left:14, display:"flex", alignItems:"center", gap:5, background:"rgba(99,102,241,.2)", backdropFilter:"blur(8px)", border:"1px solid rgba(99,102,241,.45)", borderRadius:20, padding:"4px 12px", fontSize:"0.72rem", fontWeight:700, color:"#a5b4fc", zIndex:10 }}>
        🛍️ {post.lojaCategoria || "Loja local"}
      </motion.div>
      <div style={{ position:"absolute", top:14, right:14, fontSize:"0.65rem", color:"rgba(255,255,255,.45)", fontWeight:600, zIndex:10 }}>{timeAgo(post._sortTs||null)}</div>

      {/* Sidebar */}
      <div style={{ position:"absolute", right:10, bottom:140, display:"flex", flexDirection:"column", alignItems:"center", gap:8, zIndex:10 }}>
        {[
          { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>, label:"Curtir" },
          { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>, label:"Coment." },
          { icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>, label:"Salvar" },
        ].map((btn, i) => (
          <motion.button key={i} whileTap={{ scale:1.3 }} style={{ background:"none", border:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2 }}>
            <div style={{ width:38, height:38, borderRadius:12, background:"rgba(255,255,255,.1)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(255,255,255,.2)", display:"flex", alignItems:"center", justifyContent:"center" }}>{btn.icon}</div>
            <span style={{ fontSize:"0.56rem", color:"rgba(255,255,255,.8)", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>{btn.label}</span>
          </motion.button>
        ))}
        {/* Voltar ao feed de comida */}
        <Link to="/app" style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:2, textDecoration:"none" }}>
          <div style={{ width:38, height:38, borderRadius:12, background:"rgba(245,197,24,.15)", backdropFilter:"blur(8px)", border:"1.5px solid rgba(245,197,24,.4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem" }}>🍓</div>
          <span style={{ fontSize:"0.56rem", color:"#f5c518", fontWeight:800, textShadow:"0 1px 4px rgba(0,0,0,.9)" }}>Comida</span>
        </Link>
      </div>

      {/* Rodapé */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 14px 22px", zIndex:10 }}>
        <div style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12 }}>
          <div style={{ width:40, height:40, borderRadius:"50%", background:avatarBg(post.lojaNome||"L"), border:"2px solid rgba(255,255,255,.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.1rem", fontWeight:800, color:"#fff", flexShrink:0 }}>
            {post.lojaNome?.[0]||"L"}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:800, fontSize:"0.85rem", color:"#fff", textShadow:"0 1px 4px rgba(0,0,0,.8)" }}>{post.lojaNome}</div>
            {post.produtoNome && <div style={{ fontSize:"0.7rem", color:"rgba(255,255,255,.6)" }}>{post.produtoNome}</div>}
            {post.legenda && <div style={{ fontSize:"0.8rem", color:"rgba(255,255,255,.85)", marginTop:3, lineHeight:1.4, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" as const, overflow:"hidden" as const }}>{post.legenda}</div>}
          </div>
        </div>
        {post.lojaSlug && (
          <Link to={`/loja/${post.lojaSlug}`} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(8,4,18,.85)", backdropFilter:"blur(16px)", border:"1px solid rgba(99,102,241,.25)", borderRadius:16, padding:"10px 14px", textDecoration:"none" }}>
            <div style={{ fontWeight:800, fontSize:"0.82rem", color:"#fff" }}>{post.lojaNome}</div>
            <div style={{ display:"flex", alignItems:"center", gap:5, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:20, padding:"7px 14px", fontWeight:800, fontSize:"0.75rem", color:"#fff" }}>Ver loja →</div>
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── CARD: LOJA ───────────────────────────────────────────────
function LojaDestaque({ loja, isCurrent }: { loja: LojaCard; isCurrent: boolean }) {
  const bg = BG_GRADIENTS[loja.id.charCodeAt(0) % BG_GRADIENTS.length];
  return (
    <div style={{ position:"relative", width:"100%", height:"100%", overflow:"hidden" }}>
      <div style={{ position:"absolute", inset:0, background: bg }} />
      <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse 70% 60% at 50% 40%,rgba(99,102,241,.3),transparent 70%)" }} />
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(to bottom,rgba(0,0,0,.1),transparent 30%,transparent 50%,rgba(0,0,0,.85) 100%)", pointerEvents:"none" }} />

      <motion.div initial={{ opacity:0, y:-10 }} animate={{ opacity:1, y:0 }}
        style={{ position:"absolute", top:14, left:14, display:"flex", alignItems:"center", gap:5, background:"rgba(99,102,241,.2)", backdropFilter:"blur(8px)", border:"1px solid rgba(99,102,241,.45)", borderRadius:20, padding:"4px 12px", fontSize:"0.72rem", fontWeight:700, color:"#a5b4fc", zIndex:10 }}>
        🛍️ Loja local
      </motion.div>

      {/* Logo/inicial centralizada */}
      <div style={{ position:"absolute", top:"40%", left:"50%", transform:"translate(-50%,-50%)", textAlign:"center", zIndex:5 }}>
        <motion.div initial={{ scale:.7, opacity:0 }} animate={isCurrent ? { scale:1, opacity:1 } : {}} transition={{ duration:.5, type:"spring" }}
          style={{ width:100, height:100, borderRadius:28, background:"rgba(99,102,241,.25)", border:"2px solid rgba(99,102,241,.5)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"2.8rem", fontWeight:900, color:"#fff", margin:"0 auto 16px", boxShadow:"0 0 40px rgba(99,102,241,.3)" }}>
          {loja.logo ? <img src={loja.logo} alt="" style={{ width:"100%", height:"100%", borderRadius:26, objectFit:"cover" }} /> : loja.nome?.[0]||"L"}
        </motion.div>
        <motion.div initial={{ opacity:0, y:16 }} animate={isCurrent ? { opacity:1, y:0 } : {}} transition={{ delay:.2 }}>
          <div style={{ fontFamily:"'Fraunces',serif", fontSize:"clamp(1.4rem,5vw,2rem)", fontWeight:900, color:"#fff", textShadow:"0 2px 12px rgba(0,0,0,.8)", marginBottom:6 }}>{loja.nome}</div>
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:"rgba(99,102,241,.2)", border:"1px solid rgba(99,102,241,.4)", borderRadius:20, padding:"4px 14px", fontSize:"0.75rem", fontWeight:700, color:"#a5b4fc" }}>
            🛍️ {loja.categoria}
          </div>
          {loja.cidade && <div style={{ marginTop:8, fontSize:"0.72rem", color:"rgba(255,255,255,.4)" }}>📍 {loja.cidade}{loja.estado ? ` - ${loja.estado}` : ""}</div>}
        </motion.div>
      </div>

      {/* Rodapé */}
      <div style={{ position:"absolute", bottom:0, left:0, right:0, padding:"0 14px 22px", zIndex:10 }}>
        {loja.desc && (
          <div style={{ background:"rgba(8,4,18,.8)", backdropFilter:"blur(14px)", border:"1px solid rgba(255,255,255,.08)", borderRadius:16, padding:"12px 14px", marginBottom:12, fontSize:"0.82rem", color:"rgba(255,255,255,.7)", lineHeight:1.5 }}>
            {loja.desc}
          </div>
        )}
        <Link to={`/loja/${loja.slug}`} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:8, background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:20, padding:"14px 24px", fontWeight:800, fontSize:"0.9rem", color:"#fff", textDecoration:"none" }}>
          🛍️ Visitar loja →
        </Link>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
export default function NexfoodyLojas() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts]       = useState<LojaPost[]>([]);
  const [lojas, setLojas]       = useState<LojaCard[]>([]);
  const [feed, setFeed]         = useState<Array<LojaPost | LojaCard>>([]);
  const [postAtual, setPostAtual] = useState(0);
  const [catAtiva, setCatAtiva] = useState<string | null>(null);
  const [cats, setCats]         = useState<string[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Carregar posts de lojas não-comida
  useEffect(() => {
    const q = query(collection(db, "postagens"), orderBy("createdAt","desc"), limit(30));
    return onSnapshot(q, snap => {
      const all: LojaPost[] = snap.docs.map(d => ({
        id: d.id, ...d.data(),
        _sortTs: d.data().createdAt?.toDate?.()?.getTime?.() ?? Date.now(),
      })) as LojaPost[];
      setPosts(all.filter(p => p.lojaCategoria && isNaoComida(p.lojaCategoria)));
    });
  }, []);

  // Carregar lojas não-comida
  useEffect(() => {
    getDocs(collection(db, "lojas")).then(snap => {
      const all: LojaCard[] = snap.docs.map(d => ({ id: d.id, ...d.data() })) as LojaCard[];
      const naoComida = all.filter(l => l.categoria && isNaoComida(l.categoria));
      setLojas(naoComida);
      // Extrair categorias únicas
      const uniq = [...new Set(naoComida.map(l => l.categoria).filter(Boolean))];
      setCats(uniq);
    });
  }, []);

  // Montar feed intercalando posts + lojas
  useEffect(() => {
    const result: Array<LojaPost | LojaCard> = [];
    const filtered = catAtiva ? posts.filter(p => p.lojaCategoria?.toLowerCase().includes(catAtiva.toLowerCase())) : posts;
    const lojasF   = catAtiva ? lojas.filter(l => l.categoria?.toLowerCase().includes(catAtiva.toLowerCase())) : lojas;
    let li = 0;
    filtered.forEach((p, i) => {
      result.push(p);
      if ((i + 1) % 3 === 0 && lojasF[li]) result.push(lojasF[li++]);
    });
    while (li < lojasF.length) result.push(lojasF[li++]);
    setFeed(result);
    setPostAtual(0);
  }, [posts, lojas, catAtiva]);

  // Snap scroll
  useEffect(() => {
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setPostAtual(Number((e.target as HTMLDivElement).dataset.idx)); });
    }, { threshold: 0.6 });
    cardRefs.current.forEach(r => r && obs.observe(r));
    return () => obs.disconnect();
  }, [feed]);

  const isPost  = (item: LojaPost | LojaCard): item is LojaPost  => "legenda" in item || "userNome" in item;

  return (
    <div style={{ background:"#05030f", height:"100dvh", display:"flex", flexDirection:"column", fontFamily:"'Outfit',sans-serif", overflow:"hidden", color:"#fff" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800;900&family=Fraunces:wght@700;900&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { display:none; }
      `}</style>

      {/* HEADER */}
      <div style={{ flexShrink:0, height:56, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 16px", background:"rgba(5,3,15,.95)", backdropFilter:"blur(12px)", borderBottom:"1px solid rgba(99,102,241,.15)", zIndex:100 }}>
        <button onClick={() => navigate("/app")} style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,.5)", display:"flex", alignItems:"center", gap:6, fontSize:"0.82rem", fontWeight:700 }}>
          ← 🍓 Comida
        </button>
        <div style={{ fontFamily:"'Fraunces',serif", fontSize:"1.1rem", fontWeight:900, color:"#a5b4fc" }}>🛍️ Outras lojas</div>
        {user
          ? <button onClick={() => navigate("/meu-perfil")} style={{ width:32, height:32, borderRadius:"50%", background:avatarBg(user.displayName||"U"), border:"2px solid rgba(99,102,241,.5)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontWeight:800, fontSize:"0.9rem", color:"#fff" }}>{user.displayName?.[0]||"U"}</button>
          : <Link to="/nexfoody/login" style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:20, padding:"6px 14px", fontWeight:800, fontSize:"0.75rem", color:"#fff", textDecoration:"none" }}>Entrar</Link>
        }
      </div>

      {/* FILTRO DE CATEGORIAS */}
      {cats.length > 0 && (
        <div style={{ flexShrink:0, padding:"10px 16px", display:"flex", gap:8, overflowX:"auto", background:"rgba(5,3,15,.9)", borderBottom:"1px solid rgba(99,102,241,.08)", scrollbarWidth:"none" }}>
          <button onClick={() => setCatAtiva(null)}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:20, border:`1px solid ${!catAtiva?"rgba(99,102,241,.6)":"rgba(255,255,255,.1)"}`, background:!catAtiva?"rgba(99,102,241,.2)":"rgba(255,255,255,.04)", color:!catAtiva?"#a5b4fc":"rgba(255,255,255,.5)", cursor:"pointer", fontWeight:700, fontSize:"0.78rem", whiteSpace:"nowrap", flexShrink:0 }}>
            ✨ Todos
          </button>
          {cats.map(cat => (
            <button key={cat} onClick={() => setCatAtiva(cat === catAtiva ? null : cat)}
              style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 14px", borderRadius:20, border:`1px solid ${catAtiva===cat?"rgba(99,102,241,.6)":"rgba(255,255,255,.1)"}`, background:catAtiva===cat?"rgba(99,102,241,.2)":"rgba(255,255,255,.04)", color:catAtiva===cat?"#a5b4fc":"rgba(255,255,255,.5)", cursor:"pointer", fontWeight:700, fontSize:"0.78rem", whiteSpace:"nowrap", flexShrink:0 }}>
              🛍️ {cat}
            </button>
          ))}
        </div>
      )}

      {/* FEED */}
      <div ref={feedRef} style={{ flex:1, overflowY:"scroll", scrollSnapType:"y mandatory", scrollbarWidth:"none" }}>
        {feed.length === 0
          ? (
            <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, padding:40, textAlign:"center" }}>
              <div style={{ fontSize:"4rem" }}>🛍️</div>
              <div style={{ fontFamily:"'Fraunces',serif", fontSize:"1.4rem", fontWeight:900, color:"#fff" }}>Ainda nenhuma loja aqui</div>
              <p style={{ color:"rgba(255,255,255,.4)", fontSize:"0.9rem", lineHeight:1.6 }}>Seja o primeiro a cadastrar seu negócio nessa categoria!</p>
              <Link to="/lojista/cadastro" style={{ background:"linear-gradient(135deg,#6366f1,#8b5cf6)", borderRadius:20, padding:"14px 28px", fontWeight:800, color:"#fff", textDecoration:"none" }}>
                Cadastrar minha loja →
              </Link>
            </div>
          )
          : feed.map((item, idx) => (
            <div key={"id" in item ? item.id : idx}
              ref={el => { cardRefs.current[idx] = el; }}
              data-idx={idx}
              style={{ height:"100dvh", scrollSnapAlign:"start", position:"relative", flexShrink:0 }}>
              <AnimatePresence>
                {isPost(item)
                  ? <PostCard post={item as LojaPost} isCurrent={postAtual === idx} />
                  : <LojaDestaque loja={item as LojaCard} isCurrent={postAtual === idx} />
                }
              </AnimatePresence>
            </div>
          ))
        }
      </div>

      {/* BOTTOM NAV */}
      <div style={{ flexShrink:0, height:54, background:"rgba(5,3,15,.97)", backdropFilter:"blur(16px)", borderTop:"1px solid rgba(99,102,241,.15)", display:"flex", zIndex:100 }}>
        <Link to="/app" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          🍓 Comida
        </Link>
        <Link to="/lojas" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"#a5b4fc", fontSize:"0.55rem", fontWeight:700, position:"relative" }}>
          🛍️ Lojas
          <span style={{ position:"absolute", bottom:3, width:4, height:4, borderRadius:"50%", background:"#6366f1" }} />
        </Link>
        <Link to="/mapa" style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          🗺️ Mapa
        </Link>
        <Link to={user?"/meu-perfil":"/nexfoody/login"} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, textDecoration:"none", color:"rgba(255,255,255,.35)", fontSize:"0.55rem", fontWeight:700 }}>
          👤 Perfil
        </Link>
      </div>
    </div>
  );
}

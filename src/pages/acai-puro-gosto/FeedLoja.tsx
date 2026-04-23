// src/pages/acai-puro-gosto/FeedLoja.tsx
import { useState, useEffect } from "react";
import { useTenant } from "../../contexts/TenantContext";
import { useStore } from "../../contexts/StoreContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, setDoc, deleteDoc, updateDoc, increment,
  serverTimestamp, getCountFromServer,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useNavigate } from "react-router-dom";
import CaixasDuplas from "../../components/CaixasDuplas";
import RankingFas from "../../components/RankingFas";

// ─── TIPOS ────────────────────────────────────────────────────
interface PostData {
  id: string;
  tipo?: "promo" | "novidade" | "aviso";
  postTipo?: "loja" | "cliente" | "promocao" | "cupom";
  texto?: string;
  foto?: string;
  midia?: string;
  fixado?: boolean;
  produtoId?: string;
  curtidas?: number;
  comentarios?: number;
  compartilhamentos?: number;
  titulo?: string;
  precoPromo?: string;
  validadePromo?: string;
  createdAt?: { toDate: () => Date };
  criadoEm?: { toDate: () => Date };
}

interface Story {
  id: string;
  tipo?: "imagem" | "video" | "texto";
  midia?: string;
  titulo?: string;
  texto?: string;
  cor?: string;
  permanente?: boolean;
  produtoId?: string;
  criadoEm?: { toDate: () => Date };
}

const TIPO_CONFIG: Record<string, { emoji: string; label: string; color: string; bg: string }> = {
  promo:    { emoji: "🔥", label: "Promoção",   color: "var(--gold)",  bg: "rgba(245,197,24,0.08)" },
  novidade: { emoji: "✨", label: "Novidade",   color: "var(--green)", bg: "rgba(34,197,94,0.08)" },
  aviso:    { emoji: "📢", label: "Aviso",       color: "#60a5fa",     bg: "rgba(96,165,250,0.08)" },
};

const TIPOS_DESTAQUE_FEED: Record<string, string> = {
  cardapio_dia: "🍽️",
  mais_pedidos: "🔥",
  combos:       "🎁",
  promocoes:    "💥",
  novidades:    "✨",
};

function formatDate(ts: unknown) {
  const t = ts as { toDate?: () => Date } | undefined;
  if (!t?.toDate) return "";
  return t.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ─── STORY VIEWER ─────────────────────────────────────────────
function StoryViewer({ stories, indexInicial, onClose, lojaUrl }: {
  stories: Story[]; indexInicial: number; onClose: () => void; lojaUrl: string;
}) {
  const [idx, setIdx] = useState(indexInicial);
  const [progresso, setProgresso] = useState(0);
  const navigate = useNavigate();
  const story = stories[idx];
  const DURACAO = 5000;

  useEffect(() => {
    setProgresso(0);
    const start = Date.now();
    const timer = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / DURACAO) * 100);
      setProgresso(p);
      if (p >= 100) {
        clearInterval(timer);
        if (idx < stories.length - 1) setIdx(i => i + 1);
        else onClose();
      }
    }, 50);
    return () => clearInterval(timer);
  }, [idx]);

  if (!story) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, height: "100vh", position: "relative", overflow: "hidden" }}>
        {/* Barras de progresso */}
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, display: "flex", gap: 4, zIndex: 10 }}>
          {stories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.3)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#fff", borderRadius: 2, width: i < idx ? "100%" : i === idx ? `${progresso}%` : "0%", transition: "width 0.05s linear" }} />
            </div>
          ))}
        </div>
        {/* Header */}
        <div style={{ position: "absolute", top: 24, left: 12, right: 12, display: "flex", alignItems: "center", gap: 10, zIndex: 10 }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#fff", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{story.titulo || "Story"}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1, marginLeft: "auto" }}>×</button>
        </div>
        {/* Mídia */}
        {story.tipo === "video"
          ? <video src={story.midia} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : story.midia
            ? <img src={story.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", background: story.cor || "linear-gradient(135deg,#7c3aed,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", padding: 32, textAlign: "center" }}>
                <span style={{ fontSize: "1.1rem", color: "#fff", fontWeight: 700, lineHeight: 1.5 }}>{story.texto}</span>
              </div>
        }
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.7) 100%)" }} />
        {/* CTA */}
        {story.produtoId && (
          <div style={{ position: "absolute", bottom: 40, left: 16, right: 16 }}>
            {story.texto && <div style={{ color: "#fff", fontSize: "1rem", fontWeight: 600, marginBottom: 12, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{story.texto}</div>}
            <button onClick={() => { onClose(); navigate(`${lojaUrl}?produto=${story.produtoId}`); }}
              style={{ width: "100%", padding: "13px", background: "var(--loja-cor-primaria, #8a5cf6)", border: "none", borderRadius: 14, color: "var(--loja-btn-texto, #fff)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>
              🛒 Pedir agora
            </button>
          </div>
        )}
        {/* Navegação por toque */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div style={{ flex: 1 }} onClick={e => { e.stopPropagation(); if (idx > 0) setIdx(i => i - 1); }} />
          <div style={{ flex: 1 }} onClick={e => { e.stopPropagation(); if (idx < stories.length - 1) setIdx(i => i + 1); else onClose(); }} />
        </div>
      </div>
    </div>
  );
}

// ─── CARD DE POST ─────────────────────────────────────────────
function PostCard({ post, curtido, onCurtir, salvo, onSalvar, onCompartilhar, lojaNome, lojaUrl }: {
  post: PostData; curtido: boolean; onCurtir: () => void;
  salvo: boolean; onSalvar: () => void; onCompartilhar: () => void;
  lojaNome: string; lojaUrl: string;
}) {
  const navigate = useNavigate();
  const cfg = TIPO_CONFIG[post.tipo || "aviso"];

  return (
    <div style={{ background: "var(--bg2)", border: `1px solid ${post.fixado ? "rgba(245,197,24,0.4)" : "var(--border)"}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
      {post.fixado && (
        <div style={{ padding: "6px 14px", background: "rgba(245,197,24,0.08)", borderBottom: "1px solid rgba(245,197,24,0.2)", fontSize: "0.7rem", color: "var(--gold)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          📌 Post fixado
        </div>
      )}
      {/* Mídia */}
      {(post.foto || post.midia) && (
        <div style={{ position: "relative" }}>
          {post.tipo === ("video" as string) || post.midia?.includes(".mp4")
            ? <video src={post.midia || post.foto} controls playsInline style={{ width: "100%", maxHeight: 380, objectFit: "cover", display: "block" }} />
            : <img src={post.foto || post.midia} alt="" style={{ width: "100%", maxHeight: 380, objectFit: "cover", display: "block" }} />
          }
          {post.postTipo === "promocao" && (
            <div style={{ position: "absolute", top: 12, left: 12, background: "linear-gradient(135deg, #f5c518, #e6a817)", borderRadius: 8, padding: "4px 12px", fontSize: "0.72rem", fontWeight: 800, color: "#0f0518" }}>🔥 PROMOÇÃO</div>
          )}
          {post.postTipo === "cliente" && (
            <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "4px 12px", fontSize: "0.72rem", fontWeight: 700, color: "#fff" }}>📍 {lojaNome}</div>
          )}
        </div>
      )}
      {/* Promo sem foto */}
      {post.postTipo === "promocao" && !post.foto && !post.midia && (
        <div style={{ background: "linear-gradient(135deg, rgba(245,197,24,0.12), rgba(230,168,23,0.05))", margin: 12, borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔥</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 900, color: "var(--gold)" }}>{post.titulo}</div>
          {post.precoPromo && <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--gold)", marginTop: 4 }}>R$ {post.precoPromo}</div>}
          {post.validadePromo && <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: 8 }}>⏱️ Válido até {post.validadePromo}</div>}
        </div>
      )}
      <div style={{ padding: "10px 14px 14px" }}>
        {/* Badge tipo (promo/novidade/aviso) */}
        {post.tipo && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: "1rem" }}>{cfg.emoji}</span>
            <span style={{ fontSize: "0.7rem", fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cfg.label}</span>
            <span style={{ fontSize: "0.68rem", color: "var(--text3)", marginLeft: "auto" }}>{formatDate(post.createdAt || post.criadoEm)}</span>
          </div>
        )}
        {post.texto && <div style={{ fontSize: "0.9rem", color: "var(--text)", lineHeight: 1.6, marginBottom: 10 }}>{post.texto}</div>}
        {/* Ações */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: post.produtoId ? 12 : 0 }}>
          <button onClick={onCurtir} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: curtido ? "#ef4444" : "var(--text3)", fontSize: "0.85rem", fontFamily: "'Outfit', sans-serif", padding: 0, transition: "all 0.2s" }}>
            <span style={{ fontSize: "1.1rem", transition: "transform 0.2s", transform: curtido ? "scale(1.2)" : "scale(1)" }}>{curtido ? "❤️" : "🤍"}</span>
            {(post.curtidas || 0) > 0 && <span style={{ fontWeight: 600 }}>{post.curtidas}</span>}
          </button>
          <button style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--text3)", fontSize: "0.85rem", fontFamily: "'Outfit', sans-serif", padding: 0 }}>
            <span style={{ fontSize: "1.1rem" }}>💬</span>
            {(post.comentarios || 0) > 0 && <span style={{ fontWeight: 600 }}>{post.comentarios}</span>}
          </button>
          <button onClick={onCompartilhar} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--text3)", fontSize: "0.85rem", fontFamily: "'Outfit', sans-serif", padding: 0 }}>
            <span style={{ fontSize: "1.1rem" }}>↗️</span>
            {(post.compartilhamentos || 0) > 0 && <span style={{ fontWeight: 600 }}>{post.compartilhamentos}</span>}
          </button>
          <button onClick={onSalvar} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: salvo ? "var(--gold)" : "var(--text3)", fontSize: "0.85rem", fontFamily: "'Outfit', sans-serif", padding: 0, marginLeft: "auto", transition: "all 0.2s" }}>
            <span style={{ fontSize: "1.1rem" }}>🔖</span>
            {salvo && <span style={{ fontSize: "0.72rem", color: "var(--gold)", fontWeight: 600 }}>Salvo</span>}
          </button>
        </div>
        {post.produtoId && (
          <button onClick={() => navigate(`${lojaUrl}?produto=${post.produtoId}`)}
            style={{ width: "100%", padding: "10px", background: "var(--loja-cor-primaria, #8a5cf6)", border: "none", borderRadius: 10, color: "var(--loja-btn-texto, #fff)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            🛒 {post.postTipo === "promocao" ? "Aproveitar promoção" : post.postTipo === "cliente" ? "Ver produto" : "Pedir esse produto"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────
export default function FeedLoja() {
  const { tenantId, tenantConfig } = useTenant();
  const { produtos, isAdmin } = useStore();
  const { user } = useAuth();
  const navigate = useNavigate();

  const lojaUrl = tenantId ? `/loja/${tenantId}` : "/";

  const [posts, setPosts] = useState<PostData[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [storyViewer, setStoryViewer] = useState<number | null>(null);
  const [curtidos, setCurtidos] = useState<Record<string, boolean>>({});
  const [salvos, setSalvos] = useState<Record<string, boolean>>({});
  const [seguindo, setSeguindo] = useState(false);
  const [totalSeguidores, setTotalSeguidores] = useState(0);
  const [loadingFollow, setLoadingFollow] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("feed");
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [buscaAtiva, setBuscaAtiva] = useState(false);

  // Posts (tenant-scoped)
  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, `tenants/${tenantId}/posts`),
      orderBy("createdAt", "desc"),
      limit(40)
    );
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PostData)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [tenantId]);

  // Stories (tenant-scoped)
  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, `tenants/${tenantId}/stories`),
      orderBy("criadoEm", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      const agora = Date.now();
      setStories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Story)).filter(s => {
        if (s.permanente) return true;
        if (!s.criadoEm?.toDate) return true;
        return agora - s.criadoEm.toDate().getTime() < 86400000;
      }));
    });
    return unsub;
  }, [tenantId]);

  // Seguidores + estado seguindo
  useEffect(() => {
    if (!tenantId) return;
    getCountFromServer(collection(db, `tenants/${tenantId}/seguidores`))
      .then(snap => setTotalSeguidores(snap.data().count))
      .catch(() => {});
    if (!user) return;
    getDoc(doc(db, `tenants/${tenantId}/seguidores`, user.uid))
      .then(d => setSeguindo(d.exists()));
  }, [user, tenantId]);

  // Estado curtidos/salvos do localStorage
  useEffect(() => {
    setCurtidos(JSON.parse(localStorage.getItem("postsCurtidos") || "{}"));
    setSalvos(JSON.parse(localStorage.getItem("postsSalvos") || "{}"));
  }, []);

  // ── Ações ──────────────────────────────────────────────────
  const toggleSeguir = async () => {
    if (!user) { navigate("/nexfoody/login"); return; }
    if (!tenantId) return;
    setLoadingFollow(true);
    try {
      const ref = doc(db, `tenants/${tenantId}/seguidores`, user.uid);
      if (seguindo) {
        await deleteDoc(ref);
        setSeguindo(false);
        setTotalSeguidores(n => Math.max(0, n - 1));
      } else {
        await setDoc(ref, { userId: user.uid, desde: serverTimestamp() });
        setSeguindo(true);
        setTotalSeguidores(n => n + 1);
      }
    } finally {
      setLoadingFollow(false);
    }
  };

  const curtirPost = async (post: PostData) => {
    if (!user) { navigate("/nexfoody/login"); return; }
    const jaCurtiu = !!curtidos[post.id];
    const novo = { ...curtidos };
    if (jaCurtiu) delete novo[post.id]; else novo[post.id] = true;
    setCurtidos(novo);
    localStorage.setItem("postsCurtidos", JSON.stringify(novo));
    if (!tenantId) return;
    try {
      await updateDoc(doc(db, `tenants/${tenantId}/posts`, post.id), {
        curtidas: increment(jaCurtiu ? -1 : 1),
      });
    } catch {}
  };

  const compartilharPost = (post: PostData) => {
    const txt = `${post.texto || ""}\n\n🔗 ${window.location.origin}${lojaUrl}/feed`;
    if (navigator.share) navigator.share({ title: tenantConfig?.nomeLoja || "Loja", text: txt });
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
    if (!tenantId) return;
    try { updateDoc(doc(db, `tenants/${tenantId}/posts`, post.id), { compartilhamentos: increment(1) }); } catch {}
  };

  const salvarPost = (post: PostData) => {
    const jaSalvou = !!salvos[post.id];
    const novo = { ...salvos };
    if (jaSalvou) delete novo[post.id]; else novo[post.id] = true;
    setSalvos(novo);
    localStorage.setItem("postsSalvos", JSON.stringify(novo));
  };

  // ── Filtros ────────────────────────────────────────────────
  const postsFiltrados = posts.filter(p => {
    if (busca.trim()) return p.texto?.toLowerCase().includes(busca.toLowerCase());
    if (abaAtiva === "cardapio") return !!p.produtoId;
    if (abaAtiva === "promocoes") return p.postTipo === "promocao" || p.tipo === "promo";
    if (abaAtiva === "cupons") return p.postTipo === "cupom";
    return true;
  });
  const postsOrdenados = [...postsFiltrados].sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0));

  // ── Destaque do dia ────────────────────────────────────────
  const destaquesHoje = (tenantConfig as any)?.destaquesHoje;
  const produtosDestaque = destaquesHoje?.ativo
    ? (produtos || []).filter(p => destaquesHoje.produtoIds?.includes(p.id) && p.ativo !== false)
    : [];

  const foto = tenantConfig?.logoUrl || null;
  const nome = tenantConfig?.nomeLoja || "Loja";

  if (loading) return (
    <div className="page">
      <div className="loading-screen"><div className="spinner" /></div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif", paddingBottom: 80 }}>

      {/* ── HEADER ─────────────────────────────────────────── */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(15,5,24,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 16px", height: 52, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(lojaUrl)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.1rem", padding: 0, flexShrink: 0 }}>←</button>
        {buscaAtiva ? (
          <input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar posts..."
            style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "7px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", outline: "none" }} />
        ) : (
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Fraunces', serif", fontSize: "1.05rem", fontWeight: 700, color: "var(--gold)" }}>
            {nome} <span style={{ fontSize: "0.7rem", color: "var(--purple2)", verticalAlign: "middle" }}>✔️</span>
          </div>
        )}
        <button onClick={() => { setBuscaAtiva(a => !a); setBusca(""); }}
          style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1rem", padding: 0, flexShrink: 0 }}>
          {buscaAtiva ? "✕" : "🔍"}
        </button>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* ── PERFIL ─────────────────────────────────────────── */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: seguindo ? "3px solid var(--primary)" : "2px solid var(--gold)", flexShrink: 0, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
              {foto ? <img src={foto} alt={nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🍓"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                {nome}
                <span style={{ fontSize: "0.75rem", color: "var(--purple2)" }}>✔️</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--gold)" }}>⭐ {(tenantConfig as any)?.notaMedia || "4.8"}</span>
                {tenantConfig?.endereco && <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>📍 {tenantConfig.endereco}</span>}
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 6 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text1)" }}>{posts.length}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)" }}>posts</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text1)" }}>{totalSeguidores}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)" }}>seguidores</div>
                </div>
              </div>
            </div>
          </div>
          {tenantConfig?.endereco === undefined && (tenantConfig as any)?.descricao && (
            <div style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.6, marginBottom: 12 }}>
              {(tenantConfig as any).descricao}
            </div>
          )}
          {/* Botões Seguir + Pedir */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={toggleSeguir} disabled={loadingFollow}
              style={{ flex: 1, padding: "9px", background: seguindo ? "var(--bg3, rgba(255,255,255,.06))" : "var(--loja-cor-primaria, #8a5cf6)", border: seguindo ? "1px solid var(--border)" : "none", borderRadius: 10, color: seguindo ? "var(--text2)" : "var(--loja-btn-texto, #fff)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: loadingFollow ? "not-allowed" : "pointer", opacity: loadingFollow ? 0.7 : 1, transition: "all 0.2s" }}>
              {loadingFollow ? "..." : seguindo ? "✓ Seguindo" : "❤️ Seguir"}
            </button>
            <button onClick={() => navigate(lojaUrl)}
              style={{ flex: 1, padding: "9px", background: "linear-gradient(135deg, #22c55e, #15803d)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
              🛒 Pedir agora
            </button>
          </div>
        </div>

        {/* ── PROVA SOCIAL ───────────────────────────────────── */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none" }}>
          <div style={{ flexShrink: 0, background: "rgba(255,149,0,0.1)", border: "1px solid rgba(255,149,0,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, color: "#ff9500" }}>🔥 Mais pedido hoje</div>
          <div style={{ flexShrink: 0, background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, color: "var(--gold)" }}>🥇 Top da região</div>
          {tenantConfig?.tempoMin && tenantConfig?.tempoMax && (
            <div style={{ flexShrink: 0, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, color: "var(--green)" }}>
              🚀 {tenantConfig.tempoMin}–{tenantConfig.tempoMax} min
            </div>
          )}
        </div>

        {/* ── STORIES ────────────────────────────────────────── */}
        {(stories.length > 0 || isAdmin) && (
          <div style={{ padding: "14px 0 10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
              {isAdmin && (
                <div onClick={() => navigate(`${lojaUrl}/admin`)} style={{ flexShrink: 0, cursor: "pointer", width: 82 }}>
                  <div style={{ width: 82, height: 118, borderRadius: 14, border: "2px dashed var(--border)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "var(--bg2)", gap: 6 }}>
                    <span style={{ fontSize: "1.6rem" }}>➕</span>
                    <span style={{ fontSize: "0.6rem", color: "var(--text3)", fontWeight: 600 }}>Novo story</span>
                  </div>
                </div>
              )}
              {stories.map((s, i) => (
                <div key={s.id} onClick={() => setStoryViewer(i)} style={{ flexShrink: 0, cursor: "pointer", width: 82 }}>
                  <div style={{ width: 82, height: 118, borderRadius: 14, overflow: "hidden", position: "relative", boxShadow: "0 0 0 2.5px var(--bg), 0 0 0 4px var(--gold)" }}>
                    {s.tipo === "imagem" && s.midia
                      ? <img src={s.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : s.tipo === "video" && s.midia
                        ? <video src={s.midia} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", background: s.cor || "linear-gradient(135deg,#7c3aed,#ec4899)", display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
                            <span style={{ fontSize: "0.62rem", color: "#fff", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>{s.texto}</span>
                          </div>
                    }
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 36, background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)" }} />
                    <div style={{ position: "absolute", bottom: 5, left: 6, right: 6, fontSize: "0.55rem", color: "#fff", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.titulo || s.texto || ""}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── CARROSSEL DESTAQUE DO DIA ───────────────────────── */}
        {produtosDestaque.length > 0 && (
          <div style={{ padding: "16px 0 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text)" }}>
                {TIPOS_DESTAQUE_FEED[destaquesHoje?.tipo] || "🍽️"} {destaquesHoje?.titulo || "Destaque do Dia"}
              </div>
              <button onClick={() => navigate(lojaUrl)} style={{ fontSize: "0.7rem", color: "var(--purple2)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 700, padding: 0 }}>Ver cardápio →</button>
            </div>
            <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 4px", scrollbarWidth: "none" }}>
              {produtosDestaque.map(p => (
                <div key={p.id} onClick={() => navigate(`${lojaUrl}?produto=${p.id}`)}
                  style={{ flexShrink: 0, width: 130, cursor: "pointer", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ height: 100, background: "var(--bg3)", overflow: "hidden", position: "relative" }}>
                    {p.foto
                      ? <img src={p.foto} alt={p.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>{(p as any).emoji || "🫐"}</div>
                    }
                    {(p as any).tag && <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: 20, padding: "2px 7px", fontSize: "0.55rem", fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>{(p as any).tag}</div>}
                  </div>
                  <div style={{ padding: "8px 10px 10px" }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, lineHeight: 1.3, marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" } as React.CSSProperties}>{p.nome}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "'Fraunces', serif", fontSize: "0.92rem", fontWeight: 900, color: "var(--gold)" }}>R$ {(p.preco ?? 0).toFixed(2).replace(".", ",")}</span>
                      <button onClick={e => { e.stopPropagation(); navigate(`${lojaUrl}?produto=${p.id}`); }}
                        style={{ width: 24, height: 24, background: "var(--loja-cor-primaria, #8a5cf6)", border: "none", borderRadius: "50%", color: "var(--loja-btn-texto, #fff)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ABAS ───────────────────────────────────────────── */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto", scrollbarWidth: "none" }}>
          {[{ id: "feed", label: "Feed" }, { id: "cardapio", label: "Cardápio" }, { id: "promocoes", label: "Promoções" }, { id: "cupons", label: "Cupons" }].map(t => (
            <button key={t.id} onClick={() => setAbaAtiva(t.id)}
              style={{ flexShrink: 0, flex: 1, padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${abaAtiva === t.id ? "var(--gold)" : "transparent"}`, color: abaAtiva === t.id ? "var(--gold)" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── CAIXAS DUPLAS ──────────────────────────────────── */}
        <CaixasDuplas modoFeed={true} />

        {/* ── POSTS ──────────────────────────────────────────── */}
        <div style={{ padding: "12px 16px" }}>
          {postsOrdenados.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📭</div>
              <div style={{ fontSize: "0.85rem" }}>{busca ? "Nenhum post encontrado" : "Nenhuma publicação ainda"}</div>
            </div>
          ) : postsOrdenados.map(post => (
            <PostCard
              key={post.id}
              post={post}
              curtido={!!curtidos[post.id]}
              onCurtir={() => curtirPost(post)}
              salvo={!!salvos[post.id]}
              onSalvar={() => salvarPost(post)}
              onCompartilhar={() => compartilharPost(post)}
              lojaNome={nome}
              lojaUrl={lojaUrl}
            />
          ))}
        </div>

        {/* ── RANKING DE FÃS ─────────────────────────────────── */}
        <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          <RankingFas compact={true} />
        </div>

      </div>

      {/* Story Viewer */}
      {storyViewer !== null && (
        <StoryViewer
          stories={stories}
          indexInicial={storyViewer}
          onClose={() => setStoryViewer(null)}
          lojaUrl={lojaUrl}
        />
      )}
    </div>
  );
}

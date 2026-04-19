// src/pages/FeedLoja.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, doc, updateDoc, increment, setDoc, deleteDoc, getDoc, addDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import CaixasDuplas from "../components/CaixasDuplas";
import RankingFas from "../components/RankingFas";

const TIPOS_DESTAQUE_FEED = {
  cardapio_dia: "🍽️",
  mais_pedidos: "🔥",
  combos:       "🎁",
  promocoes:    "💥",
  novidades:    "✨",
};

// ── Story Viewer ──────────────────────────────────────────────
function StoryViewer({ stories, indexInicial, onClose }) {
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
      if (p >= 100) { clearInterval(timer); if (idx < stories.length - 1) setIdx(i => i + 1); else onClose(); }
    }, 50);
    return () => clearInterval(timer);
  }, [idx]);

  if (!story) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 480, height: "100vh", position: "relative", overflow: "hidden" }}>
        {/* Barras progresso */}
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
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.7)", marginLeft: "auto" }}>{story.tempo}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", fontSize: "1.4rem", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {/* Mídia */}
        {story.tipo === "video"
          ? <video src={story.midia} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <img src={story.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        }
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 60%, rgba(0,0,0,0.7) 100%)" }} />
        {/* Texto e CTA */}
        <div style={{ position: "absolute", bottom: 40, left: 16, right: 16 }}>
          {story.texto && <div style={{ color: "#fff", fontSize: "1rem", fontWeight: 600, marginBottom: 12, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{story.texto}</div>}
          {story.produtoId && (
            <button onClick={() => { onClose(); navigate(`/?produto=${story.produtoId}`); }} style={{ width: "100%", padding: "13px", background: "var(--loja-cor-primaria, #8a5cf6)", border: "none", borderRadius: 14, color: "var(--loja-btn-texto, #fff)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>
              🛒 Pedir agora
            </button>
          )}
        </div>
        {/* Navegação toque */}
        <div style={{ position: "absolute", inset: 0, display: "flex" }}>
          <div style={{ flex: 1 }} onClick={e => { e.stopPropagation(); if (idx > 0) setIdx(i => i - 1); }} />
          <div style={{ flex: 1 }} onClick={e => { e.stopPropagation(); if (idx < stories.length - 1) setIdx(i => i + 1); else onClose(); }} />
        </div>
      </div>
    </div>
  );
}

// ── Card de Post ──────────────────────────────────────────────
function PostCard({ post, curtido, onCurtir, salvo, onSalvar, onCompartilhar, isAdmin }) {
  const navigate = useNavigate();

  return (
    <div style={{ background: "var(--bg2)", border: `1px solid ${post.fixado ? "rgba(245,197,24,0.4)" : "var(--border)"}`, borderRadius: 16, overflow: "hidden", marginBottom: 14 }}>
      {/* Badge fixado */}
      {post.fixado && (
        <div style={{ padding: "6px 14px", background: "rgba(245,197,24,0.08)", borderBottom: "1px solid rgba(245,197,24,0.2)", fontSize: "0.7rem", color: "var(--gold)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
          📌 Post fixado
        </div>
      )}
      {/* Mídia */}
      {post.midia && (
        <div style={{ position: "relative" }}>
          {post.tipo === "video"
            ? <video src={post.midia} controls playsInline style={{ width: "100%", maxHeight: 380, objectFit: "cover", display: "block" }} />
            : <img src={post.midia} alt="" style={{ width: "100%", maxHeight: 380, objectFit: "cover", display: "block" }} />
          }
          {post.postTipo === "promocao" && (
            <div style={{ position: "absolute", top: 12, left: 12, background: "linear-gradient(135deg, #f5c518, #e6a817)", borderRadius: 8, padding: "4px 12px", fontSize: "0.72rem", fontWeight: 800, color: "#0f0518" }}>🔥 PROMOÇÃO</div>
          )}
          {post.postTipo === "cliente" && (
            <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "4px 12px", fontSize: "0.72rem", fontWeight: 700, color: "#fff" }}>📍 {config?.nomeLoja || "Loja"}</div>
          )}
        </div>
      )}
      {/* Card promoção sem foto */}
      {post.postTipo === "promocao" && !post.midia && (
        <div style={{ background: "linear-gradient(135deg, rgba(245,197,24,0.12), rgba(230,168,23,0.05))", margin: 12, borderRadius: 12, padding: "24px 16px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔥</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 900, color: "var(--gold)" }}>{post.titulo}</div>
          {post.precoPromo && <div style={{ fontSize: "1.5rem", fontWeight: 900, color: "var(--gold)", marginTop: 4 }}>R$ {post.precoPromo}</div>}
          {post.validadePromo && <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: 8 }}>⏱️ Válido até {post.validadePromo}</div>}
        </div>
      )}
      {/* Avaliação cliente */}
      {post.postTipo === "cliente" && (
        <div style={{ padding: "12px 16px 0", display: "flex", gap: 2 }}>
          {[1,2,3,4,5].map(s => <span key={s} style={{ color: "#f5c518", fontSize: "1rem" }}>★</span>)}
        </div>
      )}
      {/* Corpo */}
      <div style={{ padding: "10px 14px 14px" }}>
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
            <span style={{ fontSize: "1.1rem" }}>{salvo ? "🔖" : "🔖"}</span>
            {salvo && <span style={{ fontSize: "0.72rem", color: "var(--gold)", fontWeight: 600 }}>Salvo</span>}
          </button>
        </div>
        {/* CTA produto */}
        {post.produtoId && (
          <button onClick={() => navigate(`/?produto=${post.produtoId}`)} style={{ width: "100%", padding: "10px", background: "var(--loja-cor-primaria)", border: "none", borderRadius: 10, color: "var(--loja-btn-texto, #fff)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            🛒 {post.postTipo === "promocao" ? "Aproveitar promoção" : post.postTipo === "cliente" ? "Ver produto" : "Pedir esse produto"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────
export default function FeedLoja() {
  const { user } = useAuth();
  const { config, isAdmin, produtos, tenantId } = useStore();
  const navigate = useNavigate();
  const [posts, setPosts] = useState([]);
  const [stories, setStories] = useState([]);
  const [storyViewer, setStoryViewer] = useState(null);
  const [curtidos, setCurtidos] = useState({});
  const [salvos, setSalvos] = useState({});
  const [seguindo, setSeguindo] = useState(false);
  const [seguidores, setSeguidores] = useState(0);
  const [abaAtiva, setAbaAtiva] = useState("feed");
  const [loading, setLoading] = useState(true);
  const [buscaAtiva, setBuscaAtiva] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    const unsubPosts = onSnapshot(query(collection(db, "feedLoja"), orderBy("criadoEm", "desc")), snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    const lojaId = tenantId || config?.slug;
    const storiesRef = lojaId
      ? query(collection(db, "lojas", lojaId, "stories"), orderBy("criadoEm", "desc"))
      : query(collection(db, "storiesLoja"), orderBy("criadoEm", "desc"));
    const unsubStories = onSnapshot(storiesRef, snap => {
      const agora = Date.now();
      setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => {
        if (s.permanente) return true;
        if (!s.criadoEm?.toDate) return true;
        return agora - s.criadoEm.toDate() < 86400000;
      }));
    });
    const unsubSeg = onSnapshot(collection(db, "seguidoresLoja"), snap => setSeguidores(snap.size));
    // Estado local
    setCurtidos(JSON.parse(localStorage.getItem("postsCurtidos") || "{}"));
    setSalvos(JSON.parse(localStorage.getItem("postsSalvos") || "{}"));
    if (user) getDoc(doc(db, "seguidoresLoja", user.uid)).then(d => setSeguindo(d.exists()));
    return () => { unsubPosts(); unsubStories(); unsubSeg(); };
  }, [user, tenantId]);

  const toggleSeguir = async () => {
    if (!user) { navigate("/login"); return; }
    const ref = doc(db, "seguidoresLoja", user.uid);
    if (seguindo) { await deleteDoc(ref); setSeguindo(false); }
    else { await setDoc(ref, { userId: user.uid, desde: serverTimestamp() }); setSeguindo(true); }
  };

  const curtirPost = async (post) => {
    if (!user) { navigate("/login"); return; }
    const jaCurtiu = !!curtidos[post.id];
    const novo = { ...curtidos };
    if (jaCurtiu) delete novo[post.id]; else novo[post.id] = true;
    setCurtidos(novo);
    localStorage.setItem("postsCurtidos", JSON.stringify(novo));
    try {
      await updateDoc(doc(db, "feedLoja", post.id), { curtidas: increment(jaCurtiu ? -1 : 1) });
      // +5 pts ranking para quem curtiu (só ao curtir, não ao descurtir)
      if (!jaCurtiu) {
        const ptsCurtir = parseInt(config.rankingPtsCurtirFeed) || 5;
        await updateDoc(doc(db, "users", user.uid), { rankingPts: increment(ptsCurtir) });
      }
    } catch {}
  };

  const compartilharPost = async (post) => {
    const txt = `${post.texto || ""}\n\n🔗 ${window.location.origin}/feed`;
    if (navigator.share) navigator.share({ title: config?.nomeLoja || "Loja", text: txt });
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
    // +10 pts ranking por compartilhar
    if (user) {
      try { const ptsComp = parseInt(config.rankingPtsCompartFeed) || 10; await updateDoc(doc(db, "users", user.uid), { rankingPts: increment(ptsComp) }); } catch {}
    }
    try { await updateDoc(doc(db, "feedLoja", post.id), { compartilhamentos: increment(1) }); } catch {}
  };

  const salvarPost = (post) => {
    const jaSalvou = !!salvos[post.id];
    const novo = { ...salvos };
    if (jaSalvou) delete novo[post.id]; else novo[post.id] = true;
    setSalvos(novo);
    localStorage.setItem("postsSalvos", JSON.stringify(novo));
  };

  // Filtrar posts por aba
  const postsFiltrados = posts.filter(p => {
    if (busca.trim()) return p.texto?.toLowerCase().includes(busca.toLowerCase());
    if (abaAtiva === "feed") return true;
    if (abaAtiva === "cardapio") return !!p.produtoId;
    if (abaAtiva === "promocoes") return p.postTipo === "promocao";
    if (abaAtiva === "cupons") return p.postTipo === "cupom";
    return true;
  });

  // Ordenar: fixados primeiro
  const postsOrdenados = [...postsFiltrados].sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0));

  // Produtos destaque (mais pedidos)
  const produtosDestaque = (produtos || []).filter(p => p.ativo !== false).slice(0, 6);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif", paddingBottom: 70 }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(15,5,24,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.1rem", padding: 0, flexShrink: 0 }}>←</button>
        {buscaAtiva ? (
          <input autoFocus value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar posts..." style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "7px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", outline: "none" }} />
        ) : (
          <div style={{ flex: 1, textAlign: "center", fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--gold)" }}>
            {config.nomeLoja || "Açaí Puro Gosto"} <span style={{ fontSize: "0.7rem", color: "var(--purple2)", verticalAlign: "middle" }}>✔️</span>
          </div>
        )}
        <button onClick={() => { setBuscaAtiva(a => !a); setBusca(""); }} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1rem", padding: 0, flexShrink: 0 }}>
          {buscaAtiva ? "✕" : "🔍"}
        </button>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Perfil da loja */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
            <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--gold)", flexShrink: 0, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
              {config.logoUrl ? <img src={config.logoUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🍓"}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                {config.nomeLoja || "Açaí Puro Gosto"}
                <span style={{ fontSize: "0.75rem", color: "var(--purple2)" }}>✔️</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4, flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--gold)" }}>⭐ {config.notaMedia || "4.8"}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>📍 {config.cidade || "Bacabal - MA"}</span>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>👥 {seguidores} seguidores</span>
              </div>
            </div>
          </div>
          {/* Bio */}
          {config.descricao && (
            <div style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.6, marginBottom: 12 }}>
              {config.descricao}
            </div>
          )}
          {/* Botões */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={toggleSeguir} style={{ flex: 1, padding: "9px", background: seguindo ? "var(--bg3)" : "var(--loja-cor-primaria)", border: seguindo ? "1px solid var(--border)" : "none", borderRadius: 10, color: seguindo ? "var(--text2)" : "var(--loja-btn-texto, #fff)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s" }}>
              {seguindo ? "✓ Seguindo" : "❤️ Seguir"}
            </button>
            <button onClick={() => navigate("/")} style={{ flex: 1, padding: "9px", background: "linear-gradient(135deg, #22c55e, #15803d)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
              🛒 Pedir agora
            </button>
          </div>
        </div>

        {/* Prova social */}
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none" }}>
          <div style={{ flexShrink: 0, background: "rgba(255,149,0,0.1)", border: "1px solid rgba(255,149,0,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, color: "#ff9500" }}>🔥 Mais pedido hoje</div>
          <div style={{ flexShrink: 0, background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, color: "var(--gold)" }}>🥇 Top da região</div>
          {config.tempoEntrega && <div style={{ flexShrink: 0, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 700, color: "var(--green)" }}>🚀 {config.tempoEntrega}</div>}
        </div>

        {/* Stories com thumbnail real */}
        {(stories.length > 0 || isAdmin) && (
          <div style={{ padding: "14px 0 10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
              {isAdmin && (
                <div onClick={() => navigate("/admin")} style={{ flexShrink: 0, cursor: "pointer", width: 82 }}>
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

        {/* Carrosel Destaque do Dia */}
        {config?.destaquesHoje?.ativo && config.destaquesHoje.produtoIds?.length > 0 && (() => {
          const prods = (produtos || []).filter(p => config.destaquesHoje.produtoIds.includes(p.id) && p.ativo !== false);
          if (prods.length === 0) return null;
          const tipoLabel = TIPOS_DESTAQUE_FEED[config.destaquesHoje.tipo] || config.destaquesHoje.tipo;
          return (
            <div style={{ padding: "16px 0 12px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px", marginBottom: 12 }}>
                <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text)" }}>{tipoLabel} {config.destaquesHoje.titulo}</div>
                <button onClick={() => navigate("/")} style={{ fontSize: "0.7rem", color: "var(--purple2)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 700, padding: 0 }}>Ver cardápio →</button>
              </div>
              <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "0 16px 4px", scrollbarWidth: "none" }}>
                {prods.map(p => (
                  <div key={p.id} onClick={() => navigate(`/?produto=${p.id}`)} style={{ flexShrink: 0, width: 130, cursor: "pointer", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
                    <div style={{ height: 100, background: "var(--bg3)", overflow: "hidden", position: "relative" }}>
                      {p.foto
                        ? <img src={p.foto} alt={p.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>{p.emoji || "🫐"}</div>
                      }
                      {p.tag && <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: 20, padding: "2px 7px", fontSize: "0.55rem", fontWeight: 700, color: "#fff", textTransform: "uppercase" }}>{p.tag}</div>}
                    </div>
                    <div style={{ padding: "8px 10px 10px" }}>
                      <div style={{ fontSize: "0.78rem", fontWeight: 700, lineHeight: 1.3, marginBottom: 4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.nome}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'Fraunces', serif", fontSize: "0.92rem", fontWeight: 900, color: "var(--gold)" }}>R$ {(p.preco ?? 0).toFixed(2).replace(".", ",")}</span>
                        <button onClick={e => { e.stopPropagation(); navigate(`/?produto=${p.id}`); }} style={{ width: 24, height: 24, background: "var(--loja-cor-primaria)", border: "none", borderRadius: "50%", color: "var(--loja-btn-texto, #fff)", fontSize: "0.9rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto", scrollbarWidth: "none" }}>
          {[{ id: "feed", label: "Feed" }, { id: "cardapio", label: "Cardápio" }, { id: "promocoes", label: "Promoções" }, { id: "cupons", label: "Cupons" }].map(t => (
            <button key={t.id} onClick={() => setAbaAtiva(t.id)} style={{ flexShrink: 0, flex: 1, padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${abaAtiva === t.id ? "var(--gold)" : "transparent"}`, color: abaAtiva === t.id ? "var(--gold)" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
         </div>

        {/* Caixas Duplas */}
        <CaixasDuplas modoFeed={true} />

        {/* Ranking de fãs — no final, não interrompe o feed */}
        <div style={{ marginTop: 8, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          <RankingFas compact={true} />
        </div>
      </div>
      {/* Story Viewer */}
      {storyViewer !== null && (
        <StoryViewer stories={stories} indexInicial={storyViewer} onClose={() => setStoryViewer(null)} />
      )}

      {/* Barra inferior */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100, background: "rgba(19,8,42,0.96)", backdropFilter: "blur(20px)", borderTop: "1px solid var(--border)", display: "flex", paddingBottom: "env(safe-area-inset-bottom)", maxWidth: 520, margin: "0 auto" }}>
        {[
          { icon: "🏠", label: "Home", action: () => navigate("/") },
          { icon: "🔍", label: "Buscar", action: () => setBuscaAtiva(a => !a) },
          { icon: "➕", label: "Postar", action: () => isAdmin ? navigate("/admin") : navigate("/") },
          { icon: "🔖", label: "Favoritos", action: () => setAbaAtiva("salvos") },
          { icon: "🛒", label: "Carrinho", action: () => navigate("/carrinho") },
        ].map((item, i) => (
          <button key={i} onClick={item.action} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "10px 4px 8px", background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontFamily: "'Outfit', sans-serif", fontSize: "0.62rem", fontWeight: 500 }}>
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

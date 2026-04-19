// src/pages/FeedLoja.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, doc, updateDoc, increment, setDoc, deleteDoc, getDoc, addDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import CaixasDuplas from "../components/CaixasDuplas";
import RankingFas from "../components/RankingFas";

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
            <button onClick={() => { onClose(); navigate(`/?produto=${story.produtoId}`); }} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, #8a5cf6, #5a2d91)", border: "none", borderRadius: 14, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer" }}>
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
            <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", borderRadius: 8, padding: "4px 12px", fontSize: "0.72rem", fontWeight: 700, color: "#fff" }}>📍 Açaí Puro Gosto</div>
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
          <button onClick={() => navigate(`/?produto=${post.produtoId}`)} style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", boxShadow: "0 4px 12px rgba(90,45,145,0.35)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
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
  const { config, isAdmin, produtos } = useStore();
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
    const unsubStories = onSnapshot(query(collection(db, "storiesLoja"), orderBy("criadoEm", "desc")), snap => {
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
  }, [user]);

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
    const txt = `${post.texto || ""}\n\n🔗 https://acaipurogosto.com.br/feed`;
    if (navigator.share) navigator.share({ title: "Açaí Puro Gosto", text: txt });
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
            <button onClick={toggleSeguir} style={{ flex: 1, padding: "9px", background: seguindo ? "var(--bg3)" : "linear-gradient(135deg, var(--purple2), var(--purple))", border: seguindo ? "1px solid var(--border)" : "none", borderRadius: 10, color: seguindo ? "var(--text2)" : "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", transition: "all 0.2s" }}>
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

        {/* Stories */}
        {stories.length > 0 && (
          <div style={{ padding: "14px 0 10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
              {/* Botão novo story — só admin */}
              {isAdmin && (
                <div onClick={() => navigate("/admin")} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}>
                  <div style={{ width: 58, height: 58, borderRadius: "50%", border: "2px dashed var(--border2)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg2)", fontSize: "1.4rem" }}>➕</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", fontWeight: 600 }}>Novo</div>
                </div>
              )}
              {stories.map((s, i) => (
                <div key={s.id} onClick={() => setStoryViewer(i)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: "pointer", flexShrink: 0 }}>
                  <div style={{ width: 58, height: 58, borderRadius: "50%", border: "2px solid var(--gold)", overflow: "hidden", padding: 2 }}>
                    <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>
                      {s.thumb ? <img src={s.thumb} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : s.emoji || "🍓"}
                    </div>
                  </div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text2)", fontWeight: 600, textAlign: "center", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.titulo || "Story"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Produtos em destaque */}
        {produtosDestaque.length > 0 && (
          <div style={{ padding: "14px 0 10px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ padding: "0 16px", fontSize: "0.78rem", fontWeight: 700, color: "var(--text2)", marginBottom: 10 }}>🍧 Mais pedidos</div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 16px", scrollbarWidth: "none" }}>
              {produtosDestaque.map(p => (
                <div key={p.id} onClick={() => navigate(`/?produto=${p.id}`)} style={{ flexShrink: 0, width: 100, cursor: "pointer", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ height: 70, background: "var(--bg3)", overflow: "hidden" }}>
                    {p.foto ? <img src={p.foto} alt={p.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>{p.emoji || "🫐"}</div>}
                  </div>
                  <div style={{ padding: "6px 8px" }}>
                    <div style={{ fontSize: "0.68rem", fontWeight: 600, lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.nome}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--gold)", fontWeight: 700, marginTop: 2 }}>R$ {p.preco?.toFixed(2).replace(".", ",")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Ranking compacto */}
        <RankingFas compact={true} />
        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", overflowX: "auto", scrollbarWidth: "none" }}>
          {[{ id: "feed", label: "Feed" }, { id: "cardapio", label: "Cardápio" }, { id: "promocoes", label: "Promoções" }, { id: "cupons", label: "Cupons" }].map(t => (
            <button key={t.id} onClick={() => setAbaAtiva(t.id)} style={{ flexShrink: 0, flex: 1, padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${abaAtiva === t.id ? "var(--gold)" : "transparent"}`, color: abaAtiva === t.id ? "var(--gold)" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer", transition: "all 0.2s", whiteSpace: "nowrap" }}>
              {t.label}
            </button>
          ))}
         </div>

        {/* Caixas Duplas */}
<CaixasDuplas modoFeed={true} />
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

// src/pages/PerfilCliente.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc, onSnapshot, collection, query, where, orderBy, limit, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { getBadges } from "../components/RankingFas";
import CaixasDuplas from "../components/CaixasDuplas";

const IMGBB_KEY = "4b8379f3bfc7eb113e0820730166a9f8";

// Ícone coração favorito
const IconHeart = ({ filled, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "#f5c518" : "none"} stroke={filled ? "#f5c518" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

export default function PerfilCliente() {
  const { userId } = useParams();
  const { user } = useAuth();
  const { config } = useStore();
  const navigate = useNavigate();
  const isMeu = !userId || userId === user?.uid;
  const targetId = isMeu ? user?.uid : userId;

  const [perfil, setPerfil] = useState(null);
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [uploadando, setUploadando] = useState(false);
  const [pedidos, setPedidos] = useState([]);
  const [rankingPos, setRankingPos] = useState(null);
  const [aba, setAba] = useState("feed");
  const [favoritos, setFavoritos] = useState([]);
  const [produtosData, setProdutosData] = useState({});
  const [cropModal, setCropModal] = useState(null);
  const [capaY, setCapaY] = useState(0);
  const [draggingCrop, setDraggingCrop] = useState(false);
  const [cropStartY, setCropStartY] = useState(0);

  // Stories
  const [stories, setStories] = useState([]);
  const [highlights, setHighlights] = useState([]);
  const [storyViewer, setStoryViewer] = useState(null);
  const [highlightModal, setHighlightModal] = useState(null);
  const [storyCamera, setStoryCamera] = useState(false);
  const [storyPreview, setStoryPreview] = useState(null);
  const [storyTipo, setStoryTipo] = useState("imagem");
  const [storyFile, setStoryFile] = useState(null);
  const [uploadingStory, setUploadingStory] = useState(false);
  const [storyProgress, setStoryProgress] = useState(0);

  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(doc(db, "users", targetId), snap => {
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setPerfil(data);
        if (data.capaY !== undefined) setCapaY(data.capaY);
        setForm({
          nome: data.nome || data.displayName || "",
          bio: data.bio || "",
          cidade: data.cidade || "",
          perfilOculto: data.perfilOculto || false,
        });
      }
    });
    return unsub;
  }, [targetId]);

  // Buscar posição no ranking
  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(
      query(collection(db, "users"), orderBy("pontos", "desc"), limit(100)),
      snap => {
        const lista = snap.docs.map((d, i) => ({ id: d.id, posicao: i + 1 }));
        const pos = lista.find(u => u.id === targetId);
        setRankingPos(pos?.posicao || null);
      }
    );
    return unsub;
  }, [targetId]);

  // Buscar pedidos
  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(
      query(collection(db, "pedidos"), where("userId", "==", targetId), orderBy("criadoEm", "desc"), limit(10)),
      snap => setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [targetId]);

  // Carregar favoritos do localStorage
  useEffect(() => {
    if (!isMeu) return;
    try {
      const fav = JSON.parse(localStorage.getItem("produtosFavoritos") || "{}");
      const favList = Object.values(fav);
      setFavoritos(favList);
    } catch {}
  }, [isMeu, targetId]);

  // Buscar dados dos produtos favoritos no Firestore
  useEffect(() => {
    if (favoritos.length === 0) return;
    const ids = favoritos.filter(f => f.id).map(f => f.id);
    const unsubs = ids.map(id =>
      onSnapshot(doc(db, "produtos", id), snap => {
        if (snap.exists()) {
          setProdutosData(prev => ({ ...prev, [id]: { id: snap.id, ...snap.data() } }));
        }
      })
    );
    return () => unsubs.forEach(u => u());
  }, [favoritos.length]);

  // Stories do cliente (todos — quem não é cliente não vê stories alheios)
  useEffect(() => {
    if (!targetId) return;
    // Debug: busca todos os stories do autor
    const unsub = onSnapshot(
      query(collection(db, "stories"), where("autorId", "==", targetId), orderBy("criadoEm", "desc")),
      snap => {
        console.log("📖 Stories query result:", targetId, "count:", snap.docs.length, snap.docs.map(d => d.data()));
        setStories(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );
    return unsub;
  }, [targetId]);

  // Highlights do cliente
  useEffect(() => {
    if (!targetId) return;
    const unsub = onSnapshot(
      query(collection(db, "highlights"), where("autorId", "==", targetId), orderBy("criadoEm", "asc")),
      snap => setHighlights(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [targetId]);

  // Assists a story (marca quem viu)
  const markStorySeen = async (storyId, viewerId) => {
    if (!viewerId) return;
    try {
      await updateDoc(doc(db, "stories", storyId), {
        visualizacoes: viewerId,
      }, { merge: true });
    } catch {}
  };

  // Criar highlight
  const criarHighlight = async (storyId) => {
    const story = stories.find(s => s.id === storyId);
    if (!story || !user?.uid) return;
    await addDoc(collection(db, "highlights"), {
      autorId: user.uid,
      capa: story.midia,
      tipo: story.tipo,
      stories: [storyId],
      titulo: "Novo",
      criadoEm: serverTimestamp(),
    });
  };

  const removeFavorito = (produtoId) => {
    const fav = JSON.parse(localStorage.getItem("produtosFavoritos") || "{}");
    delete fav[produtoId];
    localStorage.setItem("produtosFavoritos", JSON.stringify(fav));
    setFavoritos(prev => prev.filter(f => f.id !== produtoId));
  };

  const uploadFoto = async (file) => {
    if (!file || file.size > 5 * 1024 * 1024) return;
    setUploadando(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
      const data = await res.json();
      if (data.success) {
        await updateDoc(doc(db, "users", user.uid), { photoURL: data.data.url });
      }
    } catch (e) { console.error(e); }
    finally { setUploadando(false); }
  };

  const salvar = async () => {
    if (!user?.uid) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, "users", user.uid), {
        nome: form.nome.trim(),
        bio: form.bio.trim(),
        cidade: form.cidade.trim(),
        perfilOculto: form.perfilOculto,
      });
      setEditando(false);
    } catch (e) { console.error(e); }
    finally { setSalvando(false); }
  };

  if (!perfil) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: "3px solid var(--border2)", borderTopColor: "var(--gold)", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
    </div>
  );

  if (perfil.perfilOculto && !isMeu) return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 24 }}>
      <div style={{ fontSize: "3rem" }}>🔒</div>
      <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>Perfil privado</div>
      <div style={{ fontSize: "0.82rem", color: "var(--text3)", textAlign: "center" }}>Este cliente optou por manter seu perfil oculto</div>
      <button onClick={() => navigate(-1)} style={{ marginTop: 12, padding: "10px 24px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, color: "var(--text2)", fontFamily: "'Outfit', sans-serif", cursor: "pointer" }}>← Voltar</button>
    </div>
  );

  const badges = getBadges(rankingPos || 999, Math.floor(perfil.pontos || 0));
  const nome = perfil.nome || perfil.displayName || "Cliente";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(15,5,24,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: "0.95rem" }}>{isMeu ? "Meu Perfil" : nome}</div>
        {isMeu && !editando && (
          <button onClick={() => setEditando(true)} style={{ background: "none", border: "none", color: "var(--purple2)", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>✏️ Editar</button>
        )}
        {isMeu && editando && (
          <button onClick={() => setEditando(false)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "0.82rem", fontFamily: "'Outfit', sans-serif" }}>Cancelar</button>
        )}
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Capa */}
        <div style={{ height: 120, background: "linear-gradient(135deg, #2d1055, #1a0a36, #0f0518)", position: "relative", overflow: "hidden" }}>
          {perfil.fotoCapa && (
            <img src={perfil.fotoCapa} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: `center ${capaY}%` }} />
          )}
          <div style={{ position: "absolute", inset: 0, background: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%238a5cf6' fill-opacity='0.08'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
          {isMeu && (
            <label style={{ position: "absolute", bottom: 8, right: 8, background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: "0.7rem", color: "#fff" }}>
              {uploadando ? "⏳" : "🖼️ Alterar capa"}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                const file = e.target.files[0];
                if (!file) return;
                setUploadando(true);
                const url = URL.createObjectURL(file);
                setCropModal({ tempUrl: url, file });
                setUploadando(false);
              }} />
            </label>
          )}
        </div>

        {/* Avatar + info */}
        <div style={{ padding: "0 16px", marginTop: -40 }}>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 12 }}>
            {/* Avatar */}
            <div style={{ position: "relative" }}>
              <div style={{ width: 80, height: 80, borderRadius: "50%", border: "3px solid var(--bg)", overflow: "hidden", background: "linear-gradient(135deg, var(--purple), var(--gold2))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>
                {perfil.photoURL
                  ? <img src={perfil.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : nome[0]?.toUpperCase()
                }
              </div>
              {isMeu && (
                <label style={{ position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: "50%", background: "var(--purple)", border: "2px solid var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.7rem" }}>
                  {uploadando ? "⏳" : "📷"}
                  <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadFoto(e.target.files[0])} />
                </label>
              )}
            </div>
            {/* Ranking badge */}
            {rankingPos && rankingPos <= 10 && (
              <div style={{ background: "linear-gradient(135deg, rgba(245,197,24,0.15), rgba(138,92,246,0.1))", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 20, padding: "6px 14px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "1rem" }}>{rankingPos === 1 ? "👑" : rankingPos <= 3 ? "🏆" : "⭐"}</span>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gold)" }}>#{rankingPos} Ranking</span>
              </div>
            )}
          </div>

          {/* Nome e info */}
          {editando ? (
            <div style={{ animation: "fadeUp 0.2s ease" }}>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 600, display: "block", marginBottom: 4 }}>Nome</label>
                <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Seu nome" />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 600, display: "block", marginBottom: 4 }}>Bio</label>
                <textarea className="form-input" rows={2} value={form.bio} onChange={e => setForm(p => ({ ...p, bio: e.target.value }))} placeholder="Fã do melhor açaí da cidade 🍓" style={{ resize: "none" }} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 600, display: "block", marginBottom: 4 }}>Cidade</label>
                <input className="form-input" value={form.cidade} onChange={e => setForm(p => ({ ...p, cidade: e.target.value }))} placeholder="Ex: Bacabal - MA" />
              </div>
              {/* Toggle perfil oculto */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 600 }}>🔒 Perfil oculto</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 2 }}>Some do ranking e buscas públicas</div>
                </div>
                <div className={`toggle-switch ${form.perfilOculto ? "on" : ""}`} onClick={() => setForm(p => ({ ...p, perfilOculto: !p.perfilOculto }))} style={{ cursor: "pointer" }} />
              </div>
              <button onClick={salvar} disabled={salvando} style={{ width: "100%", padding: "13px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", boxShadow: "0 4px 16px rgba(90,45,145,0.4)" }}>
                {salvando ? "Salvando..." : "💾 Salvar perfil"}
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 700, marginBottom: 2 }}>{nome}</div>
              {perfil.bio && <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 6, lineHeight: 1.5 }}>{perfil.bio}</div>}
              {perfil.cidade && <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 10 }}>📍 {perfil.cidade}</div>}
              {/* Badges */}
              {badges.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {badges.map(b => (
                    <div key={b.id} style={{ background: "rgba(138,92,246,0.12)", border: "1px solid rgba(138,92,246,0.25)", borderRadius: 20, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ fontSize: "0.85rem" }}>{b.emoji}</span>
                      <span style={{ fontSize: "0.68rem", color: "var(--purple2)", fontWeight: 700 }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Stats */}
              <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "var(--gold)" }}>{Math.floor(perfil.pontos || 0).toLocaleString()}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>pontos</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "var(--purple2)" }}>{Math.floor(perfil.rankingPts || 0).toLocaleString()}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>pts ranking</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "var(--green)" }}>{pedidos.length}</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>pedidos</div>
                </div>
                {rankingPos && (
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: rankingPos <= 3 ? "var(--gold)" : "var(--text2)" }}>#{rankingPos}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>ranking</div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Stories + Highlights horizontal */}
        {!editando && (
          <div style={{ padding: "12px 14px 0", overflowX: "auto", scrollbarWidth: "none" }}>
            <div style={{ display: "flex", gap: 10, paddingBottom: 2 }}>
              {/* Criar story — só meu perfil */}
              {isMeu && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                  <div
                    onClick={() => setStoryCamera(true)}
                    style={{ width: 62, height: 62, borderRadius: "50%", background: "var(--bg2)", border: "2px dashed var(--purple2)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "1.8rem" }}
                  >+</div>
                  <span style={{ fontSize: "0.58rem", color: "var(--text3)" }}>Novo</span>
                </div>
              )}
              {/* Stories do cliente */}
              {stories.map(story => (
                <div key={story.id} onClick={() => { setStoryViewer(story); markStorySeen(story.id, user?.uid); }} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, cursor: "pointer" }}>
                  <div style={{ width: 66, height: 66, borderRadius: "50%", padding: 2, background: story.midia ? "conic-gradient(var(--purple2), var(--gold), var(--purple2))" : "var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "var(--bg)" }}>
                      {story.midia && story.tipo === "video"
                        ? <video src={story.midia} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : story.midia
                          ? <img src={story.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: "1.4rem" }}>📷</span>
                      }
                    </div>
                  </div>
                  <span style={{ fontSize: "0.58rem", color: "var(--text3)", maxWidth: 66, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>você</span>
                </div>
              ))}
              {/* Highlights */}
              {highlights.map(h => (
                <div key={h.id} onClick={() => setHighlightModal(h)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0, cursor: "pointer" }}>
                  <div style={{ width: 66, height: 66, borderRadius: "50%", padding: 2, background: "linear-gradient(135deg, var(--gold), var(--purple))", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden", background: "var(--bg)" }}>
                      {h.capa ? <img src={h.capa} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "1.4rem" }}>✨</span>}
                    </div>
                  </div>
                  <span style={{ fontSize: "0.58rem", color: "var(--text3)", maxWidth: 66, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.titulo}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        {!editando && (
          <>
            <div style={{ display: "flex", borderBottom: "1px solid var(--border)", margin: "0 0 16px" }}>
              {[{ id: "feed", label: "📸 Posts" }, { id: "pedidos", label: "🛒 Pedidos" }, { id: "favoritos", label: "❤️ Favoritos" }].map(t => (
                <button key={t.id} onClick={() => setAba(t.id)} style={{ flex: 1, padding: "12px 8px", background: "none", border: "none", borderBottom: `2px solid ${aba === t.id ? "var(--gold)" : "transparent"}`, color: aba === t.id ? "var(--gold)" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.78rem", cursor: "pointer" }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Conteúdo das tabs */}
            <div style={{ padding: "0 14px" }}>
              {aba === "feed" && (
                <div style={{ margin: "0 -14px" }}>
                  <CaixasDuplas filtroUserId={targetId} />
                </div>
              )}
              {aba === "pedidos" && (
                pedidos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🛒</div>
                    <div style={{ fontSize: "0.85rem" }}>Nenhum pedido ainda</div>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {pedidos.map(p => (
                      <div key={p.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>Pedido #{p.numeroPedido || p.id.slice(-4)}</div>
                          <div style={{ fontSize: "0.72rem", color: "var(--gold)", fontWeight: 700 }}>R$ {(p.total || 0).toFixed(2).replace(".", ",")}</div>
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
                          {p.criadoEm?.toDate ? p.criadoEm.toDate().toLocaleDateString("pt-BR") : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
              {aba === "favoritos" && (
                !isMeu ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🔖</div>
                    <div style={{ fontSize: "0.85rem" }}>Favoritos são visíveis apenas no próprio perfil</div>
                  </div>
                ) : favoritos.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
                    <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🔖</div>
                    <div style={{ fontSize: "0.85rem" }}>Nenhum favorito ainda</div>
                    <button onClick={() => navigate("/")} style={{ marginTop: 12, padding: "8px 16px", background: "var(--purple)", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>Explorar produtos</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {favoritos.map(fav => {
                      const prod = produtosData[fav.id];
                      const foto = prod?.foto || fav.foto;
                      const nome = prod?.nome || fav.nome || "Produto";
                      const preco = prod?.preco || fav.preco || 0;
                      return (
                        <div key={fav.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", position: "relative" }}>
                          <div onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
                            <div style={{ position: "relative", paddingTop: "100%", background: "var(--bg3)" }}>
                              {foto ? (
                                <img src={foto} alt={nome} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                              ) : (
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🫐</div>
                              )}
                              {prod?.tag && (
                                <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(0,0,0,0.6)", borderRadius: 50, padding: "2px 6px", fontSize: "0.58rem", fontWeight: 700, color: "#fff" }}>{prod.tag}</div>
                              )}
                            </div>
                            <div style={{ padding: "8px" }}>
                              <div style={{ fontWeight: 600, fontSize: "0.78rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{nome}</div>
                              <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700, fontSize: "0.88rem", marginTop: 2 }}>R$ {preco.toFixed(2).replace(".", ",")}</div>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFavorito(fav.id)}
                            style={{ position: "absolute", top: 6, right: 6, width: 26, height: 26, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          >
                            <IconHeart filled size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </>
        )}

        {/* Botões de ação — só no meu perfil */}
        {isMeu && !editando && (
          <div style={{ padding: "16px 14px 0", display: "flex", gap: 10 }}>
            <button onClick={() => navigate("/pontos")} style={{ flex: 1, padding: "11px", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 10, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
              🏆 Meus Pontos
            </button>
            <button onClick={() => navigate("/ranking")} style={{ flex: 1, padding: "11px", background: "rgba(138,92,246,0.1)", border: "1px solid rgba(138,92,246,0.3)", borderRadius: 10, color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
              📊 Ver Ranking
            </button>
          </div>
        )}

        {/* Modal de corte de capa */}
        {cropModal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#fff", marginBottom: 12 }}>Posicione a foto</div>
            <div style={{ position: "relative", width: "100%", maxWidth: 400, height: 120, overflow: "hidden", borderRadius: 8, border: "2px solid rgba(255,255,255,0.3)" }}>
              <img
                src={cropModal.tempUrl}
                alt=""
                draggable={false}
                style={{ position: "absolute", inset: 0, width: "100%", height: "130%", objectFit: "cover", objectPosition: `center ${capaY}%`, cursor: draggingCrop ? "grabbing" : "grab" }}
                onMouseDown={e => { setDraggingCrop(true); setCropStartY(e.clientY - capaY); }}
                onMouseMove={e => { if (draggingCrop) setCapaY(Math.max(0, Math.min(100, e.clientY - cropStartY))); }}
                onMouseUp={() => setDraggingCrop(false)}
                onMouseLeave={() => setDraggingCrop(false)}
                onTouchStart={e => { setDraggingCrop(true); setCropStartY(e.touches[0].clientY - capaY); }}
                onTouchMove={e => { if (draggingCrop) setCapaY(Math.max(0, Math.min(100, e.touches[0].clientY - cropStartY))); }}
                onTouchEnd={() => setDraggingCrop(false)}
              />
            </div>
            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", marginTop: 8, marginBottom: 16 }}>Arraste para ajustar</div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { URL.revokeObjectURL(cropModal.tempUrl); setCropModal(null); setCapaY(0); }}
                style={{ padding: "10px 20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600, cursor: "pointer" }}
              >Cancelar</button>
              <button
                onClick={async () => {
                  setUploadando(true);
                  try {
                    const fd = new FormData();
                    fd.append("image", cropModal.file);
                    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
                    const data = await res.json();
                    if (data.success) {
                      await updateDoc(doc(db, "users", user.uid), { fotoCapa: data.data.url, capaY });
                    }
                    URL.revokeObjectURL(cropModal.tempUrl);
                    setCropModal(null);
                  } catch (e) { console.error(e); }
                  finally { setUploadando(false); }
                }}
                disabled={uploadando}
                style={{ padding: "10px 20px", background: "var(--purple2)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: uploadando ? "not-allowed" : "pointer", opacity: uploadando ? 0.6 : 1 }}
              >{uploadando ? "⏳" : "💾 Salvar"}</button>
            </div>
          </div>
        )}

        {/* Story Viewer */}
        {storyViewer && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", padding: "10px 14px", gap: 10 }}>
              <button onClick={() => setStoryViewer(null)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1rem" }}>✕</button>
              <span style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600 }}>você</span>
              <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", marginLeft: "auto" }}>
                {storyViewer.criadoEm?.toDate ? storyViewer.criadoEm.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}
              </span>
            </div>
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {storyViewer.tipo === "video"
                ? <video src={storyViewer.midia} controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                : <img src={storyViewer.midia} alt="" style={{ width: "100%", maxHeight: "80vh", objectFit: "contain" }} />
              }
            </div>
            {isMeu && (
              <div style={{ padding: "10px 14px", display: "flex", gap: 10 }}>
                <button onClick={async () => { await criarHighlight(storyViewer.id); setStoryViewer(null); }} style={{ flex: 1, padding: "10px", background: "rgba(245,197,24,0.15)", border: "1px solid rgba(245,197,24,0.4)", borderRadius: 10, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}>⭐ Salvar como Highlight</button>
                <button onClick={async () => { await deleteDoc(doc(db, "stories", storyViewer.id)); setStoryViewer(null); }} style={{ flex: 1, padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}>🗑 Apagar</button>
              </div>
            )}
          </div>
        )}

        {/* Highlight Viewer */}
        {highlightModal && (
          <HighlightViewer
            highlight={highlightModal}
            stories={stories}
            isMeu={isMeu}
            user={user}
            onClose={() => setHighlightModal(null)}
            onDelete={async (highlightId) => {
              await deleteDoc(doc(db, "highlights", highlightId));
              setHighlightModal(null);
            }}
            onUpdateTitle={async (highlightId, novoTitulo) => {
              await updateDoc(doc(db, "highlights", highlightId), { titulo: novoTitulo });
            }}
          />
        )}

        {/* Story Camera */}
        {storyCamera && (
          <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <button onClick={() => { setStoryCamera(false); setStoryPreview(null); }} style={{ position: "absolute", top: 14, right: 14, background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
            <div style={{ width: "100%", maxWidth: 360, aspectRatio: "9/16", background: "var(--bg2)", borderRadius: 16, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
              {storyPreview
                ? (storyTipo === "video"
                    ? <video src={storyPreview} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <img src={storyPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  )
                : <span style={{ fontSize: "3rem" }}>📷</span>
              }
            </div>
            {storyPreview ? (
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setStoryPreview(null); }} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600, cursor: "pointer" }}>Trocar</button>
                <button onClick={async () => {
                  if (!storyPreview) return;
                  setUploadingStory(true);
                  try {
                    const isVideo = storyTipo === "video";
                    let url = "";
                    if (isVideo) {
                      url = await new Promise((resolve) => {
                        const nome = `stories/${Date.now()}_video.mp4`;
                        const ref = storageRef(storage, nome);
                        const task = uploadBytesResumable(ref, storyFile);
                        task.on("state_changed", snap => setStoryProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)), err => resolve(""), async () => { resolve(await getDownloadURL(task.snapshot.ref)); });
                      });
                    } else {
                      const res = await fetch(storyPreview);
                      const blob = await res.blob();
                      const formData = new FormData();
                      formData.append("image", blob);
                      const resp = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: formData });
                      const data = await resp.json();
                      url = data.success ? data.data.url : "";
                    }
                    if (url) {
                      await addDoc(collection(db, "stories"), {
                        autorId: user.uid,
                        midia: url,
                        tipo: storyTipo,
                        visualizacoes: [],
                        criadoEm: serverTimestamp(),
                      });
                      setStoryCamera(false);
                      setStoryPreview(null);
                    }
                  } catch (e) { console.error("Erro ao postar story:", e); alert("Erro: " + (e?.message || e?.code || JSON.stringify(e))); }
                  finally { setUploadingStory(false); }
                }} disabled={uploadingStory} style={{ padding: "10px 20px", background: "var(--purple2)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: uploadingStory ? "not-allowed" : "pointer", opacity: uploadingStory ? 0.6 : 1 }}>
                  {uploadingStory ? "⏳ Postando..." : "📤 Postar Story"}
                </button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: "pointer", color: "#fff" }}>
                <div style={{ fontSize: "2.5rem" }}>📷</div>
                <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>Foto ou vídeo (máx 15s)</div>
                <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={e => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const isVideo = file.type.startsWith("video/");
                  setStoryTipo(isVideo ? "video" : "imagem");
                  setStoryFile(file);
                  setStoryPreview(URL.createObjectURL(file));
                }} />
              </label>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

// ─── HighlightViewer ───
function HighlightViewer({ highlight, stories, isMeu, user, onClose, onDelete, onUpdateTitle }) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(highlight.titulo);

  // só stories que estão neste highlight
  const highlightStories = stories.filter(s => highlight.stories.includes(s.id));
  const total = highlightStories.length;
  const current = highlightStories[currentIdx];

  // progresso por story
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!current) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          // avança para próxima
          if (currentIdx < total - 1) {
            setCurrentIdx(i => i + 1);
          } else {
            onClose();
          }
          return 100;
        }
        return p + 2; // ~5s por story
      });
    }, 100);
    return () => clearInterval(interval);
  }, [current, currentIdx, total]);

  if (!current) {
    return (
      <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#fff", fontSize: "1rem", marginBottom: 16 }}>Nenhuma story neste highlight</div>
        <button onClick={onClose} style={{ padding: "10px 20px", background: "var(--purple2)", border: "none", borderRadius: 10, color: "#fff", cursor: "pointer" }}>Fechar</button>
      </div>
    );
  }

  const goNext = () => { if (currentIdx < total - 1) setCurrentIdx(i => i + 1); else onClose(); };
  const goPrev = () => { if (currentIdx > 0) setCurrentIdx(i => i - 1); };

  const salvarTitulo = async () => {
    if (titleInput.trim()) {
      await onUpdateTitle(highlight.id, titleInput.trim());
    }
    setEditingTitle(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "#000", display: "flex", flexDirection: "column" }}>
      {/* Barra de progresso por story */}
      <div style={{ display: "flex", gap: 4, padding: "8px 12px" }}>
        {highlightStories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.3)", borderRadius: 2 }}>
            <div style={{ width: `${i < currentIdx ? 100 : i === currentIdx ? progress : 0}%`, height: "100%", background: "#fff", borderRadius: 2, transition: "width 0.1s linear" }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 14px", gap: 10 }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        <div style={{ flex: 1 }}>
          {editingTitle ? (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                value={titleInput}
                onChange={e => setTitleInput(e.target.value)}
                onBlur={salvarTitulo}
                onKeyDown={e => { if (e.key === "Enter") salvarTitulo(); }}
                autoFocus
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 6, color: "#fff", padding: "4px 8px", fontSize: "0.82rem", fontFamily: "'Outfit', sans-serif", width: 100 }}
              />
            </div>
          ) : (
            <span
              onClick={isMeu ? () => setEditingTitle(true) : undefined}
              style={{ fontSize: "0.85rem", color: "#fff", fontWeight: 600, cursor: isMeu ? "pointer" : "default" }}
            >{highlight.titulo} {isMeu && "✏️"}</span>
          )}
        </div>
        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.6)" }}>{currentIdx + 1}/{total}</span>
      </div>

      {/* Mídia — toque para navegar */}
      <div
        style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}
        onTouchStart={e => { goNext(); }}
        onClick={goNext}
      >
        {/* Tap zones */}
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "30%", cursor: "pointer" }} onClick={goPrev} />

        {current.tipo === "video"
          ? <video src={current.midia} controls playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          : <img src={current.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        }
      </div>

      {/* Ações */}
      {isMeu && (
        <div style={{ padding: "10px 14px", display: "flex", gap: 10 }}>
          <button
            onClick={() => { if (confirm("Apagar este highlight?")) onDelete(highlight.id); }}
            style={{ flex: 1, padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.8rem", cursor: "pointer" }}
          >🗑 Apagar highlight</button>
        </div>
      )}
    </div>
  );
}

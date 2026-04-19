// src/pages/Social.js — Rede Social CardápioZap
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/Toast";
import {
  collection, query, orderBy, onSnapshot, addDoc, doc,
  updateDoc, arrayUnion, arrayRemove, getDoc, getDocs,
  where, serverTimestamp, deleteDoc, limit
} from "firebase/firestore";
import { db, storage } from "../lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const IMGBB_KEY = "4b8379f3bfc7eb113e0820730166a9f8";

async function uploadVideo(file, onProgress) {
  const ext = file.name.split(".").pop() || "mp4";
  const path = `postagens_videos/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const storageRef = ref(storage, path);
  return new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file);
    task.on("state_changed",
      snap => onProgress && onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      reject,
      () => getDownloadURL(task.snapshot.ref).then(resolve).catch(reject)
    );
  });
}

// ===== COMPRESSOR =====
async function comprimirImg(file, maxW = 800) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > maxW) { h = h * maxW / w; w = maxW; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => resolve(b || file), "image/webp", 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

async function uploadImg(file) {
  const blob = await comprimirImg(file);
  const fd = new FormData();
  fd.append("image", blob);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
  const data = await res.json();
  return data.success ? data.data.url : null;
}

// ===== PERFIL PÚBLICO =====
function PerfilPublico({ userId, onClose }) {
  const [perfil, setPerfil] = useState(null);
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    getDoc(doc(db, "users", userId)).then(d => d.exists() && setPerfil({ id: d.id, ...d.data() }));
    const q = query(collection(db, "postagens"), where("userId", "==", userId), orderBy("createdAt", "desc"), limit(9));
    const unsub = onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [userId]);

  if (!perfil) return null;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "var(--bg)", borderRadius: "20px 20px 0 0", maxHeight: "85vh", overflowY: "auto", paddingBottom: 40 }}>
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "12px 16px 0" }}>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontSize: "1.2rem" }}>✕</button>
        </div>
        <div style={{ textAlign: "center", padding: "0 20px 20px" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", overflow: "hidden", background: "var(--bg3)", border: "3px solid rgba(245,197,24,0.4)", margin: "0 auto 10px" }}>
            {perfil.fotoPerfil ? <img src={perfil.fotoPerfil} alt={perfil.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces',serif", fontSize: "1.8rem", color: "var(--gold)" }}>{perfil.nome?.[0]}</div>}
          </div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.2rem", fontWeight: 700 }}>{perfil.nome}</div>
          {perfil.bio && <div style={{ fontSize: "0.82rem", color: "var(--text2)", marginTop: 4, lineHeight: 1.5 }}>{perfil.bio}</div>}
          {perfil.cidade && <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 4 }}>📍 {perfil.cidade}</div>}
          <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 14 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 800, color: "var(--gold)" }}>{posts.length}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>Posts</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 800, color: "var(--gold)" }}>{perfil.pontos || 0}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>Pontos</div>
            </div>
          </div>
        </div>
        {posts.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2, padding: "0 2px" }}>
            {posts.map(p => (
              <div key={p.id} style={{ paddingTop: "100%", position: "relative", background: "var(--bg3)" }}>
                {p.video && <>
                  <video src={p.video} muted playsInline preload="metadata" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.6)", borderRadius: 6, padding: "2px 5px", fontSize: "0.55rem", color: "#fff" }}>▶</div>
                </>}
                {!p.video && p.foto && <img src={p.foto} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                {!p.video && !p.foto && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>🫐</div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== TEMPO RELATIVO =====
function tempoRelativo(timestamp) {
  if (!timestamp?.toDate) return "agora";
  const diff = (Date.now() - timestamp.toDate().getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} dias atrás`;
  return timestamp.toDate().toLocaleDateString("pt-BR");
}

// ===== CARD DE POSTAGEM =====
function PostCard({ post, currentUid, onCurtir, onDeletar, onVerPerfil }) {
  const curtido = post.curtidas?.includes(currentUid);
  const [showOpts, setShowOpts] = useState(false);
  const [showComentarios, setShowComentarios] = useState(false);
  const [comentarios, setComentarios] = useState([]);
  const [novoComentario, setNovoComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const { user, userData } = useAuth();

  const TEXTO_MAX = 120;
  const textoLongo = (post.legenda?.length || 0) > TEXTO_MAX;

  useEffect(() => {
    if (!showComentarios) return;
    const q = query(collection(db, `postagens/${post.id}/comentarios`), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, snap => setComentarios(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [showComentarios, post.id]);

  const enviarComentario = async () => {
    if (!novoComentario.trim() || !user) return;
    setEnviando(true);
    try {
      await addDoc(collection(db, `postagens/${post.id}/comentarios`), {
        userId: user.uid,
        userNome: userData?.nome || "Anônimo",
        userFoto: userData?.fotoPerfil || null,
        texto: novoComentario.trim(),
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "postagens", post.id), {
        numComentarios: (post.numComentarios || 0) + 1
      });
      setNovoComentario("");
    } catch {}
    finally { setEnviando(false); }
  };

  const compartilhar = () => {
    const texto = `🍕 ${post.userNome} postou no CardápioZap!

${post.legenda || ""}${post.produtoNome ? `
🛵 ${post.produtoNome}` : ""}

📲 Baixe o app: https://acaipurogosto.com.br`;
    if (navigator.share) navigator.share({ title: "CardápioZap", text: texto });
    else { navigator.clipboard.writeText(texto); }
  };

  const denunciar = () => {
    if (window.confirm("Denunciar esta postagem como inapropriada?")) {
      addDoc(collection(db, "denuncias"), {
        postId: post.id, userId: currentUid,
        motivo: "inapropriado", createdAt: serverTimestamp()
      });
      alert("Denúncia enviada. Obrigado!");
    }
  };

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>

      {/* 1. CABEÇALHO */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px" }}>
        <div onClick={() => onVerPerfil(post.userId)} style={{ width: 42, height: 42, borderRadius: "50%", overflow: "hidden", background: "var(--bg3)", flexShrink: 0, cursor: "pointer", border: "2px solid rgba(245,197,24,0.3)" }}>
          {post.userFoto
            ? <img src={post.userFoto} alt={post.userNome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--gold)", fontSize: "1.1rem" }}>{post.userNome?.[0]?.toUpperCase()}</div>
          }
        </div>
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => onVerPerfil(post.userId)}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{post.userNome}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>
            {post.cidade && `📍 ${post.cidade} · `}{tempoRelativo(post.createdAt)}
          </div>
        </div>
        {/* Menu opções */}
        <div style={{ position: "relative" }}>
          <button onClick={() => setShowOpts(p => !p)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "1.3rem", padding: "0 4px", lineHeight: 1 }}>⋯</button>
          {showOpts && (
            <div onClick={() => setShowOpts(false)} style={{ position: "absolute", right: 0, top: 30, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", zIndex: 10, minWidth: 150, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
              {post.userId === currentUid ? (
                <button onClick={() => { onDeletar(post.id); }} style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>🗑️ Apagar post</button>
              ) : (
                <button onClick={denunciar} style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", cursor: "pointer", color: "var(--text2)", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}>🚩 Denunciar</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. TEXTO */}
      {post.legenda && (
        <div style={{ padding: "0 14px 10px", fontSize: "0.88rem", lineHeight: 1.6, color: "var(--text)" }}>
          {textoLongo && !expandido
            ? <>{post.legenda.slice(0, TEXTO_MAX)}... <span onClick={() => setExpandido(true)} style={{ color: "var(--purple2)", cursor: "pointer", fontWeight: 600 }}>ver mais</span></>
            : post.legenda
          }
        </div>
      )}

      {/* Produto tag */}
      {post.produtoNome && (
        <div style={{ padding: "0 14px 10px" }}>
          <span style={{ fontSize: "0.72rem", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 20, padding: "3px 10px", color: "var(--gold)" }}>🛵 {post.produtoNome}</span>
        </div>
      )}

      {/* 3. MÍDIA: vídeo ou foto */}
      {post.video && (
        <video src={post.video} controls muted playsInline preload="metadata" style={{ width: "100%", maxHeight: 420, display: "block", background: "#000" }} />
      )}
      {!post.video && post.foto && (
        <img src={post.foto} alt="post" style={{ width: "100%", maxHeight: 400, objectFit: "cover", display: "block" }} />
      )}

      {/* 4. RESUMO DE INTERAÇÕES */}
      <div style={{ padding: "8px 14px 6px", display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--text3)", borderTop: post.foto ? "none" : "1px solid var(--border)" }}>
        <span>{post.curtidas?.length > 0 && `❤️ ${post.curtidas.length} curtida${post.curtidas.length > 1 ? "s" : ""}`}</span>
        <div style={{ display: "flex", gap: 10 }}>
          {(post.numComentarios || 0) > 0 && <span onClick={() => setShowComentarios(true)} style={{ cursor: "pointer" }}>{post.numComentarios} comentário{post.numComentarios > 1 ? "s" : ""}</span>}
        </div>
      </div>

      {/* 5. BARRA DE AÇÃO */}
      <div style={{ padding: "6px 14px 10px", display: "flex", alignItems: "center", borderTop: "1px solid var(--border)" }}>
        <button onClick={() => onCurtir(post.id, curtido)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: curtido ? "#ef4444" : "var(--text2)", fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem", padding: "6px 0", transition: "all 0.2s" }}>
          <span style={{ fontSize: "1.2rem", transform: curtido ? "scale(1.2)" : "scale(1)", transition: "transform 0.2s" }}>{curtido ? "❤️" : "🤍"}</span>
          Curtir
        </button>
        <div style={{ width: 1, height: 24, background: "var(--border)" }} />
        <button onClick={() => setShowComentarios(p => !p)} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: showComentarios ? "var(--purple2)" : "var(--text2)", fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem", padding: "6px 0" }}>
          <span style={{ fontSize: "1.1rem" }}>💬</span>
          Comentar
        </button>
        <div style={{ width: 1, height: 24, background: "var(--border)" }} />
        <button onClick={compartilhar} style={{ flex: 1, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5, color: "var(--text2)", fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem", padding: "6px 0" }}>
          <span style={{ fontSize: "1.1rem" }}>↗️</span>
          Compartilhar
        </button>
      </div>

      {/* 6. COMENTÁRIOS */}
      {showComentarios && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "10px 14px 14px", background: "rgba(0,0,0,0.1)" }}>
          {comentarios.length === 0 && <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 10, textAlign: "center" }}>Nenhum comentário ainda. Seja o primeiro! 💬</div>}
          {comentarios.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg3)", overflow: "hidden", flexShrink: 0 }}>
                {c.userFoto ? <img src={c.userFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, color: "var(--gold)" }}>{c.userNome?.[0]}</div>}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ background: "var(--bg2)", borderRadius: "4px 12px 12px 12px", padding: "8px 12px" }}>
                  <div style={{ fontWeight: 700, fontSize: "0.75rem", marginBottom: 2, color: "var(--gold)" }}>{c.userNome}</div>
                  <div style={{ fontSize: "0.83rem", lineHeight: 1.4 }}>{c.texto}</div>
                </div>
                <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 3, marginLeft: 4 }}>{tempoRelativo(c.createdAt)}</div>
              </div>
            </div>
          ))}
          {user && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg3)", overflow: "hidden", flexShrink: 0 }}>
                {userData?.fotoPerfil ? <img src={userData.fotoPerfil} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.72rem", fontWeight: 700, color: "var(--gold)" }}>{userData?.nome?.[0]}</div>}
              </div>
              <div style={{ flex: 1, display: "flex", gap: 6 }}>
                <input
                  value={novoComentario}
                  onChange={e => setNovoComentario(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && enviarComentario()}
                  placeholder="Escreva um comentário..."
                  style={{ flex: 1, padding: "8px 12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, color: "var(--text)", fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem" }}
                />
                <button onClick={enviarComentario} disabled={enviando || !novoComentario.trim()} style={{ padding: "8px 14px", background: novoComentario.trim() ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "var(--bg3)", border: "none", borderRadius: 20, cursor: "pointer", color: "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.78rem", transition: "all 0.2s" }}>
                  {enviando ? "⏳" : "↑"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ===== PERFIL =====
function TabPerfil({ user, userData }) {
  const toast = useToast();
  const [editando, setEditando] = useState(false);
  const [bio, setBio] = useState(userData?.bio || "");
  const [cidade, setCidade] = useState(userData?.cidade || "");
  const [fotoUpload, setFotoUpload] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [postagens, setPostagens] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "postagens"), where("userId", "==", user.uid), orderBy("createdAt", "desc"), limit(12));
    const unsub = onSnapshot(q, snap => setPostagens(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [user?.uid]);

  const salvar = async () => {
    setSalvando(true);
    try {
      const updates = { bio, cidade };
      if (fotoUpload) {
        const url = await uploadImg(fotoUpload);
        if (url) updates.fotoPerfil = url;
      }
      await updateDoc(doc(db, "users", user.uid), updates);
      toast("✅ Perfil atualizado!");
      setEditando(false);
    } catch { toast("Erro.", "error"); }
    finally { setSalvando(false); }
  };

  return (
    <div>
      {/* Card perfil */}
      <div style={{ background: "linear-gradient(135deg, #2d1055, #1a0a36)", borderRadius: 16, padding: "24px 20px", marginBottom: 16, textAlign: "center", border: "1px solid rgba(245,197,24,0.15)" }}>
        {/* Avatar */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 12 }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", overflow: "hidden", background: "var(--bg3)", border: "3px solid rgba(245,197,24,0.4)", margin: "0 auto" }}>
            {userData?.fotoPerfil
              ? <img src={userData.fotoPerfil} alt="perfil" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Fraunces',serif", fontSize: "2rem", color: "var(--gold)" }}>{userData?.nome?.[0]?.toUpperCase() || "?"}</div>
            }
          </div>
          {editando && (
            <label style={{ position: "absolute", bottom: 0, right: 0, width: 26, height: 26, background: "var(--gold)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.75rem" }}>
              📷<input type="file" accept="image/*" style={{ display: "none" }} onChange={e => setFotoUpload(e.target.files[0])} />
            </label>
          )}
        </div>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.3rem", fontWeight: 700 }}>{userData?.nome}</div>
        {!editando ? (
          <>
            {userData?.bio && <div style={{ fontSize: "0.82rem", color: "var(--text2)", marginTop: 6, lineHeight: 1.5 }}>{userData.bio}</div>}
            {userData?.cidade && <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 4 }}>📍 {userData.cidade}</div>}
            <div style={{ display: "flex", justifyContent: "center", gap: 24, marginTop: 14 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--gold)" }}>{postagens.length}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>Postagens</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--gold)" }}>{userData?.amigos?.length || 0}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>Amigos</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--gold)" }}>{userData?.pontos || 0}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>Pontos</div>
              </div>
            </div>
            <button onClick={() => setEditando(true)} style={{ marginTop: 14, padding: "8px 20px", background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, cursor: "pointer", color: "var(--text)", fontFamily: "'Outfit',sans-serif", fontSize: "0.78rem" }}>
              ✏️ Editar perfil
            </button>
          </>
        ) : (
          <div style={{ marginTop: 12 }}>
            <input className="form-input" value={bio} onChange={e => setBio(e.target.value)} placeholder="Sua bio..." style={{ marginBottom: 8, textAlign: "center" }} />
            <input className="form-input" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Sua cidade..." style={{ marginBottom: 12, textAlign: "center" }} />
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={salvar} disabled={salvando} className="btn btn-gold" style={{ flex: 1 }}>{salvando ? "Salvando..." : "💾 Salvar"}</button>
              <button onClick={() => setEditando(false)} style={{ padding: "8px 16px", background: "var(--bg3)", border: "none", borderRadius: 8, cursor: "pointer", color: "var(--text2)", fontFamily: "'Outfit',sans-serif" }}>Cancelar</button>
            </div>
          </div>
        )}
      </div>

      {/* Grid de fotos */}
      {postagens.length > 0 && (
        <div>
          <div className="section-label" style={{ marginBottom: 10 }}>Suas postagens</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 3 }}>
            {postagens.map(p => (
              <div key={p.id} style={{ paddingTop: "100%", position: "relative", background: "var(--bg3)", borderRadius: 4, overflow: "hidden" }}>
                {p.video && <>
                  <video src={p.video} muted playsInline preload="metadata" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,.6)", borderRadius: 6, padding: "2px 5px", fontSize: "0.55rem", color: "#fff" }}>▶</div>
                </>}
                {!p.video && p.foto && <img src={p.foto} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
                {!p.video && !p.foto && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>🫐</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== AMIGOS =====
function TabAmigos({ user, userData }) {
  const toast = useToast();
  const [busca, setBusca] = useState("");
  const [resultados, setResultados] = useState([]);
  const [buscando, setBuscando] = useState(false);
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [amigos, setAmigos] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    // Solicitações pendentes
    const q1 = query(collection(db, "amizades"), where("para", "==", user.uid), where("status", "==", "pendente"));
    const unsub1 = onSnapshot(q1, snap => setSolicitacoes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    // Amigos aceitos
    const q2 = query(collection(db, "amizades"), where("status", "==", "aceito"), where("participantes", "array-contains", user.uid));
    const unsub2 = onSnapshot(q2, snap => {
      const lista = snap.docs.map(d => {
        const data = d.data();
        const amigoId = data.de === user.uid ? data.para : data.de;
        return { id: d.id, amigoId, ...data };
      });
      setAmigos(lista);
    });
    return () => { unsub1(); unsub2(); };
  }, [user?.uid]);

  const buscarAmigos = async () => {
    if (!busca.trim()) return;
    setBuscando(true);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("nome", ">=", busca), where("nome", "<=", busca + "\uf8ff"), limit(10)));
      setResultados(snap.docs.filter(d => d.id !== user.uid).map(d => ({ id: d.id, ...d.data() })));
    } catch { toast("Erro na busca.", "error"); }
    finally { setBuscando(false); }
  };

  const enviarSolicitacao = async (paraId) => {
    try {
      await addDoc(collection(db, "amizades"), {
        de: user.uid, para: paraId,
        participantes: [user.uid, paraId],
        status: "pendente", createdAt: serverTimestamp(),
      });
      toast("✅ Solicitação enviada!");
      setResultados([]);
      setBusca("");
    } catch { toast("Erro.", "error"); }
  };

  const aceitarAmizade = async (docId, deId) => {
    try {
      await updateDoc(doc(db, "amizades", docId), { status: "aceito" });
      toast("🎉 Amizade aceita!");
    } catch { toast("Erro.", "error"); }
  };

  const removerAmigo = async (docId) => {
    if (!window.confirm("Remover amigo?")) return;
    await deleteDoc(doc(db, "amizades", docId));
    toast("Amigo removido.");
  };

  return (
    <div>
      {/* Solicitações pendentes */}
      {solicitacoes.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>🔔 Solicitações ({solicitacoes.length})</div>
          {solicitacoes.map(s => (
            <div key={s.id} style={{ background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 12, padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, fontSize: "0.85rem", fontWeight: 600 }}>{s.deNome || "Alguém"} quer ser seu amigo</div>
              <button onClick={() => aceitarAmizade(s.id, s.de)} style={{ padding: "6px 12px", background: "var(--gold)", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "var(--bg)" }}>Aceitar</button>
            </div>
          ))}
        </div>
      )}

      {/* Buscar amigos */}
      <div className="section-label" style={{ marginBottom: 10 }}>🔍 Buscar amigos</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input className="form-input" style={{ flex: 1 }} value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => e.key === "Enter" && buscarAmigos()} placeholder="Nome do amigo..." />
        <button onClick={buscarAmigos} disabled={buscando} style={{ padding: "0 16px", background: "var(--gold)", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 700, color: "var(--bg)" }}>
          {buscando ? "..." : "Buscar"}
        </button>
      </div>

      {resultados.map(u => (
        <div key={u.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg3)", overflow: "hidden", flexShrink: 0 }}>
            {u.fotoPerfil ? <img src={u.fotoPerfil} alt={u.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--gold)" }}>{u.nome?.[0]}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{u.nome}</div>
            {u.cidade && <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>📍 {u.cidade}</div>}
          </div>
          <button onClick={() => enviarSolicitacao(u.id)} style={{ padding: "6px 12px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.78rem", color: "#fff" }}>
            + Adicionar
          </button>
        </div>
      ))}

      {/* Lista de amigos */}
      {amigos.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>👫 Seus amigos ({amigos.length})</div>
          {amigos.map(a => (
            <AmigoCard key={a.id} amigoId={a.amigoId} docId={a.id} onRemover={removerAmigo} />
          ))}
        </div>
      )}

      {amigos.length === 0 && solicitacoes.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text2)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👫</div>
          <p>Ainda sem amigos. Busque pelo nome!</p>
        </div>
      )}
    </div>
  );
}

function AmigoCard({ amigoId, docId, onRemover }) {
  const [amigo, setAmigo] = useState(null);
  useEffect(() => {
    getDoc(doc(db, "users", amigoId)).then(d => d.exists() && setAmigo({ id: d.id, ...d.data() }));
  }, [amigoId]);
  if (!amigo) return null;
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg3)", overflow: "hidden", flexShrink: 0 }}>
        {amigo.fotoPerfil ? <img src={amigo.fotoPerfil} alt={amigo.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--gold)" }}>{amigo.nome?.[0]}</div>}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{amigo.nome}</div>
        {amigo.cidade && <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>📍 {amigo.cidade}</div>}
      </div>
      <button onClick={() => onRemover(docId)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "0.8rem" }}>✕</button>
    </div>
  );
}

// ===== MURAL =====
function TabMural({ user, userData }) {
  const toast = useToast();
  const [postagens, setPostagens] = useState([]);
  const [perfilAberto, setPerfilAberto] = useState(null);
  const [novaFoto, setNovaFoto] = useState(null);
  const [novaVideo, setNovaVideo] = useState(null);
  const [videoPreview, setVideoPreview] = useState(null);
  const [videoProgress, setVideoProgress] = useState(0);
  const [novaLegenda, setNovaLegenda] = useState("");
  const [novaProduto, setNovaProduto] = useState("");
  const [postando, setPostando] = useState(false);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "postagens"), orderBy("createdAt", "desc"), limit(30));
    const unsub = onSnapshot(q, snap => setPostagens(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);

  const handleFoto = e => {
    const file = e.target.files[0];
    if (!file) return;
    setNovaVideo(null); setVideoPreview(null);
    setNovaFoto(file);
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleVideo = e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) { toast("Vídeo muito grande. Máximo 100MB.", "error"); return; }
    setNovaFoto(null); setPreview(null);
    setNovaVideo(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const publicar = async () => {
    if (!novaFoto && !novaVideo && !novaLegenda.trim()) { toast("Adicione uma mídia ou legenda.", "error"); return; }
    setPostando(true);
    try {
      let fotoUrl = null;
      let videoUrl = null;
      if (novaFoto) fotoUrl = await uploadImg(novaFoto);
      if (novaVideo) {
        setVideoProgress(0);
        videoUrl = await uploadVideo(novaVideo, p => setVideoProgress(p));
      }
      await addDoc(collection(db, "postagens"), {
        userId: user.uid,
        userNome: userData?.nome || "Anônimo",
        userFoto: userData?.fotoPerfil || null,
        foto: fotoUrl,
        video: videoUrl,
        legenda: novaLegenda.trim(),
        produtoNome: novaProduto.trim(),
        curtidas: [],
        createdAt: serverTimestamp(),
      });
      toast("✅ Postagem publicada!");
      setNovaFoto(null); setNovaVideo(null); setVideoPreview(null); setVideoProgress(0);
      setNovaLegenda(""); setNovaProduto(""); setPreview(null);
    } catch (e) { toast("Erro ao publicar.", "error"); console.error(e); }
    finally { setPostando(false); }
  };

  const curtir = async (postId, jaCurtido) => {
    const ref = doc(db, "postagens", postId);
    await updateDoc(ref, { curtidas: jaCurtido ? arrayRemove(user.uid) : arrayUnion(user.uid) });
  };

  const deletar = async (postId) => {
    if (!window.confirm("Apagar postagem?")) return;
    await deleteDoc(doc(db, "postagens", postId));
    toast("Postagem apagada.");
  };

  return (
    <div>
      {/* Nova postagem */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--bg3)", overflow: "hidden", flexShrink: 0 }}>
            {userData?.fotoPerfil ? <img src={userData.fotoPerfil} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--gold)" }}>{userData?.nome?.[0]}</div>}
          </div>
          <textarea
            value={novaLegenda}
            onChange={e => setNovaLegenda(e.target.value)}
            placeholder={`O que você recebeu hoje, ${userData?.nome?.split(" ")[0] || ""}? 🍕`}
            rows={2}
            style={{ flex: 1, padding: "10px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text)", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", resize: "none" }}
          />
        </div>

        {/* Preview da foto */}
        {preview && (
          <div style={{ position: "relative", marginBottom: 10 }}>
            <img src={preview} alt="preview" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10 }} />
            <button onClick={() => { setNovaFoto(null); setPreview(null); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
          </div>
        )}

        {/* Preview do vídeo */}
        {videoPreview && (
          <div style={{ position: "relative", marginBottom: 10 }}>
            <video src={videoPreview} controls muted style={{ width: "100%", maxHeight: 240, borderRadius: 10, background: "#000", display: "block" }} />
            <button onClick={() => { setNovaVideo(null); setVideoPreview(null); setVideoProgress(0); }} style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", cursor: "pointer", fontSize: "0.9rem" }}>✕</button>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>
              {novaVideo?.name} · {novaVideo ? (novaVideo.size / 1024 / 1024).toFixed(1) + " MB" : ""}
            </div>
          </div>
        )}

        {/* Barra de progresso upload */}
        {postando && novaVideo && videoProgress > 0 && videoProgress < 100 && (
          <div style={{ marginBottom: 10 }}>
            <div style={{ height: 4, background: "var(--bg3)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg, var(--purple2), var(--gold))", width: `${videoProgress}%`, transition: "width .2s" }} />
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 3 }}>Enviando vídeo… {videoProgress}%</div>
          </div>
        )}

        <input className="form-input" value={novaProduto} onChange={e => setNovaProduto(e.target.value)} placeholder="🛵 Qual produto você recebeu?" style={{ marginBottom: 10 }} />

        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ flex: 1, padding: "8px", textAlign: "center", background: "rgba(245,197,24,0.08)", border: `1px dashed ${novaFoto ? "rgba(245,197,24,0.7)" : "rgba(245,197,24,0.3)"}`, borderRadius: 10, cursor: "pointer", fontSize: "0.78rem", color: "var(--gold)", fontFamily: "'Outfit',sans-serif" }}>
            📷 {novaFoto ? "Foto ✓" : "Foto"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleFoto} />
          </label>
          <label style={{ flex: 1, padding: "8px", textAlign: "center", background: "rgba(168,85,247,0.08)", border: `1px dashed ${novaVideo ? "rgba(168,85,247,0.7)" : "rgba(168,85,247,0.3)"}`, borderRadius: 10, cursor: "pointer", fontSize: "0.78rem", color: "#c084fc", fontFamily: "'Outfit',sans-serif" }}>
            🎬 {novaVideo ? "Vídeo ✓" : "Vídeo"}
            <input type="file" accept="video/*" style={{ display: "none" }} onChange={handleVideo} />
          </label>
          <button onClick={publicar} disabled={postando} style={{ padding: "8px 20px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 10, cursor: "pointer", color: "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.85rem", opacity: postando ? 0.7 : 1 }}>
            {postando ? "⏳" : "Publicar"}
          </button>
        </div>
      </div>

      {/* Feed */}
      {postagens.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text2)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📸</div>
          <p>Seja o primeiro a postar!</p>
        </div>
      )}
      {postagens.map(p => (
        <PostCard key={p.id} post={p} currentUid={user.uid} onCurtir={curtir} onDeletar={deletar} onVerPerfil={setPerfilAberto} />
      ))}
      {perfilAberto && <PerfilPublico userId={perfilAberto} onClose={() => setPerfilAberto(null)} />}
    </div>
  );
}

// ===== RANKING =====
function TabRanking() {
  const [ranking, setRanking] = useState([]);
  const [perfilAberto, setPerfilAberto] = useState(null);

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("pontos", "desc"), limit(20));
    const unsub = onSnapshot(q, snap => setRanking(snap.docs.map((d, i) => ({ id: d.id, pos: i + 1, ...d.data() }))));
    return unsub;
  }, []);

  const medalha = pos => pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `#${pos}`;

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: "2rem", marginBottom: 6 }}>🏆</div>
        <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.2rem", fontWeight: 700 }}>Super Fãs do Mês</div>
        <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 4 }}>Top clientes por pontos acumulados</div>
      </div>
      {perfilAberto && <PerfilPublico userId={perfilAberto} onClose={() => setPerfilAberto(null)} />}
      {ranking.map(u => (
        <div key={u.id} onClick={() => setPerfilAberto(u.id)} style={{
          background: u.pos <= 3 ? "linear-gradient(135deg, rgba(245,197,24,0.1), rgba(245,197,24,0.05))" : "var(--bg2)",
          border: `1px solid ${u.pos <= 3 ? "rgba(245,197,24,0.3)" : "var(--border)"}`,
          borderRadius: 14, padding: "12px 14px", marginBottom: 8,
          display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
        }}>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: u.pos <= 3 ? "1.5rem" : "1rem", fontWeight: 900, minWidth: 36, textAlign: "center", color: u.pos <= 3 ? "var(--gold)" : "var(--text3)" }}>
            {medalha(u.pos)}
          </div>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--bg3)", overflow: "hidden", flexShrink: 0 }}>
            {u.fotoPerfil ? <img src={u.fotoPerfil} alt={u.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "var(--gold)" }}>{u.nome?.[0]}</div>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{u.nome || "Anônimo"}</div>
            {u.cidade && <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>📍 {u.cidade}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, color: "var(--gold)", fontSize: "1rem" }}>{u.pontos || 0}</div>
            <div style={{ fontSize: "0.62rem", color: "var(--text3)" }}>pontos</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ===== PÁGINA PRINCIPAL =====
export default function Social() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const [aba, setAba] = useState("mural");

  if (!user) return (
    <div className="page" style={{ textAlign: "center", paddingTop: 60 }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 16 }}>👥</div>
      <h2 style={{ fontFamily: "'Fraunces',serif", marginBottom: 8 }}>Rede Social</h2>
      <p style={{ color: "var(--text2)", marginBottom: 24 }}>Faça login para participar da comunidade!</p>
      <button className="btn btn-gold" onClick={() => navigate("/login")}>Entrar</button>
    </div>
  );

  const abas = [
    { id: "mural",   icon: "📸", label: "Mural" },
    { id: "amigos",  icon: "👫", label: "Amigos" },
    { id: "ranking", icon: "🏆", label: "Ranking" },
    { id: "perfil",  icon: "👤", label: "Perfil" },
  ];

  return (
    <div className="page" style={{ paddingBottom: 80 }}>
      <h2 className="display-title mb-4">Comunidade <span>CardápioZap</span></h2>

      {/* Abas */}
      <div style={{ display: "flex", background: "var(--bg2)", borderRadius: 12, padding: 4, marginBottom: 20, gap: 2 }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{
            flex: 1, padding: "8px 4px",
            background: aba === a.id ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "none",
            border: "none", borderRadius: 10, cursor: "pointer",
            color: aba === a.id ? "#fff" : "var(--text2)",
            fontFamily: "'Outfit',sans-serif", fontSize: "0.72rem", fontWeight: 600,
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
            transition: "all 0.2s",
          }}>
            <span style={{ fontSize: "1rem" }}>{a.icon}</span>
            {a.label}
          </button>
        ))}
      </div>

      {aba === "mural"   && <TabMural   user={user} userData={userData} />}
      {aba === "amigos"  && <TabAmigos  user={user} userData={userData} />}
      {aba === "ranking" && <TabRanking />}
      {aba === "perfil"  && <TabPerfil  user={user} userData={userData} />}
    </div>
  );
}

// src/components/CaixasDuplas.jsx
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  collection, onSnapshot, orderBy, query, addDoc, updateDoc,
  doc, increment, serverTimestamp, where, getDoc, limit, getDocs, deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";

const IMGBB_KEY = "4b8379f3bfc7eb113e0820730166a9f8";
const ALTURA_CAIXAS = "calc(100vh - 200px)";

// ── Helpers ──────────────────────────────────────────────────
function extractYoutubeId(url) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&?\s/]+)/);
  return m ? m[1] : null;
}

async function comprimirImagem(file, maxWidth = 1080) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => resolve(new File([blob], file.name, { type: "image/jpeg" })), "image/jpeg", 0.85);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

async function uploadMidia(file, onProgress) {
  if (file.type.startsWith("video/")) {
    if (file.size > 100 * 1024 * 1024) { alert("Vídeo muito grande. Máximo 100MB."); return null; }
    return new Promise((resolve) => {
      const nomeArquivo = `videos/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const storageRef = ref(storage, nomeArquivo);
      const task = uploadBytesResumable(storageRef, file);
      task.on("state_changed",
        snap => onProgress && onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
        err => { console.error("Erro upload vídeo:", err); resolve(null); },
        async () => { const url = await getDownloadURL(task.snapshot.ref); resolve(url); }
      );
    });
  }
  const comprimido = await comprimirImagem(file);
  const fd = new FormData();
  fd.append("image", comprimido);
  try {
    const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: fd });
    const data = await res.json();
    onProgress && onProgress(100);
    return data.success ? data.data.url : null;
  } catch { return null; }
}

function tempo(ts) {
  if (!ts?.toDate) return "";
  const diff = Math.floor((Date.now() - ts.toDate()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

// ── buildNexFoodFeed — 60% store / 40% client ────────────────
function buildNexFoodFeed(storePosts, clientPosts, produtos, topBuyers) {
  const feed = [];
  const store = [...storePosts];
  const client = [...clientPosts];
  const prod = [...(produtos || [])];
  const buyers = [...(topBuyers || [])];
  let si = 0, ci = 0, pi = 0, bi = 0;
  const total = store.length + client.length + prod.length + buyers.length;
  for (let i = 0; i < total && feed.length < 60; i++) {
    const r = Math.random();
    if (r < 0.5 && si < store.length) {
      feed.push({ _type: "store", ...store[si++] });
    } else if (r < 0.8 && ci < client.length) {
      feed.push({ _type: "client", ...client[ci++] });
    } else if (r < 0.92 && pi < prod.length) {
      feed.push({ _type: "produto", ...prod[pi++] });
    } else if (bi < buyers.length) {
      feed.push({ _type: "topbuyer", ...buyers[bi++] });
    } else if (si < store.length) {
      feed.push({ _type: "store", ...store[si++] });
    } else if (ci < client.length) {
      feed.push({ _type: "client", ...client[ci++] });
    }
  }
  return feed;
}

// ── VideoMuted — vídeo silenciado com toggle ─────────────────
function VideoMuted({ src, style }) {
  const [muted, setMuted] = useState(true);
  const videoRef = useRef();
  return (
    <div style={{ position: "relative", ...style }}>
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        playsInline
        autoPlay
        loop
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onTimeUpdate={e => { if (e.target.currentTime > 60) { e.target.currentTime = 0; } }}
      />
      <button
        onClick={e => { e.stopPropagation(); setMuted(m => !m); }}
        style={{
          position: "absolute", bottom: 8, right: 8, zIndex: 5,
          background: "rgba(0,0,0,0.55)", border: "none", borderRadius: "50%",
          width: 30, height: 30, color: "#fff", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem",
        }}
      >{muted ? "🔇" : "🔊"}</button>
    </div>
  );
}

// ── BotoesAcao — curtir, comentar, compartilhar, repostar ────
function BotoesAcao({ post, coll, curtido, onCurtir, onComentar, tamanho = "md" }) {
  const { user } = useAuth();
  const [repostando, setRepostando] = useState(false);
  const [repostado, setRepostado] = useState(false);
  const sz = tamanho === "sm" ? 18 : 22;
  const fz = tamanho === "sm" ? "0.65rem" : "0.82rem";

  // Feeds favoritos (bookmark)
  const [salvo, setSalvo] = useState(() => {
    if (!user?.uid) return false;
    try {
      const lista = JSON.parse(localStorage.getItem(`feedsFav_${user.uid}`) || "[]");
      return lista.some(f => f.id === post.id);
    } catch { return false; }
  });

  const toggleSalvar = () => {
    if (!user?.uid) return;
    const chave = `feedsFav_${user.uid}`;
    try {
      const lista = JSON.parse(localStorage.getItem(chave) || "[]");
      if (salvo) {
        localStorage.setItem(chave, JSON.stringify(lista.filter(f => f.id !== post.id)));
        setSalvo(false);
      } else {
        const item = {
          id: post.id, coll,
          autorId: post.autorId || null,
          autorNome: post.autorNome || "Usuário",
          autorFoto: post.autorFoto || null,
          texto: post.texto || "",
          midia: post.midia || null,
          tipo: post.tipo || "imagem",
          curtidas: post.curtidas || 0,
          savedAt: Date.now(),
        };
        localStorage.setItem(chave, JSON.stringify([item, ...lista]));
        setSalvo(true);
      }
    } catch {}
  };

  const compartilhar = () => {
    const txt = `${post.texto || post.produtoNome || ""}\n\n🔗 https://nexfoody.com.br`;
    if (navigator.share) navigator.share({ text: txt });
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  const repostar = async () => {
    if (!user || repostando || repostado) return;
    setRepostando(true);
    try {
      await addDoc(collection(db, "userPosts"), {
        autorId: user.uid,
        autorNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        autorFoto: user.photoURL || null,
        texto: post.texto || "",
        midia: post.midia || null,
        tipo: post.tipo || "imagem",
        curtidas: 0,
        comentarios: 0,
        repostDe: { id: post.id, coll, autorNome: post.autorNome || "Usuário", autorFoto: post.autorFoto || null },
        criadoEm: serverTimestamp(),
      });
      setRepostado(true);
    } catch (e) { console.error("Erro ao repostar:", e); }
    finally { setRepostando(false); }
  };

  return (
    <div style={{ display: "flex", gap: tamanho === "sm" ? 8 : 14, alignItems: "center" }}>
      <button onClick={onCurtir} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: curtido ? "#ef4444" : "var(--text3)", padding: 0, fontFamily: "'Outfit', sans-serif" }}>
        <svg width={sz} height={sz} viewBox="0 0 24 24" fill={curtido ? "#ef4444" : "none"} stroke={curtido ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        {(post.curtidas || 0) > 0 && <span style={{ fontWeight: 600, fontSize: fz }}>{post.curtidas}</span>}
      </button>
      <button onClick={onComentar} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--text3)", padding: 0, fontFamily: "'Outfit', sans-serif" }}>
        <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {(post.comentarios || 0) > 0 && <span style={{ fontWeight: 600, fontSize: fz }}>{post.comentarios}</span>}
      </button>
      <button
        onClick={repostar}
        disabled={repostando || repostado}
        title={repostado ? "Repostado!" : "Repostar"}
        style={{ background: "none", border: "none", cursor: repostado ? "default" : "pointer", display: "flex", alignItems: "center", gap: 4, color: repostado ? "var(--purple2)" : "var(--text3)", padding: 0, fontFamily: "'Outfit', sans-serif" }}
      >
        <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        {repostado && <span style={{ fontSize: fz, fontWeight: 600 }}>✓</span>}
      </button>
      <button onClick={compartilhar} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0, display: "flex", alignItems: "center" }}>
        <svg width={sz} height={sz} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
      </button>
      {user && (
        <button onClick={toggleSalvar} title={salvo ? "Remover dos salvos" : "Salvar feed"} style={{ background: "none", border: "none", cursor: "pointer", color: salvo ? "var(--gold)" : "var(--text3)", padding: 0, display: "flex", alignItems: "center", marginLeft: "auto" }}>
          <svg width={sz} height={sz} viewBox="0 0 24 24" fill={salvo ? "var(--gold)" : "none"} stroke={salvo ? "var(--gold)" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Menu de Post (···) ────────────────────────────────────────
function MenuPost({ post, coll, onClose }) {
  const { user } = useAuth();
  const { isAdmin } = useStore();
  const [editando, setEditando] = useState(false);
  const [textoEdit, setTextoEdit] = useState(post.texto || "");
  const [salvando, setSalvando] = useState(false);

  const ehDono = user && (user.uid === post.autorId || isAdmin);
  if (!ehDono) return null;

  const excluir = async () => {
    if (!window.confirm("Excluir este post?")) return;
    try {
      await deleteDoc(doc(db, coll, post.id));
    } catch (e) { console.error(e); }
    onClose();
  };

  const salvarEdicao = async () => {
    if (!textoEdit.trim() && !post.midia) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, coll, post.id), { texto: textoEdit.trim() });
    } catch (e) { console.error(e); }
    setSalvando(false);
    onClose();
  };

  if (editando) {
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2100, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end" }}>
        <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "var(--bg)", borderRadius: "20px 20px 0 0", padding: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "0.92rem", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            ✏️ Editar post
            <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
          </div>
          <textarea
            value={textoEdit}
            onChange={e => setTextoEdit(e.target.value)}
            autoFocus
            style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", outline: "none", resize: "none", minHeight: 100, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "11px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer" }}>
              Cancelar
            </button>
            <button onClick={salvarEdicao} disabled={salvando} style={{ flex: 2, padding: "11px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}>
              {salvando ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 2100, background: "rgba(0,0,0,0.5)" }}>
      <div onClick={e => e.stopPropagation()} style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", background: "var(--bg)", borderRadius: 16, overflow: "hidden", minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.4)" }}>
        <button
          onClick={() => setEditando(true)}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 18px", background: "none", border: "none", borderBottom: "1px solid var(--border)", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", cursor: "pointer", textAlign: "left" }}
        >
          <span style={{ fontSize: "1.1rem" }}>✏️</span> Editar
        </button>
        <button
          onClick={excluir}
          style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "14px 18px", background: "none", border: "none", color: "#ef4444", fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", cursor: "pointer", textAlign: "left" }}
        >
          <span style={{ fontSize: "1.1rem" }}>🗑️</span> Excluir
        </button>
      </div>
    </div>
  );
}

// ── Drawer de Comentários ─────────────────────────────────────
function DrawerComentarios({ postId, coll, onClose }) {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, `${coll}/${postId}/comentarios`), orderBy("criadoEm", "asc")),
      snap => setComentarios(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [postId, coll]);

  const enviar = async () => {
    if (!texto.trim() || !user) return;
    setEnviando(true);
    try {
      await addDoc(collection(db, `${coll}/${postId}/comentarios`), {
        texto: texto.trim(),
        autorId: user.uid,
        autorNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        autorFoto: user.photoURL || null,
        curtidas: 0,
        criadoEm: serverTimestamp(),
      });
      await updateDoc(doc(db, coll, postId), { comentarios: increment(1) });
      setTexto("");
    } catch (e) { console.error(e); }
    finally { setEnviando(false); }
  };

  const curtirComentario = async (c) => {
    if (!user) return;
    const key = `curtidoComentario_${c.id}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    await updateDoc(doc(db, `${coll}/${postId}/comentarios`, c.id), { curtidas: increment(1) });
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "var(--bg)", borderRadius: "20px 20px 0 0", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>💬 Comentários {comentarios.length > 0 && `(${comentarios.length})`}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
          {comentarios.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text3)", fontSize: "0.82rem" }}>Nenhum comentário ainda. Seja o primeiro!</div>
          )}
          {comentarios.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>
                {c.autorFoto ? <img src={c.autorFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : c.autorNome?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ background: "var(--bg2)", borderRadius: "0 12px 12px 12px", padding: "8px 12px" }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, marginBottom: 3 }}>{c.autorNome}</div>
                  <div style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{c.texto}</div>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 4, paddingLeft: 4 }}>
                  <span style={{ fontSize: "0.65rem", color: "var(--text3)" }}>{tempo(c.criadoEm)}</span>
                  <button onClick={() => { setTexto(`@${c.autorNome} `); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.65rem", color: "var(--text3)", padding: 0, fontFamily: "'Outfit', sans-serif" }}>Responder</button>
                  {c.curtidas > 0 && <span style={{ fontSize: "0.65rem", color: "var(--text3)" }}>❤️ {c.curtidas}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {user ? (
          <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            {[
              ["😍","🔥","😋","💜","👑","🍓","🥰","😂","❤️","👏"],
              ["🤤","✨","💯","🎉","😎","🙌","💪","🍧","😱","🥳"],
            ].map((linha, li) => (
              <div key={li} style={{ display: "flex", gap: 2, padding: li === 0 ? "8px 16px 2px" : "2px 16px 6px", overflowX: "auto", scrollbarWidth: "none" }}>
                {linha.map(emoji => (
                  <button key={emoji} onClick={() => { setTexto(t => t + emoji); inputRef.current?.focus(); }}
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", padding: "2px 4px", borderRadius: 8, flexShrink: 0, transition: "transform 0.1s", lineHeight: 1 }}
                    onMouseEnter={e => e.target.style.transform = "scale(1.3)"}
                    onMouseLeave={e => e.target.style.transform = "scale(1)"}
                  >{emoji}</button>
                ))}
              </div>
            ))}
            <div style={{ padding: "6px 16px 20px", display: "flex", gap: 10, alignItems: "flex-end" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", flexShrink: 0, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>
                {user.photoURL ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : user.displayName?.[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "8px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  ref={inputRef}
                  value={texto}
                  onChange={e => setTexto(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && enviar()}
                  placeholder="Adicionar comentário..."
                  style={{ flex: 1, background: "none", border: "none", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", outline: "none" }}
                />
                <button onClick={enviar} disabled={!texto.trim() || enviando} style={{ background: "none", border: "none", color: texto.trim() ? "var(--purple2)" : "var(--text3)", cursor: "pointer", fontWeight: 700, fontSize: "0.85rem", padding: 0, fontFamily: "'Outfit', sans-serif" }}>
                  {enviando ? "..." : "Enviar"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "12px 16px 20px", textAlign: "center", fontSize: "0.82rem", color: "var(--text3)" }}>Faça login para comentar</div>
        )}
      </div>
    </div>
  );
}

// ── Card da Caixa Grande ──────────────────────────────────────
function CardGrande({ post, onCurtir, curtido, coll }) {
  const [showComentarios, setShowComentarios] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [imagemZoom, setImagemZoom] = useState(null);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 10, flexShrink: 0 }}>
        {/* Banner de repost */}
        {post.repostDe && (
          <div style={{ padding: "6px 12px", background: "rgba(138,92,246,0.08)", borderBottom: "1px solid rgba(138,92,246,0.12)", display: "flex", alignItems: "center", gap: 6, fontSize: "0.65rem", color: "var(--text3)" }}>
            <span style={{ color: "var(--purple2)" }}>🔁</span>
            <span>Repostado de <strong style={{ color: "var(--text)" }}>{post.repostDe.autorNome}</strong></span>
          </div>
        )}
        <div style={{ padding: "10px 12px 8px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>
            {post.autorFoto ? <img src={post.autorFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : post.autorNome?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.autorNome || "Cliente"}</div>
            <div style={{ fontSize: "0.62rem", color: "var(--text3)" }}>{tempo(post.criadoEm)}</div>
          </div>
          <button onClick={() => setShowMenu(true)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "4px 6px", fontSize: "1.1rem", lineHeight: 1 }}>···</button>
        </div>
        {post.midia && (
          post.tipo === "youtube"
            ? <div style={{ position: "relative", paddingTop: "56.25%" }}>
                <iframe
                  src={`https://www.youtube.com/embed/${post.midia}?playsinline=1`}
                  allow="encrypted-media"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                />
              </div>
            : post.tipo === "video"
              ? <VideoMuted src={post.midia} style={{ width: "100%", height: 280, background: "#000" }} />
              : <img src={post.midia} alt="" loading="lazy" onClick={() => setImagemZoom(post.midia)} style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block", cursor: "zoom-in" }} />
        )}
        {post.texto && (
          <div style={{ padding: "8px 12px 4px" }}>
            <div style={{ fontSize: "0.82rem", color: "var(--text)", lineHeight: 1.6, overflow: expandido ? "visible" : "hidden", display: expandido ? "block" : "-webkit-box", WebkitLineClamp: expandido ? "unset" : 8, WebkitBoxOrient: "vertical" }}>
              {post.texto}
            </div>
            {post.texto.length > 300 && !expandido && (
              <button onClick={() => setExpandido(true)} style={{ background: "none", border: "none", color: "var(--purple2)", cursor: "pointer", fontSize: "0.78rem", fontWeight: 600, padding: "2px 0", fontFamily: "'Outfit', sans-serif" }}>
                Ver mais...
              </button>
            )}
          </div>
        )}
        <div style={{ padding: "6px 12px 10px" }}>
          <BotoesAcao post={post} coll={coll} curtido={curtido} onCurtir={onCurtir} onComentar={() => setShowComentarios(true)} />
        </div>
      </div>
      {showComentarios && <DrawerComentarios postId={post.id} coll={coll} onClose={() => setShowComentarios(false)} />}
      {showMenu && <MenuPost post={post} coll={coll} onClose={() => setShowMenu(false)} />}
      {imagemZoom && (
        <div onClick={() => setImagemZoom(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <img src={imagemZoom} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }} />
          <button onClick={() => setImagemZoom(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
        </div>
      )}
    </>
  );
}

// ── Cards da Caixa NexFood ────────────────────────────────────

function NexFoodClientCard({ post, onCurtir, curtido, coll }) {
  const [showComentarios, setShowComentarios] = useState(false);
  const [imagemZoom, setImagemZoom] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  return (
    <>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 8, flexShrink: 0 }}>
        {/* Repost banner */}
        {post.repostDe && (
          <div style={{ padding: "4px 10px", background: "rgba(138,92,246,0.08)", fontSize: "0.6rem", color: "var(--text3)", display: "flex", gap: 4 }}>
            <span style={{ color: "var(--purple2)" }}>🔁</span>
            <span>de <strong style={{ color: "var(--text)" }}>{post.repostDe.autorNome}</strong></span>
          </div>
        )}
        {/* Mídia */}
        {post.midia ? (
          post.tipo === "youtube"
            ? <div style={{ position: "relative", height: 120, overflow: "hidden", cursor: "pointer" }} onClick={() => setImagemZoom(`yt:${post.midia}`)}>
                <img src={`https://img.youtube.com/vi/${post.midia}/mqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ff0000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>▶</div>
                </div>
              </div>
            : post.tipo === "video"
              ? <VideoMuted src={post.midia} style={{ width: "100%", height: 120, background: "#000" }} />
              : <img src={post.midia} alt="" loading="lazy" onClick={() => setImagemZoom(post.midia)} style={{ width: "100%", height: 120, objectFit: "cover", display: "block", cursor: "zoom-in" }} />
        ) : (
          <div style={{ height: 80, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--border2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          </div>
        )}
        <div style={{ padding: "6px 10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--surface)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem" }}>
              {post.autorFoto ? <img src={post.autorFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : post.autorNome?.[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: "0.68rem", fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.autorNome || "Cliente"}</span>
            <span style={{ fontSize: "0.58rem", color: "var(--text3)" }}>{tempo(post.criadoEm)}</span>
            <button onClick={() => setShowMenu(true)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "2px 4px", fontSize: "1rem", lineHeight: 1 }}>···</button>
          </div>
          {post.texto && <div style={{ fontSize: "0.72rem", color: "var(--text)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", marginBottom: 6 }}>{post.texto}</div>}
          <BotoesAcao post={post} coll={coll} curtido={curtido} onCurtir={onCurtir} onComentar={() => setShowComentarios(true)} tamanho="sm" />
        </div>
      </div>
      {showComentarios && <DrawerComentarios postId={post.id} coll={coll} onClose={() => setShowComentarios(false)} />}
      {showMenu && <MenuPost post={post} coll={coll} onClose={() => setShowMenu(false)} />}
      {imagemZoom && (
        <div onClick={() => setImagemZoom(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          {imagemZoom.startsWith("yt:")
            ? <iframe src={`https://www.youtube.com/embed/${imagemZoom.slice(3)}?autoplay=1&playsinline=1`} allow="autoplay; encrypted-media" allowFullScreen style={{ width: "100%", maxWidth: 500, aspectRatio: "9/16", border: "none", borderRadius: 8 }} />
            : <img src={imagemZoom} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }} />
          }
          <button onClick={() => setImagemZoom(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
        </div>
      )}
    </>
  );
}

function NexFoodStoreCard({ post }) {
  const tipoLabel = { promo: "🔥 Promoção", novidade: "✨ Novidade", aviso: "📢 Aviso" };
  const tipoColor = { promo: "#ef4444", novidade: "#a855f7", aviso: "#f59e0b" };
  const cor = tipoColor[post.subtipo] || "var(--purple2)";
  return (
    <div style={{ background: "var(--bg2)", border: `1px solid ${cor}30`, borderRadius: 12, overflow: "hidden", marginBottom: 8, flexShrink: 0 }}>
      {post.midia && (
        post.tipo === "youtube"
          ? <div style={{ position: "relative", paddingTop: "56.25%" }}>
              <iframe src={`https://www.youtube.com/embed/${post.midia}?playsinline=1`} allow="encrypted-media" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} />
            </div>
          : post.tipo === "video"
            ? <VideoMuted src={post.midia} style={{ width: "100%", height: 140, background: "#000" }} />
            : <img src={post.midia} alt="" loading="lazy" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
      )}
      <div style={{ padding: "8px 10px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: "0.6rem", fontWeight: 800, background: `${cor}18`, border: `1px solid ${cor}35`, borderRadius: 20, padding: "2px 7px", color: cor }}>{tipoLabel[post.subtipo] || "📣 Post"}</span>
          <span style={{ fontSize: "0.58rem", color: "var(--text3)", marginLeft: "auto" }}>{tempo(post.criadoEm)}</span>
        </div>
        {post.titulo && <div style={{ fontSize: "0.82rem", fontWeight: 800, marginBottom: 3 }}>{post.titulo}</div>}
        {post.texto && <div style={{ fontSize: "0.72rem", color: "var(--text2)", lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{post.texto}</div>}
        {post.cta && (
          <button style={{ marginTop: 8, width: "100%", padding: "8px", background: `linear-gradient(135deg, ${cor}, ${cor}cc)`, border: "none", borderRadius: 8, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>
            {post.cta}
          </button>
        )}
      </div>
    </div>
  );
}

function NexFoodProdutoCard({ produto }) {
  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 8, flexShrink: 0, display: "flex", gap: 0 }}>
      <div style={{ width: 70, flexShrink: 0, background: "var(--bg3)" }}>
        {produto.foto
          ? <img src={produto.foto} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem" }}>🍧</div>
        }
      </div>
      <div style={{ flex: 1, padding: "8px 10px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 800, marginBottom: 2 }}>{produto.nome}</div>
        {produto.descricao && <div style={{ fontSize: "0.62rem", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>{produto.descricao}</div>}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--gold)" }}>R$ {produto.preco?.toFixed(2).replace(".", ",")}</span>
          <button style={{ marginLeft: "auto", padding: "4px 10px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.65rem", cursor: "pointer" }}>
            Pedir agora
          </button>
        </div>
      </div>
    </div>
  );
}

function NexFoodTopBuyerCard({ buyer }) {
  if (!buyer) return null;
  return (
    <div style={{ background: "linear-gradient(135deg, rgba(245,197,24,0.08), rgba(138,92,246,0.08))", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 12, padding: "10px 12px", marginBottom: 8, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface)", overflow: "hidden", flexShrink: 0, border: "2px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem" }}>
        {buyer.photoURL ? <img src={buyer.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : buyer.nome?.[0]?.toUpperCase() || "👑"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.58rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--gold)", marginBottom: 1 }}>👑 Top Comprador</div>
        <div style={{ fontSize: "0.75rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{buyer.nome || buyer.email?.split("@")[0] || "Fã"}</div>
        <div style={{ fontSize: "0.6rem", color: "var(--text3)" }}>{buyer.pontos || buyer.rankingPts || 0} pts</div>
      </div>
      <div style={{ fontSize: "1.4rem" }}>🏆</div>
    </div>
  );
}

// ── Caixa NexFood — auto-scroll com barra de progresso ───────
function CaixaNexFood({ feed, curtidos, onCurtir, collCliente }) {
  const scrollRef = useRef();
  const [progresso, setProgresso] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [itemAtual, setItemAtual] = useState(0);
  const progressoRef = useRef(0);
  const pausadoRef = useRef(false);
  const intervalRef = useRef(null);

  pausadoRef.current = pausado;

  const avancar = useCallback(() => {
    if (pausadoRef.current || !scrollRef.current || feed.length === 0) return;
    const container = scrollRef.current;
    const cards = container.querySelectorAll("[data-nexfood-card]");
    const next = (itemAtual + 1) % cards.length;
    setItemAtual(next);
    cards[next]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    progressoRef.current = 0;
    setProgresso(0);
  }, [itemAtual, feed.length]);

  useEffect(() => {
    progressoRef.current = 0;
    setProgresso(0);
    intervalRef.current = setInterval(() => {
      if (pausadoRef.current) return;
      progressoRef.current += 100 / 40; // 40 ticks × 100ms = 4s
      const p = Math.min(100, progressoRef.current);
      setProgresso(p);
      if (p >= 100) {
        avancar();
      }
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [avancar]);

  const pausar = () => { setPausado(true); setTimeout(() => setPausado(false), 8000); };

  return (
    <div style={{ position: "relative" }}>
      {/* Header */}
      <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--purple2)", marginBottom: 6, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <span>⚡ Caixa NexFood</span>
        <button onClick={() => setPausado(p => !p)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "0.7rem", padding: 0 }}>{pausado ? "▶" : "⏸"}</button>
      </div>
      {/* Barra de progresso */}
      <div style={{ height: 2, background: "var(--bg3)", borderRadius: 1, marginBottom: 8, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${progresso}%`, background: "linear-gradient(90deg, var(--purple2), var(--gold))", transition: "width 0.1s linear", borderRadius: 1 }} />
      </div>
      {/* Feed */}
      <div
        ref={scrollRef}
        onTouchStart={pausar}
        onMouseEnter={pausar}
        style={{ overflowY: "auto", scrollbarWidth: "none", maxHeight: "100%" }}
      >
        {feed.length === 0 && (
          <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text3)", fontSize: "0.75rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>⚡</div>
            Feed carregando...
          </div>
        )}
        {feed.map((item, idx) => (
          <div key={`${item._type}_${item.id || idx}`} data-nexfood-card>
            {item._type === "client" && (
              <NexFoodClientCard
                post={item}
                curtido={!!curtidos[item.id]}
                onCurtir={() => onCurtir(item.id, collCliente)}
                coll={collCliente}
              />
            )}
            {item._type === "store" && <NexFoodStoreCard post={item} />}
            {item._type === "produto" && <NexFoodProdutoCard produto={item} />}
            {item._type === "topbuyer" && <NexFoodTopBuyerCard buyer={item} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CardSabor (Caixa do Sabor legada — mantida) ───────────────
function CardSabor({ post, onCurtir, curtido, onPedirIgual, coll, isDono, energiaVotos, onDarPontos }) {
  const [hover, setHover] = useState(false);
  const [showComentarios, setShowComentarios] = useState(false);
  const [imagemZoom, setImagemZoom] = useState(null);
  const [jaVotou] = useState(false);
  const [votando] = useState(false);

  const votosRecebidos = post.votosRecebidos || 0;
  const votosNecessarios = 3;

  const compartilhar = () => {
    const txt = `🍓 ${post.produtoNome || "Produto"}\n\nhttps://nexfoody.com.br`;
    if (navigator.share) navigator.share({ text: txt });
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  return (
    <>
      <div
        style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 8, flexShrink: 0, position: "relative" }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onTouchStart={() => setHover(true)} onTouchEnd={() => setTimeout(() => setHover(false), 2000)}
      >
        <div style={{ position: "relative" }}>
          {post.midia ? (
            post.tipo === "youtube"
              ? <div style={{ position: "relative", height: 120, overflow: "hidden", cursor: "pointer" }} onClick={() => setImagemZoom(`yt:${post.midia}`)}>
                  <img src={`https://img.youtube.com/vi/${post.midia}/mqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#ff0000", display: "flex", alignItems: "center", justifyContent: "center" }}>▶</div>
                  </div>
                </div>
              : post.tipo === "video"
                ? <VideoMuted src={post.midia} style={{ width: "100%", height: 120, background: "#000" }} />
                : <img src={post.midia} alt="" loading="lazy" onClick={() => !hover && setImagemZoom(post.midia)} style={{ width: "100%", height: 120, objectFit: "cover", display: "block", cursor: "zoom-in" }} />
          ) : (
            <div style={{ height: 120, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--border2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
          )}
          {hover && post.produtoId && (
            <div onClick={() => onPedirIgual(post)} style={{ position: "absolute", inset: 0, background: "rgba(10,4,20,0.85)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, cursor: "pointer" }}>
              <div style={{ fontSize: "1.3rem" }}>🔁</div>
              <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#fff" }}>Pedir Igual</div>
              <div style={{ fontSize: "0.65rem", color: "var(--gold)", fontWeight: 700 }}>+20pts ranking 🏆</div>
            </div>
          )}
        </div>
        <div style={{ padding: "7px 10px 4px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🍧 {post.produtoNome || "Produto"}</div>
          {post.produtoPreco && <div style={{ fontSize: "0.65rem", color: "var(--gold)", fontWeight: 700, marginTop: 1 }}>R$ {post.produtoPreco}</div>}
          <div style={{ fontSize: "0.6rem", color: "var(--text3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>👤 {post.autorNome || "Cliente"}</div>
        </div>
        {post.midia && (
          <div style={{ padding: "6px 10px 0", display: "flex", alignItems: "center", gap: 6 }}>
            {post.pontosLiberados ? (
              <div style={{ fontSize: "0.6rem", color: "var(--gold)", fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}>
                <span>🏆</span> +20pts liberados!
              </div>
            ) : (
              <>
                <div style={{ flex: 1, height: 3, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${Math.min(100, (votosRecebidos / votosNecessarios) * 100)}%`, background: "linear-gradient(90deg, var(--purple2), var(--gold))", borderRadius: 2, transition: "width 0.4s ease" }} />
                </div>
                <span style={{ fontSize: "0.58rem", color: "var(--text3)", flexShrink: 0 }}>{votosRecebidos}/{votosNecessarios}</span>
              </>
            )}
          </div>
        )}
        <div style={{ padding: "4px 10px 8px", display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={e => { e.stopPropagation(); onCurtir(); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, color: curtido ? "#ef4444" : "var(--text3)", padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill={curtido ? "#ef4444" : "none"} stroke={curtido ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {(post.curtidas || 0) > 0 && <span style={{ fontWeight: 600, fontSize: "0.65rem" }}>{post.curtidas}</span>}
          </button>
          <button onClick={e => { e.stopPropagation(); setShowComentarios(true); }} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, color: "var(--text3)", padding: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {(post.comentarios || 0) > 0 && <span style={{ fontWeight: 600, fontSize: "0.65rem" }}>{post.comentarios}</span>}
          </button>
          <button onClick={e => { e.stopPropagation(); compartilhar(); }} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0, display: "flex", alignItems: "center" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
          {!isDono && post.midia && (
            <button
              onClick={e => { e.stopPropagation(); onDarPontos(post); }}
              disabled={jaVotou || post.pontosLiberados || energiaVotos <= 0 || votando}
              title={jaVotou ? "Você já votou" : post.pontosLiberados ? "Pontos liberados!" : energiaVotos <= 0 ? "Sem energia hoje" : "Dar pontos para este post"}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", background: jaVotou || post.pontosLiberados ? "rgba(245,197,24,0.08)" : energiaVotos <= 0 ? "var(--bg3)" : "rgba(138,92,246,0.15)", border: `1px solid ${jaVotou || post.pontosLiberados ? "rgba(245,197,24,0.25)" : energiaVotos <= 0 ? "var(--border)" : "rgba(138,92,246,0.3)"}`, borderRadius: 20, cursor: jaVotou || post.pontosLiberados || energiaVotos <= 0 ? "default" : "pointer", transition: "all 0.2s" }}
            >
              <span style={{ fontSize: "0.75rem" }}>{jaVotou || post.pontosLiberados ? "⭐" : "🏆"}</span>
              <span style={{ fontSize: "0.58rem", fontWeight: 700, color: jaVotou || post.pontosLiberados ? "var(--gold)" : energiaVotos <= 0 ? "var(--text3)" : "var(--purple2)" }}>
                {votando ? "..." : jaVotou ? "Votado" : post.pontosLiberados ? "Liberado" : "+pts"}
              </span>
            </button>
          )}
        </div>
      </div>
      {showComentarios && <DrawerComentarios postId={post.id} coll={coll} onClose={() => setShowComentarios(false)} />}
      {imagemZoom && (
        <div onClick={() => setImagemZoom(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          {imagemZoom.startsWith("yt:")
            ? <iframe src={`https://www.youtube.com/embed/${imagemZoom.slice(3)}?autoplay=1&playsinline=1`} allow="autoplay; encrypted-media" allowFullScreen style={{ width: "100%", maxWidth: 500, aspectRatio: "9/16", border: "none", borderRadius: 8 }} />
            : <img src={imagemZoom} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }} />
          }
          <button onClick={() => setImagemZoom(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
        </div>
      )}
    </>
  );
}

// ── Modal de novo post ────────────────────────────────────────
function ModalNovoPost({ tipo, coll, onClose, produtos }) {
  const { user } = useAuth();
  const [texto, setTexto] = useState("");
  const [midia, setMidia] = useState(null);
  const [midiaUrl, setMidiaUrl] = useState("");
  const [tipoMidia, setTipoMidia] = useState("imagem");
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [postando, setPostando] = useState(false);
  const [inputMode, setInputMode] = useState("arquivo");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [ytSearch, setYtSearch] = useState("");
  const textareaRef = useRef();

  const ytId = extractYoutubeId(youtubeUrl);

  const handleMidia = async (file) => {
    if (!file) return;
    setUploading(true);
    setProgresso(0);
    const isVideo = file.type.startsWith("video/");
    setTipoMidia(isVideo ? "video" : "imagem");
    setMidia(URL.createObjectURL(file));
    const url = await uploadMidia(file, setProgresso);
    setMidiaUrl(url || "");
    setUploading(false);
  };

  const handlePost = async () => {
    const midiaFinal = inputMode === "youtube" ? ytId : midiaUrl;
    const tipoFinal = inputMode === "youtube" ? "youtube" : tipoMidia;
    if (!texto.trim() && !midiaFinal) return;
    setPostando(true);
    try {
      await addDoc(collection(db, coll), {
        autorId: user.uid,
        autorNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        autorFoto: user.photoURL || null,
        texto: texto.trim(),
        midia: midiaFinal || null,
        tipo: tipoFinal,
        curtidas: 0,
        comentarios: 0,
        ...(tipo === "sabor" && produtoSelecionado ? {
          produtoId: produtoSelecionado.id,
          produtoNome: produtoSelecionado.nome,
          produtoPreco: produtoSelecionado.preco?.toFixed(2).replace(".", ","),
          rankingPts: 20,
        } : {}),
        criadoEm: serverTimestamp(),
      });
      onClose();
    } catch (e) { console.error("Erro ao postar:", e); }
    finally { setPostando(false); }
  };

  const podeConcluir = ((inputMode === "youtube" ? ytId : (texto.trim() || midiaUrl))) && !uploading && !postando;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "var(--bg)", borderRadius: "20px 20px 0 0", padding: "16px", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          {tipo === "sabor" ? "🍧 Caixa NexFood" : "📝 Novo Post"}
          {tipo === "sabor" && <span style={{ fontSize: "0.65rem", background: "rgba(245,197,24,0.15)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 20, padding: "2px 8px", color: "var(--gold)", fontWeight: 700 }}>+20pts 🏆</span>}
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
        </div>

        {tipo === "sabor" && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 6 }}>📦 Qual produto você está postando?</div>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
              {(produtos || []).filter(p => p.ativo !== false).slice(0, 10).map(p => (
                <div key={p.id} onClick={() => setProdutoSelecionado(produtoSelecionado?.id === p.id ? null : p)}
                  style={{ flexShrink: 0, background: produtoSelecionado?.id === p.id ? "rgba(245,197,24,0.12)" : "var(--bg2)", border: `1px solid ${produtoSelecionado?.id === p.id ? "var(--gold)" : "var(--border)"}`, borderRadius: 10, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s" }}>
                  {p.foto && <img src={p.foto} alt="" loading="lazy" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />}
                  <div>
                    <div style={{ fontSize: "0.7rem", fontWeight: 600, maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
                    <div style={{ fontSize: "0.62rem", color: "var(--gold)" }}>R$ {p.preco?.toFixed(2).replace(".", ",")}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Abas mídia */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {[{ id: "arquivo", label: "📸 Arquivo" }, { id: "youtube", label: "▶️ YouTube" }].map(tab => (
            <button key={tab.id} onClick={() => { setInputMode(tab.id); setMidia(null); setMidiaUrl(""); setYoutubeUrl(""); setYtSearch(""); }}
              style={{ flex: 1, padding: "8px 0", background: inputMode === tab.id ? "linear-gradient(135deg, #7c3aed, #a855f7)" : "var(--bg2)", border: `1px solid ${inputMode === tab.id ? "rgba(168,85,247,0.5)" : "var(--border)"}`, borderRadius: 10, color: inputMode === tab.id ? "#fff" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", transition: "all 0.2s" }}
            >{tab.label}</button>
          ))}
        </div>

        {inputMode === "arquivo" && (
          <div style={{ marginBottom: 12 }}>
            {midia ? (
              <div style={{ position: "relative", marginBottom: 8 }}>
                {tipoMidia === "video"
                  ? <video src={midia} controls style={{ width: "100%", maxHeight: 220, borderRadius: 10 }} />
                  : <img src={midia} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 10 }} />
                }
                {uploading && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, background: "var(--bg3)", borderRadius: "0 0 10px 10px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progresso}%`, background: "var(--purple2)", transition: "width 0.3s" }} />
                  </div>
                )}
                {!uploading && <button onClick={() => { setMidia(null); setMidiaUrl(""); }} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%", width: 26, height: 26, color: "#fff", cursor: "pointer", fontSize: "0.85rem" }}>✕</button>}
              </div>
            ) : (
              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", background: "var(--bg2)", border: "1px dashed var(--border)", borderRadius: 10, cursor: "pointer", fontSize: "0.82rem", color: "var(--text3)" }}>
                📷 Foto ou vídeo
                <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={e => handleMidia(e.target.files[0])} />
              </label>
            )}
          </div>
        )}

        {inputMode === "youtube" && (
          <div style={{ marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px" }}>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 600, marginBottom: 8 }}>🔍 Buscar no YouTube</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={ytSearch} onChange={e => setYtSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && ytSearch.trim()) window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(ytSearch)}`, "_blank"); }}
                  placeholder="Ex: açaí short, burger challenge…"
                  style={{ flex: 1, padding: "8px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", outline: "none" }}
                />
                <button onClick={() => ytSearch.trim() && window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(ytSearch)}`, "_blank")}
                  disabled={!ytSearch.trim()}
                  style={{ padding: "8px 14px", background: ytSearch.trim() ? "#ff0000" : "var(--bg3)", border: "none", borderRadius: 8, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: ytSearch.trim() ? "pointer" : "default", opacity: ytSearch.trim() ? 1 : 0.4 }}
                >Buscar</button>
              </div>
              <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 6 }}>Abre o YouTube → copie o link → cole abaixo</div>
            </div>
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", fontWeight: 600, marginBottom: 6 }}>🔗 Colar link</div>
              <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/shorts/…"
                style={{ width: "100%", padding: "10px 12px", background: "var(--bg2)", border: `1.5px solid ${ytId ? "#a855f7" : "var(--border)"}`, borderRadius: 10, color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
              />
              {youtubeUrl && !ytId && <div style={{ fontSize: "0.68rem", color: "#f87171", marginTop: 4 }}>Link inválido</div>}
              {ytId && <div style={{ fontSize: "0.68rem", color: "#86efac", marginTop: 4 }}>✓ Vídeo identificado</div>}
            </div>
            {ytId && (
              <div style={{ borderRadius: 10, overflow: "hidden", position: "relative" }}>
                <img src={`https://img.youtube.com/vi/${ytId}/mqdefault.jpg`} alt="" style={{ width: "100%", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#ff0000", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>▶</div>
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none", marginBottom: 8, padding: "2px 0" }}>
          {["😍","🔥","😋","💜","👑","🍓","🥰","😂","❤️","👏","🤤","✨","💯","🎉","😎","🙌","💪","🍧","😱","🥳"].map(emoji => (
            <button key={emoji} onClick={() => { setTexto(t => t + emoji); textareaRef.current?.focus(); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", padding: "2px 3px", borderRadius: 8, flexShrink: 0, lineHeight: 1 }}
            >{emoji}</button>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={tipo === "sabor" ? "Como estava? 😍🔥" : "O que você está pensando? ✍️"}
          style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", outline: "none", resize: "none", minHeight: 80, boxSizing: "border-box" }}
        />

        <button onClick={handlePost} disabled={!podeConcluir}
          style={{ width: "100%", marginTop: 12, padding: "13px", background: podeConcluir ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "var(--bg3)", border: "none", borderRadius: 12, color: podeConcluir ? "#fff" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: podeConcluir ? "pointer" : "not-allowed", boxShadow: podeConcluir ? "0 4px 16px rgba(90,45,145,0.4)" : "none", transition: "all 0.2s" }}>
          {uploading ? `⏳ Enviando ${progresso}%...` : postando ? "Publicando..." : tipo === "sabor" ? "⚡ Postar na Caixa NexFood" : "📤 Publicar"}
        </button>
      </div>
    </div>
  );
}

// ── FAB de novo post ─────────────────────────────────────────
function FABNovoPost({ podePostarGrande, podePostarNexFood, energiaVotos, onPostar, onNexFood }) {
  const [aberto, setAberto] = useState(false);
  const temDuasOpcoes = podePostarGrande && podePostarNexFood;

  const handleClick = () => {
    if (!temDuasOpcoes) {
      podePostarGrande ? onPostar() : onNexFood();
      return;
    }
    setAberto(a => !a);
  };

  return (
    <div style={{ position: "fixed", bottom: 80, right: 18, zIndex: 900, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10 }}>
      {/* Opções expandidas */}
      {aberto && (
        <>
          {podePostarNexFood && (
            <button
              onClick={() => { setAberto(false); onNexFood(); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--bg2)", border: "1px solid rgba(245,197,24,0.35)", borderRadius: 24, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}
            >
              <span style={{ fontSize: "1rem" }}>⚡</span> NexFoody
            </button>
          )}
          {podePostarGrande && (
            <button
              onClick={() => { setAberto(false); onPostar(); }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--bg2)", border: "1px solid rgba(138,92,246,0.35)", borderRadius: 24, color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.3)", whiteSpace: "nowrap" }}
            >
              <span style={{ fontSize: "1rem" }}>✏️</span> Postar
            </button>
          )}
        </>
      )}

      {/* Botão principal */}
      <button
        onClick={handleClick}
        style={{
          width: 52, height: 52, borderRadius: "50%",
          background: aberto
            ? "var(--bg2)"
            : "var(--loja-cor-primaria, var(--purple))",
          border: aberto ? "1px solid var(--border)" : "none",
          color: aberto ? "var(--text3)" : "var(--loja-btn-texto, #fff)",
          fontSize: "1.5rem", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: aberto ? "none" : "0 4px 20px rgba(0,0,0,0.35)",
          transition: "all 0.2s",
          transform: aberto ? "rotate(45deg)" : "rotate(0deg)",
          fontFamily: "'Outfit', sans-serif", lineHeight: 1,
        }}
      >+</button>

      {/* Overlay para fechar */}
      {aberto && (
        <div
          onClick={() => setAberto(false)}
          style={{ position: "fixed", inset: 0, zIndex: -1 }}
        />
      )}
    </div>
  );
}

// ── Caixa dos Amigos ─────────────────────────────────────────
function CaixaAmigos() {
  const { user } = useAuth();
  const [amigosIds, setAmigosIds] = useState([]);
  const [posts, setPosts] = useState([]);
  const [curtidos, setCurtidos] = useState({});
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    setCurtidos(JSON.parse(localStorage.getItem("curtidosAmigos") || "{}"));
  }, []);

  // Escuta amizades aceitas em tempo real
  useEffect(() => {
    if (!user) { setCarregando(false); return; }
    const q = query(
      collection(db, "amizades"),
      where("status", "==", "aceito"),
      where("participantes", "array-contains", user.uid)
    );
    const unsub = onSnapshot(q, snap => {
      const ids = snap.docs.map(d => {
        const data = d.data();
        return data.de === user.uid ? data.para : data.de;
      });
      setAmigosIds(ids);
    });
    return unsub;
  }, [user]);

  // Busca posts dos amigos (batches de 30 — limite do Firestore)
  useEffect(() => {
    if (!user || amigosIds.length === 0) {
      setPosts([]);
      setCarregando(false);
      return;
    }
    setCarregando(true);
    const chunks = [];
    for (let i = 0; i < amigosIds.length; i += 30) chunks.push(amigosIds.slice(i, i + 30));
    const allPostsMap = new Map();
    const unsubFns = [];
    let loaded = 0;
    chunks.forEach(chunk => {
      const q = query(
        collection(db, "userPosts"),
        where("autorId", "in", chunk),
        orderBy("criadoEm", "desc"),
        limit(30)
      );
      const unsub = onSnapshot(q, snap => {
        snap.docs.forEach(d => allPostsMap.set(d.id, { id: d.id, ...d.data() }));
        loaded++;
        if (loaded >= chunks.length) {
          const sorted = Array.from(allPostsMap.values())
            .sort((a, b) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))
            .slice(0, 60);
          setPosts(sorted);
          setCarregando(false);
        }
      });
      unsubFns.push(unsub);
    });
    return () => unsubFns.forEach(u => u());
  }, [amigosIds]);

  const curtirPost = async (id) => {
    if (!user) return;
    const jaCurtiu = !!curtidos[id];
    const novo = { ...curtidos };
    if (jaCurtiu) delete novo[id]; else novo[id] = true;
    setCurtidos(novo);
    localStorage.setItem("curtidosAmigos", JSON.stringify(novo));
    try { await updateDoc(doc(db, "userPosts", id), { curtidas: increment(jaCurtiu ? -1 : 1) }); } catch {}
  };

  if (!user) return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text3)" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👥</div>
      <div style={{ fontSize: "0.88rem", fontWeight: 600 }}>Faça login para ver o feed dos amigos</div>
    </div>
  );

  if (carregando) return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text3)", fontSize: "0.82rem" }}>
      Carregando feed dos amigos...
    </div>
  );

  if (amigosIds.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text3)" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>👥</div>
      <div style={{ fontSize: "0.92rem", fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Sem amigos ainda</div>
      <div style={{ fontSize: "0.78rem", lineHeight: 1.6, maxWidth: 260, margin: "0 auto" }}>
        Adicione amigos na aba <strong>Social</strong> para ver o feed deles aqui
      </div>
    </div>
  );

  if (posts.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text3)" }}>
      <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📭</div>
      <div style={{ fontSize: "0.92rem", fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Nenhum post ainda</div>
      <div style={{ fontSize: "0.78rem", lineHeight: 1.6 }}>
        Seus {amigosIds.length} amigo{amigosIds.length !== 1 ? "s" : ""} ainda não postaram nada
      </div>
    </div>
  );

  return (
    <div>
      <div style={{ fontSize: "0.62rem", color: "var(--text3)", textAlign: "center", marginBottom: 10 }}>
        {amigosIds.length} amigo{amigosIds.length !== 1 ? "s" : ""} · {posts.length} post{posts.length !== 1 ? "s" : ""}
      </div>
      {posts.map(post => (
        <CardGrande
          key={post.id}
          post={post}
          curtido={!!curtidos[post.id]}
          onCurtir={() => curtirPost(post.id)}
          coll="userPosts"
        />
      ))}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function CaixasDuplas({ filtroUserId, modoFeed = false }) {
  const { user } = useAuth();
  const { produtos, isAdmin } = useStore();
  const [postosGrande, setPostosGrande] = useState([]);
  const [postosSabor, setPostosSabor] = useState([]);
  const [postosNexFood, setPostosNexFood] = useState([]); // cliente posts para NexFood
  const [storeFeed, setStoreFeed] = useState([]);          // feedLoja para NexFood
  const [topBuyer, setTopBuyer] = useState(null);
  const [curtidosGrande, setCurtidosGrande] = useState({});
  const [curtidosSabor, setCurtidosSabor] = useState({});
  const [curtidosNexFood, setCurtidosNexFood] = useState({});
  const [modalTipo, setModalTipo] = useState(null);
  const [energiaVotos, setEnergiaVotos] = useState(10);
  // modo: "duplo" | "grande" | "nexfood" | "amigos"
  const [modo, setModo] = useState("duplo");

  const collGrande = modoFeed ? "feedLoja" : "userPosts";
  const collSabor = modoFeed ? "feedSabor" : "userSabor";
  const collNexFood = "userPosts"; // todos os clientes

  useEffect(() => {
    // Caixa Grande
    const q1 = filtroUserId
      ? query(collection(db, collGrande), where("autorId", "==", filtroUserId), orderBy("criadoEm", "desc"))
      : query(collection(db, collGrande), orderBy("criadoEm", "desc"));
    const unsub1 = onSnapshot(q1, snap => setPostosGrande(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Caixa NexFood (posts de clientes — global)
    const q3 = query(collection(db, collNexFood), orderBy("criadoEm", "desc"), limit(40));
    const unsub3 = onSnapshot(q3, snap => setPostosNexFood(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Feed das lojas para NexFood
    const q4 = query(collection(db, "feedLoja"), orderBy("criadoEm", "desc"), limit(20));
    const unsub4 = onSnapshot(q4, snap => setStoreFeed(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Caixa do Sabor
    const q2 = modoFeed
      ? query(collection(db, collSabor), orderBy("criadoEm", "desc"))
      : filtroUserId
        ? query(collection(db, collSabor), where("autorId", "==", filtroUserId), orderBy("criadoEm", "desc"))
        : query(collection(db, collSabor), orderBy("criadoEm", "desc"));
    const unsub2 = onSnapshot(q2, snap => setPostosSabor(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Top buyer
    const fetchTopBuyer = async () => {
      try {
        const snap = await getDocs(query(collection(db, "users"), orderBy("rankingPts", "desc"), limit(1)));
        if (!snap.empty) setTopBuyer({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } catch {}
    };
    fetchTopBuyer();

    setCurtidosGrande(JSON.parse(localStorage.getItem("curtidosGrande") || "{}"));
    setCurtidosSabor(JSON.parse(localStorage.getItem("curtidosSabor") || "{}"));
    setCurtidosNexFood(JSON.parse(localStorage.getItem("curtidosNexFood") || "{}"));

    const hoje = new Date().toISOString().split("T")[0];
    const savedEnergia = JSON.parse(localStorage.getItem("energiaVotos") || "{}");
    if (savedEnergia.data !== hoje) {
      localStorage.setItem("energiaVotos", JSON.stringify({ data: hoje, restante: 10 }));
      setEnergiaVotos(10);
    } else {
      setEnergiaVotos(savedEnergia.restante ?? 10);
    }

    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [filtroUserId]);

  const curtir = async (id, coll, curtidos, setCurtidos, key) => {
    if (!user) return;
    const jaCurtiu = !!curtidos[id];
    const novo = { ...curtidos };
    if (jaCurtiu) delete novo[id]; else novo[id] = true;
    setCurtidos(novo);
    localStorage.setItem(key, JSON.stringify(novo));
    try { await updateDoc(doc(db, coll, id), { curtidas: increment(jaCurtiu ? -1 : 1) }); } catch {}
  };

  const pedirIgual = (post) => {
    if (post.produtoId) window.location.href = `/?produto=${post.produtoId}`;
  };

  const darPontos = async (post) => {
    if (!user || post.autorId === user.uid) return;
    if (energiaVotos <= 0) return;
    if (post.votantes?.[user.uid]) return;
    const hoje = new Date().toISOString().split("T")[0];
    const userData = await getDoc(doc(db, "users", user.uid));
    const ultimoPedido = userData.data()?.ultimoPedidoEm;
    const comprouRecente = ultimoPedido && (Date.now() - new Date(ultimoPedido).getTime()) < 30 * 86400000;
    const pesoPts = comprouRecente ? 5 : 1;
    const keyRendimento = `rendimento_${user.uid}_${post.autorId}_${hoje}`;
    const votosNoCriador = parseInt(localStorage.getItem(keyRendimento) || "0");
    const multiplicador = votosNoCriador === 0 ? 1 : votosNoCriador === 1 ? 0.5 : 0;
    if (multiplicador === 0) return;
    const ptsFinal = Math.round(pesoPts * multiplicador);
    const novosVotos = (post.votosRecebidos || 0) + ptsFinal;
    const liberar = novosVotos >= 3 && !post.pontosLiberados;
    try {
      await updateDoc(doc(db, collSabor, post.id), {
        [`votantes.${user.uid}`]: new Date().toISOString(),
        votosRecebidos: increment(ptsFinal),
        ...(liberar ? { pontosLiberados: true } : {}),
      });
      if (liberar) await updateDoc(doc(db, "users", post.autorId), { rankingPts: increment(20) });
      await updateDoc(doc(db, "users", user.uid), { rankingPts: increment(2) });
      const novaEnergia = Math.max(0, energiaVotos - 1);
      setEnergiaVotos(novaEnergia);
      localStorage.setItem("energiaVotos", JSON.stringify({ data: hoje, restante: novaEnergia }));
      localStorage.setItem(keyRendimento, String(votosNoCriador + 1));
    } catch (e) { console.error("Erro ao dar pontos:", e); }
  };

  const podePostarGrande = modoFeed ? isAdmin : (user && user.uid === filtroUserId);
  const podePostarSabor = modoFeed ? isAdmin : (user && user.uid === filtroUserId);
  // No perfil de outro usuário o FAB não aparece — só no feed geral ou no próprio perfil
  const podePostarNexFood = modoFeed ? !!user : (user && user.uid === filtroUserId);

  // Feed mixado para CaixaNexFood
  const nexFoodFeed = buildNexFoodFeed(
    storeFeed,
    postosNexFood,
    (produtos || []).filter(p => p.ativo !== false).slice(0, 10),
    topBuyer ? [topBuyer] : []
  );

  // Expand buttons
  const btnExpandir = (col) => {
    const expandido = modo === col;
    return (
      <button
        onClick={() => setModo(m => m === col ? "duplo" : col)}
        style={{
          display: "flex", alignItems: "center", gap: 4,
          padding: "4px 10px",
          background: expandido ? "rgba(138,92,246,0.12)" : "rgba(138,92,246,0.08)",
          border: "1px solid rgba(138,92,246,0.25)",
          borderRadius: 20,
          color: "var(--purple2)",
          fontFamily: "'Outfit', sans-serif",
          fontWeight: 700, fontSize: "0.65rem",
          cursor: "pointer", lineHeight: 1,
          transition: "all 0.15s",
        }}
      >
        {expandido ? (
          <><span style={{ fontSize: "0.8rem" }}>←→</span> Reduzir</>
        ) : (
          <><span style={{ fontSize: "0.8rem" }}>⤢</span> Expandir</>
        )}
      </button>
    );
  };

  const mostraColunaGrande = modo === "duplo" || modo === "grande";
  const mostraColunaFoods = modo === "duplo" || modo === "nexfood";
  const mostraColunaAmigos = modo === "amigos";

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)", margin: "0 14px" }}>
        {[
          { id: "duplo",   label: "📝 Feed" },
          { id: "nexfood", label: "⚡ NexFood" },
          { id: "amigos",  label: "👥 Amigos" },
        ].map(tab => {
          const ativo = tab.id === "duplo"
            ? (modo === "duplo" || modo === "grande")
            : modo === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setModo(tab.id)}
              style={{
                flex: 1, padding: "10px 4px",
                background: "none", border: "none",
                borderBottom: `2px solid ${ativo ? "var(--purple2)" : "transparent"}`,
                color: ativo ? "var(--purple2)" : "var(--text3)",
                fontFamily: "'Outfit', sans-serif", fontWeight: 700,
                fontSize: "0.78rem", cursor: "pointer",
                transition: "color 0.2s, border-color 0.2s",
                marginBottom: -1,
              }}
            >{tab.label}</button>
          );
        })}
      </div>

      {/* Grid */}
      <div style={{ display: "flex", gap: 8, padding: "0 14px", height: ALTURA_CAIXAS }}>

        {/* Caixa Grande */}
        {mostraColunaGrande && (
          <div style={{ flex: modo === "grande" ? 1 : "0 0 58%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header da coluna */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
              <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--text3)" }}>📝 Feed</span>
              {btnExpandir("grande")}
            </div>
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "var(--surface2) transparent", paddingRight: 4 }}>
              {postosGrande.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
                  <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>📝</div>
                  <div style={{ fontSize: "0.82rem" }}>Nenhum post ainda</div>
                  {podePostarGrande && <div style={{ fontSize: "0.72rem", marginTop: 6, color: "var(--purple2)", cursor: "pointer" }} onClick={() => setModalTipo("grande")}>Criar primeiro post →</div>}
                </div>
              ) : postosGrande.map(post => (
                <CardGrande key={post.id} post={post} curtido={!!curtidosGrande[post.id]}
                  onCurtir={() => curtir(post.id, collGrande, curtidosGrande, setCurtidosGrande, "curtidosGrande")}
                  coll={collGrande}
                />
              ))}
            </div>
          </div>
        )}

        {/* Caixa NexFood */}
        {mostraColunaFoods && (
          <div style={{ flex: modo === "nexfood" ? 1 : "0 0 40%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header com expand */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, flexShrink: 0 }}>
              <span style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.2, color: "var(--purple2)" }}>⚡ NexFood</span>
              {btnExpandir("nexfood")}
            </div>
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "var(--surface2) transparent" }}>
              <CaixaNexFood
                feed={nexFoodFeed}
                curtidos={curtidosNexFood}
                onCurtir={(id, coll) => curtir(id, coll || collNexFood, curtidosNexFood, setCurtidosNexFood, "curtidosNexFood")}
                collCliente={collNexFood}
              />
              {/* Caixa do Sabor abaixo do NexFood (modo duplo/nexfood) */}
              {postosSabor.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold)", marginBottom: 8, textAlign: "center" }}>🍧 Sabor</div>
                  {postosSabor.map(post => (
                    <CardSabor key={post.id} post={post} curtido={!!curtidosSabor[post.id]}
                      onCurtir={() => curtir(post.id, collSabor, curtidosSabor, setCurtidosSabor, "curtidosSabor")}
                      onPedirIgual={pedirIgual}
                      coll={collSabor}
                      energiaVotos={energiaVotos}
                      onDarPontos={darPontos}
                      isDono={user && user.uid === post.autorId}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Caixa Amigos */}
        {mostraColunaAmigos && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ flex: 1, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "var(--surface2) transparent", paddingRight: 4 }}>
              <CaixaAmigos />
            </div>
          </div>
        )}
      </div>

      {/* FAB — botão de novo post */}
      {(podePostarGrande || podePostarSabor || podePostarNexFood) && modo !== "amigos" && (
        <FABNovoPost
          podePostarGrande={podePostarGrande}
          podePostarNexFood={podePostarSabor || podePostarNexFood}
          energiaVotos={energiaVotos}
          onPostar={() => setModalTipo("grande")}
          onNexFood={() => setModalTipo("sabor")}
        />
      )}

      {/* Modal */}
      {modalTipo && (
        <ModalNovoPost
          tipo={modalTipo}
          coll={modalTipo === "sabor" ? collSabor : collGrande}
          onClose={() => setModalTipo(null)}
          produtos={produtos || []}
        />
      )}
    </div>
  );
}

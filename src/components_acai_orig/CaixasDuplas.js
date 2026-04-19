// src/components/CaixasDuplas.js
import React, { useState, useEffect, useRef } from "react";
import { collection, onSnapshot, orderBy, query, addDoc, updateDoc, doc, increment, serverTimestamp, where, getDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "../lib/firebase";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";

const IMGBB_KEY = "4b8379f3bfc7eb113e0820730166a9f8";
const ALTURA_CAIXAS = "calc(100vh - 200px)";

// ── Compressão de imagem ─────────────────────────────────────
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

// ── Upload de mídia ──────────────────────────────────────────
async function uploadMidia(file, onProgress) {
  if (file.type.startsWith("video/")) {
    if (file.size > 100 * 1024 * 1024) { alert("Vídeo muito grande. Máximo 100MB."); return null; }
    // Upload vídeo para Firebase Storage
    return new Promise((resolve, reject) => {
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
  // Imagens: comprimir e enviar para ImgBB
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

// ── Drawer de Comentários ────────────────────────────────────
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
    const jaCurtiu = localStorage.getItem(key);
    if (jaCurtiu) return;
    localStorage.setItem(key, "1");
    await updateDoc(doc(db, `${coll}/${postId}/comentarios`, c.id), { curtidas: increment(1) });
  };

  const tempo = (ts) => {
    if (!ts?.toDate) return "";
    const diff = Math.floor((Date.now() - ts.toDate()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1200, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "var(--bg)", borderRadius: "20px 20px 0 0", maxHeight: "75vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>💬 Comentários {comentarios.length > 0 && `(${comentarios.length})`}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
        </div>
        {/* Lista */}
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
                  <button onClick={() => { setTexto(`@${c.autorNome} `); inputRef.current?.focus(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.65rem", color: "var(--text3)", padding: 0, fontFamily: "'Outfit', sans-serif" }}>
                    Responder
                  </button>
                  {c.curtidas > 0 && <span style={{ fontSize: "0.65rem", color: "var(--text3)" }}>❤️ {c.curtidas}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Input */}
        {user ? (
          <div style={{ borderTop: "1px solid var(--border)", flexShrink: 0 }}>
            {/* Emojis rápidos */}
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
            {/* Input */}
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

// ── Card da Caixa Grande ─────────────────────────────────────
function CardGrande({ post, onCurtir, curtido, coll }) {
  const [showComentarios, setShowComentarios] = useState(false);
  const [expandido, setExpandido] = useState(false);
  const [imagemZoom, setImagemZoom] = useState(null);

  const tempo = (ts) => {
    if (!ts?.toDate) return "";
    const diff = Math.floor((Date.now() - ts.toDate()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const compartilhar = () => {
    const txt = `${post.texto || ""}\n\n🔗 https://acaipurogosto.com.br/feed`;
    if (navigator.share) navigator.share({ text: txt });
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  return (
    <>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", marginBottom: 10, flexShrink: 0 }}>
        <div style={{ padding: "10px 12px 8px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--surface)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>
            {post.autorFoto ? <img src={post.autorFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : post.autorNome?.[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.78rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.autorNome || "Cliente"}</div>
            <div style={{ fontSize: "0.62rem", color: "var(--text3)" }}>{tempo(post.criadoEm)}</div>
          </div>
          <button style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: "4px 6px", fontSize: "1.1rem", lineHeight: 1, WebkitTapHighlightColor: "transparent" }}>
            ···
          </button>
        </div>
        {post.midia && (
          post.tipo === "video"
            ? <video src={post.midia} controls playsInline style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }} />
            : <img src={post.midia} alt="" loading="lazy" onClick={() => setImagemZoom(post.midia)} style={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block", cursor: "zoom-in" }} />
        )}
        {imagemZoom && (
          <div onClick={() => setImagemZoom(null)} style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <img src={imagemZoom} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }} />
            <button onClick={() => setImagemZoom(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
          </div>
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
        <div style={{ padding: "6px 12px 10px", display: "flex", gap: 14, alignItems: "center" }}>
          <button onClick={onCurtir} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: curtido ? "#ef4444" : "var(--text3)", padding: 0, fontFamily: "'Outfit', sans-serif" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={curtido ? "#ef4444" : "none"} stroke={curtido ? "#ef4444" : "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            {(post.curtidas || 0) > 0 && <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{post.curtidas}</span>}
          </button>
          <button onClick={() => setShowComentarios(true)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, color: "var(--text3)", padding: 0, fontFamily: "'Outfit', sans-serif" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {(post.comentarios || 0) > 0 && <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>{post.comentarios}</span>}
          </button>
          <button onClick={compartilhar} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", padding: 0, display: "flex", alignItems: "center" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
        </div>
      </div>
      {showComentarios && <DrawerComentarios postId={post.id} coll={coll} onClose={() => setShowComentarios(false)} />}
    </>
  );
}

// ── Card da Caixa do Sabor ───────────────────────────────────
function CardSabor({ post, onCurtir, curtido, onPedirIgual, coll, isDono, energiaVotos, onDarPontos }) {
  const [hover, setHover] = useState(false);
  const [showComentarios, setShowComentarios] = useState(false);
  const [imagemZoom, setImagemZoom] = useState(null);
  const [jaVotou, setJaVotou] = useState(false);
  const [votando, setVotando] = useState(false);

  const votosRecebidos = post.votosRecebidos || 0;
  const votosNecessarios = 3;

  const compartilhar = () => {
    const txt = `🍓 ${post.produtoNome || "Produto"}\n\nhttps://acaipurogosto.com.br`;
    if (navigator.share) navigator.share({ text: txt });
    else window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  return (
    <>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 8, flexShrink: 0, position: "relative" }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        onTouchStart={() => setHover(true)} onTouchEnd={() => setTimeout(() => setHover(false), 2000)}
      >
        <div style={{ position: "relative" }}>
          {post.midia ? (
            post.tipo === "video"
              ? <video src={post.midia} muted playsInline loop autoPlay style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
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
        {/* Barra de votos */}
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
          {/* Botão dar pontos */}
          {!isDono && post.midia && (
            <button
              onClick={e => { e.stopPropagation(); onDarPontos(post); }}
              disabled={jaVotou || post.pontosLiberados || energiaVotos <= 0 || votando}
              title={jaVotou ? "Você já votou" : post.pontosLiberados ? "Pontos liberados!" : energiaVotos <= 0 ? "Sem energia hoje" : "Dar 20pts para este post"}
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
          <img src={imagemZoom} alt="" style={{ maxWidth: "100%", maxHeight: "90vh", objectFit: "contain", borderRadius: 8 }} />
          <button onClick={() => setImagemZoom(null)} style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", width: 36, height: 36, borderRadius: "50%", fontSize: "1.2rem", cursor: "pointer" }}>✕</button>
        </div>
      )}
    </>
  );
}

// ── Modal de novo post ───────────────────────────────────────
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
  const textareaRef = useRef();

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
    if (!texto.trim() && !midiaUrl) return;
    setPostando(true);
    try {
      await addDoc(collection(db, coll), {
        autorId: user.uid,
        autorNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        autorFoto: user.photoURL || null,
        texto: texto.trim(),
        midia: midiaUrl || null,
        tipo: tipoMidia,
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

  const podeConcluir = (texto.trim() || midiaUrl) && !uploading && !postando;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "var(--bg)", borderRadius: "20px 20px 0 0", padding: "16px", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
          {tipo === "sabor" ? "🍧 Caixa do Sabor" : "📝 Novo Post"}
          {tipo === "sabor" && <span style={{ fontSize: "0.65rem", background: "rgba(245,197,24,0.15)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 20, padding: "2px 8px", color: "var(--gold)", fontWeight: 700 }}>+20pts 🏆</span>}
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.3rem" }}>✕</button>
        </div>

        {/* Seletor de produto */}
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

        {/* Upload */}
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
              📷 Foto ou vídeo (máx 60s)
              <input type="file" accept="image/*,video/*" style={{ display: "none" }} onChange={e => handleMidia(e.target.files[0])} />
            </label>
          )}
        </div>

        {/* Emojis rápidos para o post */}
        <div style={{ display: "flex", gap: 2, overflowX: "auto", scrollbarWidth: "none", marginBottom: 8, padding: "2px 0" }}>
          {["😍","🔥","😋","💜","👑","🍓","🥰","😂","❤️","👏","🤤","✨","💯","🎉","😎","🙌","💪","🍧","😱","🥳"].map(emoji => (
            <button key={emoji} onClick={() => { setTexto(t => t + emoji); textareaRef.current?.focus(); }}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.3rem", padding: "2px 3px", borderRadius: 8, flexShrink: 0, lineHeight: 1 }}
            >{emoji}</button>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={tipo === "sabor" ? "Como estava? 😍🔥" : "O que você está pensando? ✍️"}
          style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", outline: "none", resize: "none", minHeight: 80, boxSizing: "border-box" }}
        />

        <button onClick={handlePost} disabled={!podeConcluir}
          style={{ width: "100%", marginTop: 12, padding: "13px", background: podeConcluir ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "var(--bg3)", border: "none", borderRadius: 12, color: podeConcluir ? "#fff" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: podeConcluir ? "pointer" : "not-allowed", boxShadow: podeConcluir ? "0 4px 16px rgba(90,45,145,0.4)" : "none", transition: "all 0.2s" }}>
          {uploading ? `⏳ Enviando ${progresso}%...` : postando ? "Publicando..." : tipo === "sabor" ? "🍧 Postar na Caixa do Sabor" : "📤 Publicar"}
        </button>
      </div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────
export default function CaixasDuplas({ filtroUserId, modoFeed = false }) {
  const { user } = useAuth();
  const { produtos, isAdmin } = useStore();
  const [postosGrande, setPostosGrande] = useState([]);
  const [postosSabor, setPostosSabor] = useState([]);
  const [curtidosGrande, setCurtidosGrande] = useState({});
  const [curtidosSabor, setCurtidosSabor] = useState({});
  const [sabor, setSabor] = useState(true);
  const [modalTipo, setModalTipo] = useState(null);
  const [energiaVotos, setEnergiaVotos] = useState(10);

  // No feed da loja: coll = feedLoja / feedSabor
  // No perfil: filtra por autorId
  // No feed da loja: usa feedLoja/feedSabor (admin posta)
  // No perfil do cliente: usa userPosts/userSabor (dono posta)
  const collGrande = modoFeed ? "feedLoja" : "userPosts";
  const collSabor = modoFeed ? "feedSabor" : "userSabor";

  useEffect(() => {
    const q1 = filtroUserId
      ? query(collection(db, collGrande), where("autorId", "==", filtroUserId), orderBy("criadoEm", "desc"))
      : query(collection(db, collGrande), orderBy("criadoEm", "desc"));
    const unsub1 = onSnapshot(q1, snap => setPostosGrande(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    // Caixa do Sabor é sempre global (TikTok-style) — todos veem todos
    const q2 = modoFeed
      ? query(collection(db, collSabor), orderBy("criadoEm", "desc"))
      : filtroUserId
        ? query(collection(db, collSabor), where("autorId", "==", filtroUserId), orderBy("criadoEm", "desc"))
        : query(collection(db, collSabor), orderBy("criadoEm", "desc"));
    const unsub2 = onSnapshot(q2, snap => setPostosSabor(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    setCurtidosGrande(JSON.parse(localStorage.getItem("curtidosGrande") || "{}"));
    setCurtidosSabor(JSON.parse(localStorage.getItem("curtidosSabor") || "{}"));
    // Energia de votos — reset diário
    const hoje = new Date().toISOString().split("T")[0];
    const savedEnergia = JSON.parse(localStorage.getItem("energiaVotos") || "{}");
    if (savedEnergia.data !== hoje) {
      localStorage.setItem("energiaVotos", JSON.stringify({ data: hoje, restante: 10 }));
      setEnergiaVotos(10);
    } else {
      setEnergiaVotos(savedEnergia.restante ?? 10);
    }
    return () => { unsub1(); unsub2(); };
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

    // Verificar se comprou nos últimos 30 dias
    const hoje = new Date().toISOString().split("T")[0];
    const userData = await getDoc(doc(db, "users", user.uid));
    const ultimoPedido = userData.data()?.ultimoPedidoEm;
    const comprouRecente = ultimoPedido && (Date.now() - new Date(ultimoPedido).getTime()) < 30 * 86400000;
    const pesoPts = comprouRecente ? 5 : 1;

    // Rendimentos decrescentes — votos no mesmo criador no mesmo dia
    const keyRendimento = `rendimento_${user.uid}_${post.autorId}_${hoje}`;
    const votosNoCriador = parseInt(localStorage.getItem(keyRendimento) || "0");
    const multiplicador = votosNoCriador === 0 ? 1 : votosNoCriador === 1 ? 0.5 : 0;
    if (multiplicador === 0) return; // já votou 2x no mesmo criador hoje

    const ptsFinal = Math.round(pesoPts * multiplicador);
    const novosVotos = (post.votosRecebidos || 0) + ptsFinal;
    const liberar = novosVotos >= 3 && !post.pontosLiberados;

    try {
      const coll = modoFeed ? collSabor : collSabor;
      await updateDoc(doc(db, coll, post.id), {
        [`votantes.${user.uid}`]: new Date().toISOString(),
        votosRecebidos: increment(ptsFinal),
        ...(liberar ? { pontosLiberados: true } : {}),
      });

      // Dar pontos ao criador se liberou
      if (liberar) {
        await updateDoc(doc(db, "users", post.autorId), { rankingPts: increment(20) });
      }

      // Dar pts de ranking para quem votou (+2pts por votar)
      await updateDoc(doc(db, "users", user.uid), { rankingPts: increment(2) });

      // Atualizar energia
      const novaEnergia = Math.max(0, energiaVotos - 1);
      setEnergiaVotos(novaEnergia);
      localStorage.setItem("energiaVotos", JSON.stringify({ data: hoje, restante: novaEnergia }));

      // Registrar rendimento decrescente
      localStorage.setItem(keyRendimento, String(votosNoCriador + 1));

    } catch (e) { console.error("Erro ao dar pontos:", e); }
  };

  // Permissões de postagem
  // modoFeed=true → feed da loja → só admin posta
  // modoFeed=false → perfil → só dono do perfil posta
  const podePostarGrande = modoFeed ? isAdmin : (user && user.uid === filtroUserId);
  const podePostarSabor = modoFeed ? isAdmin : (user && user.uid === filtroUserId);

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px 8px" }}>
        <div style={{ display: "flex", gap: 8 }}>
          {podePostarGrande && (
            <button onClick={() => setModalTipo("grande")} style={{ padding: "6px 14px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}>
              ✏️ Postar
            </button>
          )}
          {podePostarSabor && (
            <button onClick={() => setModalTipo("sabor")} style={{ padding: "6px 14px", background: "rgba(245,197,24,0.12)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 20, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}>
              🍧 Caixa do Sabor
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {user && energiaVotos > 0 && (
            <div title="Votos disponíveis hoje" style={{ fontSize: "0.62rem", color: "var(--purple2)", fontWeight: 600, background: "rgba(138,92,246,0.1)", border: "1px solid rgba(138,92,246,0.2)", borderRadius: 20, padding: "3px 8px" }}>
              🏆 {energiaVotos} votos
            </div>
          )}
          <button onClick={() => setSabor(s => !s)} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "4px 10px", fontSize: "0.65rem", color: "var(--text3)", fontFamily: "'Outfit', sans-serif", cursor: "pointer" }}>
            {sabor ? "⊟ Ocultar sabor" : "⊞ Mostrar sabor"}
          </button>
        </div>
      </div>

      {/* Grid */}
      <div style={{ display: "flex", gap: 8, padding: "0 14px", height: ALTURA_CAIXAS }}>
        {/* Caixa Grande */}
        <div style={{ flex: sabor ? "0 0 60%" : "1", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "var(--surface2) transparent", paddingRight: 4 }}>
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

        {/* Caixa do Sabor */}
        {sabor && (
          <div style={{ flex: "0 0 38%", overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: "var(--surface2) transparent" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--gold)", marginBottom: 8, textAlign: "center" }}>🍧 Caixa do Sabor</div>
            {postosSabor.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>🍓</div>
                <div style={{ fontSize: "0.72rem", lineHeight: 1.5 }}>
                  {podePostarSabor ? <>Poste seu açaí aqui e ganhe <span style={{ color: "var(--gold)", fontWeight: 700 }}>+20pts</span>!</> : "Nenhum post ainda"}
                </div>
                {podePostarSabor && <div style={{ marginTop: 8, fontSize: "0.68rem", color: "var(--purple2)", cursor: "pointer" }} onClick={() => setModalTipo("sabor")}>Postar agora →</div>}
              </div>
            ) : postosSabor.map(post => (
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

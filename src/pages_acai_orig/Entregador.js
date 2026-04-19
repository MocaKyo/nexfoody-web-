// src/pages/Entregador.js — página do entregador (link separado)
import React, { useState, useEffect, useRef } from "react";
import { doc, setDoc, onSnapshot, collection, query, where, updateDoc, addDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useParams } from "react-router-dom";

export default function Entregador() {
  const { entregadorId } = useParams();
  const [entregador, setEntregador] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [rastreando, setRastreando] = useState(false);
  const [posicao, setPosicao] = useState(null);
  const watchRef = useRef(null);

  // Carregar dados do entregador
  useEffect(() => {
    if (!entregadorId) return;
    const unsub = onSnapshot(doc(db, "entregadores", entregadorId), snap => {
      if (snap.exists()) setEntregador({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [entregadorId]);

  // Carregar pedidos atribuídos
  useEffect(() => {
    if (!entregadorId) return;
    const q = query(
      collection(db, "pedidos"),
      where("entregadorId", "==", entregadorId),
      where("status", "in", ["pronto", "entrega"])
    );
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [entregadorId]);

  // Iniciar rastreamento
  const iniciarRastreamento = () => {
    if (!navigator.geolocation) { alert("GPS não disponível."); return; }
    setRastreando(true);
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setPosicao({ latitude, longitude });
        // Salvar localização no Firestore
        await setDoc(doc(db, "entregadores", entregadorId), {
          localizacao: { latitude, longitude },
          ultimaAtualizacao: serverTimestamp(),
          ativo: true,
        }, { merge: true });
      },
      (err) => console.warn("GPS erro:", err),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  };

  const pararRastreamento = () => {
    if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
    setRastreando(false);
    setDoc(doc(db, "entregadores", entregadorId), { ativo: false }, { merge: true });
  };

  const marcarEntregue = async (pedidoId) => {
    await updateDoc(doc(db, "pedidos", pedidoId), { status: "entregue" });
  };

  // ── Chat ──────────────────────────────────────────────────
  const [chatAberto, setChatAberto] = useState(null); // pedidoId do chat aberto
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatTexto, setChatTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const bottomRef = useRef(null);
  const unsubChatRef = useRef(null);

  const ABRIR_CHAT = (pedidoId) => {
    if (unsubChatRef.current) unsubChatRef.current();
    setChatAberto(pedidoId);
    setChatMsgs([]);
    const q = query(collection(db, "chats", pedidoId, "mensagens"), orderBy("createdAt", "asc"));
    unsubChatRef.current = onSnapshot(q, snap => {
      setChatMsgs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  };

  const FECHAR_CHAT = () => {
    if (unsubChatRef.current) unsubChatRef.current();
    setChatAberto(null);
    setChatMsgs([]);
  };

  const ENVIAR_MSG = async (e) => {
    e?.preventDefault();
    if (!chatTexto.trim() || !chatAberto) return;
    setEnviando(true);
    const txt = chatTexto.trim();
    setChatTexto("");
    try {
      await addDoc(collection(db, "chats", chatAberto, "mensagens"), {
        texto: txt, senderId: entregadorId, senderType: "entregador",
        tipo: "normal", createdAt: serverTimestamp(),
      });
    } catch (err) { console.error(err); }
    finally { setEnviando(false); }
  };

  const COMPARTILHAR_LOCAL = async () => {
    if (!chatAberto || !posicao) return;
    const expiresAt = Date.now() + 5 * 60 * 1000;
    await setDoc(doc(db, "chats", chatAberto), {
      localizacao: { latitude: posicao.latitude, longitude: posicao.longitude, expiresAt },
    }, { merge: true });
    await addDoc(collection(db, "chats", chatAberto, "mensagens"), {
      texto: "📍 Minha localização", senderId: entregadorId, senderType: "entregador",
      tipo: "local_compartilhado", latitude: posicao.latitude, longitude: posicao.longitude,
      expiresAt, createdAt: serverTimestamp(),
    });
  };

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  useEffect(() => () => { if (unsubChatRef.current) unsubChatRef.current(); }, []);

  const fmtHora = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const QUICK_REPLIES = [
    { texto: "Saindo!", tipo: "normal" },
    { texto: "A caminho!", tipo: "normal" },
    { texto: "Cheguei!", tipo: "normal" },
    { texto: "📍 Local", tipo: "local" },
  ];

  const enviarQR = async (qr) => {
    if (qr.tipo === "local") { COMPARTILHAR_LOCAL(); return; }
    await addDoc(collection(db, "chats", chatAberto, "mensagens"), {
      texto: qr.texto, senderId: entregadorId, senderType: "entregador",
      tipo: "normal", createdAt: serverTimestamp(),
    });
  };

  if (!entregador) return (
    <div style={{ minHeight: "100vh", background: "#0f0518", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>🛵</div>
        <p>Carregando...</p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0f0518", color: "#fff", fontFamily: "'Outfit', sans-serif", padding: 20 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🛵</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.4rem", color: "#f5c518" }}>
          Olá, {entregador.nome}!
        </div>
        <div style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.5)", marginTop: 4 }}>
          Açaí Puro Gosto — Entregador
        </div>
      </div>

      {/* Botão rastrear */}
      <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: 16, marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>📍 Rastreamento GPS</div>
        {!rastreando ? (
          <button onClick={iniciarRastreamento} style={{
            width: "100%", padding: 14, border: "none", borderRadius: 12,
            background: "linear-gradient(135deg, #22c55e, #15803d)",
            color: "#fff", fontWeight: 700, fontSize: "1rem",
            cursor: "pointer", fontFamily: "'Outfit', sans-serif",
          }}>
            ▶ Iniciar rastreamento
          </button>
        ) : (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", animation: "pulse 1s infinite" }} />
              <span style={{ color: "#22c55e", fontWeight: 600 }}>Rastreando em tempo real</span>
            </div>
            {posicao && (
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>
                📍 {posicao.latitude.toFixed(6)}, {posicao.longitude.toFixed(6)}
              </div>
            )}
            <button onClick={pararRastreamento} style={{
              width: "100%", padding: 12, border: "1px solid rgba(239,68,68,0.4)", borderRadius: 12,
              background: "rgba(239,68,68,0.1)", color: "#ef4444",
              fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif",
            }}>
              ⏹ Parar rastreamento
            </button>
          </div>
        )}
      </div>

      {/* Pedidos */}
      <div style={{ fontWeight: 700, marginBottom: 12 }}>📦 Seus pedidos ({pedidos.length})</div>
      {pedidos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>✅</div>
          <p style={{ fontSize: "0.85rem" }}>Nenhum pedido atribuído no momento</p>
        </div>
      ) : (
        pedidos.map(p => (
          <div key={p.id} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 14, marginBottom: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{p.nomeCliente}</div>
            <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
              📍 {p.endereco || "Retirada no local"}
            </div>
            <div style={{ marginBottom: 10 }}>
              {p.items?.map((item, i) => (
                <div key={i} style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.7)" }}>
                  {item.qty}x {item.nome}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {p.endereco && (
                <a href={`https://maps.google.com/?q=${encodeURIComponent(p.endereco)}`} target="_blank" rel="noopener noreferrer" style={{
                  flex: 1, minWidth: 80, padding: "9px 0", textAlign: "center", textDecoration: "none",
                  background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.3)",
                  borderRadius: 10, color: "#60a5fa", fontWeight: 600, fontSize: "0.82rem",
                }}>
                  🗺️ Navegar
                </a>
              )}
              <button onClick={() => ABRIR_CHAT(p.id)} style={{
                flex: 1, minWidth: 80, padding: 9, border: "none", borderRadius: 10,
                background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)",
                color: "#a855f7", fontWeight: 600, fontSize: "0.82rem",
                cursor: "pointer", fontFamily: "'Outfit', sans-serif",
              }}>
                💬 Chat
              </button>
              {p.status === "entrega" && (
                <button onClick={() => marcarEntregue(p.id)} style={{
                  flex: 1, minWidth: 80, padding: 9, border: "none", borderRadius: 10,
                  background: "linear-gradient(135deg, #22c55e, #15803d)",
                  color: "#fff", fontWeight: 700, fontSize: "0.82rem",
                  cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                }}>
                  ✅ Entregue!
                </button>
              )}
            </div>
          </div>
        ))
      )}
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>

      {/* Chat Modal */}
      {chatAberto && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "var(--bg, #0f0518)", display: "flex", flexDirection: "column",
        }}>
          <div style={{
            padding: "14px 16px", background: "rgba(255,255,255,0.05)",
            borderBottom: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <button onClick={FECHAR_CHAT} style={{
              background: "none", border: "none", color: "#fff",
              cursor: "pointer", fontSize: "1.2rem", padding: 4,
            }}>←</button>
            <div style={{ flex: 1, fontWeight: 700, fontSize: "0.95rem" }}>
              💬 Chat com cliente
            </div>
            {posicao && rastreando && (
              <button onClick={COMPARTILHAR_LOCAL} style={{
                background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 8, padding: "4px 10px", cursor: "pointer",
                fontSize: "0.72rem", color: "#22c55e", fontFamily: "'Outfit', sans-serif",
              }}>
                📍 Localização ao vivo
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {chatMsgs.length === 0 && (
              <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.82rem", marginTop: 40 }}>
                👋 Sem mensagens ainda
              </div>
            )}
            {chatMsgs.map(msg => {
              const mine = msg.senderId === entregadorId;
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "78%", background: mine ? "#7c3aed" : "rgba(255,255,255,0.08)",
                    color: "#fff", borderRadius: mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    padding: "10px 14px", fontSize: "0.88rem", lineHeight: 1.4,
                    border: mine ? "none" : "1px solid rgba(255,255,255,0.1)",
                  }}>
                    <div style={{ wordBreak: "break-word" }}>{msg.texto}</div>
                    <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", textAlign: "right", marginTop: 4 }}>
                      {fmtHora(msg.createdAt)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={ENVIAR_MSG} style={{
            padding: "10px 16px", background: "rgba(255,255,255,0.03)",
            borderTop: "1px solid rgba(255,255,255,0.1)",
            display: "flex", gap: 8, alignItems: "center", flexDirection: "column",
          }}>
            <div style={{ display: "flex", gap: 8, overflowX: "auto", width: "100%", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
              {QUICK_REPLIES.map((qr, i) => (
                <button key={i} onClick={() => enviarQR(qr)} style={{
                  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 20, padding: "5px 12px", fontSize: "0.75rem",
                  color: "#fff", cursor: "pointer", whiteSpace: "nowrap",
                  fontFamily: "'Outfit', sans-serif", flexShrink: 0,
                }}>{qr.texto}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, width: "100%" }}>
              <input value={chatTexto} onChange={e => setChatTexto(e.target.value)}
                placeholder="Digite..." style={{
                  flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 24, padding: "10px 16px", color: "#fff",
                  fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", outline: "none",
              }} />
              <button type="submit" disabled={!chatTexto.trim() || enviando} style={{
                width: 44, height: 44, background: chatTexto.trim() ? "#7c3aed" : "rgba(255,255,255,0.1)",
                border: "none", borderRadius: "50%", cursor: chatTexto.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", color: "#fff",
              }}>➤</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

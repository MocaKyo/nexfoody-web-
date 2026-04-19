// src/components/ChatEntregador.js — Chat com entregador e localização em tempo real
import React, { useState, useEffect, useRef } from "react";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  setDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

// ── Quick Replies ──────────────────────────────────────────
const QUICK_REPLIES_CLIENTE = [
  { texto: "📍 Onde você está?", tipo: "pergunta" },
  { texto: "Pode hur@?", tipo: "normal" },
  { texto: "Obrigado!", tipo: "normal" },
];

// ── Auto mensagens de status ──────────────────────────────
const AUTO_MENSAGENS = {
  confirmado: "✅ Seu pedido foi confirmado!",
  preparo: "🫐 Preparando seu pedido...",
  pronto: "🎉 Pedido pronto!",
  entrega: "🛵 Saiu para entrega!",
  entregue: "✅ Pedido entregue! Bom apetite!",
  cancelado: "❌ Pedido cancelado.",
};

// ── Mini Mapa de Localização ───────────────────────────────
function MiniMapaLocal({ latitude, longitude, entregadorNome, onExpirou }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (window.L) {
      setMapLoaded(true);
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
    const map = window.L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      touchZoom: false,
    }).setView([latitude, longitude], 15);
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);
    const icon = window.L.divIcon({
      html: "🛵",
      className: "",
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });
    markerRef.current = window.L.marker([latitude, longitude], { icon }).addTo(map);
    mapInstanceRef.current = map;
  }, [mapLoaded]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([latitude, longitude]);
    mapInstanceRef.current.panTo([latitude, longitude], { animate: true });
  }, [latitude, longitude]);

  return (
    <div
      style={{
        margin: "8px 0",
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--border)",
        position: "relative",
      }}
    >
      <div ref={mapRef} style={{ height: 160, background: "var(--bg3)" }} />
      <div
        style={{
          position: "absolute",
          bottom: 8,
          left: 8,
          background: "rgba(0,0,0,0.7)",
          color: "#fff",
          borderRadius: 8,
          padding: "4px 8px",
          fontSize: "0.65rem",
        }}
      >
        🛵 {entregadorNome || "Entregador"} — localização ao vivo
      </div>
      {onExpirou && (
        <div
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            background: "rgba(239,68,68,0.9)",
            color: "#fff",
            borderRadius: 8,
            padding: "4px 8px",
            fontSize: "0.65rem",
          }}
        >
          Expirando em breve
        </div>
      )}
    </div>
  );
}

// ── Formatar hora ──────────────────────────────────────────
function formatarHora(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Componente Principal ───────────────────────────────────
export default function ChatEntregador({ pedidoId, entregadorId, onClose }) {
  const { user } = useAuth();
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [localizacao, setLocalizacao] = useState(null);
  const [solicitouLocal, setSolicitouLocal] = useState(false);
  const [mostrarQR, setMostrarQR] = useState(true);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const unsubLocalRef = useRef(null);

  // Carregar mensagens em tempo real
  useEffect(() => {
    if (!pedidoId) return;
    const q = query(
      collection(db, "chats", pedidoId, "mensagens"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMensagens(msgs);
    });
    return unsub;
  }, [pedidoId]);

  // Scroll para última mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Escutar documento de localização do chat
  useEffect(() => {
    if (!pedidoId) return;
    const chatDoc = doc(db, "chats", pedidoId);
    const unsub = onSnapshot(chatDoc, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.localizacao && data.localizacao.expiresAt > Date.now()) {
          setLocalizacao(data.localizacao);
        } else if (data.localizacao?.expiresAt && data.localizacao.expiresAt <= Date.now()) {
          setLocalizacao(null);
        }
      }
    });
    return unsub;
  }, [pedidoId]);

  // Solicitar localização ao entregador
  const solicitarLocalizacao = async () => {
    await addDoc(collection(db, "chats", pedidoId, "mensagens"), {
      texto: "📍 O cliente pediu para compartilhar a localização",
      senderId: user.uid,
      senderType: "cliente",
      tipo: "local_solicitado",
      createdAt: serverTimestamp(),
    });
    setSolicitouLocal(true);
  };

  // Enviar mensagem de texto
  const enviar = async (e) => {
    e?.preventDefault();
    if (!texto.trim() || enviando) return;
    setEnviando(true);
    const txt = texto.trim();
    setTexto("");
    try {
      await addDoc(collection(db, "chats", pedidoId, "mensagens"), {
        texto: txt,
        senderId: user.uid,
        senderType: "cliente",
        tipo: "normal",
        createdAt: serverTimestamp(),
      });
      inputRef.current?.focus();
    } catch (err) {
      console.error(err);
    } finally {
      setEnviando(false);
    }
  };

  // Quick reply
  const enviarQR = async (qr) => {
    if (qr.tipo === "pergunta") {
      await solicitarLocalizacao();
      return;
    }
    await addDoc(collection(db, "chats", pedidoId, "mensagens"), {
      texto: qr.texto,
      senderId: user.uid,
      senderType: "cliente",
      tipo: "normal",
      createdAt: serverTimestamp(),
    });
  };

  // MinhaLocalizacaoBtn
  const MinhaLocalizacaoBtn = () => {
    if (!navigator.geolocation) return null;
    const compartilharMinha = () => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const expiresAt = Date.now() + 5 * 60 * 1000;
        await setDoc(
        doc(db, "chats", pedidoId),
        { localizacao: { latitude: pos.coords.latitude, longitude: pos.coords.longitude, expiresAt } },
        { merge: true }
        );
        await addDoc(collection(db, "chats", pedidoId, "mensagens"), {
          texto: "📍 Minha localização",
          senderId: user.uid,
          senderType: "cliente",
          tipo: "local_cliente",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          createdAt: serverTimestamp(),
        });
      }, () => {});
    };
    return (
      <button
        onClick={compartilharMinha}
        style={{
          background: "var(--bg2)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "4px 10px",
          cursor: "pointer",
          fontSize: "0.7rem",
          color: "var(--text2)",
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        📍 Minha localização
      </button>
    );
  };

  const isMine = (msg) => msg.senderId === user.uid;
  const isEntregador = (msg) => msg.senderId === entregadorId;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          background: "var(--bg2)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "1.2rem",
            padding: 4,
          }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            💬 Chat com entregador
          </div>
          <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
            Pedido #{pedidoId?.slice(-4)}
          </div>
        </div>
        {localizacao && (
          <div
            style={{
              background: "rgba(34,197,94,0.15)",
              color: "var(--green)",
              borderRadius: 8,
              padding: "3px 8px",
              fontSize: "0.68rem",
              fontWeight: 700,
            }}
          >
            ● Localização ao vivo
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {mensagens.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "var(--text3)",
              fontSize: "0.82rem",
              marginTop: 40,
            }}
          >
            👋 Comece a conversa!
            {solicitouLocal && (
              <span style={{ color: "var(--purple2)" }}>
                Aguardando entregador aceitar...
              </span>
            )}
          </div>
        )}

        {mensagens.map((msg) => {
          const mine = isMine(msg);

          // Status auto — mensagens centralizadas cinzas
          if (msg.tipo === "status_auto") {
            const textoAuto = AUTO_MENSAGENS[msg.status];
            return (
              <div
                key={msg.id}
                style={{
                  textAlign: "center",
                  fontSize: "0.75rem",
                  color: "var(--text3)",
                  margin: "4px 0",
                }}
              >
                {textoAuto || msg.texto}
              </div>
            );
          }

          // Local solicitado
          if (msg.tipo === "local_solicitado") {
            return (
              <div
                key={msg.id}
                style={{
                  textAlign: "center",
                  fontSize: "0.72rem",
                  color: mine ? "var(--purple2)" : "var(--text3)",
                  margin: "4px 0",
                }}
              >
                {mine ? "📍 Você pediu a localização" : "📍 Cliente pediu sua localização"}
              </div>
            );
          }

          // Local encerrado
          if (msg.tipo === "local_encerrado") {
            return (
              <div
                key={msg.id}
                style={{
                  textAlign: "center",
                  fontSize: "0.72rem",
                  color: "var(--text3)",
                  margin: "4px 0",
                }}
              >
                📍 Localização encerrada
              </div>
            );
          }

          // Local compartilhado pelo entregador — mostra mini mapa
          if (msg.tipo === "local_compartilhado" && isEntregador(msg)) {
            return (
              <div key={msg.id}>
                <MiniMapaLocal
                  latitude={msg.latitude}
                  longitude={msg.longitude}
                  onExpirou={msg.expiresAt && msg.expiresAt - Date.now() < 60000}
                  entregadorNome="Entregador"
                />
              </div>
            );
          }

          // Local do cliente — mostra mini mapa
          if (msg.tipo === "local_cliente" && mine) {
            return (
              <div key={msg.id}>
                <div
                  style={{
                    fontSize: "0.65rem",
                    color: "var(--text3)",
                    marginBottom: 4,
                    textAlign: "right",
                  }}
                >
                  Sua localização
                </div>
                <MiniMapaLocal
                  latitude={msg.latitude}
                  longitude={msg.longitude}
                  entregadorNome="Você"
                />
              </div>
            );
          }

          // Bolha normal
          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
              }}
            >
              <div
                style={{
                  maxWidth: "78%",
                  background: mine ? "var(--purple2)" : "var(--bg2)",
                  color: mine ? "#fff" : "var(--text)",
                  borderRadius:
                    mine ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  padding: "10px 14px",
                  fontSize: "0.88rem",
                  lineHeight: 1.4,
                  border: mine ? "none" : "1px solid var(--border)",
                }}
              >
                <div style={{ wordBreak: "break-word" }}>{msg.texto}</div>
                <div
                  style={{
                    fontSize: "0.62rem",
                    color: mine ? "rgba(255,255,255,0.6)" : "var(--text3)",
                    textAlign: "right",
                    marginTop: 4,
                  }}
                >
                  {formatarHora(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}

        {/* Mini Mapa Persistente quando localizacao do entregador está ativa */}
        {localizacao && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ maxWidth: "78%" }}>
              <MiniMapaLocal
                latitude={localizacao.latitude}
                longitude={localizacao.longitude}
                onExpirou={localizacao.expiresAt - Date.now() < 60000}
                entregadorNome="Entregador"
              />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Quick Replies */}
      {mostrarQR && (
        <div
          style={{
            padding: "8px 16px 0",
            background: "var(--bg)",
            display: "flex",
            gap: 8,
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {QUICK_REPLIES_CLIENTE.map((qr, i) => (
            <button
              key={i}
              onClick={() => {
                enviarQR(qr);
                setMostrarQR(false);
              }}
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 20,
                padding: "6px 14px",
                fontSize: "0.78rem",
                color: "var(--text)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "'Outfit', sans-serif",
                flexShrink: 0,
              }}
            >
              {qr.texto}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form
        onSubmit={enviar}
        style={{
          padding: "10px 16px",
          background: "var(--bg2)",
          borderTop: "1px solid var(--border)",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <MinhaLocalizacaoBtn />
        <input
          ref={inputRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Digite..."
          style={{
            flex: 1,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 24,
            padding: "10px 16px",
            color: "var(--text)",
            fontFamily: "'Outfit', sans-serif",
            fontSize: "0.88rem",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          style={{
            width: 44,
            height: 44,
            background: texto.trim() ? "var(--purple2)" : "var(--bg3)",
            border: "none",
            borderRadius: "50%",
            cursor: texto.trim() ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.2rem",
          }}
        >
          ➤
        </button>
      </form>
    </div>
  );
}

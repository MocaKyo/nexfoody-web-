// src/components/PainelChatDual.tsx — Painel lateral com 2 abas: Entregador + Cliente
import React, { useState, useEffect, useRef } from "react";
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc } from "firebase/firestore";
import { db } from "../lib/firebase";

// ── Tipos ────────────────────────────────────────────────
interface Mensagem {
  id: string;
  texto?: string;
  senderType?: string;
  autorId?: string;
  tipo?: string;
  latitude?: number;
  longitude?: number;
  autorNome?: string;
  createdAt?: { toDate?: () => Date };
}

interface Localizacao {
  latitude: number;
  longitude: number;
  expiresAt: number;
}

interface Entregador {
  nome?: string;
  telefone?: string;
  ativo?: boolean;
}

interface Pedido {
  id: string;
  status?: string;
}

interface QuickReply {
  texto: string;
  tipo: string;
}

// ── Mini Mapa de Localização ─
function MiniMapaLocal({ latitude, longitude, entregadorNome, expirando }: {
  latitude: number; longitude: number; entregadorNome?: string; expirando?: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (window.L) { setMapLoaded(true); return; }
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
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    const icon = window.L.divIcon({ html: "🛵", className: "", iconSize: [32, 32], iconAnchor: [16, 32] });
    markerRef.current = window.L.marker([latitude, longitude], { icon }).addTo(map);
    mapInstanceRef.current = map;
  }, [mapLoaded]);

  useEffect(() => {
    if (!mapInstanceRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([latitude, longitude]);
    mapInstanceRef.current.panTo([latitude, longitude], { animate: true });
  }, [latitude, longitude]);

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", position: "relative", background: "var(--bg3)" }}>
      <div ref={mapRef} style={{ height: 140, background: "var(--bg3)" }} />
      <div style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(0,0,0,0.7)", color: "#fff", borderRadius: 8, padding: "4px 8px", fontSize: "0.65rem" }}>
        🛵 {entregadorNome || "Entregador"}
      </div>
      {expirando && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(239,68,68,0.9)", color: "#fff", borderRadius: 8, padding: "4px 8px", fontSize: "0.65rem" }}>
          Expirando
        </div>
      )}
    </div>
  );
}

// ── Formatar hora ─
function formatarHora(ts: Mensagem["createdAt"]) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts as any);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Quick Replies ──
const QUICK_REPLIES_ENTREGADOR: QuickReply[] = [
  { texto: "📍 Onde você está?", tipo: "pergunta" },
  { texto: "✅ Pedido recebido!", tipo: "normal" },
  { texto: "Pode chegar!", tipo: "normal" },
];

const QUICK_REPLIES_CLIENTE: QuickReply[] = [
  { texto: "📋 Já estamos preparando!", tipo: "normal" },
  { texto: "⚡ Já sai!", tipo: "normal" },
  { texto: "✅ Pode chegar!", tipo: "normal" },
];

// ── Componente Principal ─
export default function PainelChatDual({ pedido, entregador, tenantId }: {
  pedido: Pedido | null; entregador: Entregador | null; tenantId: string;
}) {
  const [aba, setAba] = useState<"entregador" | "cliente">("entregador");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [localizacao, setLocalizacao] = useState<Localizacao | null>(null);
  const [enviouLocal, setEnviouLocal] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pedidoId = pedido?.id;

  const statusInfo: Record<string, string> = { pendente: "#f5c518", preparo: "#60a5fa", entrega: "#f97316", entregue: "#6b7280" };
  const corStatus = statusInfo[pedido?.status || ""] || "#f5c518";

  // Carregar mensagens em tempo real
  useEffect(() => {
    if (!pedidoId) return;
    const q = query(collection(db, "chats", pedidoId, "mensagens"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Mensagem));
      setMensagens(msgs);
    });
    return unsub;
  }, [pedidoId]);

  // Escutar localização do entregador
  useEffect(() => {
    if (!pedidoId) return;
    const chatDocRef = doc(db, "chats", pedidoId);
    const unsub = onSnapshot(chatDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data() as any;
        if (data.localizacao?.expiresAt > Date.now()) {
          setLocalizacao(data.localizacao as Localizacao);
        }
      }
    });
    return unsub;
  }, [pedidoId]);

  // Scroll para última mensagem
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);

  // Solicitar localização ao entregador
  const solicitarLocalizacao = async () => {
    if (!pedidoId) return;
    await addDoc(collection(db, "chats", pedidoId, "mensagens"), {
      texto: "📍 A loja pediu para você compartilhar sua localização",
      senderId: `loja_${tenantId}`,
      senderType: "loja",
      tipo: "local_solicitado",
      createdAt: serverTimestamp(),
    });
    setEnviouLocal(true);
  };

  // Enviar mensagem
  const enviar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!texto.trim() || enviando || !pedidoId) return;
    setEnviando(true);
    const txt = texto.trim();
    setTexto("");
    try {
      await addDoc(collection(db, "chats", pedidoId, "mensagens"), {
        texto: txt,
        senderId: `loja_${tenantId}`,
        senderType: "loja",
        tipo: "normal",
        createdAt: serverTimestamp(),
      });
      inputRef.current?.focus();
    } catch (err) { console.error(err); }
    finally { setEnviando(false); }
  };

  // Quick reply
  const enviarQR = async (qr: QuickReply) => {
    if (!pedidoId) return;
    if (qr.tipo === "pergunta") { await solicitarLocalizacao(); return; }
    await addDoc(collection(db, "chats", pedidoId, "mensagens"), {
      texto: qr.texto,
      senderId: `loja_${tenantId}`,
      senderType: "loja",
      tipo: "normal",
      createdAt: serverTimestamp(),
    });
  };

  const expirando = localizacao?.expiresAt && (localizacao.expiresAt - Date.now()) < 60000;
  const qrList = aba === "entregador" ? QUICK_REPLIES_ENTREGADOR : QUICK_REPLIES_CLIENTE;

  // ABA ENTREGADOR: só loja ⇄ entregador
  // ABA CLIENTE: conversa completa (cliente + bot IA + loja) — operador se antecipa
  const msgsFiltradas = aba === "entregador"
    ? mensagens.filter(msg => msg.senderType === "entregador" || msg.senderType === "loja" || !msg.senderType)
    : mensagens;

  if (!pedido) {
    return (
      <div style={{
        width: 300, flexShrink: 0, background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 12, textAlign: "center",
      }}>
        <span style={{ fontSize: "2.5rem" }}>💬</span>
        <div style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.5 }}>
          Selecione um pedido para ver os chats
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: 300, flexShrink: 0, background: "var(--bg2)", border: "1px solid var(--border)",
      borderRadius: 16, overflow: "hidden", display: "flex", flexDirection: "column",
      maxHeight: "calc(100vh - 120px)", borderLeft: `3px solid ${corStatus}`,
    }}>
      {/* Abas */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        <button
          onClick={() => setAba("entregador")}
          style={{
            flex: 1, padding: "10px 8px",
            background: aba === "entregador" ? "var(--surface)" : "transparent",
            border: "none", borderBottom: `2px solid ${aba === "entregador" ? "#f97316" : "transparent"}`,
            color: aba === "entregador" ? "#f97316" : "var(--text3)",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          🛵 Entregador
        </button>
        <button
          onClick={() => setAba("cliente")}
          style={{
            flex: 1, padding: "10px 8px",
            background: aba === "cliente" ? "var(--surface)" : "transparent",
            border: "none", borderBottom: `2px solid ${aba === "cliente" ? "var(--green)" : "transparent"}`,
            color: aba === "cliente" ? "var(--green)" : "var(--text3)",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          💬 Cliente
        </button>
      </div>

      {/* Mapa — só aba entregador */}
      {aba === "entregador" && (
        localizacao ? (
          <div style={{ padding: "8px 10px" }}>
            <MiniMapaLocal latitude={localizacao.latitude} longitude={localizacao.longitude} entregadorNome={entregador?.nome || "Entregador"} expirando={!!expirando} />
          </div>
        ) : (
          <div style={{ padding: "8px 10px", textAlign: "center", fontSize: "0.72rem", color: "var(--text3)", background: "var(--bg3)", margin: "8px 10px", borderRadius: 10 }}>
            📍 {entregador?.ativo ? "Aguardando localização..." : "Entregador offline"}
          </div>
        )
      )}

      {/* Chat */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6, minHeight: 0 }}>
        {msgsFiltradas.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text3)", fontSize: "0.78rem", marginTop: 16 }}>
            👋 Sem mensagens ainda
          </div>
        )}
        {msgsFiltradas.map((msg) => {
          const isLoja = msg.senderType === "loja";
          const isCliente = msg.senderType === "cliente";
          const isBot = msg.autorId?.includes("bot") || (msg.texto && msg.texto.startsWith("🤖"));
          if (msg.tipo === "local_solicitado") return (
            <div key={msg.id} style={{ textAlign: "center", fontSize: "0.68rem", color: "var(--text3)", margin: "4px 0" }}>
              📍 {isLoja ? "Loja pediu localização" : "Entregador recebeu pedido de localização"}
            </div>
          );
          if (msg.tipo?.startsWith("local_") && msg.latitude) return (
            <MiniMapaLocal latitude={msg.latitude!} longitude={msg.longitude!} entregadorNome={isLoja ? "Você" : msg.autorNome || "Entregador"} expirando={false} />
          );
          const isMensagemLoja = isLoja;
          const isMensagemBot = isBot && !isLoja;
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: isMensagemLoja ? "flex-end" : "flex-start", flexDirection: "column", alignItems: isMensagemLoja ? "flex-end" : "flex-start" }}>
              {aba === "cliente" && (
                <div style={{ fontSize: "0.58rem", color: isMensagemBot ? "#a855f7" : isCliente ? "var(--green)" : "var(--text3)", marginBottom: 2, marginLeft: 4 }}>
                  {isMensagemBot ? "🤖 Bot" : isCliente ? "👤 Cliente" : "🏪 Loja"}
                </div>
              )}
              <div style={{
                maxWidth: "85%",
                background: isMensagemLoja ? "var(--purple2)" : "var(--surface)",
                color: isMensagemLoja ? "#fff" : "var(--text)",
                borderRadius: isMensagemLoja ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                padding: "8px 12px", fontSize: "0.8rem", border: isMensagemLoja ? "none" : "1px solid var(--border)",
              }}>
                <div style={{ wordBreak: "break-word" }}>{msg.texto}</div>
                <div style={{ fontSize: "0.6rem", color: isMensagemLoja ? "rgba(255,255,255,.6)" : "var(--text3)", textAlign: "right", marginTop: 3 }}>
                  {formatarHora(msg.createdAt)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies */}
      <div style={{ padding: "6px 10px", display: "flex", gap: 6, flexWrap: "wrap", borderTop: "1px solid var(--border)" }}>
        {qrList.map((qr) => (
          <button key={qr.texto} onClick={() => enviarQR(qr)} style={{
            background: "var(--bg3)", border: "1px solid var(--border2)", borderRadius: 20,
            padding: "4px 10px", fontSize: "0.68rem", fontWeight: 600, color: "var(--text2)",
            cursor: "pointer", fontFamily: "'Outfit', sans-serif",
          }}>
            {qr.texto}
          </button>
        ))}
      </div>

      {/* Input de mensagem */}
      <form onSubmit={enviar} style={{ padding: "8px 10px", display: "flex", gap: 6, borderTop: "1px solid var(--border)" }}>
        <input
          ref={inputRef}
          value={texto}
          onChange={e => setTexto(e.target.value)}
          placeholder={aba === "entregador" ? "Msg p/ entregador..." : "Msg p/ cliente..."}
          style={{
            flex: 1, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 20,
            padding: "8px 12px", fontSize: "0.8rem", color: "var(--text)", fontFamily: "'Outfit', sans-serif",
            outline: "none",
          }}
        />
        <button type="submit" disabled={enviando || !texto.trim()} style={{
          background: "var(--purple2)", border: "none", borderRadius: "50%", width: 36, height: 36,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1rem", opacity: enviando || !texto.trim() ? 0.5 : 1,
        }}>
          ➤
        </button>
      </form>
    </div>
  );
}

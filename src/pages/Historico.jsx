// src/pages/Historico.js
import React, { useEffect, useState, useRef } from "react";
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, updateDoc, serverTimestamp, increment, addDoc, getDocs, getDoc } from "firebase/firestore";
import { ref as refStorage, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db } from "../lib/firebase";
import { storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useFCM } from "../hooks/useFCM";
import { useNavigate } from "react-router-dom";
import { useStore } from "../contexts/StoreContext";
import { useToast } from "../components/Toast";
import RastreamentoEntrega from "../components/RastreamentoEntrega";
import ChatEntregador from "../components/ChatEntregador";
import Comprovante from "../components/Comprovante";

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

function uploadFotoAvaliacao(file, onProgress) {
  return new Promise((resolve) => {
    comprimirImagem(file).then(comprimida => {
      const nomeArquivo = `avaliacoes/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
      const storageRef = refStorage(storage, nomeArquivo);
      const task = uploadBytesResumable(storageRef, comprimida);
      task.on("state_changed",
        snap => onProgress && onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
        () => resolve(null),
        async () => { const url = await getDownloadURL(task.snapshot.ref); resolve(url); }
      );
    });
  });
}

const STATUS_INFO = {
  pendente:   { label: "Pendente",        color: "var(--gold)",    bg: "rgba(245,197,24,0.1)",  icon: "⏳" },
  confirmado: { label: "Confirmado",      color: "#60a5fa",        bg: "rgba(96,165,250,0.1)",  icon: "✅" },
  preparo:    { label: "Em preparo",      color: "var(--purple2)", bg: "rgba(138,92,246,0.1)",  icon: "🫐" },
  pronto:     { label: "Pronto",          color: "var(--green)",   bg: "rgba(34,197,94,0.1)",   icon: "🎉" },
  entrega:    { label: "Saiu p/ entrega", color: "#f97316",        bg: "rgba(249,115,22,0.1)",  icon: "🛵" },
  entregue:   { label: "Entregue",        color: "var(--green)",   bg: "rgba(34,197,94,0.1)",   icon: "✅" },
  cancelado:  { label: "Cancelado",       color: "var(--red)",     bg: "rgba(239,68,68,0.1)",   icon: "❌" },
};

const TIMELINE_STATUSES = ["pendente", "confirmado", "preparo", "pronto", "entrega", "entregue"];

function calcularETA(pedido, config) {
  const tempoMin = parseInt(config?.tempoMin) || 30;
  const tempoMax = parseInt(config?.tempoMax) || 45;
  const tempoEntrega = Math.round((tempoMin + tempoMax) / 2);
  const criado = pedido.createdAt?.toDate ? pedido.createdAt.toDate() : new Date(pedido.createdAt?.seconds ? new Date(pedido.createdAt.seconds * 1000) : new Date());
  const agora = new Date();
  const decorridoMin = Math.round((agora - criado) / 60000);
  const duracoes = {
    pendente:   tempoMax,
    confirmado: tempoMax,
    preparo:     tempoMax + 15,
    pronto:      tempoMax + 15 + tempoEntrega,
    entrega:     Math.max(1, (tempoMax + 15 + tempoEntrega) - decorridoMin),
    entregue:    0,
    cancelado:   0,
  };
  const total = duracoes[pedido.status] || tempoMax;
  return Math.max(0, total - decorridoMin);
}

function TimelinePedido({ status, eta, tipoEntrega }) {
  const [etaAtual, setEtaAtual] = useState(eta);
  useEffect(() => {
    setEtaAtual(eta);
    const t = setInterval(() => setEtaAtual(prev => Math.max(0, prev - 1)), 30000);
    return () => clearInterval(t);
  }, [eta]);
  const currentIndex = TIMELINE_STATUSES.indexOf(status);
  const isCancelado = status === "cancelado";
  const frasesDinamicas = {
    pendente:   etaAtual > 0 ? `⏳ ~${etaAtual} min para confirmar` : "Aguardando confirmação...",
    confirmado: etaAtual > 0 ? `⏳ ~${etaAtual} min para ficar pronto` : "Pedido confirmado! 🎉",
    preparo:    etaAtual > 0 ? `🫐 ~${etaAtual} min para ficar pronto` : "Preparando seu pedido... 🫐",
    pronto:     tipoEntrega === "entrega" ? (etaAtual > 0 ? `🛵 ~${etaAtual} min para chegar` : "Saiu para entrega! 🛵") : "Pronto! Pode retirar! 🎉",
    entrega:    etaAtual > 0 ? `🛵 ~${etaAtual} min para chegar` : "Saiu para entrega! 🛵",
    entregue:   "Entregue! Bom apetite! 😋",
    cancelado:  "Pedido cancelado",
  };
  return (
    <div style={{ padding: "12px 0 16px" }}>
      <div style={{ textAlign: "center", marginBottom: 14, fontSize: "0.82rem", color: isCancelado ? "var(--red)" : "var(--text2)", fontWeight: 500 }}>
        {frasesDinamicas[status]}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", padding: "0 8px" }}>
        <div style={{ position: "absolute", top: 14, left: 28, right: 28, height: 2, background: "var(--border)", zIndex: 0 }} />
        {!isCancelado && currentIndex >= 0 && (
          <div style={{ position: "absolute", top: 14, left: 28, width: `calc(${(currentIndex / (TIMELINE_STATUSES.length - 1)) * 100}% - 0px)`, height: 2, background: "var(--purple2)", zIndex: 1, transition: "width 0.4s ease" }} />
        )}
        {TIMELINE_STATUSES.map((s, i) => {
          const info = STATUS_INFO[s];
          const isActive = i <= currentIndex && !isCancelado;
          const isCurrent = i === currentIndex && !isCancelado;
          return (
            <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: isActive ? info.color : "var(--bg3)", border: `2px solid ${isActive ? info.color : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", transition: "all 0.3s ease", boxShadow: isCurrent ? `0 0 12px ${info.color}66` : "none" }}>
                {isActive ? info.icon : ""}
              </div>
              <span style={{ fontSize: "0.58rem", marginTop: 4, fontWeight: isCurrent ? 700 : 400, color: isActive ? info.color : "var(--text3)" }}>
                {info.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== SONS DO CLIENTE =====
function useSomCliente() {
  const ctxRef = useRef(null);
  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };
  const tocarConfirmado = () => {
    try {
      const ctx = getCtx();
      [659, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "sine";
        const t = ctx.currentTime + i * 0.2;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.35, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t); osc.stop(t + 0.46);
      });
    } catch (e) { console.warn("Som indisponível"); }
  };
  const tocarEntrega = () => {
    try {
      const ctx = getCtx();
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "triangle";
        const t = ctx.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t); osc.stop(t + 0.32);
      });
    } catch (e) { console.warn("Som indisponível"); }
  };
  const tocarCancelado = () => {
    try {
      const ctx = getCtx();
      [440, 330].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "sine";
        const t = ctx.currentTime + i * 0.25;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t); osc.stop(t + 0.42);
      });
    } catch (e) { console.warn("Som indisponível"); }
  };
  return { tocarConfirmado, tocarEntrega, tocarCancelado };
}

function formatarData(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function StatusBanner({ status, onClose }) {
  const info = STATUS_INFO[status];
  if (!info) return null;
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);
  return (
    <div style={{
      position: "fixed", top: 70, left: 16, right: 16, zIndex: 9999,
      background: `linear-gradient(135deg, ${info.bg}, var(--bg2))`,
      border: `1px solid ${info.color}55`,
      borderRadius: "var(--radius)", padding: "14px 16px",
      display: "flex", alignItems: "center", gap: 12,
      boxShadow: `0 8px 32px ${info.color}33`,
      animation: "slideDown 0.4s ease",
    }}>
      <style>{`@keyframes slideDown { from { opacity:0; transform:translateY(-20px); } to { opacity:1; transform:translateY(0); } }`}</style>
      <span style={{ fontSize: "1.8rem" }}>{info.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: info.color, fontSize: "0.95rem" }}>Pedido atualizado!</div>
        <div style={{ fontSize: "0.82rem", color: "var(--text2)", marginTop: 2 }}>
          {status === "confirmado" && "Seu pedido foi confirmado! 🎉"}
          {status === "preparo" && "Seu açaí está sendo preparado! 🫐"}
          {status === "pronto" && "Pedido pronto! Pode retirar! 🎉"}
          {status === "entrega" && "Seu pedido saiu para entrega! 🛵"}
          {status === "entregue" && "Pedido entregue! Bom apetite! 😋"}
          {status === "cancelado" && "Pedido cancelado. Entre em contato."}
        </div>
      </div>
      <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.1rem" }}>✕</button>
    </div>
  );
}

// --- PedidoCard component ---
function PedidoCard({ p, expanded, onToggle, avaliacoesData, avaliados, config, st }) {
  const { setChatAberto, setComprovanteAberto, setAvaliacaoPrivModal, handlePedirNovamente, setCancelModal, handleAbrirSuporte, entregadorData, calcularETA, formatarData } = PedidoCard;
  return null; // placeholder
}

// --- Renderização de um card de pedido (comum a ativos e entregados) ---
function PedidoCardInner({ p, expanded, onToggle, avaliacoesData, avaliados, config, entregadorData }) {
  const st = STATUS_INFO[p.status] || STATUS_INFO.pendente;
  const isAtivo = ["pendente", "confirmado", "preparo", "pronto", "entrega"].includes(p.status);
  const eta = isAtivo ? calcularETA(p, config) : 0;
  return (
    <div style={{ background: "linear-gradient(135deg, var(--bg3), var(--bg2))", border: `1px solid ${expanded ? "var(--border2)" : "var(--border)"}`, borderRadius: "var(--radius)", marginBottom: 10, overflow: "hidden", transition: "border-color 0.2s" }}>
      <div onClick={onToggle} style={{ padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
        {p.items?.[0]?.foto && <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "var(--bg)" }}><img src={p.items[0].foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{ background: st.bg, color: st.color, borderRadius: 8, padding: "4px 10px", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", gap: 4, border: `1px solid ${st.color}33` }}>
              {p.status === "entregue" && (avaliacoesData[p.id] || avaliados[p.id]) ? <span>⭐ {(avaliacoesData[p.id] || avaliados[p.id]).estrelas} · {st.label}</span> : <span>{st.icon} {st.label}</span>}
            </div>
            {isAtivo && eta > 0 && <div style={{ background: "rgba(138,92,246,0.15)", color: "var(--purple2)", borderRadius: 8, padding: "3px 8px", fontSize: "0.68rem", fontWeight: 700, border: "1px solid rgba(138,92,246,0.3)" }}>🕐 ~{eta} min</div>}
          </div>
          <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.items?.length === 1 ? p.items[0].nome : `${p.items?.[0]?.nome} +${p.items.length - 1}`}{p.tipoEntrega === "entrega" ? " · 🛵" : " · 🏠"}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 2 }}>{formatarData(p.createdAt)}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700, fontSize: "1rem" }}>R$ {p.total?.toFixed(2).replace(".", ",")}</div>
          {p.status === "entregue" && <button onClick={(e) => { e.stopPropagation(); handlePedirNovamente(p); }} style={{ marginTop: 6, padding: "4px 10px", background: "linear-gradient(135deg, #f5c518, #ff9800)", border: "2px solid #f5c518", borderRadius: 20, color: "#1a1a1a", fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "0.72rem", cursor: "pointer" }}>Novamente</button>}
          <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 4 }}>{expanded ? "▲" : "▼"}</div>
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "14px 16px" }}>
          {isAtivo && <div style={{ marginBottom: 12 }}><TimelinePedido status={p.status} eta={calcularETA(p, config)} tipoEntrega={p.tipoEntrega} /></div>}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Itens do pedido</div>
            {p.items?.map((item, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}><span style={{ color: "var(--text2)" }}>{item.qty}x {item.nome}</span><span style={{ fontWeight: 600 }}>R$ {(item.preco * item.qty).toFixed(2).replace(".", ",")}</span></div>)}
          </div>
          <div style={{ background: "var(--bg2)", borderRadius: "var(--radius-sm)", padding: "10px 12px", marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}><span style={{ color: "var(--text2)" }}>Pagamento</span><span style={{ fontWeight: 600, textTransform: "uppercase" }}>{p.pagamento}</span></div>
            {p.pontosGanhos > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}><span style={{ color: "var(--text2)" }}>Pontos ganhos</span><span style={{ color: "var(--gold)", fontWeight: 600 }}>+{p.pontosGanhos} pts</span></div>}
            {p.pontosUsados > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}><span style={{ color: "var(--text2)" }}>Pontos usados</span><span style={{ color: "var(--red)", fontWeight: 600 }}>−{p.pontosUsados} pts</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 6 }}><span style={{ fontWeight: 700 }}>Total</span><span style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700 }}>R$ {p.total?.toFixed(2).replace(".", ",")}</span></div>
          </div>
          {(p.status === "entrega" || p.status === "pronto") && <div style={{ marginBottom: 12 }}><RastreamentoEntrega entregadorLocalizacao={entregadorData[p.entregadorId]?.localizacao} entregadorNome={entregadorData[p.entregadorId]?.nome || p.entregadorNome} endereco={p.endereco} /></div>}
          {p.tipoEntrega === "entrega" && p.endereco && <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 8 }}>📍 {p.endereco}</div>}
          {p.obs && <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 8 }}>📝 {p.obs}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {p.entregadorId && <button onClick={(e) => { e.stopPropagation(); setChatAberto({ pedidoId: p.id, entregadorId: p.entregadorId }); }} style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: "#25D366", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>💬 Chat</button>}
            {config.suporteAtivo !== false && <button onClick={(e) => { e.stopPropagation(); handleAbrirSuporte(p); }} style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: "linear-gradient(135deg, #25D366, #128C7E)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>💬 Suporte</button>}
            {["pendente", "confirmado", "preparo"].includes(p.status) && <button onClick={(e) => { e.stopPropagation(); setCancelModal({ pedidoId: p.id, motivo: "" }); }} style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, color: "var(--red)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>❌ Cancelar</button>}
            <button onClick={(e) => { e.stopPropagation(); setComprovanteAberto(p); }} style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>🧾 Comprovante</button>
            {p.status === "entregue" && <button onClick={(e) => { e.stopPropagation(); setAvaliacaoPrivModal({ pedido: p }); }} style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>💬 Avaliação</button>}
            {p.status === "entregue" && <button onClick={(e) => { e.stopPropagation(); handlePedirNovamente(p); }} style={{ flex: 1, minWidth: 120, padding: "10px 14px", background: "linear-gradient(135deg, #f5c518, #ff9800)", border: "2px solid #f5c518", borderRadius: 20, color: "#1a1a1a", fontFamily: "'Outfit', sans-serif", fontWeight: 900, fontSize: "0.72rem", cursor: "pointer" }}>🔄 Novamente</button>}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Historico() {
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { restoreCartFromPedido, config } = useStore();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);
  const [banner, setBanner] = useState(null);
  const [aba, setAba] = useState("pedidos");
  const [favoritos, setFavoritos] = useState([]);
  const [avaliarPedido, setAvaliarPedido] = useState(null);
  const [avaliacoes, setAvaliacoes] = useState({});
  const [avalidados, setAvalidados] = useState(() => {
    try { return JSON.parse(localStorage.getItem("pedidosAvaliados") || "{}"); } catch { return {}; }
  });
  const [popupDismissed, setPopupDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("popupDismissed") || "{}"); } catch { return {}; }
  });
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [chatAberto, setChatAberto] = useState(null);
  const [avaliacaoPrivModal, setAvaliacaoPrivModal] = useState(null);
  const [avaliacoesPrivadas, setAvaliacoesPrivadas] = useState({});
  const [avaliacoesData, setAvaliacoesData] = useState({});
  const [cancelModal, setCancelModal] = useState(null);
  const [comprovanteAberto, setComprovanteAberto] = useState(null);
  const [suporteModal, setSuporteModal] = useState(null);
  const [entregadorData, setEntregadorData] = useState({});
  const [enderecoEditavel, setEnderecoEditavel] = useState(false);
  const pedidosAnteriores = useRef(null);
  const { tocarConfirmado, tocarEntrega, tocarCancelado } = useSomCliente();
  useFCM(user?.uid);
  const [avPrivData, setAvPrivData] = useState({ estrelas: 5, comentario: "", fotoFile: null, fotoUrl: null, enviando: false });

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "pedidos"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const novos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (pedidosAnteriores.current !== null) {
        novos.forEach(p => {
          const anterior = pedidosAnteriores.current.find(x => x.id === p.id);
          if (anterior && anterior.status !== p.status) {
            if (p.status === "confirmado") { tocarConfirmado(); setBanner("confirmado"); }
            else if (p.status === "preparo")  { tocarConfirmado(); setBanner("preparo"); }
            else if (p.status === "pronto")   { tocarEntrega();    setBanner("pronto"); }
            else if (p.status === "entrega")  { tocarEntrega();    setBanner("entrega"); }
            else if (p.status === "entregue") { tocarConfirmado(); setBanner("entregue"); }
            else if (p.status === "cancelado"){ tocarCancelado();  setBanner("cancelado"); }
          }
        });
      }
      pedidosAnteriores.current = novos;
      setPedidos(novos);
      setLoading(false);
    });
    return unsub;
  }, [user, tocarConfirmado, tocarEntrega, tocarCancelado]);

  useEffect(() => {
    if (!user) return;
    const entregueIds = (pedidos || []).filter(p => p.status === "entregue").map(p => p.id);
    if (entregueIds.length === 0) return;
    const unsubs = entregueIds.map(pid =>
      onSnapshot(doc(db, "avaliacoesPedidos", pid), snap => {
        if (snap.exists()) setAvaliacoesData(prev => ({ ...prev, [pid]: snap.data() }));
      })
    );
    return () => unsubs.forEach(u => u());
  }, [user, pedidos.length]);

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid)).then(snap => {
      if (snap.exists() && snap.data().favoritos) {
        const favObj = snap.data().favoritos;
        const favArray = Object.values(favObj);
        setFavoritos(favArray);
      } else {
        try {
          const local = JSON.parse(localStorage.getItem("produtosFavoritos") || "{}");
          const favArray = Object.values(local);
          setFavoritos(favArray);
        } catch {}
      }
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "avaliacoesPrivadas"), where("userId", "==", user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.data().pedidoId] = d.data(); });
      setAvaliacoesPrivadas(map);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "usuarios"), where("tipo", "==", "entregador"));
    const unsub = onSnapshot(q, snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.id] = d.data(); });
      setEntregadorData(prev => ({ ...prev, ...map }));
    });
    return () => unsub();
  }, [user]);

  const handlePedirNovamente = (pedido) => {
    try {
      const carrinho = [];
      (pedido.items || []).forEach(item => {
        if (item.complementos) {
          carrinho.push({ ...item, complementos: item.complementos.map(c => c.id || c) });
        } else {
          carrinho.push({ ...item });
        }
      });
      restoreCartFromPedido(carrinho);
      toast("Itens adicionados ao carrinho!");
      if (config?.tenantId) navigate(`/loja/${config.tenantId}/carrinho`);
    } catch (e) { toast("Erro ao pedir novamente", "error"); }
  };

  const handleAbrirSuporte = (pedido) => { setSuporteModal({ pedido }); };

  const handleCancelarPedido = async () => {
    if (!cancelModal?.motivo) { toast("Selecione um motivo", "error"); return; }
    try {
      await updateDoc(doc(db, "pedidos", cancelModal.pedidoId), { status: "cancelado", motivoCancelamento: cancelModal.motivo });
      setCancelModal(null);
      toast("Pedido cancelado");
    } catch (e) { toast("Erro ao cancelar", "error"); }
  };

  const handleEnviarAvaliacaoPrivada = async () => {
    if (!avaliacaoPrivModal?.pedido) return;
    setAvPrivData(prev => ({ ...prev, enviando: true }));
    try {
      let fotoUrl = "";
      if (avPrivData.fotoFile) { fotoUrl = await uploadFotoAvaliacao(avPrivData.fotoFile); }
      await addDoc(collection(db, "avaliacoesPrivadas"), {
        pedidoId: avaliacaoPrivModal.pedido.id,
        userId: user.uid,
        nomeCliente: user.displayName || userData?.nome || "Cliente",
        estrelas: avPrivData.estrelas,
        comentario: avPrivData.comentario,
        foto: fotoUrl,
        createdAt: serverTimestamp(),
      });
      setAvaliacaoPrivModal(null);
      setAvPrivData({ estrelas: 5, comentario: "", fotoFile: null, fotoUrl: null, enviando: false });
      toast("Avaliação enviada!");
    } catch (e) { toast("Erro: " + (e?.message || ""), "error"); }
    finally { setAvPrivData(prev => ({ ...prev, enviando: false })); }
  };

  if (loading) return (
    <div className="loading-screen" style={{ minHeight: "60vh" }}>
      <div className="spinner" />
    </div>
  );

  const ativos = pedidos.filter(p => ["pendente","confirmado","preparo","pronto","entrega"].includes(p.status));
  const entregados = pedidos.filter(p => ["entregue", "cancelado"].includes(p.status));
  const countAtivos = ativos.length;

  return (
    <div className="page">
      {banner && <StatusBanner status={banner} onClose={() => setBanner(null)} />}

      <h2 className="display-title mb-4">Meus <span>Pedidos</span></h2>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
        <button onClick={() => setAba("pedidos")} style={{ padding: "8px 20px", background: aba === "pedidos" ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, color: aba === "pedidos" ? "#fff" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
          📋 Ativos {countAtivos > 0 && <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 10, padding: "1px 6px", fontSize: "0.7rem" }}>{countAtivos}</span>}
        </button>
        <button onClick={() => setAba("entregues")} style={{ padding: "8px 20px", background: aba === "entregues" ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, color: aba === "entregues" ? "#fff" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
          ✅ Entregues
        </button>
        <button onClick={() => setAba("favoritos")} style={{ padding: "8px 20px", background: aba === "favoritos" ? "linear-gradient(135deg, #dc2626, #991b1b)" : "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, color: aba === "favoritos" ? "#fff" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>
          ❤️ Favoritos
        </button>
      </div>

      {/* ===== ABA FAVORITOS ===== */}
      {aba === "favoritos" && (
        favoritos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text2)" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>💔</div>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum favorito ainda</p>
            <p className="text-sm">Toque no ❤️ nos produtos do cardápio para adicioná-los aqui.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {favoritos.map((fav, i) => (
              <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                {fav.foto && <img src={fav.foto} alt={fav.nome} style={{ width: "100%", aspectRatio: "1", objectFit: "cover" }} />}
                <div style={{ padding: "10px" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{fav.nome}</div>
                  <div style={{ color: "var(--gold)", fontFamily: "'Fraunces', serif", fontSize: "0.88rem" }}>R$ {fav.preco?.toFixed(2).replace(".", ",")}</div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* ===== ABA ENTREGUES ===== */}
      {aba === "entregues" && (
        entregados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text2)" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>📦</div>
            <p style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum pedido entregue ainda</p>
            <p className="text-sm">Pedidos finalizados aparecerão aqui.</p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 16 }}>
              {entregados.length} {entregados.length === 1 ? "pedido" : "pedidos"} finalizado{entregados.length !== 1 && "s"}
            </div>
            {entregados.map(p => (
              <PedidoCardInner
                key={p.id}
                p={p}
                expanded={expandido === p.id}
                onToggle={() => setExpandido(expandido === p.id ? null : p.id)}
                avaliacoesData={avaliacoesData}
                avaliados={avalidados}
                config={config}
                entregadorData={entregadorData}
                setChatAberto={setChatAberto}
                setComprovanteAberto={setComprovanteAberto}
                setAvaliacaoPrivModal={setAvaliacaoPrivModal}
                handlePedirNovamente={handlePedirNovamente}
                setCancelModal={setCancelModal}
                handleAbrirSuporte={handleAbrirSuporte}
                calcularETA={calcularETA}
                formatarData={formatarData}
              />
            ))}
          </div>
        )
      )}

      {/* ===== ABA ATIVOS (PEDIDOS) ===== */}
      {aba === "pedidos" && (
        <>
          <p style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 16 }}>
            🔔 Você será notificado aqui quando seu pedido for atualizado
          </p>
          {ativos.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text2)" }}>
              <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎉</div>
              <p style={{ fontWeight: 600, marginBottom: 6 }}>Nenhum pedido ativo</p>
              <p className="text-sm">Que tal pedir um açaí agora?</p>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 16 }}>
                {ativos.length} {ativos.length === 1 ? "pedido" : "pedidos"} ativo{ativos.length !== 1 && "s"}
              </div>
              {ativos.map(p => (
                <PedidoCardInner
                  key={p.id}
                  p={p}
                  expanded={expandido === p.id}
                  onToggle={() => setExpandido(expandido === p.id ? null : p.id)}
                  avaliacoesData={avaliacoesData}
                  avaliados={avalidados}
                  config={config}
                  entregadorData={entregadorData}
                  setChatAberto={setChatAberto}
                  setComprovanteAberto={setComprovanteAberto}
                  setAvaliacaoPrivModal={setAvaliacaoPrivModal}
                  handlePedirNovamente={handlePedirNovamente}
                  setCancelModal={setCancelModal}
                  handleAbrirSuporte={handleAbrirSuporte}
                  calcularETA={calcularETA}
                  formatarData={formatarData}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {chatAberto && (
        <ChatEntregador pedidoId={chatAberto.pedidoId} entregadorId={chatAberto.entregadorId} onClose={() => setChatAberto(null)} />
      )}

      {cancelModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 16 }}>Motivo do cancelamento</div>
            {["Mudou de ideia", "Demora excessiva", "Erro no pedido", "Outro"].map(m => (
              <label key={m} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: cancelModal.motivo === m ? "rgba(239,68,68,0.1)" : "var(--bg2)", border: `1px solid ${cancelModal.motivo === m ? "rgba(239,68,68,0.4)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", fontSize: "0.88rem", marginBottom: 8 }}>
                <input type="radio" name="motivo" value={m} checked={cancelModal.motivo === m} onChange={() => setCancelModal(prev => ({ ...prev, motivo: m }))} style={{ accentColor: "var(--red)" }} />
                {m}
              </label>
            ))}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setCancelModal(null)} style={{ flex: 1, padding: 12, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "'Outfit', sans-serif", fontWeight: 600, cursor: "pointer" }}>Voltar</button>
              <button onClick={handleCancelarPedido} style={{ flex: 1, padding: 12, background: "var(--red)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: "pointer" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {comprovanteAberto && (
        <Comprovante pedido={comprovanteAberto} onClose={() => setComprovanteAberto(null)} />
      )}

      {avaliacaoPrivModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 6 }}>💬 Avaliação — Pedido #{avaliacaoPrivModal.pedido.numeroPedido || avaliacaoPrivModal.pedido.id.slice(-4)}</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text3)", marginBottom: 16 }}>Como foi sua experiência?</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 16 }}>
              {[1,2,3,4,5].map(n => (
                <span key={n} onClick={() => setAvPrivData(prev => ({ ...prev, estrelas: n }))} style={{ fontSize: "1.8rem", cursor: "pointer" }}>{n <= avPrivData.estrelas ? "⭐" : "☆"}</span>
              ))}
            </div>
            <textarea value={avPrivData.comentario} onChange={e => setAvPrivData(prev => ({ ...prev, comentario: e.target.value }))} placeholder="Deixe seu comentário (opcional)..." rows={3} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", resize: "none", outline: "none", marginBottom: 12 }} />
            {avPrivData.fotoUrl && (
              <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
                <img src={avPrivData.fotoUrl} alt="Preview" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }} />
                <button onClick={() => setAvPrivData(prev => ({ ...prev, fotoUrl: null, fotoFile: null }))} style={{ position: "absolute", top: -8, right: -8, background: "var(--red)", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", color: "#fff", fontSize: "0.75rem", lineHeight: "22px", textAlign: "center" }}>×</button>
              </div>
            )}
            {!avPrivData.fotoUrl && (
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "var(--text3)", fontSize: "0.82rem", marginBottom: 14 }}>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files[0]; if (f) setAvPrivData(prev => ({ ...prev, fotoFile: f, fotoUrl: URL.createObjectURL(f) })); }} />
                📷 Adicionar foto (opcional)
              </label>
            )}
            {avPrivData.enviando && <div style={{ fontSize: "0.78rem", color: "var(--gold)", marginBottom: 8 }}>⏳ Enviando...</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setAvaliacaoPrivModal(null); setAvPrivData({ estrelas: 5, comentario: "", fotoFile: null, fotoUrl: null, enviando: false }); }} style={{ flex: 1, padding: 11, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "'Outfit', sans-serif", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={handleEnviarAvaliacaoPrivada} disabled={avPrivData.enviando} style={{ flex: 1, padding: 11, background: avPrivData.enviando ? "var(--bg3)" : "var(--purple2)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: avPrivData.enviando ? "not-allowed" : "pointer" }}>Enviar</button>
            </div>
          </div>
        </div>
      )}

      {suporteModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: 6 }}>💬 Suporte</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text3)", marginBottom: 16 }}>Como podemos ajudar?</div>
            <button onClick={() => { const num = suporteModal.pedido.numeroPedido || suporteModal.pedido.id.slice(-4); window.open(`https://wa.me/55${config?.whatsapp || ""}?text=Pedido%20%23${num}`, "_blank"); setSuporteModal(null); }} style={{ width: "100%", padding: "12px", background: "#25D366", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", marginBottom: 10 }}>💬 WhatsApp</button>
            <button onClick={() => setSuporteModal(null)} style={{ width: "100%", padding: 11, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "'Outfit', sans-serif", fontWeight: 600, cursor: "pointer" }}>Fechar</button>
          </div>
        </div>
      )}
    </div>
  );
}

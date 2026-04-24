// src/pages/Admin.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { doc, collection, getDocs, updateDoc, increment, query, orderBy, onSnapshot, limit, setDoc, deleteDoc, serverTimestamp, where, addDoc, Timestamp, getDoc } from "firebase/firestore";
import { db, storage, auth } from "../lib/firebase";
import { getApp } from "firebase/app";
import { getFunctions, httpsCallable } from "firebase/functions";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useStore } from "../contexts/StoreContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/Toast";
import StoreLocationPicker from "../components/StoreLocationPicker";
import PlaceSearch from "../components/PlaceSearch";
import FeedRulesPanel from "../components/FeedRulesPanel";
import PDVDrawer from "../components/PDVDrawer";
import ChatEntregador from "../components/ChatEntregador";
import ChatPage from "../pages/ChatPage";
import { useNavigate } from "react-router-dom";

const IMGBB_API_KEY = "4b8379f3bfc7eb113e0820730166a9f8";

const DASHBOARD_MENUS = [
  { id: 0,  label: "Pedidos",      emoji: "📋", color: "#f5c518" },
  { id: 1,  label: "Histórico",    emoji: "📜", color: "#a78bfa" },
  { id: 2,  label: "Cardápio",     emoji: "🍇", color: "#22c55e" },
  { id: 3,  label: "Categorias",   emoji: "🏷️", color: "#f97316" },
  { id: 4,  label: "Recompensas",  emoji: "🎁", color: "#ec4899" },
  { id: 5,  label: "Cupons",       emoji: "🎟️", color: "#06b6d4" },
  { id: 6,  label: "Relatórios",   emoji: "📊", color: "#8b5cf6" },
  { id: 7,  label: "Recuperador",  emoji: "♻️", color: "#14b8a6" },
  { id: 8,  label: "Entregadores", emoji: "🛵", color: "#f43f5e" },
  { id: 9,  label: "Mesas",        emoji: "🍽️", color: "#eab308" },
  { id: 10, label: "Perfil da Loja",emoji: "🏪", color: "#6366f1" },
  { id: 11, label: "Financeiro",    emoji: "💰", color: "#84cc16" },
  { id: 12, label: "Configurações", emoji: "⚙️", color: "#64748b" },
  { id: 13, label: "Clientes",      emoji: "👥", color: "#0ea5e9" },
  { id: 14, label: "Visitantes",    emoji: "👁️", color: "#a855f7" },
  { id: 15, label: "Avaliações",    emoji: "⭐", color: "#fb923c" },
  { id: 16, label: "NexFoody",      emoji: "🗺️", color: "#7c3aed" },
  { id: 17, label: "Chat",          emoji: "💬", color: "#0891b2" },
  { id: 18, label: "Feed / Posts",  emoji: "📸", color: "#22c55e" },
  { id: 19, label: "Comunicar",    emoji: "📢", color: "#ec4899" },
  { id: 20, label: "Gerente IA",   emoji: "🤖", color: "#7c3aed" },
  { id: 21, label: "Dívidas",      emoji: "📑", color: "#ef4444" },
  { id: 22, label: "Aparência",    emoji: "🎨", color: "#ec4899" },
  { id: 23, label: "Equipe",       emoji: "👥", color: "#14b8a6" },
  { id: 24, label: "Dashboard Analytics", emoji: "📈", color: "#7c3aed" },
];

import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

const STATUS_LIST = [
  { id: "aguardando_confirmacao", label: "Aguard. confirm.", icon: "💬", color: "#22d3ee" },
  { id: "aguardando_pagamento",   label: "Aguard. pagto.",   icon: "💳", color: "#f59e0b" },
  { id: "pendente",   label: "Pendente",       icon: "⏳", color: "var(--gold)" },
  { id: "confirmado", label: "Confirmado",      icon: "✅", color: "#60a5fa" },
  { id: "preparo",    label: "Em preparo",      icon: "🫐", color: "var(--purple2)" },
  { id: "pronto",     label: "Pronto",          icon: "🎉", color: "var(--green)" },
  { id: "entrega",    label: "Saiu p/ entrega", icon: "🛵", color: "#f97316" },
  { id: "entregue",   label: "Entregue",        icon: "✅", color: "var(--green)" },
  { id: "cancelado",  label: "Cancelado",       icon: "❌", color: "var(--red)" },
];

function formatarData(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ===== SONS =====
function useSom() {
  const ctxRef = useRef(null);
  const silenciadoRef = useRef(false);
  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  };
  const tocarNovoPedido = useCallback(() => {
    if (silenciadoRef.current) return;
    try {
      const ctx = getCtx();
      const repeticoes = 3; // Repete 3 vezes
      const intervalo = 0.9; // Intervalo entre repetições em segundos
      for (let r = 0; r < repeticoes; r++) {
        [523, 659, 784].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = freq; osc.type = "sine";
          const t = ctx.currentTime + r * intervalo + i * 0.18;
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.start(t); osc.stop(t + 0.36);
        });
      }
    } catch (e) {}
  }, []);
  const tocarEstoqueBaixo = useCallback(() => {
    if (silenciadoRef.current) return;
    try {
      const ctx = getCtx();
      // Dois bipes descendentes — tom de aviso
      [480, 320].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "triangle";
        const t = ctx.currentTime + i * 0.28;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
        osc.start(t); osc.stop(t + 0.39);
      });
    } catch (e) {}
  }, []);
  const setSilenciado = useCallback((val) => { silenciadoRef.current = val; }, []);
  return { tocarNovoPedido, tocarEstoqueBaixo, setSilenciado };
}

// ===== UPLOAD FOTO =====
function FotoUpload({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [modo, setModo] = useState("link");
  const fileRef = useRef();
  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert("Foto muito grande! Máximo 5MB."); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("key", IMGBB_API_KEY);
      const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) onChange(data.data.display_url);
      else alert("Erro ao fazer upload.");
    } catch { alert("Erro de conexão."); }
    finally { setUploading(false); }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {["link", "upload"].map(m => (
          <button key={m} onClick={() => setModo(m)} style={{
            flex: 1, padding: "8px", border: "none", borderRadius: "var(--radius-sm)",
            background: modo === m ? "var(--gold)" : "var(--bg3)",
            color: modo === m ? "var(--bg)" : "var(--text2)",
            fontWeight: 600, fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif",
          }}>
            {m === "link" ? "🔗 Colar link" : "📁 Upload do PC"}
          </button>
        ))}
      </div>
      {modo === "link" && <input className="form-input" value={value} onChange={e => onChange(e.target.value)} placeholder="https://i.ibb.co/xxxxx/foto.jpg" />}
      {modo === "upload" && (
        <div onClick={() => !uploading && fileRef.current.click()} style={{ border: "2px dashed var(--border2)", borderRadius: "var(--radius-sm)", padding: "20px", textAlign: "center", cursor: uploading ? "not-allowed" : "pointer", background: "var(--bg2)" }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          {uploading ? <div><div style={{ fontSize: "1.5rem" }}>⏳</div><div style={{ fontSize: "0.82rem", color: "var(--text2)" }}>Fazendo upload...</div></div>
            : <div><div style={{ fontSize: "1.8rem" }}>📁</div><div style={{ fontSize: "0.85rem", fontWeight: 600 }}>Clique para selecionar foto</div><div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 4 }}>JPG, PNG ou WebP · Máx. 5MB</div></div>}
        </div>
      )}
      {value && (
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
          <img src={value} alt="Preview" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border2)" }} onError={e => e.target.style.display = "none"} />
          <div style={{ flex: 1 }}><div style={{ fontSize: "0.75rem", color: "var(--green)" }}>✅ Foto carregada</div></div>
          <button onClick={() => onChange("")} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontSize: "1rem" }}>✕</button>
        </div>
      )}
    </div>
  );
}

// ===== DASHBOARD GRID (static — reorder only in EditarCardsModal) =====
function DashboardGrid({ menuOrder, dashboardMenus, activeTab, onSelectMenu }) {
  // Resolve saved order + appends any new menus not yet in saved order
  const allIds = dashboardMenus.map(m => m.id);
  const validOrder = [
    ...menuOrder.filter(id => allIds.includes(id)),
    ...allIds.filter(id => !menuOrder.includes(id)),
  ];
  const orderedMenus = validOrder.map(id => dashboardMenus.find(m => m.id === id)).filter(Boolean);

  return (
    <div className="dashboard-grid">
      {orderedMenus.map(menu => (
        <div
          key={menu.id}
          className={`dash-card${activeTab === menu.id ? " active" : ""}`}
          style={{ background: menu.color, borderRadius: 16, padding: "20px 12px 18px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, boxShadow: "0 4px 12px rgba(0,0,0,0.2)", cursor: "pointer", minHeight: 120, color: "#fff", fontWeight: 700, fontSize: "1rem", touchAction: "manipulation" }}
          onClick={() => onSelectMenu(menu.id)}
        >
          <span className="dash-emoji">{menu.emoji}</span>
          <span className="dash-label">{menu.label}</span>
        </div>
      ))}
    </div>
  );
}

// ===== DASHBOARD HEADER =====
const ACOES_RAPIDAS = [
  { label: "🎯 Promoção",       tab: 4,    color: "#ec4899" },
  { label: "🎟️ Criar Cupom",    tab: 5,    color: "#06b6d4" },
  { label: "📸 Novo Post",      tab: 18,   color: "#a855f7" },
  { label: "⏸️ Pausar Produto", tab: 2,    color: "#f97316" },
  { label: "🖼️ Banner do dia",  tab: 10,   color: "#6366f1" },
  { label: "🛍️ Ver Loja",       tab: null, color: "#22c55e" },
];

function DashboardHeader({ onSelectMenu, menuOrder, dashboardMenus, onEditCards }) {
  const { tenantId, config } = useStore();
  const [lojaDocId, setLojaDocId] = useState(null);
  const [lojaAberta, setLojaAberta] = useState(true);
  const [chatAberto, setChatAberto] = useState(false);
  const [placeId, setPlaceId] = useState(null);
  const [showCards, setShowCards] = useState(() => {
    try { return localStorage.getItem("admin_show_cards") !== "0"; } catch { return true; }
  });

  // Métricas
  const [pedidosHoje, setPedidosHoje] = useState(0);
  const [clientesHoje, setClientesHoje] = useState(0);
  const [totalFas, setTotalFas] = useState(0);
  const [avaliacoes, setAvaliacoes] = useState(0);
  const [chatNaoLido, setChatNaoLido] = useState(0);
  const [atendentesSolicitados, setAtendentesSolicitados] = useState(0);
  const [receitaHoje, setReceitaHoje] = useState(0);

  // Vendas de balcão
  const [todasVendasBalcao, setTodasVendasBalcao] = useState([]);
  const [caixaOpen, setCaixaOpen] = useState(false);
  const [caixaAba, setCaixaAba] = useState("venda");

  // Carregar dados da loja
  useEffect(() => {
    if (!tenantId) return;
    getDocs(query(collection(db, "lojas"), where("tenantId", "==", tenantId))).then(snap => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setLojaDocId(d.id);
        setChatAberto(d.data().chatAberto ?? false);
        setPlaceId(d.data().placeId || null);
      }
    });
  }, [tenantId]);

  // Sincroniza lojaAberta com config.cardapioAtivo (fonte de verdade)
  useEffect(() => {
    setLojaAberta(config.cardapioAtivo ?? true);
  }, [config.cardapioAtivo]);

  // Pedidos hoje + clientes únicos + receita (1 listener)
  useEffect(() => {
    if (!tenantId) return;
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const q = query(collection(db, "pedidos"), where("tenantId", "==", tenantId), where("createdAt", ">=", Timestamp.fromDate(inicio)));
    return onSnapshot(q, snap => {
      setPedidosHoje(snap.size);
      setClientesHoje(new Set(snap.docs.map(d => d.data().userId).filter(Boolean)).size);
      setReceitaHoje(snap.docs.filter(d => ["entregue", "pronto"].includes(d.data().status)).reduce((s, d) => s + (d.data().total || 0), 0));
    });
  }, [tenantId]);

  // Total fãs (pontos de fidelidade)
  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, "pontos"), where("tenantId", "==", tenantId));
    return onSnapshot(q, snap => setTotalFas(snap.size));
  }, [tenantId]);

  // Avaliações não lidas
  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, "avaliacoes"), where("tenantId", "==", tenantId), where("lida", "==", false));
    return onSnapshot(q, snap => setAvaliacoes(snap.size));
  }, [tenantId]);

  // Chat não lido
  useEffect(() => {
    if (!lojaDocId) return;
    const lojaVirtualId = `loja_${lojaDocId}`;
    const q = query(collection(db, "chats"), where("participantes", "array-contains", lojaVirtualId));
    return onSnapshot(q, snap => setChatNaoLido(snap.docs.reduce((s, d) => s + (d.data().naoLido?.[lojaVirtualId] || 0), 0)));
  }, [lojaDocId]);

  // Alertas de atendente solicitado
  useEffect(() => {
    if (!lojaDocId) return;
    const q = query(collection(db, "lojas", lojaDocId, "alertasAtendimento"), where("resolvido", "==", false));
    return onSnapshot(q, snap => setAtendentesSolicitados(snap.size));
  }, [lojaDocId]);

  // Vendas de balcão (histórico completo)
  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, `tenants/${tenantId}/vendas-balcao`), orderBy("createdAt", "desc"), limit(500));
    return onSnapshot(q, snap => setTodasVendasBalcao(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [tenantId]);

  const toggleLoja = async () => {
    const novo = !lojaAberta;
    setLojaAberta(novo);
    await salvarConfig({ cardapioAtivo: novo, pausaManual: !novo });
    if (lojaDocId) await updateDoc(doc(db, "lojas", lojaDocId), { aberta: novo }).catch(() => {});
  };

  const toggleChat = async () => {
    if (!lojaDocId) return;
    const novo = !chatAberto;
    setChatAberto(novo);
    await updateDoc(doc(db, "lojas", lojaDocId), { chatAberto: novo });
  };

  const receitaFmt = receitaHoje >= 1000
    ? `R$${(receitaHoje / 1000).toFixed(1)}k`
    : `R$${receitaHoje.toFixed(0)}`;

  const METRICS = [
    { label: "Pedidos",    val: pedidosHoje,  color: "#f5c518", tab: 0,  hi: pedidosHoje > 0  },
    { label: "Clientes",   val: clientesHoje, color: "#60a5fa", tab: 13, hi: false             },
    { label: "Total Fãs",  val: totalFas,     color: "#ec4899", tab: 4,  hi: false             },
    { label: "Avaliações", val: avaliacoes,   color: "#fb923c", tab: 15, hi: avaliacoes > 0   },
    { label: "Chat",       val: chatNaoLido,  color: "#a78bfa", tab: 17, hi: chatNaoLido > 0  },
    { label: "Receita",    val: receitaFmt,   color: "#22c55e", tab: 11, hi: receitaHoje > 0, isStr: true },
  ];

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @keyframes plive  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.75)} }
        @keyframes pbadge { 0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)} 70%{box-shadow:0 0 0 5px rgba(239,68,68,0)} }
        @keyframes pulseAlerta { 0%,100%{box-shadow:0 0 0 0 currentColor} 50%{box-shadow:0 0 12px 3px currentColor} }
        .dm-card:active { transform:scale(.96); }
        .acao-pill { flex-shrink:0; border:none; font-family:'Outfit',sans-serif; font-weight:700; font-size:.73rem; cursor:pointer; white-space:nowrap; transition:opacity .15s; }
        .acao-pill:active { opacity:.65; }
      `}</style>

      {/* ── 1. IDENTIDADE DA LOJA ─────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: "14px 14px" }}>
        {config?.logoUrl
          ? <img src={config.logoUrl} alt="" style={{ width: 48, height: 48, borderRadius: 12, objectFit: "cover", flexShrink: 0, border: "2px solid var(--border2)" }} />
          : <div style={{ width: 48, height: 48, borderRadius: 12, background: "var(--purple2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>🫐</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {config?.nomeLoja || "Minha Loja"}
          </div>
          <a href={`/loja/${tenantId}`} target="_blank" rel="noreferrer"
            style={{ fontSize: "0.64rem", color: "var(--text3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            nexfoody.com/loja/{tenantId}
          </a>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
          <button onClick={toggleLoja} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.7rem", background: lojaAberta ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)", color: lojaAberta ? "#22c55e" : "#ef4444", outline: `1px solid ${lojaAberta ? "rgba(34,197,94,.3)" : "rgba(239,68,68,.3)"}` }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", animation: lojaAberta ? "plive 1.5s infinite" : "none", flexShrink: 0 }} />
            {lojaAberta ? "Aberta" : "Fechada"}
          </button>
          <button onClick={toggleChat} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.7rem", background: chatAberto ? "rgba(124,58,237,.15)" : "rgba(255,255,255,.04)", color: chatAberto ? "#a78bfa" : "rgba(255,255,255,.3)", outline: `1px solid ${chatAberto ? "rgba(124,58,237,.3)" : "rgba(255,255,255,.08)"}`, position: "relative" }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Chat {chatAberto ? "aberto" : "fechado"}
            {chatNaoLido > 0 && <span style={{ position: "absolute", top: -5, right: -5, background: "#ef4444", color: "#fff", borderRadius: 8, fontSize: "0.5rem", fontWeight: 800, padding: "0 4px", animation: "pbadge 1.5s infinite" }}>{chatNaoLido}</span>}
          </button>
        </div>
      </div>

      {/* ── LIVRO CAIXA ──────────────────────────────────── */}
      {lojaAberta && (
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setCaixaAba("venda"); setCaixaOpen(true); }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 0", background: "linear-gradient(135deg, #22c55e, #16a34a)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif", boxShadow: "0 3px 14px rgba(34,197,94,0.3)" }}>
            <span>📝</span> Registrar Venda
          </button>
          <button onClick={() => { setCaixaAba("retirada"); setCaixaOpen(true); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "11px 18px", background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif", boxShadow: "0 3px 14px rgba(239,68,68,0.3)" }}>
            <span>💸</span> Retirada
          </button>
        </div>
      )}

      {/* ── 2. MAPA AO VIVO ───────────────────────────────── */}
      <div onClick={() => onSelectMenu(8)} style={{ background: "rgba(14,165,233,.05)", border: "1px solid rgba(14,165,233,.14)", borderRadius: 14, padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(14,165,233,.12)", border: "1px solid rgba(14,165,233,.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>🗺️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "#38bdf8" }}>Mapa ao vivo dos entregadores</div>
          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>Em breve · Rastreamento inteligente em tempo real</div>
        </div>
        <span style={{ color: "rgba(56,189,248,.35)", fontSize: "0.9rem" }}>›</span>
      </div>

      {/* ── 3. HOJE EM TEMPO REAL ─────────────────────────── */}
      <div>
        <div style={{ fontSize: "0.61rem", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text3)", fontWeight: 700, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "plive 1.5s infinite" }} />
          Hoje em tempo real
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 7 }}>
          {METRICS.map((m, i) => (
            <div key={i} className="dm-card" onClick={() => onSelectMenu(m.tab)}
              style={{ background: m.hi ? `${m.color}12` : "rgba(255,255,255,.03)", border: `1px solid ${m.hi ? m.color + "30" : "rgba(255,255,255,.06)"}`, borderRadius: 12, padding: "12px 8px", textAlign: "center", cursor: "pointer", transition: "transform .15s" }}>
              <div style={{ fontSize: m.isStr ? (receitaHoje >= 1000 ? ".83rem" : "1rem") : "1.3rem", fontWeight: 800, color: m.hi ? m.color : "var(--text2)", lineHeight: 1 }}>{m.val}</div>
              <div style={{ fontSize: "0.56rem", color: "var(--text3)", marginTop: 4, textTransform: "uppercase", letterSpacing: ".04em" }}>{m.label}</div>
            </div>
          ))}
        </div>

        {/* ── BARRA DE PROGRESSO VENDAS ─── */}
        {(() => {
          const meta = config.metaFaturamento || 1500;
          const pct = Math.min((receitaHoje / meta) * 100, 100);
          const falta = Math.max(meta - receitaHoje, 0);
          const ticket = pedidosHoje > 0 ? receitaHoje / pedidosHoje : 0;
          return (
            <div style={{ marginTop: 10, background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 14, padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: ".08em" }}>💰 VENDAS DO DIA</div>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", fontWeight: 600 }}>{config.nomeLoja || "Loja"}</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <div style={{ fontSize: "1.1rem", fontWeight: 900, color: "#22c55e" }}>{receitaFmt}</div>
                <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.4)", fontWeight: 600 }}>R$ {meta.toLocaleString("pt-BR")}</div>
              </div>
              <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,.08)", overflow: "hidden", marginBottom: 6 }}>
                <div style={{
                  height: "100%", width: `${pct}%`,
                  background: pct >= 100
                    ? "linear-gradient(90deg, #22c55e, #4ade80)"
                    : pct >= 60
                    ? "linear-gradient(90deg, #22c55e, #86efac)"
                    : "linear-gradient(90deg, #22c55e, #bef264)",
                  borderRadius: 5, transition: "width .4s ease",
                  boxShadow: "0 0 12px rgba(34,197,94,.5)",
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, color: pct >= 100 ? "#4ade80" : "rgba(255,255,255,.45)" }}>
                  {pct >= 100 ? "🎉 Meta batida!" : `⚡ Faltam R$ ${falta.toLocaleString("pt-BR")}`}
                </div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)" }}>
                  🔥 {pedidosHoje} pedidos | Ticket: R$ {ticket.toFixed(2).replace(".", ",")}
                </div>
              </div>
            </div>
          );
        })()}

      </div>

      {/* ── 3. AÇÕES RÁPIDAS ──────────────────────────────── */}
      <div>
        <div style={{ fontSize: "0.61rem", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text3)", fontWeight: 700, marginBottom: 8 }}>Ações rápidas</div>
        <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
          {ACOES_RAPIDAS.map((a, i) => (
            <button key={i} className="acao-pill"
              onClick={() => a.tab !== null ? onSelectMenu(a.tab) : window.open(`/loja/${tenantId}`, "_blank")}
              style={{ padding: "7px 13px", borderRadius: 20, background: `${a.color}18`, color: a.color, outline: `1px solid ${a.color}30` }}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 4. GERIR LOJA ────────────────────────────────── */}
      <div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: showCards ? 10 : 0 }}>
          <div style={{ fontSize: "0.61rem", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text3)", fontWeight: 700 }}>Gerir loja</div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onEditCards} style={{ padding: "4px 10px", background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text3)", fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: "0.65rem", cursor: "pointer" }}>✏️ Editar cards</button>
            <button
              onClick={() => { const n = !showCards; setShowCards(n); try { localStorage.setItem("admin_show_cards", n ? "1" : "0"); } catch {} }}
              style={{ padding: "4px 10px", background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 8, color: "var(--text3)", fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: "0.65rem", cursor: "pointer" }}>
              {showCards ? "Ocultar ↑" : "Ver painel ↓"}
            </button>
          </div>
        </div>
        {showCards && (
          <DashboardGrid
            menuOrder={menuOrder}
            dashboardMenus={dashboardMenus}
            activeTab={-1}
            onSelectMenu={onSelectMenu}
          />
        )}
      </div>


      {/* ── 7. VINCULAR LOJA AO MAPA ─────────────────────── */}
      <div onClick={() => onSelectMenu(16)} style={{ display: "flex", alignItems: "center", gap: 10, background: placeId ? "rgba(34,197,94,.05)" : "rgba(245,197,24,.06)", border: `1px solid ${placeId ? "rgba(34,197,94,.18)" : "rgba(245,197,24,.2)"}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
        <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{placeId ? "✅" : "📍"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, color: placeId ? "#22c55e" : "#f5c518" }}>
            {placeId ? "Loja vinculada ao mapa NexFoody" : "Vincular loja ao mapa NexFoody"}
          </div>
          <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 1 }}>
            {placeId ? "Sua loja aparece nas buscas e no mapa" : "Apareça nas buscas e no mapa da cidade"}
          </div>
        </div>
        <span style={{ color: "var(--text3)" }}>›</span>
      </div>
    </div>

    {/* ── CARD VENDAS NO BALCÃO ── */}
    {(() => {
      const agora = new Date();
      const vendasMes = todasVendasBalcao.filter(v => {
        const d = v.createdAt?.toDate?.();
        return d && d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
      });
      const totalMes = vendasMes.reduce((s, v) => s + (v.total || 0), 0);
      const vendasPorDia = todasVendasBalcao.reduce((acc, v) => {
        const d = v.createdAt?.toDate ? v.createdAt.toDate() : new Date();
        const chave = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
        if (!acc[chave]) acc[chave] = { vendas: [], total: 0, data: d };
        acc[chave].vendas.push(v);
        acc[chave].total += v.total || 0;
        return acc;
      }, {});
      const diasOrdenados = Object.entries(vendasPorDia).sort((a, b) => b[1].data.getTime() - a[1].data.getTime());
      const fmt = v => "R$ " + v.toFixed(2).replace(".", ",");

      return (
        <div style={{ marginTop: 6 }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text3)", marginBottom: 8 }}>Vendas no balcão</div>
          <div style={{ background: "rgba(34,197,94,0.05)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(34,197,94,0.1)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>🏪</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--text)" }}>Balcão · este mês</div>
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 1 }}>{vendasMes.length} venda{vendasMes.length !== 1 ? "s" : ""} registrada{vendasMes.length !== 1 ? "s" : ""}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: "1rem", color: "#22c55e" }}>{fmt(totalMes)}</div>
                <div style={{ fontSize: "0.58rem", color: "var(--text3)" }}>faturamento</div>
              </div>
            </div>

            {diasOrdenados.length === 0 ? (
              <div style={{ padding: "24px 14px", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: 6 }}>🏪</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.3)" }}>Nenhuma venda no balcão ainda</div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.18)", marginTop: 3 }}>Use o botão verde flutuante para registrar</div>
              </div>
            ) : diasOrdenados.map(([dia, info], i) => {
              const isHoje = i === 0 && info.data.toDateString() === agora.toDateString();
              const pagtos = info.vendas.reduce((acc, v) => { acc[v.pagamento] = (acc[v.pagamento] || 0) + (v.total || 0); return acc; }, {});
              return (
                <div key={dia} style={{ padding: "10px 14px", borderBottom: i < diasOrdenados.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      {isHoje && <span style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 20, padding: "1px 6px", fontSize: "0.52rem", fontWeight: 800, color: "#22c55e" }}>HOJE</span>}
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text)", textTransform: "capitalize" }}>{dia}</span>
                      <span style={{ fontSize: "0.62rem", color: "var(--text3)" }}>{info.vendas.length} venda{info.vendas.length > 1 ? "s" : ""}</span>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "#22c55e" }}>{fmt(info.total)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Object.entries(pagtos).map(([pag, val]) => (
                      <span key={pag} style={{ fontSize: "0.6rem", color: "var(--text3)", background: "rgba(255,255,255,0.05)", borderRadius: 20, padding: "2px 7px" }}>
                        {pag === "dinheiro" ? "💵" : pag === "pix" ? "📲" : "💳"} {fmt(val)}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      );
    })()}

    {tenantId && <PDVDrawer tenantId={tenantId} nomeLoja={config?.nomeLoja || "Minha Loja"} open={caixaOpen} aba={caixaAba} onClose={() => setCaixaOpen(false)} onChangeAba={setCaixaAba} />}
    </>
  );
}

// ===== ADMIN PRINCIPAL =====
export default function Admin() {
  const { config, salvarConfig, tenantId } = useStore();
  const { tocarEstoqueBaixo } = useSom();
  const toast = useToast();
  const [tab, setTab] = useState(() => {
    try {
      const saved = localStorage.getItem("admin_tab");
      if (saved !== null) return parseInt(saved);
    } catch {}
    return -1;
  });
  const [novoPedidoBadge, setNovoPedidoBadge] = useState(0);
  const [editarCards, setEditarCards] = useState(false);
  // Sempre garante que novos menus adicionados ao código apareçam,
  // mesmo que o admin tenha uma lista salva sem eles
  const savedMenus = config?.adminDashboardMenus;
  const dashboardMenus = savedMenus
    ? [
        ...savedMenus,
        ...DASHBOARD_MENUS.filter(m => !savedMenus.some(s => s.id === m.id)),
      ]
    : DASHBOARD_MENUS;
  const [menuOrder, setMenuOrder] = useState(() => {
    const allIds = DASHBOARD_MENUS.map(m => m.id);
    const saved = localStorage.getItem("admin_dashboard_order");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Merge: keep saved order, append any new ids not yet saved
          return [...parsed.filter(id => allIds.includes(id)), ...allIds.filter(id => !parsed.includes(id))];
        }
      } catch {}
    }
    return allIds;
  });

  // Listen for cross-component reorder events
  useEffect(() => {
    const handler = (e) => setMenuOrder(e.detail);
    window.addEventListener("dashboard-reorder", handler);
    return () => window.removeEventListener("dashboard-reorder", handler);
  }, []);

  // Alertas de estoque baixo — ouve em tempo real e toca som
  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, "lojas", tenantId, "alertasEstoque"),
      where("lido", "==", false)
    );
    let primeira = true;
    return onSnapshot(q, snap => {
      if (primeira) { primeira = false; return; } // ignora carga inicial
      snap.docChanges().forEach(change => {
        if (change.type !== "added") return;
        const d = change.doc.data();
        const nome = d.nomeProduto || "Produto";
        const esgotado = d.tipo === "esgotado";
        tocarEstoqueBaixo();
        toast(
          esgotado
            ? `📦 "${nome}" esgotado! Estoque zerado.`
            : `⚠️ Estoque baixo: "${nome}" — ${d.estoque} restantes`,
          esgotado ? "error" : "warning"
        );
        // Marca como lido automaticamente após notificar
        updateDoc(change.doc.ref, { lido: true }).catch(() => {});
      });
    });
  }, [tenantId, tocarEstoqueBaixo, toast]);

  // Voltar ao dashboard pelo botão "voltar" do celular
  useEffect(() => {
    const handler = () => { if (tab !== -1) setTab(-1); };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [tab]);

  const handleSelectMenu = (id) => {
    setTab(id);
    localStorage.setItem("admin_tab", id);
    if (id === 0) setNovoPedidoBadge(0);
  };

  const handleBackToDashboard = () => {
    setTab(-1);
    localStorage.removeItem("admin_tab");
  };

  return (
    <div className="page">
      {tab !== -1 && (
        <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
          <h2 className="display-title mb-0">Painel <span>Admin</span></h2>
        </div>
      )}
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }`}</style>

      {tab === -1 ? (
        <DashboardHeader
          onSelectMenu={handleSelectMenu}
          menuOrder={menuOrder}
          dashboardMenus={dashboardMenus}
          onEditCards={() => setEditarCards(true)}
        />
      ) : (
        <>
          <button className="dash-back-btn" onClick={handleBackToDashboard}>
            ← Dashboard
          </button>
          {tab === 0 && <TabPedidos onNovoPedido={() => setNovoPedidoBadge(n => n + 1)} onNavigate={setTab} />}
          {tab === 1 && <TabHistorico />}
          {tab === 2 && <TabCardapio />}
          {tab === 3 && <TabCategorias />}
          {tab === 4 && <TabRecompensas />}
          {tab === 5 && <TabCupons />}
          {tab === 6 && <TabRelatorios />}
          {tab === 7 && <TabRecuperador />}
          {tab === 8 && <TabEntregadores />}
          {tab === 9 && <TabMesas />}
          {tab === 10 && <TabPerfilLoja />}
          {tab === 11 && <TabFinanceiro />}
          {tab === 12 && <TabConfig />}
          {tab === 13 && <TabClientes />}
          {tab === 14 && <TabVisitantes />}
          {tab === 15 && <TabAvaliacoes />}
          {tab === 16 && <TabNexfoody />}
          {tab === 17 && <TabChat />}
          {tab === 18 && <TabFeed />}
          {tab === 19 && <TabComunicar />}
          {tab === 20 && <TabGerenteIA />}
          {tab === 21 && <TabDividas />}
          {tab === 22 && <TabAparencia />}
          {tab === 23 && <TabEquipe />}
          {tab === 24 && <TabDashboardAnalytics />}
        </>
      )}

      {/* Modal Editar Cards */}
      {editarCards && (
        <EditarCardsModal
          menus={dashboardMenus}
          onSave={(menus) => {
            salvarConfig({ adminDashboardMenus: menus, adminDashboardOrder: menus.map(m => m.id) });
            setEditarCards(false);
          }}
          onClose={() => setEditarCards(false)}
        />
      )}

    </div>
  );
}

// ===== DASHBOARD ANALYTICS =====
function TabDashboardAnalytics() {
  const { tenantId } = useStore();
  const [periodo, setPeriodo] = useState("7d");
  const [pedidos, setPedidos] = useState([]);
  const [pedidosAnterior, setPedidosAnterior] = useState([]);
  const [loading, setLoading] = useState(true);

  const getPeriodDates = (p) => {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    if (p === "hoje") {
      return { inicio: new Date(hoje), fim: new Date(hoje.getTime() + 86400000 - 1) };
    } else if (p === "7d") {
      const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 6);
      const fim = new Date(hoje); fim.setTime(fim.getTime() + 86400000 - 1);
      return { inicio, fim };
    } else {
      const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 29);
      const fim = new Date(hoje); fim.setTime(fim.getTime() + 86400000 - 1);
      return { inicio, fim };
    }
  };

  const getAnteriorDates = (p) => {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    if (p === "hoje") {
      const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 1);
      const fim = new Date(inicio.getTime() + 86400000 - 1);
      return { inicio, fim };
    } else if (p === "7d") {
      const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 13);
      const fim = new Date(hoje); fim.setDate(fim.getDate() - 7); fim.setTime(fim.getTime() + 86400000 - 1);
      return { inicio, fim };
    } else {
      const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 59);
      const fim = new Date(hoje); fim.setDate(fim.getDate() - 30); fim.setTime(fim.getTime() + 86400000 - 1);
      return { inicio, fim };
    }
  };

  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const { inicio, fim } = getPeriodDates(periodo);
    const q = query(
      collection(db, "pedidos"),
      where("tenantId", "==", tenantId),
      where("createdAt", ">=", Timestamp.fromDate(inicio)),
      where("createdAt", "<=", Timestamp.fromDate(fim)),
      orderBy("createdAt", "desc"),
      limit(500)
    );
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [tenantId, periodo]);

  useEffect(() => {
    if (!tenantId) return;
    const { inicio, fim } = getAnteriorDates(periodo);
    const q = query(
      collection(db, "pedidos"),
      where("tenantId", "==", tenantId),
      where("createdAt", ">=", Timestamp.fromDate(inicio)),
      where("createdAt", "<=", Timestamp.fromDate(fim)),
      limit(500)
    );
    const unsub = onSnapshot(q, snap => {
      setPedidosAnterior(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [tenantId, periodo]);

  const fmt = v => v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

  const pct = (a, b) => {
    if (!b) return null;
    const p = ((a - b) / b) * 100;
    return { val: Math.abs(p).toFixed(1), up: p >= 0 };
  };

  const validos = pedidos.filter(p => p.status !== "cancelado");
  const validosAnt = pedidosAnterior.filter(p => p.status !== "cancelado");

  const faturamento = validos.reduce((s, p) => s + (p.total || 0), 0);
  const fatAnterior = validosAnt.reduce((s, p) => s + (p.total || 0), 0);
  const ticketMedio = validos.length ? faturamento / validos.length : 0;
  const ticketAnt = validosAnt.length ? fatAnterior / validosAnt.length : 0;

  const userIds = [...new Set(validos.map(p => p.userId).filter(Boolean))];
  const userIdsAnt = [...new Set(validosAnt.map(p => p.userId).filter(Boolean))];

  const cancelados = pedidos.filter(p => p.status === "cancelado");
  const taxaCancel = pedidos.length > 0 ? (cancelados.length / pedidos.length) * 100 : 0;
  const taxaCancelAnt = pedidosAnterior.length > 0
    ? (pedidosAnterior.filter(p => p.status === "cancelado").length / pedidosAnterior.length) * 100
    : 0;

  // Produtos mais vendidos
  const produtosMap = {};
  validos.forEach(p => {
    (p.items || []).forEach(item => {
      if (!produtosMap[item.nome]) produtosMap[item.nome] = { qty: 0, total: 0 };
      produtosMap[item.nome].qty += item.qty || 1;
      produtosMap[item.nome].total += (item.preco || 0) * (item.qty || 1);
    });
  });
  const topProdutos = Object.entries(produtosMap)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 5);

  const totalProdutos = topProdutos.length > 0 ? topProdutos[0][1].qty : 1;

  // Formas de pagamento
  const pagMap = {};
  validos.forEach(p => {
    const pg = p.pagamento || "outro";
    if (!pagMap[pg]) pagMap[pg] = { qty: 0, total: 0 };
    pagMap[pg].qty++;
    pagMap[pg].total += p.total || 0;
  });
  const pagamentoData = Object.entries(pagMap)
    .sort((a, b) => b[1].total - a[1].total);

  // Chart data
  const { inicio, fim } = getPeriodDates(periodo);
  const dias = Math.ceil((fim - inicio) / 86400000) + 1;
  const chartData = Array.from({ length: dias }, (_, i) => {
    const dia = new Date(inicio);
    dia.setDate(dia.getDate() + i);
    const diaStr = dia.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
    const dayPedidos = validos.filter(p => {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      return d.toDateString() === dia.toDateString();
    });
    return {
      dia: diaStr,
      faturamento: dayPedidos.reduce((s, p) => s + (p.total || 0), 0),
      pedidos: dayPedidos.length,
    };
  });

  function KPICard({ icon, titulo, valor, variacao, cor, invertVariation }) {
    return (
      <div style={{
        background: "rgba(255,255,255,.04)",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 16, padding: "14px 12px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `${cor}18`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1rem"
          }}>{icon}</div>
          {variacao && (
            <span style={{
              fontSize: "0.6rem", fontWeight: 800, padding: "3px 7px", borderRadius: 20,
              color: (invertVariation ? !variacao.up : variacao.up) ? "#22c55e" : "#ef4444",
              background: (invertVariation ? !variacao.up : variacao.up) ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)"
            }}>
              {variacao.up ? "↑" : "↓"} {variacao.val}%
            </span>
          )}
        </div>
        <div style={{ fontWeight: 900, fontSize: "1.05rem", color: cor }}>{valor}</div>
        <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".06em", marginTop: 3 }}>{titulo}</div>
      </div>
    );
  }

  function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
      <div style={{
        background: "rgba(15,7,32,.97)",
        border: "1px solid rgba(255,255,255,.12)",
        borderRadius: 10, padding: "10px 14px"
      }}>
        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.5)", marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ fontSize: "0.8rem", fontWeight: 800, color: p.color }}>
            {p.name === "faturamento" ? fmt(p.value) : `${p.value} pedidos`}
          </div>
        ))}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "60px 20px", color: "rgba(255,255,255,.4)" }}>
        Carregando analytics...
      </div>
    );
  }

  return (
    <div style={{ padding: "20px 16px" }}>
      {/* Period selector */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {["hoje", "7d", "30d"].map(p => (
          <button key={p} onClick={() => setPeriodo(p)} style={{
            padding: "7px 18px", borderRadius: 10, border: "none", fontWeight: 700,
            fontSize: "0.78rem", cursor: "pointer",
            background: periodo === p ? "#7c3aed" : "rgba(255,255,255,.06)",
            color: periodo === p ? "#fff" : "rgba(255,255,255,.5)",
            fontFamily: "'Outfit',sans-serif",
          }}>
            {p === "hoje" ? "HOJE" : p === "7d" ? "7 DIAS" : "30 DIAS"}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 20 }}>
        <KPICard icon="💰" titulo="Faturamento" valor={fmt(faturamento)} variacao={pct(faturamento, fatAnterior)} cor="#22c55e" />
        <KPICard icon="📋" titulo="Pedidos" valor={validos.length} variacao={pct(validos.length, validosAnt.length)} cor="#f5c518" />
        <KPICard icon="📊" titulo="Ticket Médio" valor={fmt(ticketMedio)} variacao={pct(ticketMedio, ticketAnt)} cor="#60a5fa" />
        <KPICard icon="👥" titulo="Novos Clientes" valor={userIds.length} variacao={pct(userIds.length, userIdsAnt.length)} cor="#a78bfa" />
        <KPICard icon="❌" titulo="Taxa Cancelamento" valor={`${taxaCancel.toFixed(1)}%`} variacao={pct(taxaCancel, taxaCancelAnt)} cor="#ef4444" invertVariation />
        <KPICard icon="🍽️" titulo="Produtos Vendidos" valor={topProdutos.reduce((s, [, d]) => s + d.qty, 0)} cor="#f97316" />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        {/* Faturamento chart */}
        <div style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 16, padding: 16
        }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>💰 Faturamento</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={.4}/>
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "rgba(255,255,255,.4)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,.4)" }} tickLine={false} axisLine={false}
                tickFormatter={v => v >= 1000 ? `R$${(v/1000).toFixed(0)}k` : `R$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="faturamento" stroke="#22c55e" strokeWidth={2} fill="url(#gradFat)" name="faturamento" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pedidos chart */}
        <div style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 16, padding: 16
        }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>📋 Pedidos</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.06)" />
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "rgba(255,255,255,.4)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,.4)" }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pedidos" fill="#f5c518" radius={[4, 4, 0, 0]} name="pedidos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {/* Top produtos */}
        <div style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 16, padding: 16
        }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>🏆 Top Produtos</div>
          {topProdutos.length === 0 && (
            <div style={{ color: "rgba(255,255,255,.3)", fontSize: "0.8rem" }}>Nenhum produto vendido no período</div>
          )}
          {topProdutos.map(([nome, dados], i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 800, color: i === 0 ? "#f5c518" : "rgba(255,255,255,.4)", width: 16 }}>#{i + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nome}</div>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.08)", marginTop: 4 }}>
                  <div style={{ height: "100%", borderRadius: 2, background: "#f5c518", width: `${(dados.qty / totalProdutos) * 100}%` }} />
                </div>
              </div>
              <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#f5c518", flexShrink: 0 }}>{dados.qty}x</span>
            </div>
          ))}
        </div>

        {/* Formas de pagamento */}
        <div style={{
          background: "rgba(255,255,255,.04)",
          border: "1px solid rgba(255,255,255,.08)",
          borderRadius: 16, padding: 16
        }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>💳 Formas de Pagamento</div>
          {pagamentoData.map(({ tipo, qty, total }) => (
            <div key={tipo} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{tipo}</span>
                <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.4)" }}>{qty} pedidos · {fmt(total)}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.08)" }}>
                <div style={{ height: "100%", borderRadius: 3, background: "#7c3aed", width: `${faturamento > 0 ? (total / faturamento) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== EDITAR CARDS MODAL =====
function EditarCardsModal({ menus, onSave, onClose }) {
  const [editMenus, setEditMenus] = useState(menus);

  const mover = (idx, dir) => {
    const nova = [...editMenus];
    const novoIdx = idx + dir;
    if (novoIdx < 0 || novoIdx >= nova.length) return;
    [nova[idx], nova[novoIdx]] = [nova[novoIdx], nova[idx]];
    setEditMenus(nova);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "var(--bg)", borderRadius: 16, padding: 16, width: "100%", maxWidth: 420, border: "1px solid var(--border)", maxHeight: "85vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: "1rem", fontWeight: 700 }}>✏️ Editar Cards</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.2rem" }}>✕</button>
        </div>
        {editMenus.map((menu, idx) => (
          <div key={menu.id} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 7, padding: "7px 7px", background: menu.color, borderRadius: 10, color: "#fff" }}>
            <button
              onClick={() => mover(idx, -1)}
              disabled={idx === 0}
              style={{ background: "rgba(0,0,0,0.2)", border: "none", borderRadius: 6, color: "#fff", width: 26, height: 26, cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", opacity: idx === 0 ? 0.3 : 1 }}
            >↑</button>
            <button
              onClick={() => mover(idx, 1)}
              disabled={idx === editMenus.length - 1}
              style={{ background: "rgba(0,0,0,0.2)", border: "none", borderRadius: 6, color: "#fff", width: 26, height: 26, cursor: "pointer", fontSize: "0.8rem", display: "flex", alignItems: "center", justifyContent: "center", opacity: idx === editMenus.length - 1 ? 0.3 : 1 }}
            >↓</button>
            <span style={{ fontSize: "1.2rem" }}>{menu.emoji}</span>
            <input
              value={menu.label}
              onChange={(e) => setEditMenus(editMenus.map((m, i) => i === idx ? { ...m, label: e.target.value } : m))}
              style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 6, padding: "3px 6px", color: "#fff", fontSize: "0.75rem", fontFamily: "'Outfit', sans-serif" }}
            />
            <span
              contentEditable
              suppressContentEditableWarning
              onInput={(e) => setEditMenus(editMenus.map((m, i) => i === idx ? { ...m, emoji: e.target.textContent } : m))}
              style={{ fontSize: "1.2rem", width: 32, textAlign: "center", background: "rgba(255,255,255,0.2)", borderRadius: 6, padding: "3px 2px", outline: "none", minWidth: 32, display: "inline-block", lineHeight: 1.2 }}
            >{menu.emoji}</span>
            <input
              type="color"
              value={menu.color}
              onChange={(e) => setEditMenus(editMenus.map((m, i) => i === idx ? { ...m, color: e.target.value } : m))}
              style={{ width: 30, height: 28, border: "none", borderRadius: 6, cursor: "pointer", padding: 2, background: "rgba(255,255,255,0.2)" }}
            />
          </div>
        ))}
        <button
          onClick={() => onSave(editMenus)}
          style={{ width: "100%", marginTop: 10, padding: 10, background: "var(--purple2)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}
        >Salvar tudo</button>
        <button onClick={onClose} style={{ width: "100%", marginTop: 6, padding: 8, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>Cancelar</button>
      </div>
    </div>
  );
}

// ===== PEDIDOS =====// ===== PEDIDOS =====
function TabPedidos({ onNovoPedido, onNavigate }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [atualizando, setAtualizando] = useState(null);
  const [silenciado, setSilenciadoState] = useState(false);
  const [impressaoAtiva, setImpressaoAtiva] = useState(true);
  const [ativado, setAtivado] = useState(false);
  const [enviandoVideo, setEnviandoVideo] = useState(null); // pedidoId em upload
  const [modoSelecao, setModoSelecao] = useState(false); // modo seleção múltipla
  const [selecionados, setSelecionados] = useState(new Set()); // IDs selecionados
  const pedidosAnteriores = useRef(null);
  const videoInputRef = useRef(null);
  const videoPedidoRef = useRef(null); // pedido alvo do upload
  const { tenantId } = useStore();
  const t = (c) => tenantId ? `tenants/${tenantId}/${c}` : c;
  const { tocarNovoPedido, setSilenciado } = useSom();

  // ── Chat Entregador Full Screen ──────────────────────────────
  function ChatEntregadorFullScreen() {
    const [pedidosComEntregador, setPedidosComEntregador] = useState([]);
    const [chatAberto, setChatAberto] = useState(null);
    const { tenantId } = useStore();

    useEffect(() => {
      if (!tenantId) return;
      const q = query(collection(db, "pedidos"), where("tenantId", "==", tenantId), where("status", "in", ["entrega", "pronto"]));
      return onSnapshot(q, snap => {
        setPedidosComEntregador(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.entregadorId));
      });
    }, [tenantId]);

    if (chatAberto) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 16px", background: "var(--bg2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setChatAberto(null)} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", fontSize: "1rem" }}>←</button>
            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>🛵 Chat com Entregador</span>
          </div>
          <div style={{ flex: 1 }}>
            <ChatEntregador pedidoId={chatAberto.pedidoId} entregadorId={chatAberto.entregadorId} onClose={() => setChatAberto(null)} />
          </div>
        </div>
      );
    }

    return (
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 12 }}>🛵 Pedidos com entregador</div>
        {pedidosComEntregador.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Nenhum pedido em entrega</div>
        )}
        {pedidosComEntregador.map(p => (
          <div key={p.id} onClick={() => setChatAberto({ pedidoId: p.id, entregadorId: p.entregadorId })}
            style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: "2rem" }}>🛵</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.9rem" }}>{p.nomeCliente}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>Pedido #{p.numeroPedido}</div>
              {p.entregadorNome && <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>Motorista: {p.entregadorNome}</div>}
            </div>
            <div style={{ color: "var(--text3)", fontSize: "1.2rem" }}>💬</div>
          </div>
        ))}
      </div>
    );
  }

  // ── Chat Cliente Full Screen ──────────────────────────────────
  function ChatPageFullScreen() {
    const [chats, setChats] = useState([]);
    const [chatSelecionado, setChatSelecionado] = useState(null);
    const [lojaDocId, setLojaDocId] = useState(null);
    const { tenantId } = useStore();

    useEffect(() => {
      if (!tenantId) return;
      getDocs(query(collection(db, "lojas"), where("tenantId", "==", tenantId), limit(1))).then(snap => {
        if (!snap.empty) setLojaDocId(snap.docs[0].id);
      });
    }, [tenantId]);

    useEffect(() => {
      if (!lojaDocId) return;
      const lojaVirtualId = `loja_${lojaDocId}`;
      const q = query(collection(db, "chats"), where("participantes", "array-contains", lojaVirtualId));
      return onSnapshot(q, snap => {
        setChats(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0)));
      });
    }, [lojaDocId]);

    const lojaVirtualId = lojaDocId ? `loja_${lojaDocId}` : null;

    if (chatSelecionado) {
      return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 16px", background: "var(--bg2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
            <button onClick={() => setChatSelecionado(null)} style={{ background: "none", border: "none", color: "var(--text)", cursor: "pointer", fontSize: "1rem" }}>←</button>
            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>💬 Chat</span>
          </div>
          <div style={{ flex: 1 }}>
            <ChatPage chatId={chatSelecionado} />
          </div>
        </div>
      );
    }

    return (
      <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 12 }}>💬 Conversas com clientes</div>
        {chats.length === 0 && (
          <div style={{ textAlign: "center", color: "var(--text2)", padding: 32 }}>Nenhuma conversa ainda</div>
        )}
        {chats.map(c => {
          const outroId = c.participantes?.find(p => !p.startsWith("loja_"));
          const outroInfo = c.participantesInfo?.[outroId] || {};
          const naoLido = lojaVirtualId ? (c.naoLido?.[lojaVirtualId] || 0) : 0;
          return (
            <div key={c.id} onClick={() => setChatSelecionado(c.id)}
              style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 10, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>
                {outroInfo.foto ? <img src={outroInfo.foto} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : "👤"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{outroInfo.nome || "Cliente"}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.ultimaMensagem?.texto || "—"}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                {naoLido > 0 && <div style={{ background: "var(--purple2)", color: "#fff", borderRadius: 20, padding: "2px 8px", fontSize: "0.62rem", fontWeight: 800 }}>{naoLido}</div>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const ativarAudio = () => {
    if (!ativado) {
      try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); ctx.resume(); ctx.close(); } catch (e) {}
      setAtivado(true);
    }
  };

  // Impressão automática do pedido
  const imprimirPedido = (pedido) => {
    const data = pedido.createdAt?.toDate ? pedido.createdAt.toDate() : new Date();
    const dataStr = data.toLocaleString("pt-BR", { day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit" });
    const itens = pedido.items?.map(i => `
      <tr>
        <td style="padding:2px 0">${i.qty}x ${i.nome}</td>
        <td style="text-align:right;padding:2px 0">R$${(i.preco*i.qty).toFixed(2).replace(".",",")}</td>
      </tr>`).join("") || "";

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: monospace; font-size: 13px; width: 280px; padding: 8px; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .big { font-size: 16px; font-weight: bold; }
  table { width: 100%; }
  .total { font-size: 15px; font-weight: bold; }
</style>
</head>
<body>
  <div class="center bold" style="font-size:15px">🫐 AÇAÍ PURO GOSTO</div>
  <div class="center" style="font-size:11px">acaipurogosto.com.br</div>
  <div class="line"></div>
  <div class="center" style="font-size:11px">${dataStr}</div>
  <div class="line"></div>
  <div class="bold">Cliente: ${pedido.nomeCliente || "—"}</div>
  ${pedido.telefone ? `<div style="font-size:11px">Tel: ${pedido.telefone}</div>` : ""}
  <div class="line"></div>
  <table>${itens}</table>
  <div class="line"></div>
  <table>
    <tr><td class="total">TOTAL</td><td class="total" style="text-align:right">R$${(pedido.total||0).toFixed(2).replace(".",",")}</td></tr>
  </table>
  <div class="line"></div>
  <div class="bold">Pagamento: ${(pedido.pagamento||"").toUpperCase()}</div>
  <div class="bold">${pedido.tipoEntrega === "entrega" ? "🛵 DELIVERY" : "🏠 RETIRADA"}</div>
  ${pedido.tipoEntrega === "entrega" && pedido.endereco ? `<div style="font-size:11px">📍 ${pedido.endereco}</div>` : ""}
  ${pedido.obs ? `<div style="font-size:11px">📝 ${pedido.obs}</div>` : ""}
  <div class="line"></div>
  <div class="center" style="font-size:11px">Obrigado pela preferência! 🫐</div>
</body>
</html>`;

    const janela = window.open("", "_blank", "width=320,height=500");
    if (!janela) { alert("Permita pop-ups para imprimir automaticamente!"); return; }
    janela.document.write(html);
    janela.document.close();
    setTimeout(() => { janela.print(); setTimeout(() => janela.close(), 2000); }, 500);
  };

  const toggleSilencio = () => {
    const novo = !silenciado;
    setSilenciadoState(novo);
    setSilenciado(novo);
    ativarAudio();
  };

  // ── Seleção múltipla ──
  const toggleSelecao = () => {
    if (modoSelecao) {
      setSelecionados(new Set());
    }
    setModoSelecao(!modoSelecao);
  };

  const togglePedido = (id) => {
    const novo = new Set(selecionados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setSelecionados(novo);
  };

  const batchAvancar = async (novoStatus) => {
    if (selecionados.size === 0) return;
    if (!window.confirm(`Confirmar ${selecionados.size} pedido(s) para "${novoStatus}"?`)) return;
    ativarAudio();
    setAtualizando("batch");
    try {
      await Promise.all([...selecionados].map(id => updateDoc(doc(db, "pedidos", id), { status: novoStatus })));
      setSelecionados(new Set());
      setModoSelecao(false);
    } catch { alert("Erro ao atualizar pedidos."); }
    finally { setAtualizando(null); }
  };

  const batchCancelar = async () => {
    if (selecionados.size === 0) return;
    if (!window.confirm(`Cancelar ${selecionados.size} pedido(s)?`)) return;
    ativarAudio();
    setAtualizando("batch");
    try {
      await Promise.all([...selecionados].map(id => updateDoc(doc(db, "pedidos", id), { status: "cancelado" })));
      setSelecionados(new Set());
      setModoSelecao(false);
    } catch { alert("Erro ao cancelar pedidos."); }
    finally { setAtualizando(null); }
  };

  // ── View mode Kanban / Lista ──
  const [viewMode, setViewMode] = useState("kanban");
  // ── Tempo atual para mostrar nos cards (atualiza a cada 30s) ──
  const [tempoCards, setTempoCards] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setTempoCards(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // ── SLA thresholds por status (minutos) — verde / amarelo / vermelho ──
  // Total máx: 30min do pedido até o cliente
  const SLA_KANBAN = {
    pendente: { yellow: 1, red: 2 },   // confirmação rápida
    preparo:  { yellow: 10, red: 20 }, // tempo maior de produção
    pronto:   { yellow: 5, red: 7 },   // transição rápida
    entrega:  { yellow: 25, red: 30 }, // último estágio
    entregue: { yellow: 999, red: 999 },
  };

  // ── Cor e animação de alerta por tempo e status ──
  const getCardAlerta = (pedido, statusId, now) => {
    if (!pedido.createdAt) return { cor: "rgba(34,197,94,0.5)", anim: "none" };
    const d = pedido.createdAt?.toDate ? pedido.createdAt.toDate() : new Date(pedido.createdAt);
    const min = Math.floor((now - d.getTime()) / 60000);
    const t = SLA_KANBAN[statusId] || { yellow: 5, red: 10 };
    if (min >= t.red) return { cor: "rgba(239,68,68,0.7)", anim: "pulseAlerta 1.5s ease-in-out infinite" };
    if (min >= t.yellow) return { cor: "rgba(245,158,11,0.6)", anim: "pulseAlerta 2.5s ease-in-out infinite" };
    return { cor: "rgba(34,197,94,0.4)", anim: "none" };
  };

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, "pedidos"),
      where("tenantId", "==", tenantId),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      const novos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (pedidosAnteriores.current !== null) {
        const idsAnteriores = new Set(pedidosAnteriores.current.map(p => p.id));
        const chegaram = novos.filter(p => !idsAnteriores.has(p.id));
        if (chegaram.length > 0) {
          tocarNovoPedido();
          onNovoPedido && onNovoPedido();
          if (Notification.permission === "granted") {
            new Notification("🫐 Novo pedido!", {
              body: `${chegaram[0].nomeCliente} · R$ ${chegaram[0].total?.toFixed(2).replace(".", ",")}`,
            });
          }
          // Impressão automática
          if (impressaoAtiva) {
            setTimeout(() => imprimirPedido(chegaram[0]), 1000);
          }
        }
      }
      pedidosAnteriores.current = novos;
      setPedidos(novos);
      setLoading(false);
    });
    return unsub;
  }, [tocarNovoPedido, tenantId]);

  useEffect(() => {
    if (Notification.permission === "default") Notification.requestPermission();
  }, []);

  // ── Stats de hoje vs ontem + padrão semanal ──
  const [stats, setStats] = useState({ hoje: 0, ontem: 0, fatHoje: 0, fatOntem: 0, melhorDia: null, piorDia: null });
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Notificação flutuante de chat ──
  const [chatNotif, setChatNotif] = useState(null); // { chatId, nome, foto, mensagem, chatId }

  useEffect(() => {
    if (!tenantId) return;
    const lojaDocId = tenantId;
    const lojaVirtualId = `loja_${lojaDocId}`;
    const q = query(collection(db, "chats"), where("participantes", "array-contains", lojaVirtualId));
    const unsub = onSnapshot(q, snap => {
      snap.docs.forEach(d => {
        const chat = { id: d.id, ...d.data() };
        const ultimo = chat.ultimaMensagem;
        if (!ultimo) return;
        // Só mostra se a última mensagem foi do cliente (não da loja) e é nova (últimos 30s)
        if (ultimo.autorId === lojaVirtualId) return;
        const agora = Date.now();
        const msgTime = ultimo.criadoEm?.toMillis ? ultimo.criadoEm.toMillis() : 0;
        if (agora - msgTime > 30000) return; // só últimas 30s
        // Pega info do cliente
        const outroId = chat.participantes?.find(p => !p.startsWith("loja_"));
        const info = chat.participantesInfo?.[outroId] || {};
        setChatNotif({
          chatId: chat.id,
          nome: info.nome || "Cliente",
          foto: info.foto || null,
          mensagem: ultimo.texto || "📷 Nova mensagem",
        });
      });
    });
    return unsub;
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const agora = new Date();
    const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    const inicioOntem = new Date(inicioHoje);
    inicioOntem.setDate(inicioOntem.getDate() - 1);
    const inicioMes = new Date(inicioHoje);
    inicioMes.setDate(inicioMes.getDate() - 30);

    Promise.all([
      getDocs(query(collection(db, "pedidos"), where("tenantId", "==", tenantId), where("createdAt", ">=", Timestamp.fromDate(inicioHoje)))),
      getDocs(query(collection(db, "pedidos"), where("tenantId", "==", tenantId), where("createdAt", ">=", Timestamp.fromDate(inicioOntem)), where("createdAt", "<", Timestamp.fromDate(inicioHoje)))),
      getDocs(query(collection(db, "pedidos"), where("tenantId", "==", tenantId), where("createdAt", ">=", Timestamp.fromDate(inicioMes)))),
    ]).then(([snapHoje, snapOntem, snapMes]) => {
      const pedidosHoje = snapHoje.docs.filter(d => d.data().status !== "cancelado");
      const pedidosOntem = snapOntem.docs.filter(d => d.data().status !== "cancelado");
      const pedidosMes = snapMes.docs.filter(d => d.data().status !== "cancelado");

      const fatHoje = pedidosHoje.reduce((s, d) => s + (d.data().total || 0), 0);
      const fatOntem = pedidosOntem.reduce((s, d) => s + (d.data().total || 0), 0);

      // Padrão semanal (últimos 30 dias)
      const dias = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
      const somaPorDia = Array(7).fill(0);
      const countPorDia = Array(7).fill(0);
      pedidosMes.forEach(d => {
        const dt = d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(d.data().createdAt);
        somaPorDia[dt.getDay()] += d.data().total || 0;
        countPorDia[dt.getDay()]++;
      });
      const mediaPorDia = somaPorDia.map((s, i) => countPorDia[i] > 0 ? s / countPorDia[i] : 0);
      const maxMedia = Math.max(...mediaPorDia);
      const minMedia = Math.min(...mediaPorDia.filter(v => v > 0));
      const melhorDia = dias[mediaPorDia.indexOf(maxMedia)];
      const piorDia = dias[mediaPorDia.indexOf(minMedia === maxMedia ? mediaPorDia.find(v => v > 0 && v < maxMedia) : minMedia)];

      setStats({
        hoje: pedidosHoje.length,
        ontem: pedidosOntem.length,
        fatHoje,
        fatOntem,
        melhorDia,
        piorDia,
      });
      setStatsLoading(false);
    });
  }, [tenantId, pedidos.length]); // atualiza quando pedidos mudam

  // Atualiza status SEM abrir WhatsApp — Firebase Function cuida das notificações
  const atualizarStatus = async (pedidoId, novoStatus) => {
    ativarAudio();
    setAtualizando(pedidoId);
    try {
      const user = auth?.currentUser;
      await updateDoc(doc(db, "pedidos", pedidoId), { status: novoStatus });
      // Audit log
      await addDoc(collection(db, "auditLog"), {
        uid: user?.uid || "desconhecido",
        nome: user?.displayName || user?.email || "—",
        action: "status_update",
        pedidoId,
        antigo: "", // simplificado — não temos o status anterior salvo aqui
        novo: novoStatus,
        tenantId,
        createdAt: serverTimestamp(),
      });
    } catch { alert("Erro ao atualizar status."); }
    finally { setAtualizando(null); }
  };

  const confirmarPedidoChat = async (pedido) => {
    ativarAudio();
    setAtualizando(pedido.id);
    try {
      await updateDoc(doc(db, "pedidos", pedido.id), { status: "confirmado", chatBloqueado: false });
      if (pedido.chatId) {
        await updateDoc(doc(db, "chats", pedido.chatId), { bloqueado: false, updatedAt: serverTimestamp() });
        // Mensagem automática no chat
        const lojaVirtualId = `loja_${tenantId}`;
        await addDoc(collection(db, "chats", pedido.chatId, "mensagens"), {
          autorId: lojaVirtualId,
          autorNome: "Loja",
          tipo: "texto",
          texto: `✅ Pedido #${pedido.numeroPedido || ""} confirmado! Pode falar comigo por aqui 🎉`,
          criadoEm: serverTimestamp(),
          lida: false,
          replyTo: null,
          reacoes: {},
        });
        // Atualiza ultimaMensagem do chat
        await updateDoc(doc(db, "chats", pedido.chatId), {
          ultimaMensagem: { texto: `✅ Pedido confirmado!`, criadoEm: serverTimestamp(), autorId: lojaVirtualId },
          [`naoLido.${pedido.userId}`]: increment(1),
        });
      }
    } catch { alert("Erro ao confirmar pedido."); }
    finally { setAtualizando(null); }
  };

  const recusarPedidoChat = async (pedido) => {
    ativarAudio();
    if (!window.confirm("Recusar este pedido?")) return;
    setAtualizando(pedido.id);
    try {
      await updateDoc(doc(db, "pedidos", pedido.id), { status: "cancelado", chatBloqueado: false });
      if (pedido.chatId) {
        await updateDoc(doc(db, "chats", pedido.chatId), { bloqueado: false, updatedAt: serverTimestamp() });
        const lojaVirtualId = `loja_${tenantId}`;
        await addDoc(collection(db, "chats", pedido.chatId, "mensagens"), {
          autorId: lojaVirtualId,
          autorNome: "Loja",
          tipo: "texto",
          texto: `😔 Não foi possível aceitar seu pedido no momento. Entre em contato para mais informações.`,
          criadoEm: serverTimestamp(),
          lida: false,
          replyTo: null,
          reacoes: {},
        });
        await updateDoc(doc(db, "chats", pedido.chatId), {
          ultimaMensagem: { texto: `Pedido não aceito`, criadoEm: serverTimestamp(), autorId: lojaVirtualId },
          [`naoLido.${pedido.userId}`]: increment(1),
        });
      }
    } catch { alert("Erro ao recusar pedido."); }
    finally { setAtualizando(null); }
  };

  const enviarVideoVerificacao = async (pedido, file) => {
    if (!file || !pedido.chatId) return;
    setEnviandoVideo(pedido.id);
    try {
      const path = `pedidos-video/${pedido.chatId}/${Date.now()}_verificacao.${file.name.split(".").pop()}`;
      const sRef = storageRef(storage, path);
      const task = uploadBytesResumable(sRef, file);
      await new Promise((res, rej) => task.on("state_changed", null, rej, res));
      const url = await getDownloadURL(task.snapshot.ref);
      const lojaVirtualId = `loja_${tenantId}`;
      await addDoc(collection(db, "chats", pedido.chatId, "mensagens"), {
        autorId: lojaVirtualId,
        autorNome: "Loja",
        tipo: "video",
        midia: url,
        texto: `📦 Confira todos os itens do seu pedido #${pedido.numeroPedido || ""}`,
        criadoEm: serverTimestamp(),
        lida: false,
        replyTo: null,
        reacoes: {},
        isVerificacaoPedido: true,
        tipoVerificacao: "loja",
      });
      await updateDoc(doc(db, "chats", pedido.chatId), {
        ultimaMensagem: { texto: "📹 Vídeo de verificação do pedido", criadoEm: serverTimestamp(), autorId: lojaVirtualId },
        updatedAt: serverTimestamp(),
        [`naoLido.${pedido.userId}`]: increment(1),
      });
      alert("✅ Vídeo enviado ao cliente!");
    } catch (e) {
      console.error(e);
      alert("Erro ao enviar vídeo.");
    } finally {
      setEnviandoVideo(null);
    }
  };

  const pedidosFiltrados = filtro === "todos" ? pedidos : pedidos.filter(p => p.status === filtro);
  const contadores = STATUS_LIST.reduce((acc, s) => { acc[s.id] = pedidos.filter(p => p.status === s.id).length; return acc; }, {});

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Carregando pedidos...</div>;

  return (
    <div onClick={ativarAudio} style={{ position: "relative" }}>
      {/* ── Notificação flutuante de chat ── */}
      {chatNotif && (
        <div
          onClick={() => { setFiltro("chatCliente"); setChatNotif(null); }}
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 9999,
            background: "linear-gradient(135deg, #7c3aed, #5b21b6)",
            border: "2px solid rgba(139,92,246,0.5)",
            borderRadius: 16, padding: "12px 16px",
            display: "flex", alignItems: "center", gap: 12,
            boxShadow: "0 8px 32px rgba(124,58,237,0.4)",
            cursor: "pointer", maxWidth: 300,
            animation: "fadeInUp 0.3s ease",
          }}
        >
          <style>{`@keyframes fadeInUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }`}</style>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden" }}>
            {chatNotif.foto ? <img src={chatNotif.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "👤"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", color: "#fff", marginBottom: 2 }}>{chatNotif.nome}</div>
            <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.75rem", color: "rgba(255,255,255,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chatNotif.mensagem}</div>
          </div>
          <button onClick={e => { e.stopPropagation(); setChatNotif(null); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: "1rem", padding: 4, flexShrink: 0 }}>✕</button>
        </div>
      )}

      {/* ── Barra de Stats ── */}
      {!statsLoading && (
        <div style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.1))", border: "1px solid rgba(124,58,237,0.25)", borderRadius: 12, padding: "10px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: "12px 24px", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.85rem" }}>🛒</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", color: "var(--text2)" }}>Hoje:</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: "1rem", color: "var(--purple2)" }}>{stats.hoje}</span>
            <span style={{ fontSize: "0.72rem", color: stats.hoje >= stats.ontem ? "var(--green)" : "var(--red)" }}>
              {stats.ontem > 0 ? `(${stats.hoje >= stats.ontem ? "↑" : "↓"} ${Math.round(Math.abs(stats.hoje - stats.ontem) / stats.ontem * 100)}% vs ontem)` : "(primeiro dia)"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: "0.85rem" }}>💰</span>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", color: "var(--text2)" }}>Faturamento:</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: "1rem", color: "var(--gold)" }}>R$ {stats.fatHoje.toFixed(2).replace(".", ",")}</span>
          </div>
          {stats.fatHoje > 0 && stats.hoje > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: "0.85rem" }}>⭐</span>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", color: "var(--text2)" }}>Ticket:</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 800, fontSize: "0.95rem", color: "var(--green)" }}>R$ {(stats.fatHoje / stats.hoje).toFixed(2).replace(".", ",")}</span>
            </div>
          )}
          {stats.melhorDia && stats.piorDia && (
            <div style={{ marginLeft: "auto", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 8, padding: "4px 10px", display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "0.72rem", color: "var(--gold)" }}>📊 {stats.melhorDia} é o dia mais forte · {stats.piorDia} é o mais fraco</span>
              <button onClick={() => onNavigate(6)} style={{ background: "rgba(245,197,24,0.2)", border: "1px solid rgba(245,197,24,0.4)", borderRadius: 6, padding: "2px 8px", cursor: "pointer", color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontSize: "0.68rem", fontWeight: 700 }}>
                Ver detalhes →
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: "0.78rem", color: "var(--text3)" }}>{pedidos.length} pedido(s) · tempo real</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={toggleSilencio} style={{
            background: silenciado ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
            border: `1px solid ${silenciado ? "var(--red)" : "var(--green)"}`,
            borderRadius: 20, padding: "6px 12px", cursor: "pointer",
            color: silenciado ? "var(--red)" : "var(--green)",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600,
          }}>
            {silenciado ? "🔇" : "🔔"}
          </button>
          <button onClick={() => setImpressaoAtiva(p => !p)} style={{
            background: impressaoAtiva ? "rgba(96,165,250,0.1)" : "rgba(239,68,68,0.1)",
            border: `1px solid ${impressaoAtiva ? "#60a5fa" : "var(--red)"}`,
            borderRadius: 20, padding: "6px 12px", cursor: "pointer",
            color: impressaoAtiva ? "#60a5fa" : "var(--red)",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600,
          }}>
            {impressaoAtiva ? "🖨️ Auto" : "🖨️ Off"}
          </button>
          <button onClick={toggleSelecao} style={{
            background: modoSelecao ? "rgba(168,85,247,0.3)" : "rgba(168,85,247,0.15)",
            border: `1px solid ${modoSelecao ? "#a855f7" : "rgba(168,85,247,0.5)"}`,
            borderRadius: 20, padding: "6px 14px", cursor: "pointer",
            color: modoSelecao ? "#e879f9" : "#c084fc",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.8rem", fontWeight: 700,
            boxShadow: modoSelecao ? "0 0 12px rgba(168,85,247,0.3)" : "none",
            transition: "all 0.2s",
          }}>
            {modoSelecao ? "✕ Sair" : "☑️ Selecionar"}
          </button>
        </div>
      </div>

      {/* ── Barra de seleção múltipla ── */}
      {modoSelecao && (
        <div style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(6,182,212,0.1))", border: "1px solid rgba(168,85,247,0.3)", borderRadius: 12, padding: "10px 16px", marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", color: "var(--purple2)", fontWeight: 700 }}>
            {selecionados.size} selecionado{selecionados.size !== 1 ? "s" : ""}
          </span>
          <button
            onClick={() => batchAvancar("confirmado")}
            disabled={atualizando === "batch" || selecionados.size === 0}
            style={{ padding: "6px 14px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 20, color: "var(--green)", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", opacity: atualizando === "batch" ? 0.5 : 1 }}
          >
            ✓ Confirmar todos
          </button>
          <button
            onClick={() => batchAvancar("preparo")}
            disabled={atualizando === "batch" || selecionados.size === 0}
            style={{ padding: "6px 14px", background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.4)", borderRadius: 20, color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", opacity: atualizando === "batch" ? 0.5 : 1 }}
          >
            🫐 Preparo
          </button>
          <button
            onClick={() => batchAvancar("pronto")}
            disabled={atualizando === "batch" || selecionados.size === 0}
            style={{ padding: "6px 14px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 20, color: "var(--green)", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", opacity: atualizando === "batch" ? 0.5 : 1 }}
          >
            🎉 Pronto
          </button>
          <button
            onClick={batchCancelar}
            disabled={atualizando === "batch" || selecionados.size === 0}
            style={{ padding: "6px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, color: "var(--red)", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", opacity: atualizando === "batch" ? 0.5 : 1 }}
          >
            ✕ Cancelar
          </button>
        </div>
      )}


      {/* Toggle Lista / Kanban */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button onClick={() => setViewMode(v => v === "kanban" ? "lista" : "kanban")} style={{
          background: viewMode === "kanban" ? "rgba(168,85,247,0.15)" : "rgba(34,197,94,0.1)",
          border: `1px solid ${viewMode === "kanban" ? "rgba(168,85,247,0.4)" : "rgba(34,197,94,0.3)"}`,
          borderRadius: 20, padding: "6px 14px", cursor: "pointer",
          color: viewMode === "kanban" ? "var(--purple2)" : "var(--green)",
          fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600,
        }}>
          {viewMode === "kanban" ? "📋 Ver Lista" : "🎯 Ver Kanban"}
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {[
          { id: "todos",    label: "Todos",      count: pedidos.length,      color: "var(--text)" },
          { id: "pendente", label: "Pendentes",  count: contadores.pendente, color: "var(--gold)" },
          { id: "preparo",  label: "Em preparo", count: contadores.preparo,  color: "var(--purple2)" },
          { id: "entrega",  label: "Em entrega", count: contadores.entrega,  color: "#f97316" },
          { id: "entregue", label: "Entregues",  count: contadores.entregue, color: "var(--green)" },
        ].map(f => (
          <button key={f.id} onClick={() => setFiltro(f.id)} style={{
            flexShrink: 0, padding: "8px 14px",
            background: filtro === f.id ? "var(--surface2)" : "var(--bg2)",
            border: `1px solid ${filtro === f.id ? "var(--border2)" : "var(--border)"}`,
            borderRadius: 20, cursor: "pointer",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600,
            color: filtro === f.id ? f.color : "var(--text2)",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {f.label}
            {f.count > 0 && (
              <span style={{ background: filtro === f.id ? f.color : "var(--bg3)", color: filtro === f.id ? "var(--bg)" : "var(--text2)", borderRadius: 10, padding: "1px 7px", fontSize: "0.72rem", fontWeight: 700 }}>
                {f.count}
              </span>
            )}
          </button>
        ))}
        <div style={{ flexShrink: 0, width: 1, background: "var(--border)", margin: "6px 0" }} />
        <button onClick={() => setFiltro("chatEntregador")} style={{
          flexShrink: 0, padding: "8px 14px",
          background: filtro === "chatEntregador" ? "rgba(6,182,212,0.15)" : "var(--bg2)",
          border: `1px solid ${filtro === "chatEntregador" ? "rgba(6,182,212,0.4)" : "var(--border)"}`,
          borderRadius: 20, cursor: "pointer",
          fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600,
          color: filtro === "chatEntregador" ? "#22d3ee" : "var(--text2)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          🛵 Chat Entregador
        </button>
        <button onClick={() => setFiltro("chatCliente")} style={{
          flexShrink: 0, padding: "8px 14px",
          background: filtro === "chatCliente" ? "rgba(168,85,247,0.15)" : "var(--bg2)",
          border: `1px solid ${filtro === "chatCliente" ? "rgba(168,85,247,0.4)" : "var(--border)"}`,
          borderRadius: 20, cursor: "pointer",
          fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600,
          color: filtro === "chatCliente" ? "var(--purple2)" : "var(--text2)",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          💬 Chat Cliente
        </button>
      </div>

      {/* ── CHAT ENTREGADOR ── */}
      {filtro === "chatEntregador" && (
        <ChatEntregadorFullScreen />
      )}

      {/* ── CHAT CLIENTE ── */}
      {filtro === "chatCliente" && (
        <ChatPageFullScreen />
      )}

      {/* ── KANBAN VIEW (não mostra quando chat selecionado) ── */}
      {viewMode === "kanban" && filtro !== "chatEntregador" && filtro !== "chatCliente" ? (
        <div style={{ position: "relative" }}>
          {/* Seta esquerda */}
          <button onClick={() => { const el = document.getElementById("kanban-scroll"); if (el) el.scrollBy({ left: -300, behavior: "smooth" }); }} style={{
            position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
            zIndex: 10, width: 36, height: 52, borderRadius: "0 14px 14px 0",
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            border: "none", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.8rem", fontWeight: 900, boxShadow: "0 4px 20px rgba(124,58,237,.4)",
          }}>‹</button>
          {/* Seta direita */}
          <button onClick={() => { const el = document.getElementById("kanban-scroll"); if (el) el.scrollBy({ left: 300, behavior: "smooth" }); }} style={{
            position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)",
            zIndex: 10, width: 36, height: 52, borderRadius: "14px 0 0 14px",
            background: "linear-gradient(135deg, #7c3aed, #6d28d9)",
            border: "none", color: "#fff", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.8rem", fontWeight: 900, boxShadow: "0 4px 20px rgba(124,58,237,.4)",
          }}>›</button>
          <div id="kanban-scroll" style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 8 }}>
          {["pendente", "preparo", "pronto", "entrega", "entregue"].map(statusId => {
            const statusInfo = STATUS_LIST.find(s => s.id === statusId) || STATUS_LIST[2];
            const isEntregueView = filtro === "entregue" && statusId === "entregue";
            const colPedidos = isEntregueView
              ? pedidos.filter(p => {
                  if (p.status !== "entregue") return false;
                  if (!p.createdAt) return false;
                  const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
                  return d.toDateString() === new Date().toDateString();
                })
              : statusId === "entregue" ? [] : pedidos.filter(p => p.status === statusId);
            const nextMap = { pendente: "preparo", preparo: "pronto", pronto: "entrega", entrega: "entregue" };
            const prevMap = { preparo: "pendente", pronto: "preparo", entrega: "pronto" };
            const btnConfig = {
              pendente: { label: "✓ Confirmar", bg: "linear-gradient(135deg, #a855f7, #7c3aed)", icon: "→" },
              preparo:  { label: "🎉 Pronto",   bg: "linear-gradient(135deg, #22c55e, #16a34a)", icon: "→" },
              pronto:   { label: "🛵 Sair p/ entrega", bg: "linear-gradient(135deg, #f97316, #ea580c)", icon: "" },
              entrega:  { label: "✓ Entregue", bg: "linear-gradient(135deg, #22c55e, #16a34a)", icon: "" },
            };
            const btn = btnConfig[statusId];
            return (
              <div key={statusId} style={{ minWidth: 285, flex: "0 0 285px", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ background: statusInfo?.color + "22", color: statusInfo?.color, border: `1px solid ${statusInfo?.color}44`, borderRadius: 10, padding: "6px 10px", fontSize: "0.72rem", fontWeight: 700, display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 5 }}>
                  <span>{statusInfo?.icon} {statusInfo?.label}</span>
                  <span style={{ background: statusInfo?.color + "33", borderRadius: 8, padding: "1px 6px", fontSize: "0.65rem" }}>{colPedidos.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {colPedidos.map(p => {
                    const alerta = getCardAlerta(p, statusId, tempoCards);
                    return (
                    <div key={p.id} style={{
                      background: `${statusInfo?.color}18`,
                      border: `2px solid ${alerta.cor}`,
                      borderRadius: 12,
                      cursor: "pointer",
                      flexShrink: 0,
                      minWidth: 0,
                      animation: alerta.anim,
                      color: alerta.cor,
                      position: "relative",
                    }}>
                      {/* Card interno */}
                      <div style={{ padding: "10px" }}>
                        {/* Checkbox de seleção */}
                        {modoSelecao && (
                          <div style={{ position: "absolute", top: 8, left: 8, zIndex: 5 }}>
                            <div
                              onClick={e => { e.stopPropagation(); togglePedido(p.id); }}
                              style={{
                                width: 22, height: 22, borderRadius: 6,
                                background: selecionados.has(p.id) ? "var(--purple2)" : "rgba(255,255,255,0.1)",
                                border: `2px solid ${selecionados.has(p.id) ? "var(--purple2)" : "rgba(255,255,255,0.3)"}`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                cursor: "pointer", fontSize: "0.75rem", color: "#fff",
                              }}
                            >
                              {selecionados.has(p.id) && "✓"}
                            </div>
                          </div>
                        )}
                        {/* Timer + Info */}
                        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
                          <div style={{ background: "rgba(34,197,94,0.12)", color: "var(--green)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "2px 7px", fontSize: "0.65rem", fontWeight: 800 }}>
                            {statusInfo?.icon} agora
                          </div>
                          {p.numeroPedido && <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", fontWeight: 700 }}>#{p.numeroPedido}</div>}
                          {(p.canal === "chat" || p.canal === "chat_ia") && <div style={{ background: "rgba(6,182,212,.15)", color: "#22d3ee", borderRadius: 8, padding: "2px 6px", fontSize: "0.6rem", fontWeight: 700 }}>{p.canal === "chat_ia" ? "🤖" : "💬"}</div>}
                          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
                            <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.4)" }}>{p.tipoEntrega === "entrega" ? "🛵" : "🏠"}</span>
                            <button onClick={e => { e.stopPropagation(); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.8rem", padding: 0 }}>🖨️</button>
                          </div>
                        </div>
                        {/* Cliente + Telefone */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "70%" }}>{p.nomeCliente || "Cliente"}</div>
                          {p.telefone && <a href={`tel:${p.telefone}`} onClick={e => e.stopPropagation()} style={{ fontSize: "0.65rem", color: "#22d3ee", textDecoration: "none", fontWeight: 600 }}>📱 {p.telefone}</a>}
                        </div>
                        {/* Info do entregador (só quando saiu p/ entrega) */}
                        {p.entregadorId && statusId === "entrega" && (
                          <div style={{ background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 8, padding: "6px 10px", marginBottom: 6, display: "flex", flexDirection: "column", gap: 5 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontSize: "0.75rem" }}>🛵</span>
                              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 700, color: "#f97316" }}>{p.entregadorNome || "Entregador"}</span>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <a
                                href={`/entregador/${p.entregadorId}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={e => e.stopPropagation()}
                                style={{ flex: 1, padding: "4px 8px", background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)", borderRadius: 8, color: "#f97316", fontFamily: "'Outfit', sans-serif", fontSize: "0.7rem", fontWeight: 700, textDecoration: "none", textAlign: "center" }}
                              >
                                📍 Ver rastreio
                              </a>
                              <button
                                onClick={e => { e.stopPropagation(); navigator.clipboard?.writeText(`${window.location.origin}/entregador/${p.entregadorId}`); alert("Link copiado!"); }}
                                style={{ flex: 1, padding: "4px 8px", background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: 8, color: "#22d3ee", fontFamily: "'Outfit', sans-serif", fontSize: "0.7rem", fontWeight: 700, cursor: "pointer" }}
                              >
                                📋 Copiar link
                              </button>
                            </div>
                          </div>
                        )}
                        {/* Itens */}
                        <div style={{ marginBottom: 6 }}>
                          <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.25)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>Itens</div>
                          {(p.items || []).map((item, i) => (
                            <div key={i} style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.75)", marginBottom: 1, display: "flex", justifyContent: "space-between", gap: 4 }}>
                              <span><span style={{ fontWeight: 700, color: "#fff" }}>{item.qty}x</span> {item.nome}{item.obs && <span style={{ color: "#f59e0b", fontStyle: "italic" }}> · {item.obs}</span>}</span>
                              <span style={{ color: "#f5c518", fontWeight: 600, flexShrink: 0 }}>R$ {((item.precoTotal || (item.preco * item.qty)) || 0).toFixed(2).replace(".", ",")}</span>
                            </div>
                          ))}
                          {(p.items?.length || 0) > 3 && <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginTop: 2 }}>+ {p.items.length - 3} mais itens</div>}
                        </div>
                        {/* Endereço */}
                        {p.tipoEntrega === "entrega" && p.endereco && (
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.25)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>📍 Endereço</div>
                            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.6)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.endereco}</div>
                          </div>
                        )}
                        {/* Observação */}
                        {p.obs && (
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ fontSize: "0.58rem", color: "rgba(245,158,11,.7)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 2 }}>📝 Obs</div>
                            <div style={{ fontSize: "0.7rem", color: "#f59e0b", fontStyle: "italic" }}>{p.obs}</div>
                          </div>
                        )}
                        {/* Total */}
                        <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 4, marginTop: 2 }}>
                          <span style={{ fontWeight: 800, fontSize: "0.75rem", color: "#fff" }}>TOTAL</span>
                          <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "0.85rem", color: "#f5c518" }}>R$ {(p.total || 0).toFixed(2).replace(".", ",")}</span>
                        </div>
                      </div>
                      {/* Botões Voltar + Avançar */}
                      {statusId !== "entregue" ? (
                      <div style={{ padding: "6px 10px 10px", display: "flex", gap: 8, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                        {statusId !== "pendente" && (
                          <button onClick={() => atualizarStatus(p.id, prevMap[statusId])} style={{
                            flexShrink: 0,
                            background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
                            border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 12px",
                            fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
                          }}>
                            ← Voltar
                          </button>
                        )}
                        <button onClick={() => atualizarStatus(p.id, nextMap[statusId])} style={{
                          flex: 1,
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                          background: btn.bg, color: "#fff",
                          border: "none", borderRadius: 20, padding: "7px 14px",
                          fontSize: "0.78rem", fontWeight: 800, cursor: "pointer",
                        }}>
                          {btn.label} {btn.icon && <span style={{ fontSize: "1rem" }}>{btn.icon}</span>}
                        </button>
                      </div>
                      ) : (
                      <div style={{ padding: "6px 10px 10px", display: "flex", gap: 8, borderTop: "1px solid rgba(255,255,255,.06)" }}>
                        <button onClick={() => atualizarStatus(p.id, "entrega")} style={{
                          flex: 1,
                          background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(255,255,255,0.15)", borderRadius: 20, padding: "6px 12px",
                          fontSize: "0.72rem", fontWeight: 700, cursor: "pointer",
                        }}>
                          ← Voltar p/ Em Entrega
                        </button>
                      </div>
                      )}
                    </div>
                    );
                  })}
                  {colPedidos.length === 0 && (
                    <div style={{ textAlign: "center", padding: "16px 0", color: "var(--text3)", fontSize: "0.72rem" }}>vazio</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      ) : (
        <>
        {pedidosFiltrados.length === 0 && (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text2)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
            <p className="text-sm">Nenhum pedido encontrado.</p>
          </div>
        )}

        {pedidosFiltrados.map(p => {
          const st = STATUS_LIST.find(s => s.id === p.status) || STATUS_LIST[0];
          const aberto = expandido === p.id;
          return (
          <div key={p.id} style={{
            borderRadius: "var(--radius)", marginBottom: 10, overflow: "hidden",
          }}>
            <div onClick={() => setExpandido(aberto ? null : p.id)} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                <div style={{ background: `${st.color}22`, color: st.color, borderRadius: 8, padding: "3px 8px", fontSize: "0.7rem", fontWeight: 700, border: `1px solid ${st.color}44` }}>
                  {st.icon} {st.label}
                </div>
                {(p.canal === "chat" || p.canal === "chat_ia") && (
                  <div style={{ background: "rgba(6,182,212,0.12)", color: "#22d3ee", borderRadius: 8, padding: "2px 7px", fontSize: "0.6rem", fontWeight: 700, border: "1px solid rgba(6,182,212,0.3)", textAlign: "center" }}>
                    {p.canal === "chat_ia" ? "🤖 Bot" : "💬 Chat"}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.nomeCliente}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>
                  {formatarData(p.createdAt)} · {p.tipoEntrega === "entrega" ? "🛵 Delivery" : "🏠 Retirada"}
                  {!p.telefone && p.canal !== "chat" && <span style={{ color: "var(--red)", marginLeft: 6 }}>⚠️ sem tel</span>}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700 }}>R$ {p.total?.toFixed(2).replace(".", ",")}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>{aberto ? "▲" : "▼"}</div>
              </div>
            </div>

            {aberto && (
              <div style={{ borderTop: "1px solid var(--border)", padding: "14px" }}>
                <div style={{ marginBottom: 12 }}>
                  {p.items?.map((item, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: 4 }}>
                      <span style={{ color: "var(--text2)" }}>{item.qty}x {item.nome}</span>
                      <span style={{ fontWeight: 600 }}>R$ {(item.preco * item.qty).toFixed(2).replace(".", ",")}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6, marginTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                    <span>Total</span>
                    <span style={{ color: "var(--gold)" }}>R$ {p.total?.toFixed(2).replace(".", ",")}</span>
                  </div>
                </div>

                <div style={{ background: "var(--bg2)", borderRadius: "var(--radius-sm)", padding: "10px 12px", marginBottom: 12, fontSize: "0.8rem" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>💳 {p.canal === "chat" || p.canal === "chat_ia" ? "💬 CHAT" : p.pagamento?.toUpperCase()}</span>
                    {p.telefone ? <span style={{ color: "var(--green)" }}>📱 {p.telefone}</span> : p.canal === "chat" || p.canal === "chat_ia" ? <span style={{ color: "#22d3ee" }}>💬 Via chat</span> : <span style={{ color: "var(--red)" }}>⚠️ Sem telefone</span>}
                  </div>
                  {p.tipoEntrega === "entrega" && p.endereco && <div style={{ marginTop: 6, color: "var(--text2)" }}>📍 {p.endereco}</div>}
                  {p.obs && <div style={{ marginTop: 6, color: "var(--text2)" }}>📝 {p.obs}</div>}
                  {p.motivoCancelamento && (
                    <div style={{ marginTop: 6, color: "var(--red)", fontWeight: 600 }}>❌ Cancelado: {p.motivoCancelamento}</div>
                  )}
                </div>

                {/* Ações especiais para pedidos via chat manual aguardando confirmação */}
                {(p.canal === "chat" || p.canal === "chat_ia") && p.status === "aguardando_confirmacao" && (
                  <div style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.25)", borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 14 }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#22d3ee", marginBottom: 10 }}>
                      💬 Pedido aguardando sua confirmação
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => confirmarPedidoChat(p)}
                        disabled={atualizando === p.id}
                        style={{ flex: 1, padding: "10px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", borderRadius: 10, cursor: "pointer", color: "var(--green)", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.85rem", opacity: atualizando === p.id ? 0.5 : 1 }}
                      >
                        ✅ Confirmar e Abrir Chat
                      </button>
                      <button
                        onClick={() => recusarPedidoChat(p)}
                        disabled={atualizando === p.id}
                        style={{ flex: 1, padding: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, cursor: "pointer", color: "var(--red)", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.85rem", opacity: atualizando === p.id ? 0.5 : 1 }}
                      >
                        ❌ Recusar
                      </button>
                    </div>
                  </div>
                )}

                {/* Link para o chat correspondente — pedidos do bot */}
                {p.canal === "chat_ia" && p.chatId && (
                  <div style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1, fontSize: "0.78rem", color: "var(--text2)" }}>
                      🤖 Pedido feito pelo robô — cliente está no chat
                    </div>
                    <a
                      href={`/chat/${p.chatId}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ flexShrink: 0, padding: "7px 14px", background: "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.4)", borderRadius: 8, color: "#22d3ee", fontWeight: 700, fontSize: "0.78rem", textDecoration: "none" }}
                    >
                      💬 Abrir chat
                    </a>
                  </div>
                )}

                {/* Botão de vídeo de verificação — disponível em pronto/entrega com chatId */}
                {p.chatId && (p.status === "pronto" || p.status === "entrega" || p.status === "preparo") && (
                  <div style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: 12, padding: "10px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#f97316", marginBottom: 2 }}>📹 Vídeo de verificação</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text3)", lineHeight: 1.4 }}>Grave um vídeo curto mostrando todos os itens do pedido. O cliente recebe no chat — prova que tudo foi enviado.</div>
                    </div>
                    <button
                      onClick={() => { videoPedidoRef.current = p; videoInputRef.current?.click(); }}
                      disabled={enviandoVideo === p.id}
                      style={{ flexShrink: 0, padding: "8px 14px", background: enviandoVideo === p.id ? "rgba(249,115,22,0.1)" : "linear-gradient(135deg, #f97316, #ea580c)", border: "none", borderRadius: 10, cursor: enviandoVideo === p.id ? "default" : "pointer", color: enviandoVideo === p.id ? "#f97316" : "white", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.8rem" }}
                    >
                      {enviandoVideo === p.id ? "Enviando…" : "🎥 Enviar"}
                    </button>
                  </div>
                )}

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1 }}>
                      Atualizar status · <span style={{ color: "#25d366" }}>WhatsApp automático</span>
                    </div>
                    <button onClick={() => imprimirPedido(p)} style={{
                      background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)",
                      borderRadius: 8, padding: "4px 10px", cursor: "pointer",
                      color: "#60a5fa", fontFamily: "'Outfit', sans-serif",
                      fontSize: "0.72rem", fontWeight: 600,
                    }}>
                      🖨️ Imprimir
                    </button>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {STATUS_LIST.map(s => (
                      <button key={s.id} onClick={() => atualizarStatus(p.id, s.id)}
                        disabled={p.status === s.id || atualizando === p.id}
                        style={{
                          padding: "6px 10px", border: "none", borderRadius: 20,
                          background: p.status === s.id ? s.color : "var(--bg3)",
                          color: p.status === s.id ? "var(--bg)" : "var(--text2)",
                          fontFamily: "'Outfit', sans-serif", fontSize: "0.72rem", fontWeight: 600,
                          cursor: p.status === s.id ? "default" : "pointer",
                          opacity: atualizando === p.id ? 0.5 : 1,
                        }}>
                        {s.icon} {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </>
      )}

      {/* Input oculto para seleção de vídeo de verificação */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        style={{ display: "none" }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file && videoPedidoRef.current) {
            enviarVideoVerificacao(videoPedidoRef.current, file);
          }
          e.target.value = "";
        }}
      />
    </div>
  );
}

// ===== RELATÓRIOS =====
function TabRelatorios() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("hoje");
  const [exportando, setExportando] = useState(false);
  const { tenantId } = useStore();

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, "pedidos"),
      where("tenantId", "==", tenantId),
      orderBy("createdAt", "desc"),
      limit(500)
    );
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const agora = new Date();
  const filtrarPorPeriodo = (p) => {
    if (!p.createdAt || p.status === "cancelado") return false;
    const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
    if (periodo === "hoje") return d.toDateString() === agora.toDateString();
    if (periodo === "semana") { const i = new Date(agora); i.setDate(agora.getDate() - 7); return d >= i; }
    if (periodo === "mes") return d.getMonth() === agora.getMonth() && d.getFullYear() === agora.getFullYear();
    return true;
  };

  const pf = pedidos.filter(filtrarPorPeriodo);
  const faturamento = pf.reduce((s, p) => s + (p.total || 0), 0);
  const ticketMedio = pf.length > 0 ? faturamento / pf.length : 0;
  const porPagamento = pf.reduce((acc, p) => { const pg = p.pagamento || "outro"; acc[pg] = (acc[pg] || 0) + (p.total || 0); return acc; }, {});
  const produtosVendidos = {};
  pf.forEach(p => p.items?.forEach(item => {
    if (!produtosVendidos[item.nome]) produtosVendidos[item.nome] = { qty: 0, total: 0 };
    produtosVendidos[item.nome].qty += item.qty;
    produtosVendidos[item.nome].total += item.preco * item.qty;
  }));
  const ranking = Object.entries(produtosVendidos).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5);
  const ultimos7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(agora); d.setDate(agora.getDate() - (6 - i)); return d; });
  const fatPorDia = ultimos7.map(dia => ({
    dia,
    total: pedidos.filter(p => {
      if (!p.createdAt || p.status === "cancelado") return false;
      const d = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
      return d.toDateString() === dia.toDateString();
    }).reduce((s, p) => s + (p.total || 0), 0),
  }));
  const maxFat = Math.max(...fatPorDia.map(d => d.total), 1);
  const diasSemana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  // Exportar PDF
  const exportarPDF = () => {
    setExportando(true);
    try {
      const periodoLabel = { hoje: "Hoje", semana: "Últimos 7 dias", mes: "Este mês", total: "Total geral" }[periodo];
      const dataAtual = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório — ${config.nomeLoja || "Loja"}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; color: #1a1a1a; padding: 32px; font-size: 13px; }
  .header { text-align: center; margin-bottom: 28px; padding-bottom: 20px; border-bottom: 2px solid #5a2d91; }
  .header h1 { font-size: 22px; color: #5a2d91; margin-bottom: 4px; }
  .header p { color: #666; font-size: 12px; }
  .periodo { display: inline-block; background: #f5c518; color: #1a1a1a; padding: 4px 14px; border-radius: 20px; font-weight: bold; font-size: 12px; margin-top: 8px; }
  .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .card { background: #f8f8ff; border: 1px solid #e0d6f7; border-radius: 10px; padding: 14px; text-align: center; }
  .card .valor { font-size: 20px; font-weight: 900; color: #5a2d91; }
  .card .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-top: 4px; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 14px; color: #5a2d91; border-bottom: 1px solid #e0d6f7; padding-bottom: 6px; margin-bottom: 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #5a2d91; color: white; padding: 8px 10px; text-align: left; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0f0f0; }
  tr:nth-child(even) td { background: #faf8ff; }
  .total-row td { font-weight: bold; background: #f5c51820; border-top: 2px solid #f5c518; }
  .footer { margin-top: 28px; text-align: center; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 12px; }
  @media print { body { padding: 16px; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${config.logoUrl ? `<img src="${config.logoUrl}" style="width:36px;height:36px;border-radius:8px;vertical-align:middle;margin-right:8px;object-fit:cover">` : "🫐"} ${config.nomeLoja || "Loja"}</h1>
    <p>Relatório gerado em ${dataAtual}</p>
<div className="divider" />
<div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--purple2)", marginBottom: 10 }}>🎖️ 4º Lugar (consolação)</div>
<div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={config.premio4Nome || ""} onChange={e => salvarConfig({ premio4Nome: e.target.value })} placeholder="Ex: Açaí grátis por 1 mês" /></div>
<div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={config.premio4Desc || ""} onChange={e => salvarConfig({ premio4Desc: e.target.value })} placeholder="Ex: 4 açaís 500ml" /></div>
<div className="form-group"><label className="form-label">🖼️ Imagem</label><FotoUpload value={config.premio4Imagem || ""} onChange={v => salvarConfig({ premio4Imagem: v })} /></div>
<div className="divider" />
<div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text2)", marginBottom: 10 }}>🎖️ 5º Lugar (consolação)</div>
<div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={config.premio5Nome || ""} onChange={e => salvarConfig({ premio5Nome: e.target.value })} placeholder="Ex: Desconto especial" /></div>
<div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={config.premio5Desc || ""} onChange={e => salvarConfig({ premio5Desc: e.target.value })} placeholder="Ex: 20% OFF no próximo pedido" /></div>
<div className="form-group"><label className="form-label">🖼️ Imagem</label><FotoUpload value={config.premio5Imagem || ""} onChange={v => salvarConfig({ premio5Imagem: v })} /></div>
    <div class="periodo">📅 ${periodoLabel}</div>
  </div>

  <div class="cards">
    <div class="card"><div class="valor">R$ ${faturamento.toFixed(2).replace(".", ",")}</div><div class="label">Faturamento</div></div>
    <div class="card"><div class="valor">${pf.length}</div><div class="label">Pedidos</div></div>
    <div class="card"><div class="valor">R$ ${ticketMedio.toFixed(2).replace(".", ",")}</div><div class="label">Ticket médio</div></div>
    <div class="card"><div class="valor">${pf.reduce((s, p) => s + (p.pontosGanhos || 0), 0)}</div><div class="label">Pontos dados</div></div>
  </div>

  ${ranking.length > 0 ? `
  <div class="section">
    <h2>🏆 Produtos mais vendidos</h2>
    <table>
      <tr><th>#</th><th>Produto</th><th>Qtd vendida</th><th>Faturamento</th></tr>
      ${ranking.map(([nome, dados], i) => `<tr><td>${i + 1}</td><td>${nome}</td><td>${dados.qty} un.</td><td>R$ ${dados.total.toFixed(2).replace(".", ",")}</td></tr>`).join("")}
    </table>
  </div>` : ""}

  ${Object.keys(porPagamento).length > 0 ? `
  <div class="section">
    <h2>💳 Por forma de pagamento</h2>
    <table>
      <tr><th>Pagamento</th><th>Total</th><th>%</th></tr>
      ${Object.entries(porPagamento).map(([pag, val]) => `<tr><td>${pag.toUpperCase()}</td><td>R$ ${val.toFixed(2).replace(".", ",")}</td><td>${faturamento > 0 ? ((val/faturamento)*100).toFixed(1) : 0}%</td></tr>`).join("")}
      <tr class="total-row"><td><strong>TOTAL</strong></td><td><strong>R$ ${faturamento.toFixed(2).replace(".", ",")}</strong></td><td>100%</td></tr>
    </table>
  </div>` : ""}

  <div class="section">
    <h2>📋 Pedidos do período</h2>
    <table>
      <tr><th>Data</th><th>Cliente</th><th>Itens</th><th>Pagamento</th><th>Total</th><th>Status</th></tr>
      ${pf.slice(0, 50).map(p => `
        <tr>
          <td>${p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString("pt-BR", {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—"}</td>
          <td>${p.nomeCliente || "—"}</td>
          <td>${p.items?.map(i => `${i.qty}x ${i.nome}`).join(", ") || "—"}</td>
          <td>${(p.pagamento || "").toUpperCase()}</td>
          <td>R$ ${(p.total || 0).toFixed(2).replace(".", ",")}</td>
          <td>${p.status || "—"}</td>
        </tr>`).join("")}
      ${pf.length > 50 ? `<tr><td colspan="6" style="text-align:center;color:#888;font-style:italic;">... e mais ${pf.length - 50} pedidos. Exporte o CSV para ver todos.</td></tr>` : ""}
    </table>
  </div>

  <div class="footer">${config.nomeLoja || "Loja"} · Relatório gerado automaticamente</div>
</body>
</html>`;

      const janela = window.open("", "_blank");
      janela.document.write(html);
      janela.document.close();
      setTimeout(() => janela.print(), 500);
    } catch (e) {
      alert("Erro ao gerar PDF.");
    } finally { setExportando(false); }
  };

  // Exportar CSV
  const exportarCSV = () => {
    setExportando(true);
    try {
      const pedidosParaExportar = periodo === "total" ? pedidos : pf;
      const linhas = [
        ["Data", "Cliente", "Telefone", "Itens", "Total", "Pagamento", "Entrega", "Status", "Cupom", "Pontos Ganhos"].join(";"),
        ...pedidosParaExportar.map(p => {
          const data = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString("pt-BR") : "";
          const itens = p.items?.map(i => `${i.qty}x ${i.nome}`).join(", ") || "";
          return [
            data,
            p.nomeCliente || "",
            p.telefone || "",
            `"${itens}"`,
            (p.total || 0).toFixed(2).replace(".", ","),
            p.pagamento || "",
            p.tipoEntrega || "",
            p.status || "",
            p.cupom || "",
            p.pontosGanhos || 0,
          ].join(";");
        })
      ];
      const csv = "\uFEFF" + linhas.join("\n"); // BOM para Excel reconhecer UTF-8
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const nomePeriodo = { hoje: "hoje", semana: "7dias", mes: "mes", total: "total" }[periodo];
      link.href = url;
      link.download = `pedidos_${nomePeriodo}_${new Date().toLocaleDateString("pt-BR").replace(/\//g, "-")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Erro ao exportar.");
    } finally { setExportando(false); }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Carregando...</div>;

  return (
    <div>
      {/* Filtros e exportar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6, flex: 1, flexWrap: "wrap" }}>
          {[{ id: "hoje", label: "Hoje" }, { id: "semana", label: "7 dias" }, { id: "mes", label: "Este mês" }, { id: "total", label: "Total" }].map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id)} style={{
              padding: "7px 14px", border: `1px solid ${periodo === p.id ? "var(--gold)" : "var(--border)"}`, borderRadius: 20, cursor: "pointer",
              background: periodo === p.id ? "var(--gold)" : "var(--bg2)",
              color: periodo === p.id ? "var(--bg)" : "var(--text2)",
              fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem",
            }}>{p.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={exportarCSV} disabled={exportando || pf.length === 0} style={{
            background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 20, padding: "7px 14px", cursor: "pointer",
            color: "var(--green)", fontFamily: "'Outfit', sans-serif",
            fontWeight: 600, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6,
            opacity: pf.length === 0 ? 0.5 : 1,
          }}>
            {exportando ? "⏳" : "📥"} CSV
          </button>
          <button onClick={exportarPDF} disabled={exportando || pf.length === 0} style={{
            background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 20, padding: "7px 14px", cursor: "pointer",
            color: "var(--red)", fontFamily: "'Outfit', sans-serif",
            fontWeight: 600, fontSize: "0.82rem", display: "flex", alignItems: "center", gap: 6,
            opacity: pf.length === 0 ? 0.5 : 1,
          }}>
            📄 PDF
          </button>
        </div>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        {[
          { label: "Faturamento", value: `R$ ${faturamento.toFixed(2).replace(".", ",")}`, icon: "💰", color: "var(--gold)" },
          { label: "Pedidos",     value: pf.length,                                        icon: "📋", color: "var(--purple2)" },
          { label: "Ticket médio",value: `R$ ${ticketMedio.toFixed(2).replace(".", ",")}`, icon: "🎯", color: "#60a5fa" },
          { label: "Pontos dados",value: `${pf.reduce((s, p) => s + (p.pontosGanhos || 0), 0)} pts`, icon: "⭐", color: "var(--green)" },
        ].map((card, i) => (
          <div key={i} style={{ background: "linear-gradient(135deg, var(--bg3), var(--bg2))", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "14px 16px" }}>
            <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{card.icon}</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: card.color }}>{card.value}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 3, textTransform: "uppercase", letterSpacing: 1 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Gráfico de colunas */}
      <div style={{ background: "linear-gradient(135deg, var(--bg3), var(--bg2))", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>📊 Últimos 7 dias</div>
          <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
            Total: R$ {fatPorDia.reduce((s, d) => s + d.total, 0).toFixed(2).replace(".", ",")}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, position: "relative" }}>
          {/* Linhas de grade */}
          {[25, 50, 75, 100].map(pct => (
            <div key={pct} style={{
              position: "absolute", left: 0, right: 0,
              bottom: `${pct}%`, height: 1,
              background: "rgba(255,255,255,0.04)",
              pointerEvents: "none",
            }} />
          ))}
          {fatPorDia.map((item, i) => {
            const altura = maxFat > 0 ? (item.total / maxFat) * 100 : 0;
            const isHoje = item.dia.toDateString() === agora.toDateString();
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 0, height: "100%", justifyContent: "flex-end" }}>
                {/* Valor em cima */}
                <div style={{ fontSize: "0.55rem", color: isHoje ? "var(--gold)" : "var(--text3)", marginBottom: 3, fontWeight: isHoje ? 700 : 400, textAlign: "center", minHeight: 14 }}>
                  {item.total > 0 ? `R$${item.total.toFixed(0)}` : ""}
                </div>
                {/* Coluna */}
                <div style={{
                  width: "80%", borderRadius: "6px 6px 0 0",
                  height: `${Math.max(altura, item.total > 0 ? 8 : 2)}%`,
                  background: isHoje
                    ? "linear-gradient(180deg, #fde68a, var(--gold))"
                    : "linear-gradient(180deg, var(--purple2), #3b1a6e)",
                  transition: "height 0.6s ease",
                  opacity: item.total === 0 ? 0.2 : 1,
                  position: "relative", overflow: "hidden",
                }}>
                  {/* Brilho na coluna */}
                  {item.total > 0 && (
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: "40%",
                      background: "linear-gradient(180deg, rgba(255,255,255,0.15), transparent)",
                      borderRadius: "6px 6px 0 0",
                    }} />
                  )}
                </div>
                {/* Linha base */}
                <div style={{ width: "100%", height: 1, background: "var(--border)" }} />
                {/* Dia da semana */}
                <div style={{ fontSize: "0.65rem", color: isHoje ? "var(--gold)" : "var(--text3)", fontWeight: isHoje ? 700 : 400, marginTop: 4, textAlign: "center" }}>
                  {diasSemana[item.dia.getDay()]}
                </div>
                {/* Data */}
                <div style={{ fontSize: "0.52rem", color: "var(--text3)", textAlign: "center" }}>
                  {item.dia.getDate()}/{item.dia.getMonth() + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Por pagamento */}
      {Object.keys(porPagamento).length > 0 && (
        <div style={{ background: "linear-gradient(135deg, var(--bg3), var(--bg2))", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>💳 Por pagamento</div>
          {Object.entries(porPagamento).map(([pag, val]) => {
            const pct = faturamento > 0 ? (val / faturamento) * 100 : 0;
            const icons = { pix: "📱", dinheiro: "💵", cartao: "💳" };
            return (
              <div key={pag} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 4 }}>
                  <span>{icons[pag] || "💳"} {pag.toUpperCase()}</span>
                  <span style={{ fontWeight: 600 }}>R$ {val.toFixed(2).replace(".", ",")} <span style={{ color: "var(--text3)" }}>({pct.toFixed(0)}%)</span></span>
                </div>
                <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--purple), var(--gold))", borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Ranking */}
      {ranking.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, var(--bg3), var(--bg2))", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
          <div className="section-label" style={{ marginBottom: 12 }}>🏆 Produtos mais vendidos</div>
          {ranking.map(([nome, dados], i) => (
            <div key={nome} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: i === 0 ? "var(--gold)" : i === 1 ? "var(--text3)" : "var(--bg3)", color: i < 2 ? "var(--bg)" : "var(--text2)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "0.78rem", flexShrink: 0 }}>{i + 1}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{nome}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>{dados.qty} unidades</div>
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700 }}>R$ {dados.total.toFixed(2).replace(".", ",")}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de pedidos do período */}
      {pf.length > 0 && (
        <div style={{ background: "linear-gradient(135deg, var(--bg3), var(--bg2))", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>📋 Pedidos do período</div>
            <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{pf.length} pedidos</span>
          </div>
          {pf.slice(0, 20).map(p => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "0.82rem" }}>
              <div>
                <div style={{ fontWeight: 600 }}>{p.nomeCliente}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
                  {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                  {" · "}{p.pagamento?.toUpperCase()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700 }}>R$ {p.total?.toFixed(2).replace(".", ",")}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>{p.status}</div>
              </div>
            </div>
          ))}
          {pf.length > 20 && <div style={{ textAlign: "center", marginTop: 10, fontSize: "0.75rem", color: "var(--text3)" }}>+{pf.length - 20} pedidos · exporte o CSV para ver todos</div>}
        </div>
      )}

      {pf.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text2)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>📊</div>
          <p className="text-sm">Nenhum pedido no período selecionado.</p>
        </div>
      )}
    </div>
  );
}


function TabCardapio() {
  const { produtos, salvarProduto, deletarProduto, tenantId } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({ nome: "", emoji: "🫐", preco: "", desc: "", tag: "grosso", foto: "", categoria: "", controlarEstoque: false, estoque: 0, selo: "" });
  const [editId, setEditId] = useState(null);
  const set = k => v => setForm(p => ({ ...p, [k]: typeof v === "string" ? v : v.target.value }));
  const handleSave = async () => {
    if (!form.nome || !form.preco) { toast("Preencha nome e preço.", "error"); return; }
    try { await salvarProduto({ ...form, preco: parseFloat(form.preco), estoque: form.controlarEstoque ? (parseInt(form.estoque) || 0) : null, maxComplementos: parseInt(form.maxComplementos) || 0, ativo: true }, editId); toast(editId ? "✅ Atualizado!" : "✅ Adicionado!"); setForm({ nome: "", emoji: "🫐", preco: "", desc: "", tag: "grosso", foto: "", fotos: [], categoria: "", controlarEstoque: false, estoque: 0, selo: "", maxComplementos: "" }); setEditId(null); }
    catch { toast("Erro.", "error"); }
  };
  const handleEdit = (p) => { setForm({ nome: p.nome, emoji: p.emoji || "🫐", preco: p.preco, desc: p.desc || "", tag: p.tag || "grosso", foto: p.foto || "", fotos: p.fotos || [], controlarEstoque: p.controlarEstoque || false, estoque: p.estoque || 0, selo: p.selo || "", maxComplementos: p.maxComplementos || "" }); setEditId

(p.id); window.scrollTo(0, document.body.scrollHeight); };
  return (
    <div>
      <div className="section-label">Produtos cadastrados</div>
      {[...produtos].sort((a, b) => (a.ordemLista || 0) - (b.ordemLista || 0)).map((p, idx, arr) => (
        <div
          key={p.id}
          className="admin-row"
          draggable
          onDragStart={e => { e.dataTransfer.setData("prodId", p.id); e.currentTarget.style.opacity = "0.5"; }}
          onDragEnd={e => { e.currentTarget.style.opacity = "1"; }}
          onDragOver={e => { e.preventDefault(); e.currentTarget.style.background = "rgba(245,197,24,0.08)"; }}
          onDragLeave={e => { e.currentTarget.style.background = ""; }}
          onDrop={async e => {
            e.currentTarget.style.background = "";
            const fromId = e.dataTransfer.getData("prodId");
            if (!fromId || fromId === p.id) return;
            const fromIdx = arr.findIndex(x => x.id === fromId);
            const toIdx = idx;
            try {
              await updateDoc(doc(db, "produtos", fromId), { ordemLista: toIdx });
              await updateDoc(doc(db, "produtos", p.id), { ordemLista: fromIdx });
            } catch (err) { console.error(err); }
          }}
          style={{ cursor: "grab" }}
        >
          <span style={{ color: "var(--text3)", fontSize: "1rem", marginRight: 2, cursor: "grab" }}>⠿</span>
          {p.foto ? <img src={p.foto} alt={p.nome} style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} onError={e => e.target.style.display = "none"} /> : <span style={{ fontSize: "1.4rem" }}>{p.emoji}</span>}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.nome}</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text2)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              R$ {p.preco.toFixed(2).replace(".", ",")}
              {p.foto && <span style={{ color: "var(--green)" }}>📸</span>}
              {p.ativo === false && <span className="chip chip-red">Pausado</span>}
              {p.controlarEstoque && (
                <span style={{
                  fontSize: "0.65rem", fontWeight: 700, padding: "1px 6px", borderRadius: 20,
                  background: p.estoque <= 0 ? "rgba(239,68,68,0.1)" : p.estoque <= 3 ? "rgba(245,158,11,0.1)" : "rgba(34,197,94,0.1)",
                  color: p.estoque <= 0 ? "var(--red)" : p.estoque <= 3 ? "#f59e0b" : "var(--green)",
                  border: `1px solid ${p.estoque <= 0 ? "rgba(239,68,68,0.3)" : p.estoque <= 3 ? "rgba(245,158,11,0.3)" : "rgba(34,197,94,0.3)"}`,
                }}>
                  {p.estoque <= 0 ? "Esgotado" : `${p.estoque} em estoque`}
                </span>
              )}
            </div>
          </div>
          <div className={`toggle-switch ${p.ativo !== false ? "on" : ""}`} onClick={async () => { await salvarProduto({ ativo: !p.ativo }, p.id); toast(p.ativo ? "Pausado." : "Ativado."); }} style={{ cursor: "pointer" }} />
          <button className="btn btn-sm btn-outline" onClick={() => handleEdit(p)}>✏️</button>
          <button
            className="btn btn-sm"
            title="Copiar produto com complementos"
            style={{ background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", color: "#60a5fa" }}
            onClick={async () => {
              if (!window.confirm(`Copiar "${p.nome}" com todos os complementos?`)) return;
              try {
                const novoId = `prod_${Date.now()}`;
                const { id: _, ...dadosProduto } = p;
                const prodBase = tenantId ? `tenants/${tenantId}/produtos` : "produtos";
                await setDoc(doc(db, prodBase, novoId), { ...dadosProduto, nome: p.nome + " (cópia)", ordemLista: (p.ordemLista || 0) + 0.5 });
                const gruposSnap = await getDocs(collection(db, `${prodBase}/${p.id}/grupos_complementos`));
                for (const grupoDoc of gruposSnap.docs) {
                  const novoGrupoRef = await addDoc(collection(db, `${prodBase}/${novoId}/grupos_complementos`), grupoDoc.data());
                  const itensSnap = await getDocs(collection(db, `${prodBase}/${p.id}/grupos_complementos/${grupoDoc.id}/itens`));
                  for (const itemDoc of itensSnap.docs) {
                    await addDoc(collection(db, `${prodBase}/${novoId}/grupos_complementos/${novoGrupoRef.id}/itens`), itemDoc.data());
                  }
                }
                toast(`✅ "${p.nome}" copiado com todos os complementos!`);
              } catch (e) { toast("Erro ao copiar.", "error"); console.error(e); }
            }}
          >📋</button>
          <button className="btn btn-sm btn-danger" onClick={async () => { if (window.confirm("Excluir?")) { await deletarProduto(p.id); toast("Removido."); } }}>🗑️</button>
        </div>
      ))}
      <div className="divider" />
      <div className="section-label">{editId ? "✏️ Editar produto" : "➕ Novo produto"}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="form-group" style={{ flex: "2 1 160px" }}><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={set("nome")} placeholder="Açaí Grosso 1kg" /></div>
        <div className="form-group" style={{ flex: "0 0 80px" }}><label className="form-label">Emoji</label><input className="form-input" value={form.emoji} onChange={set("emoji")} /></div>
        <div className="form-group" style={{ flex: "1 1 100px" }}><label className="form-label">Preço *</label><input className="form-input" type="number" step="0.01" value={form.preco} onChange={set("preco")} placeholder="26.00" /></div>
        <div className="form-group" style={{ flex: "1 1 120px" }}><label className="form-label">Tipo</label><select className="form-input" value={form.tag} onChange={set("tag")}><option value="grosso">Grosso</option><option value="medio">Médio</option><option value="">Outro</option></select></div>
        <CategoriaSelect value={form.categoria} onChange={v => setForm(p => ({ ...p, categoria: v }))} />
        <div className="form-group" style={{ flex: "2 1 200px" }}><label className="form-label">Descrição</label><input className="form-input" value={form.desc} onChange={set("desc")} placeholder="Polpa grossa, cremosa..." /></div>
        <div className="form-group" style={{ flex: "1 1 140px" }}>
          <label className="form-label">🏷️ Selo</label>
          <select className="form-input" value={form.selo || ""} onChange={e => setForm(p => ({ ...p, selo: e.target.value }))}>
            <option value="">Sem selo</option>
            <option value="mais_vendido">🔥 Mais vendido</option>
            <option value="novidade">✨ Novidade</option>
            <option value="promocao">🏷️ Promoção</option>
          </select>
        </div>
        <div className="form-group" style={{ flex: "100%" }}><label className="form-label">📸 Foto do produto</label><FotoUpload value={form.foto} onChange={v => setForm(p => ({ ...p, foto: v }))} /></div>
        <div className="form-group" style={{ flex: "1 1 140px" }}>
<div className="form-group" style={{ flex: "100%" }}>
  <label className="form-label">🖼️ Fotos extras (carrossel — até 3)</label>
  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
    {[0,1,2].map(i => (
      <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", background: "var(--bg3)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", color: "var(--text3)" }}>
          {form.fotos?.[i] ? <img src={form.fotos[i]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : `${i+2}ª`}
        </div>
        <FotoUpload value={form.fotos?.[i] || ""} onChange={v => setForm(p => { const n = [...(p.fotos||[])]; n[i]=v; return {...p, fotos: n.filter(Boolean)}; })} />
        {form.fotos?.[i] && <button onClick={() => setForm(p => { const n=[...(p.fotos||[])]; n[i]=""; return {...p,fotos:n.filter(Boolean)}; })} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--red)", fontSize:"1.1rem" }}>✕</button>}
      </div>
    ))}
  </div>
  <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 4 }}>Aparecem no carrossel da imagem expandida</div>
</div>
          <label className="form-label">🧩 Máx. complementos</label>
          <input className="form-input" type="number" min="0" value={form.maxComplementos || ""} onChange={e => setForm(p => ({ ...p, maxComplementos: e.target.value }))} placeholder="Ex: 5 (0 = ilimitado)" />
          <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 3 }}>Total máximo de itens nos grupos</div>
        </div>

        <div className="form-group" style={{ flex: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: form.controlarEstoque ? 12 : 0 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>📦 Controlar estoque</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 2 }}>Ativa o controle de quantidade disponível</div>
            </div>
            <div className={`toggle-switch ${form.controlarEstoque ? "on" : ""}`} onClick={() => setForm(p => ({ ...p, controlarEstoque: !p.controlarEstoque }))} style={{ cursor: "pointer" }} />
          </div>
          {form.controlarEstoque && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Quantidade em estoque</label>
                <input className="form-input" type="number" min="0" value={form.estoque || 0} onChange={e => setForm(p => ({ ...p, estoque: parseInt(e.target.value) || 0 }))} />
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 20 }}>
                {[5, 10, 20, 50].map(n => (
                  <button key={n} onClick={() => setForm(p => ({ ...p, estoque: (p.estoque || 0) + n }))} style={{
                    padding: "6px 10px", background: "var(--bg3)", border: "1px solid var(--border)",
                    borderRadius: 8, cursor: "pointer", fontSize: "0.75rem", fontWeight: 600,
                    color: "var(--text2)", fontFamily: "'Outfit', sans-serif",
                  }}>+{n}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button className="btn btn-gold" style={{ flex: 1 }} onClick={handleSave}>{editId ? "💾 Salvar" : "➕ Adicionar"}</button>
        {editId && <button className="btn btn-outline" onClick={() => { setEditId(null); setForm({ nome: "", emoji: "🫐", preco: "", desc: "", tag: "grosso", foto: "", fotos: [], categoria: "", controlarEstoque: false, estoque: 0, selo: "" }); }}>Cancelar</button>}
      </div>
      {/* Complementos — só aparece ao editar produto existente */}
      {editId && <TabComplementosAdmin produtoId={editId} produtoNome={form.nome} tenantId={tenantId} />}
    </div>
  );
}

// ===== RECOMPENSAS =====
function TabRecompensas() {
  const { recompensas, salvarRecompensa, deletarRecompensa, config, salvarConfig } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({ nome: "", emoji: "🎁", pontos: "", desc: "" });
  const [editId, setEditId] = useState(null);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const handleSave = async () => {
    if (!form.nome || !form.pontos) { toast("Preencha nome e pontos.", "error"); return; }
    try { await salvarRecompensa({ ...form, pontos: parseInt(form.pontos) }, editId); toast(editId ? "✅ Atualizada!" : "✅ Adicionada!"); setForm({ nome: "", emoji: "🎁", pontos: "", desc: "" }); setEditId(null); }
    catch { toast("Erro.", "error"); }
  };

  return (
    <div>

      {/* ── PONTOS POR COMPRA ─────────────────────────────── */}
      <div className="section-label">🛒 Pontos por Compra</div>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px", marginBottom: 16 }}>
        <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: 12, lineHeight: 1.6 }}>
          O valor do pedido em reais vira pontos de ranking. Ex: R$50 = 50pts
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>🛒 Pts por R$1 gasto</span>
          <input type="number" min="0" step="0.1" className="form-input" style={{ width: 70, textAlign: "center" }}
            value={config.rankingPtsPorReal ?? 1}
            onChange={async e => { await salvarConfig({ rankingPtsPorReal: parseFloat(e.target.value) || 1 }); }}
          />
        </div>
        <div style={{ fontSize: "0.68rem", color: "var(--purple2)", background: "rgba(138,92,246,0.08)", borderRadius: 8, padding: "6px 10px" }}>
          💡 Padrão: 1pt por R$1 — pedido de R$50 = 50pts de ranking
        </div>
      </div>

      {/* ── TURBO SEMANAL ─────────────────────────────────── */}
      <div className="section-label">🔥 Turbo Semanal</div>
      <div style={{ background: "var(--bg2)", border: "1px solid rgba(255,149,0,0.3)", borderRadius: "var(--radius-sm)", padding: "14px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Ativar Turbo Semanal</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>Multiplica pts de ranking por compras na semana</div>
          </div>
          <div onClick={() => salvarConfig({ turboAtivo: !config.turboAtivo })}
            style={{ width: 44, height: 24, borderRadius: 12, background: config.turboAtivo ? "#ff9500" : "var(--bg3)", border: `1px solid ${config.turboAtivo ? "#ff9500" : "var(--border)"}`, cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
            <div style={{ position: "absolute", top: 2, left: config.turboAtivo ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
        </div>
        {config.turboAtivo && (
          <>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 10 }}>
              Reseta toda segunda-feira. Na 4ª compra volta ao 1x.
            </div>
            {[
              { key: "turboMult2", label: "🛒 2ª compra da semana", suffix: "x pts", default: 2 },
              { key: "turboMult3", label: "🚀 3ª compra da semana", suffix: "x pts", default: 3 },
            ].map(item => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>{item.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" min="1" max="10" className="form-input" style={{ width: 60, textAlign: "center" }}
                    value={config[item.key] ?? item.default}
                    onChange={async e => { await salvarConfig({ [item.key]: parseInt(e.target.value) || item.default }); }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>{item.suffix}</span>
                </div>
              </div>
            ))}
            <div className="divider" />
            {/* Cupom Turbo */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>🎫 Cupom ao ativar Turbo</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 2 }}>Oferece cupom quando cliente ativa o modo Turbo</div>
              </div>
              <div onClick={() => salvarConfig({ turboCupomAtivo: !config.turboCupomAtivo })}
                style={{ width: 44, height: 24, borderRadius: 12, background: config.turboCupomAtivo ? "var(--purple2)" : "var(--bg3)", border: `1px solid ${config.turboCupomAtivo ? "var(--purple2)" : "var(--border)"}`, cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
                <div style={{ position: "absolute", top: 2, left: config.turboCupomAtivo ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </div>
            </div>
            {config.turboCupomAtivo && (
              <>
                <div style={{ display: "flex", gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Desconto %</label>
                    <input className="form-input" type="number" min="0" max="100"
                      value={config.turboCupomDesconto || 10}
                      onChange={e => salvarConfig({ turboCupomDesconto: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Válido (horas)</label>
                    <input className="form-input" type="number" min="1"
                      value={config.turboCupomHoras || 24}
                      onChange={e => salvarConfig({ turboCupomHoras: parseInt(e.target.value) || 24 })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Mensagem para o cliente</label>
                  <textarea className="form-input" rows={2}
                    value={config.turboCupomMsg || "🔥 Turbo ativado! Use esse cupom na sua próxima compra!"}
                    onChange={e => salvarConfig({ turboCupomMsg: e.target.value })}
                  />
                </div>
              </>
            )}
            <div style={{ background: "rgba(255,149,0,0.08)", borderRadius: 8, padding: "8px 10px", fontSize: "0.68rem", color: "#ff9500", lineHeight: 1.6 }}>
              🔥 1ª compra → normal | 2ª → {config.turboMult2 || 2}x | 3ª → {config.turboMult3 || 3}x | 4ª → reset
            </div>
          </>
        )}
      </div>

      {/* ── DIAMANTES ─────────────────────────────────────── */}
      <div className="section-label">💎 Sistema de Diamantes</div>
      <div style={{ background: "var(--bg2)", border: "1px solid rgba(138,92,246,0.3)", borderRadius: "var(--radius-sm)", padding: "14px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Ativar Diamantes</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>Clientes podem dar diamantes em posts da Caixa NexFoody</div>
          </div>
          <div onClick={() => salvarConfig({ diamantesAtivo: !config.diamantesAtivo })}
            style={{ width: 44, height: 24, borderRadius: 12, background: config.diamantesAtivo ? "var(--purple2)" : "var(--bg3)", border: `1px solid ${config.diamantesAtivo ? "var(--purple2)" : "var(--border)"}`, cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
            <div style={{ position: "absolute", top: 2, left: config.diamantesAtivo ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
        </div>
        {config.diamantesAtivo && (
          <>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 12, lineHeight: 1.6 }}>
              1 diamante por pessoa por dia por destinatário. Precisa de 1 compra para dar/receber.
            </div>
            {[
              { key: "diamante1Pts", label: "💎 Diamante 1", default: 3 },
              { key: "diamante2Pts", label: "💎💎 Diamante 2", default: 6 },
              { key: "diamante3Pts", label: "💎💎💎 Diamante 3", default: 10 },
            ].map(item => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>{item.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" min="0" className="form-input" style={{ width: 60, textAlign: "center" }}
                    value={config[item.key] ?? item.default}
                    onChange={async e => { await salvarConfig({ [item.key]: parseInt(e.target.value) || 0 }); }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>pts</span>
                </div>
              </div>
            ))}
            <div className="divider" />
            {/* Turbo + Diamante em dobro */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>🔥 Turbo = Diamantes em dobro</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 2 }}>Cliente com Turbo ativo recebe 2x diamantes</div>
              </div>
              <div onClick={() => salvarConfig({ turboDobraDiamantes: !config.turboDobraDiamantes })}
                style={{ width: 44, height: 24, borderRadius: 12, background: config.turboDobraDiamantes ? "#ff9500" : "var(--bg3)", border: `1px solid ${config.turboDobraDiamantes ? "#ff9500" : "var(--border)"}`, cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
                <div style={{ position: "absolute", top: 2, left: config.turboDobraDiamantes ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── ROCKETS (comentários) ──────────────────────────── */}
      <div className="section-label">🚀 Rockets nos Comentários</div>
      <div style={{ background: "var(--bg2)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "var(--radius-sm)", padding: "14px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Ativar Rockets</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>Clientes podem enviar rockets em comentários</div>
          </div>
          <div onClick={() => salvarConfig({ rocketsAtivo: !config.rocketsAtivo })}
            style={{ width: 44, height: 24, borderRadius: 12, background: config.rocketsAtivo ? "var(--green)" : "var(--bg3)", border: `1px solid ${config.rocketsAtivo ? "var(--green)" : "var(--border)"}`, cursor: "pointer", position: "relative", transition: "all 0.2s" }}>
            <div style={{ position: "absolute", top: 2, left: config.rocketsAtivo ? 22 : 2, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
        </div>
        {config.rocketsAtivo && (
          <>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 12 }}>
              Limite: 10 rockets por dia (total, independente de usuários)
            </div>
            {[
              { key: "rocket1Pts", label: "🚀 Rocket 1", default: 3 },
              { key: "rocket2Pts", label: "🚀🚀 Rocket 2", default: 6 },
              { key: "rocket3Pts", label: "🚀🚀🚀 Rocket 3", default: 10 },
            ].map(item => (
              <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>{item.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="number" min="0" className="form-input" style={{ width: 60, textAlign: "center" }}
                    value={config[item.key] ?? item.default}
                    onChange={async e => { await salvarConfig({ [item.key]: parseInt(e.target.value) || 0 }); }}
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>pts</span>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── PONTOS DE INTERAÇÃO ───────────────────────────── */}
      <div className="section-label">🏆 Pontos de Interação — Caixa NexFoody</div>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px", marginBottom: 16 }}>
        <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 12 }}>
          Pontos ganhos por interações na Caixa NexFoody (peso normal)
        </div>
        {[
          { key: "rankingPtsPostarFoto", label: "📸 Foto+texto na Caixa NexFoody", placeholder: "5" },
          { key: "rankingPtsPostarVideo", label: "🎥 Vídeo na Caixa NexFoody", placeholder: "8" },
          { key: "rankingPtsCurtirFeed", label: "❤️ Curtida recebida (NexFoody)", placeholder: "1" },
          { key: "rankingPtsComentario", label: "💬 Comentar produto", placeholder: "15" },
          { key: "rankingPtsCompartilhar", label: "🔗 Compartilhar produto", placeholder: "10" },
          { key: "rankingPtsCompartFeed", label: "↗️ Compartilhar post", placeholder: "10" },
        ].map(item => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>{item.label}</span>
            <input type="number" min="0" className="form-input" style={{ width: 70, textAlign: "center" }}
              value={config[item.key] ?? item.placeholder}
              onChange={async e => { await salvarConfig({ [item.key]: parseInt(e.target.value) || 0 }); }}
            />
          </div>
        ))}
        <div className="divider" />
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text3)", marginBottom: 8 }}>
          📝 Caixa Grande (desempate — 10x menos)
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>Divisor Caixa Grande</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="number" min="1" className="form-input" style={{ width: 60, textAlign: "center" }}
              value={config.caixaGrandeDivisor ?? 10}
              onChange={async e => { await salvarConfig({ caixaGrandeDivisor: parseInt(e.target.value) || 10 }); }}
            />
            <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>x menos</span>
          </div>
        </div>
        <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 6 }}>
          Posts na Caixa Grande valem pts ÷ {config.caixaGrandeDivisor || 10} (só para desempate)
        </div>
      </div>

      {/* ── PRÊMIOS DO RANKING ────────────────────────────── */}
      <div className="section-label">🎁 Prêmios do Ranking</div>
      <div style={{ background: "var(--bg2)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: "var(--radius-sm)", padding: "14px", marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--gold)", marginBottom: 10 }}>🥇 1º Lugar</div>
        <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={config.premioNome || ""} onChange={e => salvarConfig({ premioNome: e.target.value })} placeholder='Ex: TV 43" Samsung' /></div>
        <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={config.premioDesc || ""} onChange={e => salvarConfig({ premioDesc: e.target.value })} placeholder="Ex: Para o maior fã" /></div>
        <div className="form-group"><label className="form-label">🖼️ Imagem</label><FotoUpload value={config.premioImagem || ""} onChange={v => salvarConfig({ premioImagem: v })} /></div>
        <div className="form-group"><label className="form-label">💜 Desconto %</label><input className="form-input" type="number" min="0" max="100" value={config.premioDesconto || 10} onChange={e => salvarConfig({ premioDesconto: parseInt(e.target.value) || 0 })} /></div>
        <div className="divider" />
        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#9ca3af", marginBottom: 10 }}>🥈 2º Lugar</div>
        <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={config.premio2Nome || ""} onChange={e => salvarConfig({ premio2Nome: e.target.value })} placeholder="Ex: Fone Bluetooth" /></div>
        <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={config.premio2Desc || ""} onChange={e => salvarConfig({ premio2Desc: e.target.value })} placeholder="Ex: JBL Tune 520" /></div>
        <div className="form-group"><label className="form-label">🖼️ Imagem</label><FotoUpload value={config.premio2Imagem || ""} onChange={v => salvarConfig({ premio2Imagem: v })} /></div>
        <div className="divider" />
        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#cd7f32", marginBottom: 10 }}>🥉 3º Lugar</div>
        <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={config.premio3Nome || ""} onChange={e => salvarConfig({ premio3Nome: e.target.value })} placeholder="Ex: 10 itens grátis" /></div>
        <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={config.premio3Desc || ""} onChange={e => salvarConfig({ premio3Desc: e.target.value })} placeholder="Ex: Válido por 30 dias" /></div>
        <div className="form-group"><label className="form-label">🖼️ Imagem</label><FotoUpload value={config.premio3Imagem || ""} onChange={v => salvarConfig({ premio3Imagem: v })} /></div>
        <div className="divider" />
        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--purple2)", marginBottom: 10 }}>🎖️ 4º Lugar (consolação)</div>
        <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={config.premio4Nome || ""} onChange={e => salvarConfig({ premio4Nome: e.target.value })} placeholder="Ex: Desconto especial" /></div>
        <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={config.premio4Desc || ""} onChange={e => salvarConfig({ premio4Desc: e.target.value })} placeholder="Ex: 20% OFF" /></div>
        <div className="form-group"><label className="form-label">🖼️ Imagem</label><FotoUpload value={config.premio4Imagem || ""} onChange={v => salvarConfig({ premio4Imagem: v })} /></div>
        <div className="divider" />
        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text2)", marginBottom: 10 }}>🎖️ 5º Lugar (consolação)</div>
        <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={config.premio5Nome || ""} onChange={e => salvarConfig({ premio5Nome: e.target.value })} placeholder="Ex: Brinde surpresa" /></div>
        <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={config.premio5Desc || ""} onChange={e => salvarConfig({ premio5Desc: e.target.value })} placeholder="Ex: Na próxima compra" /></div>
        <div className="form-group"><label className="form-label">🖼️ Imagem</label><FotoUpload value={config.premio5Imagem || ""} onChange={v => salvarConfig({ premio5Imagem: v })} /></div>
        <div className="divider" />
        <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text2)", marginBottom: 10 }}>📅 Período</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Início</label><input className="form-input" type="date" value={config.premioInicio || ""} onChange={e => salvarConfig({ premioInicio: e.target.value })} /></div>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Hora</label><input className="form-input" type="time" value={config.premioHoraInicio || "00:00"} onChange={e => salvarConfig({ premioHoraInicio: e.target.value })} /></div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Fim</label><input className="form-input" type="date" value={config.premioFim || ""} onChange={e => salvarConfig({ premioFim: e.target.value })} /></div>
          <div className="form-group" style={{ flex: 1 }}><label className="form-label">Hora</label><input className="form-input" type="time" value={config.premioHoraFim || "23:59"} onChange={e => salvarConfig({ premioHoraFim: e.target.value })} /></div>
        </div>
        <div className="form-group">
          <label className="form-label">📋 Regras da promoção</label>
          <textarea className="form-input" rows={5} value={config.premioRegras || ""} onChange={e => salvarConfig({ premioRegras: e.target.value })} placeholder="1. Válido para clientes cadastrados&#10;2. Pontos acumulados no período&#10;3. Ganhador anunciado em 48h..." />
        </div>
        <button className="btn btn-gold btn-full" onClick={() => toast("✅ Prêmios salvos!")}>💾 Salvar prêmios</button>
      </div>

      <div className="divider" />
      <div className="section-label">Recompensas de Pontos (desconto)</div>
      {recompensas.length === 0 && <p className="text-sm text-muted mb-4">Nenhuma cadastrada.</p>}
      {recompensas.map(r => (
        <div key={r.id} className="admin-row">
          <span style={{ fontSize: "1.4rem" }}>{r.emoji}</span>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{r.nome}</div><div style={{ fontSize: "0.75rem", color: "var(--gold)" }}>{r.pontos} pontos</div></div>
          <button className="btn btn-sm btn-outline" onClick={() => { setForm({ nome: r.nome, emoji: r.emoji || "🎁", pontos: r.pontos, desc: r.desc || "" }); setEditId(r.id); }}>✏️</button>
          <button className="btn btn-sm btn-danger" onClick={async () => { await deletarRecompensa(r.id); toast("Removida."); }}>🗑️</button>
        </div>
      ))}
      <div className="divider" />
      <div className="section-label">{editId ? "✏️ Editar" : "➕ Nova recompensa"}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="form-group" style={{ flex: "2 1 160px" }}><label className="form-label">Nome *</label><input className="form-input" value={form.nome} onChange={set("nome")} placeholder="1 Litro Grátis" /></div>
        <div className="form-group" style={{ flex: "0 0 80px" }}><label className="form-label">Emoji</label><input className="form-input" value={form.emoji} onChange={set("emoji")} /></div>
        <div className="form-group" style={{ flex: "1 1 100px" }}><label className="form-label">Pontos *</label><input className="form-input" type="number" value={form.pontos} onChange={set("pontos")} /></div>
        <div className="form-group" style={{ flex: "2 1 200px" }}><label className="form-label">Descrição</label><input className="form-input" value={form.desc} onChange={set("desc")} /></div>
      </div>
      <button className="btn btn-gold btn-full" onClick={handleSave}>{editId ? "💾 Atualizar" : "➕ Adicionar"} recompensa</button>
    </div>
  );
}
// ===== AVALIAÇÕES PRIVADAS =====
function TabAvaliacoes() {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respModal, setRespModal] = useState(null); // { id, resposta }
  const toast = useToast();
  const { tenantId } = useStore();
  const t = (c) => tenantId ? `tenants/${tenantId}/${c}` : c;

  useEffect(() => {
    const q = query(collection(db, t("avaliacoesPrivadas")), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setAvaliacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const responder = async () => {
    if (!respModal || !respModal.resposta.trim()) return;
    try {
      await updateDoc(doc(db, t("avaliacoesPrivadas"), respModal.id), {
        respostaAdmin: respModal.resposta,
        dataResposta: serverTimestamp(),
      });
      toast("✅ Resposta enviada!");
      setRespModal(null);
    } catch (e) { toast("Erro: " + e.message, "error"); }
  };

  const pendentes = avaliacoes.filter(a => !a.respostaAdmin);
  const respondidas = avaliacoes.filter(a => a.respostaAdmin);

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Carregando...</div>;

  return (
    <div>
      {pendentes.length > 0 && (
        <>
          <div className="section-label" style={{ color: "var(--gold)" }}>⏳ Pendentes de resposta ({pendentes.length})</div>
          {pendentes.map(a => (
            <div key={a.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{a.nomeCliente || "Cliente"}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>Pedido #{a.pedidoId?.slice(-4) || "—"} · {a.createdAt?.toDate ? a.createdAt.toDate().toLocaleString("pt-BR") : "—"}</div>
                </div>
                <div style={{ fontSize: "1.1rem" }}>{"★".repeat(a.estrelas || 5)}</div>
              </div>
              {a.comentario && <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 8 }}>{a.comentario}</div>}
              {a.foto && <img src={a.foto} alt="" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />}
              <button onClick={() => setRespModal({ id: a.id, resposta: "" })} style={{ padding: "8px 16px", background: "var(--purple2)", border: "none", borderRadius: 8, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer" }}>
                📩 Responder
              </button>
            </div>
          ))}
        </>
      )}

      {respondidas.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 20 }}>✅ Respondidas ({respondidas.length})</div>
          {respondidas.map(a => (
            <div key={a.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{a.nomeCliente || "Cliente"}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>Pedido #{a.pedidoId?.slice(-4) || "—"}</div>
                </div>
                <div style={{ fontSize: "1.1rem" }}>{"★".repeat(a.estrelas || 5)}</div>
              </div>
              {a.comentario && <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 6 }}>{a.comentario}</div>}
              {a.foto && <img src={a.foto} alt="" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />}
              <div style={{ padding: "8px 10px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, fontSize: "0.82rem", color: "var(--green)" }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>📩 Resposta:</div>
                {a.respostaAdmin}
              </div>
            </div>
          ))}
        </>
      )}

      {avaliacoes.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text2)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>💬</div>
          <p>Nenhuma avaliação privada ainda</p>
        </div>
      )}

      {/* Modal de resposta */}
      {respModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg)", borderRadius: 16, padding: 24, width: "100%", maxWidth: 380, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}>📩 Responder avaliação</div>
            <textarea value={respModal.resposta} onChange={e => setRespModal(p => ({ ...p, resposta: e.target.value }))} placeholder="Escreva sua resposta..." rows={4} style={{ width: "100%", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, padding: "10px 12px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", resize: "none", outline: "none", marginBottom: 14 }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setRespModal(null)} style={{ flex: 1, padding: 10, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 10, fontFamily: "'Outfit', sans-serif", fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
              <button onClick={responder} style={{ flex: 1, padding: 10, background: "var(--purple2)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: "pointer" }}>Enviar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ===== CONFIG =====
function TabConfig() {
  const { config, salvarConfig } = useStore();
  const toast = useToast();
  const [form, setForm] = useState({ modoAvaliacoes: config.modoAvaliacoes || 'completo', ...config });
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));
  const handleSave = async () => {
    try { await salvarConfig(form); toast("✅ Configurações salvas!"); }
    catch { toast("Erro.", "error"); }
  };
  return (
    <div>
      {/* Modo de Operação */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 6, fontSize: "0.9rem" }}>🏪 Modo de Operação</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: 14 }}>
          Define como sua loja funciona para os clientes.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { val: "delivery", icon: "🛵", label: "Delivery", desc: "Pedidos com entrega ou retirada" },
            { val: "catalogo", icon: "📖", label: "Catálogo", desc: "Só vitrine — sem pedidos online" },
          ].map(op => {
            const ativo = (form.modoOperacao || "delivery") === op.val;
            return (
              <button key={op.val} onClick={async () => {
                setForm(p => ({ ...p, modoOperacao: op.val }));
                await salvarConfig({ modoOperacao: op.val });
                toast(op.val === "catalogo" ? "📖 Modo Catálogo ativado!" : "🛵 Modo Delivery ativado!");
              }} style={{
                padding: "14px 12px", textAlign: "left",
                background: ativo ? "rgba(124,58,237,0.15)" : "var(--bg3)",
                border: `1.5px solid ${ativo ? "rgba(124,58,237,0.5)" : "var(--border)"}`,
                borderRadius: 14, cursor: "pointer", transition: "all 0.2s",
              }}>
                <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{op.icon}</div>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", color: ativo ? "var(--purple2)" : "var(--text)", marginBottom: 3 }}>{op.label}</div>
                <div style={{ fontSize: "0.68rem", color: "var(--text3)", lineHeight: 1.4 }}>{op.desc}</div>
                {ativo && <div style={{ marginTop: 8, fontSize: "0.62rem", fontWeight: 700, color: "var(--purple2)" }}>✓ Ativo</div>}
              </button>
            );
          })}
        </div>
        {(form.modoOperacao === "catalogo") && (
          <div style={{ marginTop: 12, padding: "10px 12px", background: "rgba(245,197,24,0.06)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 10, fontSize: "0.72rem", color: "var(--text2)", lineHeight: 1.6 }}>
            💡 No modo Catálogo o botão de carrinho some. Clientes veem os produtos e entram em contato pelo WhatsApp configurado abaixo.
          </div>
        )}
      </div>

      {/* Status e controles de horário */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: "0.9rem" }}>⏰ Horário & Status</div>

        {/* Horário automático */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Abre às</label>
            <input className="form-input" type="time" value={form.horarioAbertura || "08:00"}
              onChange={e => setForm(p => ({ ...p, horarioAbertura: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
            <label className="form-label">Fecha às</label>
            <input className="form-input" type="time" value={form.horarioFechamento || "21:00"}
              onChange={e => setForm(p => ({ ...p, horarioFechamento: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>Horário automático</div>
            <div className="text-sm text-muted">Abre e fecha sozinho no horário acima</div>
          </div>
          <div onClick={async () => {
            const novo = !config.horarioAutomatico;
            await salvarConfig({ horarioAutomatico: novo });
            setForm(p => ({ ...p, horarioAutomatico: novo }));
            toast(novo ? "✅ Horário automático ativado!" : "⏸️ Horário automático desativado!");
          }} style={{ cursor: "pointer" }}>
            <div className={`toggle-switch ${config.horarioAutomatico ? "on" : ""}`} />
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>Pausa manual</div>
              <div className="text-sm text-muted">Pausar agora (ex: horário de almoço)</div>
            </div>
            <div onClick={async () => {
              const novo = !config.pausaManual;
              await salvarConfig({ pausaManual: novo });
              setForm(p => ({ ...p, pausaManual: novo }));
              toast(novo ? "⏸️ Cardápio pausado!" : "✅ Cardápio reaberto!");
            }} style={{ cursor: "pointer" }}>
              <div className={`toggle-switch ${config.pausaManual ? "on" : ""}`} />
            </div>
          </div>
        </div>

        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>💬 Chat com suporte</div>
              <div className="text-sm text-muted">Botão de suporte no pedido (pode deixar desativado)</div>
            </div>
            <div onClick={async () => {
              const novo = !config.suporteAtivo;
              await salvarConfig({ suporteAtivo: novo });
              setForm(p => ({ ...p, suporteAtivo: novo }));
              toast(novo ? "✅ Suporte ativado!" : "❌ Suporte desativado!");
            }} style={{ cursor: "pointer" }}>
              <div className={`toggle-switch ${config.suporteAtivo ? "on" : ""}`} />
            </div>
          </div>
        </div>

        {/* Estender horário */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, marginTop: 2 }}>
          <div style={{ fontWeight: 600, fontSize: "0.88rem", marginBottom: 6 }}>⏱️ Estender horário</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[30, 60, 120].map(min => (
              <button key={min} onClick={async () => {
                // Calcula novo horário de fechamento
                const agora = new Date();
                const novoFecha = new Date(agora.getTime() + min * 60000);
                const hh = String(novoFecha.getHours()).padStart(2, "0");
                const mm = String(novoFecha.getMinutes()).padStart(2, "0");
                const novoHorario = `${hh}:${mm}`;
                await salvarConfig({ horarioFechamento: novoHorario, cardapioAtivo: true, pausaManual: false });
                setForm(p => ({ ...p, horarioFechamento: novoHorario, pausaManual: false }));
                toast(`✅ Loja aberta até ${novoHorario}!`);
              }} style={{
                flex: 1, padding: "8px 0",
                background: "rgba(245,197,24,0.1)",
                border: "1px solid rgba(245,197,24,0.3)",
                borderRadius: 10, cursor: "pointer",
                color: "var(--gold)", fontFamily: "'Outfit', sans-serif",
                fontWeight: 700, fontSize: "0.82rem",
              }}>
                +{min === 120 ? "2h" : `${min}min`}
              </button>
            ))}
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 6 }}>
            Ajusta o horário de fechamento para daqui a X minutos
          </div>
        </div>

        <div style={{ marginTop: 12, padding: "8px 12px", borderRadius: "var(--radius-sm)", background: config.cardapioAtivo && !config.pausaManual ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${config.cardapioAtivo && !config.pausaManual ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}` }}>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: config.cardapioAtivo && !config.pausaManual ? "var(--green)" : "var(--red)" }}>
            {config.cardapioAtivo && !config.pausaManual ? "🟢 Aberto agora" : config.pausaManual ? "⏸️ Pausado manualmente" : "🔴 Fora do horário"}
          </span>
        </div>
      </div>
      <div className="section-label">Dados da loja</div>
      {[
        { k: "nomeLoja", label: "Nome da loja", ph: "Açaí Puro Gosto" },
        { k: "instagram", label: "Instagram (com @)", ph: "@acaipurogosto" },
        { k: "whatsapp", label: "WhatsApp (com código país)", ph: "5599984623356" },
        { k: "whatsappSuporte", label: "WhatsApp Suporte (mesmo formato)", ph: "Deixe vazio para usar o WhatsApp padrão" },
        { k: "pixKey", label: "Chave PIX (fallback manual)", ph: "86357425249" },
        { k: "nomeRecebedorPix", label: "Nome no PIX", ph: "Moises Nazareno" },
        { k: "cidadePix", label: "Cidade (PIX)", ph: "Bacabal" },
        { k: "pontosPorReal", label: "Pontos por R$ gasto", ph: "0.1", type: "number" },
      ].map(f => (
        <div key={f.k} className="form-group"><label className="form-label">{f.label}</label><input className="form-input" type={f.type || "text"} value={form[f.k] || ""} onChange={set(f.k)} placeholder={f.ph} /></div>
      ))}

      <div className="divider" />
      <div className="section-label">🎁 Sistema de Fidelidade</div>
      <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 12 }}>
        Escolha como recompensar seus clientes. Cada lojista pode ter um modelo diferente.
      </div>

      {/* Modo de fidelidade */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {[
          { id: "pontos",   icon: "⭐", label: "Só Pontos",           desc: "Cliente acumula pontos e troca por recompensas" },
          { id: "cashback", icon: "💰", label: "Só Cashback",         desc: "Cliente recebe % de volta em crédito para próximo pedido" },
          { id: "ambos",    icon: "🎁", label: "Pontos + Cashback",   desc: "Cliente escolhe entre as duas opções" },
          { id: "nenhum",   icon: "🔒", label: "Desativado",          desc: "Nenhum programa de fidelidade" },
        ].map(op => (
          <div key={op.id} onClick={() => setForm(p => ({ ...p, modoFidelidade: op.id }))} style={{
            background: form.modoFidelidade === op.id ? "rgba(245,197,24,0.08)" : "var(--bg2)",
            border: `1px solid ${form.modoFidelidade === op.id ? "rgba(245,197,24,0.4)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)", padding: "12px 14px",
            cursor: "pointer", display: "flex", alignItems: "center", gap: 12, transition: "all 0.2s",
          }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${form.modoFidelidade === op.id ? "var(--gold)" : "var(--border)"}`, background: form.modoFidelidade === op.id ? "var(--gold)" : "transparent", flexShrink: 0 }} />
            <span style={{ fontSize: "1.2rem" }}>{op.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{op.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>{op.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Configurações de pontos */}
      {(form.modoFidelidade === "pontos" || form.modoFidelidade === "ambos") && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 10 }}>⭐ Configurações de Pontos</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Pontos por R$ gasto</label>
              <input className="form-input" type="number" step="0.1" value={form.pontosPorReal || ""} onChange={set("pontosPorReal")} placeholder="Ex: 1" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Valor de 1 ponto (R$)</label>
              <input className="form-input" type="number" step="0.01" value={form.valorPonto || ""} onChange={set("valorPonto")} placeholder="Ex: 0.10" />
            </div>
          </div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
            Ex: 1 ponto por real gasto, cada ponto vale R$0,10 → R$50 = 50 pts = R$5 de desconto
          </div>
        </div>
      )}

      {/* Configurações de cashback */}
      {(form.modoFidelidade === "cashback" || form.modoFidelidade === "ambos") && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 12 }}>
          <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 10 }}>💰 Configurações de Cashback</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">% de cashback</label>
              <input className="form-input" type="number" step="0.5" value={form.cashbackPercent || ""} onChange={set("cashbackPercent")} placeholder="Ex: 5" />
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 3 }}>% do valor do pedido devolvido como crédito</div>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Limite máx. por pedido</label>
              <input className="form-input" type="number" step="1" value={form.cashbackMaxPedido || ""} onChange={set("cashbackMaxPedido")} placeholder="Ex: 20 (R$)" />
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 3 }}>Máximo de cashback por compra (R$)</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Validade (dias)</label>
              <input className="form-input" type="number" value={form.cashbackValidade || ""} onChange={set("cashbackValidade")} placeholder="Ex: 30" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">% máx. de desconto</label>
              <input className="form-input" type="number" value={form.cashbackMaxDesconto || ""} onChange={set("cashbackMaxDesconto")} placeholder="Ex: 20 (%)" />
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 3 }}>Máx. que o cliente pode usar por pedido</div>
            </div>
          </div>
        </div>
      )}

      <div className="form-group"><label className="form-label">Endereço de retirada</label><textarea className="form-input" value={form.endereco || ""} onChange={set("endereco")} rows={3} /></div>
      <div className="form-group"><label className="form-label">📍 Localização da loja (mapa de entrega)</label></div>
      <StoreLocationPicker
        latitude={form.latitude}
        longitude={form.longitude}
        onChange={(lat, lng) => setForm(p => ({ ...p, latitude: lat.toString(), longitude: lng.toString() }))}
      />

      <div className="divider" />
      <div className="section-label">🚚 Taxa de Entrega</div>
      <div className="form-group">
        <label className="form-label">Valor da taxa (R$)</label>
        <input className="form-input" type="number" step="0.01" value={form.taxaEntrega || ""} onChange={set("taxaEntrega")} placeholder="Ex: 5.00 (deixe vazio para mostrar 'A combinar')" />
      </div>
      <div className="form-group">
        <label className="form-label">Entrega grátis acima de (R$)</label>
        <input className="form-input" type="number" step="0.01" value={form.entregaGratisMin || ""} onChange={set("entregaGratisMin")} placeholder="Ex: 40.00 (deixe vazio para desativar)" />
        <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 4 }}>Quando o pedido atingir esse valor, a entrega fica gratuita</div>
      </div>
      <div className="form-group">
        <label className="form-label">Raio máximo de entrega (km)</label>
        <input className="form-input" type="number" step="0.5" value={form.raioEntregaKm || ""} onChange={set("raioEntregaKm")} placeholder="Ex: 8 (deixe vazio para sem limite)" />
        <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 4 }}>Clientes fora desse raio não poderão fazer pedidos</div>
      </div>

      <div className="form-group">
        <label className="form-label">🎯 Meta diária de faturamento (R$)</label>
        <input className="form-input" type="number" step="1" value={form.metaFaturamento || ""} onChange={set("metaFaturamento")} placeholder="Ex: 1500 (deixe vazio para default R$ 1.500)" />
        <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 4 }}>Define a meta que aparece na barra de progresso do dashboard</div>
      </div>

      <div className="form-group">
        <label className="form-label">🚫 Bairros sem entrega</label>
        <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginBottom: 8 }}>
          O cliente verá um aviso para conferir a lista antes de pedir.
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            className="form-input"
            id="bairroInput"
            placeholder="Ex: Vila Perigosa"
            style={{ flex: 1 }}
            onKeyDown={e => {
              if (e.key === "Enter") {
                e.preventDefault();
                const val = e.target.value.trim();
                if (!val) return;
                const lista = form.bairrosNaoAtendidos || [];
                if (!lista.includes(val)) setForm(p => ({ ...p, bairrosNaoAtendidos: [...lista, val] }));
                e.target.value = "";
              }
            }}
          />
          <button
            type="button"
            className="btn btn-outline"
            style={{ flexShrink: 0 }}
            onClick={() => {
              const input = document.getElementById("bairroInput");
              const val = input.value.trim();
              if (!val) return;
              const lista = form.bairrosNaoAtendidos || [];
              if (!lista.includes(val)) setForm(p => ({ ...p, bairrosNaoAtendidos: [...lista, val] }));
              input.value = "";
            }}
          >Adicionar</button>
        </div>
        {(form.bairrosNaoAtendidos || []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(form.bairrosNaoAtendidos || []).map(b => (
              <div key={b} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 20, padding: "3px 10px" }}>
                <span style={{ fontSize: "0.78rem", color: "var(--red)" }}>{b}</span>
                <button
                  type="button"
                  onClick={() => setForm(p => ({ ...p, bairrosNaoAtendidos: (p.bairrosNaoAtendidos || []).filter(x => x !== b) }))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", fontSize: "0.9rem", padding: 0, lineHeight: 1 }}
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="divider" />
      <div className="form-group"><label className="form-label">Horário de funcionamento</label><textarea className="form-input" value={form.horario || ""} onChange={set("horario")} rows={2} /></div>
      <div className="form-group"><label className="form-label">Informação extra</label><textarea className="form-input" value={form.infoExtra || ""} onChange={set("infoExtra")} rows={2} /></div>
      <div className="form-group"><label className="form-label">Mensagem de cardápio pausado</label><input className="form-input" value={form.mensagemPausa || ""} onChange={set("mensagemPausa")} /></div>
      <div className="form-group">
        <label className="form-label">📢 Banner de promoção</label>
        <input className="form-input" value={form.bannerPromocao || ""} onChange={set("bannerPromocao")} placeholder="Ex: Frete grátis acima de R$50! 🎉" />
        <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>Aparece no topo do cardápio. Deixe vazio para ocultar.</div>
      </div>

      <div className="divider" />
      <div className="section-label">💌 Compartilhar com Afeto</div>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>Mostrar no carrinho</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 2 }}>
              Exibe o card de compartilhamento abaixo do botão de finalizar
            </div>
          </div>
          <div className={`toggle-switch ${form.mostrarCompartilhar !== false ? "on" : ""}`}
            onClick={() => setForm(p => ({ ...p, mostrarCompartilhar: p.mostrarCompartilhar === false ? true : false }))}
            style={{ cursor: "pointer" }} />
        </div>
      </div>

      <div className="divider" />
<div className="section-label">💬 Comentários dos produtos</div>
<div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 12 }}>
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
    <div>
      <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>Permitir comentários</div>
      <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 2 }}>
        Clientes podem comentar nos produtos. Comentários com 3 denúncias são ocultados automaticamente.
      </div>
    </div>
    <div className={`toggle-switch ${form.comentariosAtivos !== false ? "on" : ""}`}
      onClick={() => setForm(p => ({ ...p, comentariosAtivos: p.comentariosAtivos === false ? true : false }))}
      style={{ cursor: "pointer" }} />
  </div>
</div>
<div className="divider" />
      <div className="section-label">⭐ Avaliações dos produtos</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {[
          { id: "completo", label: "⭐ Estrelas + comentários", desc: "Clientes avaliam com estrelas e podem comentar" },
          { id: "soEstrelas", label: "⭐ Só estrelas", desc: "Avaliações visíveis mas sem mostrar comentários" },
          { id: "desativado", label: "🔒 Desativado", desc: "Nenhuma avaliação é exibida ou permitida" },
        ].map(op => (
          <div
            key={op.id}
            onClick={() => setForm(p => ({ ...p, modoAvaliacoes: op.id }))}
            style={{
              background: form.modoAvaliacoes === op.id ? "rgba(245,197,24,0.08)" : "var(--bg2)",
              border: `1px solid ${form.modoAvaliacoes === op.id ? "rgba(245,197,24,0.4)" : "var(--border)"}`,
              borderRadius: "var(--radius-sm)", padding: "12px 14px",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
              transition: "all 0.2s",
            }}
          >
            <div style={{
              width: 18, height: 18, borderRadius: "50%",
              border: `2px solid ${form.modoAvaliacoes === op.id ? "var(--gold)" : "var(--border)"}`,
              background: form.modoAvaliacoes === op.id ? "var(--gold)" : "transparent",
              flexShrink: 0, transition: "all 0.2s",
            }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{op.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 2 }}>{op.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button className="btn btn-gold btn-full" onClick={handleSave}>💾 Salvar configurações</button>
    </div>
  );
}

// ===== CLIENTES =====
function TabClientes() {
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pontosAdd, setPontosAdd] = useState({});
  const [busca, setBusca] = useState("");
  const loadClientes = async () => {
    setLoading(true);
    try { const snap = await getDocs(collection(db, "users")); setClientes(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoaded(true); }
    catch { toast("Erro.", "error"); } finally { setLoading(false); }
  };
  const filtrados = clientes.filter(c => c.role !== "admin").filter(c =>
    (c.nome || "").toLowerCase().includes(busca.toLowerCase()) || (c.email || "").toLowerCase().includes(busca.toLowerCase())
  );
  return (
    <div>
      {!loaded ? (
        <button className="btn btn-gold btn-full" onClick={loadClientes} disabled={loading}>{loading ? "Carregando..." : "📋 Carregar clientes"}</button>
      ) : (
        <>
          <div className="form-group"><input className="form-input" placeholder="🔍 Buscar..." value={busca} onChange={e => setBusca(e.target.value)} /></div>
          <div className="text-sm text-muted mb-3">{filtrados.length} cliente(s)</div>
          {filtrados.map(c => (
            <div key={c.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div><div style={{ fontWeight: 600 }}>{c.nome}</div><div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>{c.email}</div></div>
                <div style={{ textAlign: "right" }}><div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", color: "var(--gold)", fontWeight: 900 }}>{c.pontos || 0}</div><div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>pontos</div></div>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <input className="form-input" type="number" placeholder="Ex: +5 ou -3" value={pontosAdd[c.id] || ""} onChange={e => setPontosAdd(p => ({ ...p, [c.id]: e.target.value }))} style={{ flex: 1 }} />
                <button className="btn btn-gold btn-sm" onClick={async () => {
                  const n = parseInt(pontosAdd[c.id]); if (!n) return;
                  await updateDoc(doc(db, "users", c.id), { pontos: increment(n) });
                  setClientes(prev => prev.map(x => x.id === c.id ? { ...x, pontos: (x.pontos || 0) + n } : x));
                  setPontosAdd(p => ({ ...p, [c.id]: "" }));
                  toast(`✅ ${n > 0 ? "+" : ""}${n} pontos!`);
                }}>Aplicar</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function TabCupons() {
  const toast = useToast();
  const { config, salvarConfig } = useStore();
  const [cupons, setCupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ codigo: "", tipo: "porcentagem", valor: "", valorMinimo: "", dataExpiracao: "", ativo: true });
  const [salvando, setSalvando] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => {
    const q = query(collection(db, "cupons"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setCupons(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleSalvar = async () => {
    if (!form.codigo.trim() || !form.valor) { toast("Preencha código e valor.", "error"); return; }
    setSalvando(true);
    try {
      const codigo = form.codigo.trim().toUpperCase();
      await setDoc(doc(db, "cupons", codigo), {
        codigo,
        tipo: form.tipo,
        valor: parseFloat(form.valor),
        valorMinimo: form.valorMinimo ? parseFloat(form.valorMinimo) : null,
        dataExpiracao: form.dataExpiracao ? new Date(form.dataExpiracao) : null,
        ativo: true,
        usosTotal: 0,
        usadoPor: [],
        createdAt: serverTimestamp(),
      });
      toast(`✅ Cupom ${codigo} criado!`);
      setForm({ codigo: "", tipo: "porcentagem", valor: "", valorMinimo: "", dataExpiracao: "", ativo: true });
    } catch { toast("Erro ao criar cupom.", "error"); }
    finally { setSalvando(false); }
  };

  const toggleAtivo = async (cupom) => {
    await updateDoc(doc(db, "cupons", cupom.id), { ativo: !cupom.ativo });
    toast(cupom.ativo ? "Cupom desativado." : "Cupom ativado.");
  };

  const deletarCupom = async (id) => {
    if (!window.confirm("Excluir este cupom?")) return;
    await deleteDoc(doc(db, "cupons", id));
    toast("🗑️ Cupom removido.");
  };

  const descricaoTipo = (c) => {
    if (c.tipo === "porcentagem") return `${c.valor}% de desconto`;
    if (c.tipo === "fixo") return `R$ ${c.valor.toFixed(2).replace(".", ",")} de desconto`;
    if (c.tipo === "frete") return "Frete grátis";
    return "";
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        Crie códigos promocionais para seus clientes. Cada cupom pode ser usado apenas uma vez por cliente.
      </p>

      {/* Chamada dos cupons */}
      <div className="section-label">🎯 Frase de chamada</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
        {[
          { emoji: "🎉", frase: "5% de desconto!" },
          { emoji: "🔥", frase: "Cupom só hoje!" },
          { emoji: "🔥", frase: "10% OFF agora" },
          { emoji: "⚡", frase: "Só hoje! Aproveita" },
          { emoji: "🎯", frase: "Economize neste pedido" },
          { emoji: "🔓", frase: "Desbloqueie seu desconto" },
          { emoji: "💸", frase: "Desconto liberado pra você" },
          { emoji: "⏳", frase: "Últimas horas de desconto" },
          { emoji: "🎁", frase: "Cupom grátis!" },
          { emoji: "⭐", frase: "Pegue seu Cupom!" },
        ].map(({ emoji, frase }) => {
          const texto = `${emoji} ${frase}`;
          const frases = Array.isArray(config.chamadaCupom) ? config.chamadaCupom : [];
          const ativo = frases.includes(texto);
          const noInput = !Array.isArray(config.chamadaCupom) && config.chamadaCupom === texto;
          const isActive = ativo || noInput;
          return (
            <button key={texto} onClick={() => {
              if (!Array.isArray(config.chamadaCupom)) {
                salvarConfig({ chamadaCupom: [texto], chamadaCupomInput: "" });
              } else {
                const ja = frases.includes(texto);
                if (ja) {
                  if (frases.length <= 1) return;
                  salvarConfig({ chamadaCupom: frases.filter(f => f !== texto) });
                } else {
                  if (frases.length >= 4) return;
                  salvarConfig({ chamadaCupom: [...frases, texto] });
                }
              }
            }} style={{ padding: "6px 10px", background: isActive ? "rgba(22,163,74,0.15)" : "var(--bg2)", border: `1.5px solid ${isActive ? "var(--green)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", fontSize: "0.72rem", color: isActive ? "var(--green)" : "var(--text2)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 72 }}>
              <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{emoji}</span>
              <span style={{ fontSize: "0.6rem", lineHeight: 1.2, textAlign: "center" }}>{frase}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: "0.78rem", color: "var(--text2)", fontFamily: "'Outfit', sans-serif" }}>Cycling</span>
          <button
            onClick={() => {
              if (Array.isArray(config.chamadaCupom) && config.chamadaCupom.length < 2) return;
              if (!Array.isArray(config.chamadaCupom)) {
                // Ligando cycling: se a frase atual não tem cupom, coloca uma padrão
                const fraseAtual = config.chamadaCupom || "";
                const comCupom = fraseAtual.toLowerCase().includes("cupom");
                const frasesIniciais = comCupom ? [fraseAtual] : [fraseAtual, "🎁 Cupom grátis!"];
                salvarConfig({ chamadaCupom: frasesIniciais, chamadaCupomInput: "" });
              } else {
                // Desligando cycling: mantém a do input, só salva se tiver cupom
                const input = config.chamadaCupomInput || "";
                if (input && input.toLowerCase().includes("cupom")) {
                  salvarConfig({ chamadaCupom: input, chamadaCupomInput: "" });
                } else {
                  // Tenta pegar a primeira que tem cupom
                  const comCupom = config.chamadaCupom.find(f => f.toLowerCase().includes("cupom"));
                  salvarConfig({ chamadaCupom: comCupom || "", chamadaCupomInput: "" });
                }
              }
            }}
            style={{ width: 44, height: 24, borderRadius: 12, background: Array.isArray(config.chamadaCupom) ? "var(--purple2)" : "var(--bg3)", border: `1px solid ${Array.isArray(config.chamadaCupom) ? "var(--purple2)" : "var(--border)"}`, cursor: Array.isArray(config.chamadaCupom) && config.chamadaCupom.length < 2 ? "not-allowed" : "pointer", position: "relative", transition: "all 0.2s", padding: 0, opacity: Array.isArray(config.chamadaCupom) && config.chamadaCupom.length < 2 ? 0.5 : 1 }}
          >
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: Array.isArray(config.chamadaCupom) ? 22 : 2, transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }} />
          </button>
        </div>
        {Array.isArray(config.chamadaCupom) && (
          <span style={{ fontSize: "0.7rem", color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>{config.chamadaCupom.length}/4 frases</span>
        )}
      </div>
      <div className="form-group">
        <input
          className="form-input"
          value={Array.isArray(config.chamadaCupom) ? (config.chamadaCupomInput || "") : (config.chamadaCupom || "")}
          onChange={e => {
            const val = e.target.value;
            if (Array.isArray(config.chamadaCupom)) {
              // Cycling ON — edita o input
              salvarConfig({ chamadaCupomInput: val });
            } else {
              if (val && !val.toLowerCase().includes("cupom")) return;
              salvarConfig({ chamadaCupom: val });
            }
          }}
          onBlur={e => {
            // Cycling ON — Enter ou blur adiciona ao array
            if (!Array.isArray(config.chamadaCupom)) return;
            const val = e.target.value.trim();
            if (!val) return;
            if (val.length > 60) return;
            if (config.chamadaCupom.includes(val)) return;
            const novo = [...config.chamadaCupom, val];
            salvarConfig({ chamadaCupom: novo, chamadaCupomInput: "" });
          }}
          onKeyDown={e => {
            if (e.key === "Enter") e.target.blur();
          }}
          placeholder={Array.isArray(config.chamadaCupom) ? "Digite e sair do campo para adicionar..." : "Escreva sua frase..."}
          maxLength={60}
        />
        <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 4 }}>Máx 60 caracteres · Cycling ON: digite e saia do campo para adicionar. Cycling OFF: frase fixa.</div>
        {Array.isArray(config.chamadaCupom) && !config.chamadaCupom.some(f => f.toLowerCase().includes("cupom")) && (
          <div style={{ fontSize: "0.65rem", color: "var(--red)", marginTop: 4, fontWeight: 600 }}>⚠️ Pelo menos 1 frase deve conter a palavra "Cupom"</div>
        )}
      </div>
      <div style={{ height: 16 }} />

      {/* Lista de cupons */}
      <div className="section-label">Cupons cadastrados</div>
      {loading && <p className="text-sm text-muted">Carregando...</p>}
      {!loading && cupons.length === 0 && <p className="text-sm text-muted mb-4">Nenhum cupom cadastrado.</p>}
      {cupons.map(c => (
        <div key={c.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "#f59e0b", fontFamily: "monospace" }}>{c.codigo}</span>
              <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 20, fontWeight: 700,
                background: c.ativo ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                color: c.ativo ? "var(--green)" : "var(--red)",
                border: `1px solid ${c.ativo ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}>
                {c.ativo ? "Ativo" : "Inativo"}
              </span>
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginTop: 2 }}>
              {descricaoTipo(c)} · {c.usosTotal || 0} uso(s)
              {c.valorMinimo && ` · Mín: R$${c.valorMinimo}`}
              {c.dataExpiracao && ` · Expira: ${new Date(c.dataExpiracao.seconds * 1000).toLocaleDateString("pt-BR")}`}
            </div>
          </div>
          <div className={`toggle-switch ${c.ativo ? "on" : ""}`} onClick={() => toggleAtivo(c)} style={{ cursor: "pointer" }} />
          <button className="btn btn-sm btn-danger" onClick={() => deletarCupom(c.id)}>🗑️</button>
        </div>
      ))}

      <div className="divider" />

      {/* Criar novo cupom */}
      <div className="section-label">➕ Novo cupom</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="form-group" style={{ flex: "2 1 140px" }}>
          <label className="form-label">Código *</label>
          <input className="form-input" value={form.codigo} onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))} placeholder="Ex: BEMVINDO10" style={{ textTransform: "uppercase" }} />
        </div>
        <div className="form-group" style={{ flex: "1 1 120px" }}>
          <label className="form-label">Tipo *</label>
          <select className="form-input" value={form.tipo} onChange={set("tipo")}>
            <option value="porcentagem">% Porcentagem</option>
            <option value="fixo">R$ Valor fixo</option>
            <option value="frete">🚚 Frete grátis</option>
          </select>
        </div>
        {form.tipo !== "frete" && (
          <div className="form-group" style={{ flex: "1 1 100px" }}>
            <label className="form-label">{form.tipo === "porcentagem" ? "% Desconto" : "R$ Desconto"} *</label>
            <input className="form-input" type="number" value={form.valor} onChange={set("valor")} placeholder={form.tipo === "porcentagem" ? "10" : "5.00"} step="0.01" />
          </div>
        )}
        <div className="form-group" style={{ flex: "1 1 120px" }}>
          <label className="form-label">Pedido mínimo (R$)</label>
          <input className="form-input" type="number" value={form.valorMinimo} onChange={set("valorMinimo")} placeholder="Opcional" step="0.01" />
        </div>
        <div className="form-group" style={{ flex: "1 1 140px" }}>
          <label className="form-label">Expiração</label>
          <input className="form-input" type="date" value={form.dataExpiracao} onChange={set("dataExpiracao")} />
        </div>
      </div>
      <button className="btn btn-gold btn-full" onClick={handleSalvar} disabled={salvando}>
        {salvando ? "Criando..." : "➕ Criar cupom"}
      </button>
    </div>
  );
}

// Selector de categoria para o formulário de produto
function CategoriaSelect({ value, onChange }) {
  const { tenantId } = useStore();
  const [categorias, setCategorias] = useState([]);
  useEffect(() => {
    const catPath = tenantId ? `tenants/${tenantId}/categorias` : "categorias";
    const q = query(collection(db, catPath), orderBy("ordem", "asc"));
    const unsub = onSnapshot(q, snap => setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, [tenantId]);
  return (
    <div className="form-group" style={{ flex: "1 1 140px" }}>
      <label className="form-label">Categoria</label>
      <select className="form-input" value={value || ""} onChange={e => onChange(e.target.value)}>
        <option value="">Sem categoria</option>
        {categorias.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.nome}</option>)}
      </select>
    </div>
  );
}


// Filtros disponíveis do cardápio
const FILTROS_DISPONIVEIS = [
  { id: "popular",     label: "🔥 Popular",    tipo: "sistema" },
  { id: "favoritos",   label: "❤️ Favoritos",  tipo: "nav" },
  { id: "cupons",      label: "🎟️ Cupons",     tipo: "nav" },
  { id: "preco_asc",   label: "💰 Menor",       tipo: "sistema" },
  { id: "preco_desc",  label: "💎 Maior",       tipo: "sistema" },
];

function TabCategorias() {
  const toast = useToast();
  const { config, tenantId } = useStore();
  const catPath = tenantId ? `tenants/${tenantId}/categorias` : "categorias";
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: "", emoji: "🫐", ordem: "" });
  const [editId, setEditId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [filtros, setFiltros] = useState(() => {
    // Padrão: todos visíveis na ordem original
    return FILTROS_DISPONIVEIS.map(f => ({ ...f, visivel: true }));
  });

  useEffect(() => {
    const q = query(collection(db, catPath), orderBy("ordem", "asc"));
    const unsub = onSnapshot(q, snap => {
      setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  // Carregar filtros do config
  useEffect(() => {
    if (config?.filtros) {
      const salvos = config.filtros;
      setFiltros(FILTROS_DISPONIVEIS.map(f => ({
        ...f,
        visivel: salvos[f.id] !== false,
      })));
    }
  }, [config]);

  const salvarFiltros = async (filtrosAtualizados) => {
    const dados = {};
    filtrosAtualizados.forEach((f, i) => { dados[`filtros.${f.id}`] = f.visivel; });
    dados["filtrosOrdem"] = filtrosAtualizados.map(f => f.id);
    await salvarConfig(dados);
  };

  const moverFiltro = (idx, direcao) => {
    const nova = [...filtros];
    const novoIdx = idx + direcao;
    if (novoIdx < 0 || novoIdx >= nova.length) return;
    [nova[idx], nova[novoIdx]] = [nova[novoIdx], nova[idx]];
    setFiltros(nova);
    salvarFiltros(nova);
  };

  const toggleFiltro = (id) => {
    const nova = filtros.map(f => f.id === id ? { ...f, visivel: !f.visivel } : f);
    setFiltros(nova);
    salvarFiltros(nova);
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) { toast("Informe o nome da categoria.", "error"); return; }
    setSalvando(true);
    try {
      const dados = {
        nome: form.nome.trim(),
        emoji: form.emoji || "🫐",
        ordem: parseInt(form.ordem) || categorias.length + 1,
        ativa: true,
      };
      if (editId) {
        await updateDoc(doc(db, catPath, editId), dados);
        toast("✅ Categoria atualizada!");
      } else {
        await setDoc(doc(db, catPath, `cat_${Date.now()}`), {
          ...dados,
          createdAt: serverTimestamp(),
        });
        toast("✅ Categoria criada!");
      }
      setForm({ nome: "", emoji: "🫐", ordem: "" });
      setEditId(null);
    } catch { toast("Erro ao salvar.", "error"); }
    finally { setSalvando(false); }
  };

  const toggleAtiva = async (cat) => {
    await updateDoc(doc(db, catPath, cat.id), { ativa: !cat.ativa });
    toast(cat.ativa ? "Categoria ocultada." : "Categoria visível!");
  };

  const deletarCategoria = async (id) => {
    if (!window.confirm("Excluir esta categoria? Os produtos não serão excluídos.")) return;
    await deleteDoc(doc(db, catPath, id));
    toast("🗑️ Categoria removida.");
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        Crie categorias para organizar seu cardápio. Ex: Bebidas, Complementos, Promoções.
      </p>

      <div className="section-label">Categorias cadastradas</div>
      {loading && <p className="text-sm text-muted">Carregando...</p>}
      {!loading && categorias.length === 0 && (
        <div style={{ background: "var(--bg2)", border: "1px dashed var(--border2)", borderRadius: "var(--radius-sm)", padding: 16, marginBottom: 16, textAlign: "center" }}>
          <p className="text-sm text-muted">Nenhuma categoria ainda. A aba "Todos" sempre aparece por padrão.</p>
        </div>
      )}

      {categorias.map((cat, i) => (
        <div key={cat.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.4rem" }}>{cat.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{cat.nome}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>Ordem: {cat.ordem}</div>
          </div>
          <span style={{
            fontSize: "0.65rem", padding: "2px 8px", borderRadius: 20, fontWeight: 700,
            background: cat.ativa !== false ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
            color: cat.ativa !== false ? "var(--green)" : "var(--red)",
            border: `1px solid ${cat.ativa !== false ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
          }}>
            {cat.ativa !== false ? "Visível" : "Oculta"}
          </span>
          <div className={`toggle-switch ${cat.ativa !== false ? "on" : ""}`} onClick={() => toggleAtiva(cat)} style={{ cursor: "pointer" }} />
          <button className="btn btn-sm btn-outline" onClick={() => { setForm({ nome: cat.nome, emoji: cat.emoji, ordem: cat.ordem }); setEditId(cat.id); }}>✏️</button>
          <button className="btn btn-sm btn-danger" onClick={() => deletarCategoria(cat.id)}>🗑️</button>
        </div>
      ))}

      <div className="divider" />

      {/* ===== FILTROS DO CARDÁPIO ===== */}
      <div className="section-label" style={{ marginBottom: 8 }}>⚙️ Filtros do Cardápio</div>
      <p className="text-sm text-muted mb-3" style={{ fontSize: "0.75rem" }}>Arraste as setas para reordenar. Filtros tipo "sistema" (Popular, Menor, Maior) não podem ser ocultados.</p>
      {filtros.map((filtro, i) => (
        <div key={filtro.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button onClick={() => moverFiltro(i, -1)} disabled={i === 0} style={{ background: "none", border: "none", cursor: i === 0 ? "not-allowed" : "pointer", color: i === 0 ? "var(--text3)" : "var(--text2)", fontSize: "0.8rem", padding: "2px 4px", lineHeight: 1 }}>▲</button>
            <button onClick={() => moverFiltro(i, 1)} disabled={i === filtros.length - 1} style={{ background: "none", border: "none", cursor: i === filtros.length - 1 ? "not-allowed" : "pointer", color: i === filtros.length - 1 ? "var(--text3)" : "var(--text2)", fontSize: "0.8rem", padding: "2px 4px", lineHeight: 1 }}>▼</button>
          </div>
          <span style={{ flex: 1, fontWeight: 600, fontSize: "0.88rem" }}>{filtro.label}</span>
          {filtro.tipo === "sistema" ? (
            <span style={{ fontSize: "0.65rem", padding: "2px 8px", borderRadius: 20, background: "rgba(138,92,246,0.1)", color: "var(--purple2)", border: "1px solid rgba(138,92,246,0.3)", fontWeight: 700 }}>Sistema</span>
          ) : (
            <div className={`toggle-switch ${filtro.visivel ? "on" : ""}`} onClick={() => toggleFiltro(filtro.id)} style={{ cursor: "pointer" }} />
          )}
        </div>
      ))}

      <div className="divider" />
      <div className="section-label">{editId ? "✏️ Editar categoria" : "➕ Nova categoria"}</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="form-group" style={{ flex: "2 1 160px" }}>
          <label className="form-label">Nome *</label>
          <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Bebidas" />
        </div>
        <div className="form-group" style={{ flex: "0 0 80px" }}>
          <label className="form-label">Emoji</label>
          <input className="form-input" value={form.emoji} onChange={e => setForm(p => ({ ...p, emoji: e.target.value }))} placeholder="🫐" />
        </div>
        <div className="form-group" style={{ flex: "0 0 80px" }}>
          <label className="form-label">Ordem</label>
          <input className="form-input" type="number" value={form.ordem} onChange={e => setForm(p => ({ ...p, ordem: e.target.value }))} placeholder="1" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-gold" style={{ flex: 1 }} onClick={handleSalvar} disabled={salvando}>
          {salvando ? "Salvando..." : editId ? "💾 Salvar" : "➕ Criar categoria"}
        </button>
        {editId && <button className="btn btn-outline" onClick={() => { setEditId(null); setForm({ nome: "", emoji: "🫐", ordem: "" }); }}>Cancelar</button>}
      </div>
    </div>
  );
}

// ===== HISTÓRICO COMPLETO =====
function TabHistorico() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [expandido, setExpandido] = useState(null);
  const [pagina, setPagina] = useState(1);
  const POR_PAGINA = 20;

  useEffect(() => {
    const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"), limit(500));
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const pedidosFiltrados = pedidos.filter(p => {
    // Filtro de busca
    if (busca.trim()) {
      const t = busca.toLowerCase();
      if (!(p.nomeCliente?.toLowerCase().includes(t) || p.telefone?.includes(t))) return false;
    }
    // Filtro status
    if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
    // Filtro data
    if (dataInicio || dataFim) {
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date();
      if (dataInicio && d < new Date(dataInicio + "T00:00:00")) return false;
      if (dataFim && d > new Date(dataFim + "T23:59:59")) return false;
    }
    return true;
  });

  const totalPaginas = Math.ceil(pedidosFiltrados.length / POR_PAGINA);
  const pedidosPagina = pedidosFiltrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const totalFiltrado = pedidosFiltrados.reduce((s, p) => s + (p.total || 0), 0);

  const STATUS_CORES = {
    pendente: "var(--gold)", confirmado: "#60a5fa", preparo: "var(--purple2)",
    pronto: "var(--green)", entrega: "#f97316", entregue: "var(--green)", cancelado: "var(--red)",
  };

  const limparFiltros = () => {
    setBusca(""); setFiltroStatus("todos"); setDataInicio(""); setDataFim(""); setPagina(1);
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Carregando...</div>;

  return (
    <div>
      {/* Filtros */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <input
            className="form-input" style={{ flex: 1 }}
            value={busca} onChange={e => { setBusca(e.target.value); setPagina(1); }}
            placeholder="🔍 Buscar por cliente ou telefone..."
          />
          {(busca || filtroStatus !== "todos" || dataInicio || dataFim) && (
            <button onClick={limparFiltros} style={{
              background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)",
              padding: "0 12px", cursor: "pointer", color: "var(--text2)", fontFamily: "'Outfit', sans-serif", fontSize: "0.8rem",
            }}>Limpar</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: "1 1 120px", marginBottom: 0 }}>
            <label className="form-label">De</label>
            <input className="form-input" type="date" value={dataInicio} onChange={e => { setDataInicio(e.target.value); setPagina(1); }} />
          </div>
          <div className="form-group" style={{ flex: "1 1 120px", marginBottom: 0 }}>
            <label className="form-label">Até</label>
            <input className="form-input" type="date" value={dataFim} onChange={e => { setDataFim(e.target.value); setPagina(1); }} />
          </div>
          <div className="form-group" style={{ flex: "1 1 140px", marginBottom: 0 }}>
            <label className="form-label">Status</label>
            <select className="form-input" value={filtroStatus} onChange={e => { setFiltroStatus(e.target.value); setPagina(1); }}>
              <option value="todos">Todos</option>
              {["pendente","confirmado","preparo","pronto","entrega","entregue","cancelado"].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", flex: 1 }}>
          <div style={{ fontSize: "0.65rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1 }}>Pedidos</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 900, color: "var(--purple2)" }}>{pedidosFiltrados.length}</div>
        </div>
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", flex: 1 }}>
          <div style={{ fontSize: "0.65rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1 }}>Faturamento</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 900, color: "var(--gold)" }}>R$ {totalFiltrado.toFixed(2).replace(".", ",")}</div>
        </div>
      </div>

      {/* Lista */}
      {pedidosPagina.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text2)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
          <p className="text-sm">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <>
          {pedidosPagina.map(p => {
            const cor = STATUS_CORES[p.status] || "var(--text3)";
            const aberto = expandido === p.id;
            const data = p.createdAt?.toDate ? p.createdAt.toDate().toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
            return (
              <div key={p.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", marginBottom: 8, overflow: "hidden" }}>
                <div onClick={() => setExpandido(aberto ? null : p.id)} style={{ padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: cor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{p.nomeCliente}</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--text2)" }}>{data} · {p.pagamento?.toUpperCase()} · {p.status}</div>
                  </div>
                  <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700, flexShrink: 0 }}>
                    R$ {p.total?.toFixed(2).replace(".", ",")}
                  </div>
                  <span style={{ fontSize: "0.65rem", color: "var(--text3)" }}>{aberto ? "▲" : "▼"}</span>
                </div>
                {aberto && (
                  <div style={{ borderTop: "1px solid var(--border)", padding: "12px 14px", fontSize: "0.82rem" }}>
                    {p.items?.map((item, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "var(--text2)" }}>{item.qty}x {item.nome}</span>
                        <span>R$ {(item.preco * item.qty).toFixed(2).replace(".", ",")}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                      <span>Total</span>
                      <span style={{ color: "var(--gold)" }}>R$ {p.total?.toFixed(2).replace(".", ",")}</span>
                    </div>
                    {p.telefone && <div style={{ marginTop: 6, color: "var(--text2)" }}>📱 {p.telefone}</div>}
                    {p.tipoEntrega === "entrega" && p.endereco && <div style={{ color: "var(--text2)" }}>📍 {p.endereco}</div>}
                    {p.obs && <div style={{ color: "var(--text2)" }}>📝 {p.obs}</div>}
                    {p.cupom && <div style={{ color: "#f59e0b" }}>🏷️ Cupom: {p.cupom}</div>}
                  </div>
                )}
              </div>
            );
          })}

          {/* Paginação */}
          {totalPaginas > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button onClick={() => setPagina(p => Math.max(1, p - 1))} disabled={pagina === 1} className="btn btn-sm btn-outline">← Anterior</button>
              <span style={{ padding: "6px 12px", fontSize: "0.82rem", color: "var(--text2)" }}>
                {pagina} / {totalPaginas}
              </span>
              <button onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))} disabled={pagina === totalPaginas} className="btn btn-sm btn-outline">Próximo →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ===== RECUPERADOR DE VENDAS =====
function TabRecuperador() {
  const toast = useToast();
  const [clientes, setClientes] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [carregado, setCarregado] = useState(false);
  const [diasInativo, setDiasInativo] = useState(7);
  const [tipoMsg, setTipoMsg] = useState("lembrete");
  const [msgCustom, setMsgCustom] = useState("");
  const [cupomRecuperacao, setCupomRecuperacao] = useState("");
  const [enviando, setEnviando] = useState(null);

  const MSG_TEMPLATES = {
    lembrete: (nome, dias, link) =>
      `🫐 *Olá, ${nome}!*\n\nSentimos sua falta! Faz ${dias} dias que você não pede no *${config.nomeLoja || "nossa loja"}*. 😢\n\nNosso cardápio está fresquinho te esperando!\n\n👉 ${link}\n\nVolte logo! 🫐❤️`,
    desconto: (nome, dias, link, cupom) =>
      `🎁 *Olá, ${nome}!*\n\nSentimos sua falta! Como presente por sua volta, preparamos um desconto especial exclusivo para você:\n\n🏷️ *Use o cupom: ${cupom}*\n\n👉 ${link}\n\nCorra, é por tempo limitado! 🫐`,
    custom: (nome, dias, link, cupom) =>
      msgCustom.replace("{nome}", nome).replace("{dias}", dias).replace("{link}", link).replace("{cupom}", cupom || ""),
  };

  const carregarClientes = async () => {
    setLoading(true);
    try {
      const [snapUsers, snapPedidos] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(query(collection(db, "pedidos"), orderBy("createdAt", "desc"))),
      ]);

      const todosClientes = snapUsers.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(c => c.role !== "admin" && c.telefone);

      const todosPedidos = snapPedidos.docs.map(d => ({ id: d.id, ...d.data() }));
      setPedidos(todosPedidos);

      const agora = new Date();
      const limite = new Date(agora.getTime() - diasInativo * 24 * 60 * 60 * 1000);

      const inativos = todosClientes.map(cliente => {
        const pedidosCliente = todosPedidos.filter(p => p.userId === cliente.id && p.status !== "cancelado");
        if (pedidosCliente.length === 0) return null;

        const ultimo = pedidosCliente[0];
        const dataUltimo = ultimo.createdAt?.toDate ? ultimo.createdAt.toDate() : new Date();
        if (dataUltimo >= limite) return null;

        const diasSem = Math.floor((agora - dataUltimo) / (1000 * 60 * 60 * 24));
        const totalGasto = pedidosCliente.reduce((s, p) => s + (p.total || 0), 0);

        return {
          ...cliente,
          ultimoPedido: dataUltimo,
          diasSemComprar: diasSem,
          totalPedidos: pedidosCliente.length,
          totalGasto,
        };
      }).filter(Boolean).sort((a, b) => b.diasSemComprar - a.diasSemComprar);

      setClientes(inativos);
      setCarregado(true);
    } catch (e) { toast("Erro ao carregar.", "error"); }
    finally { setLoading(false); }
  };

  const enviarWhatsApp = (cliente) => {
    setEnviando(cliente.id);
    const link = "https://acaipurogosto.com.br";
    const msgFn = MSG_TEMPLATES[tipoMsg];
    const msg = msgFn(
      cliente.nome?.split(" ")[0] || "Cliente",
      cliente.diasSemComprar,
      link,
      cupomRecuperacao
    );
    const tel = (cliente.telefone || "").replace(/\D/g, "");
    const telFormatado = tel.startsWith("55") ? tel : `55${tel}`;
    window.open(`https://wa.me/${telFormatado}?text=${encodeURIComponent(msg)}`, "_blank");
    setTimeout(() => setEnviando(null), 1000);
  };

  const enviarParaTodos = () => {
    if (!window.confirm(`Enviar mensagem para ${clientes.length} clientes inativos?`)) return;
    clientes.forEach((c, i) => setTimeout(() => enviarWhatsApp(c), i * 1500));
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        Identifique clientes que pararam de comprar e envie mensagens personalizadas para trazê-los de volta.
      </p>

      {/* Configurações */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>⚙️ Configurações</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div className="form-group" style={{ flex: "1 1 120px", marginBottom: 0 }}>
            <label className="form-label">Dias sem comprar</label>
            <input className="form-input" type="number" min="1" value={diasInativo}
              onChange={e => setDiasInativo(parseInt(e.target.value) || 7)} />
          </div>
          {tipoMsg === "desconto" && (
            <div className="form-group" style={{ flex: "2 1 160px", marginBottom: 0 }}>
              <label className="form-label">Código do cupom</label>
              <input className="form-input" value={cupomRecuperacao}
                onChange={e => setCupomRecuperacao(e.target.value.toUpperCase())}
                placeholder="Ex: VOLTEI10" style={{ textTransform: "uppercase" }} />
            </div>
          )}
        </div>

        {/* Tipo de mensagem */}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Tipo de mensagem</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { id: "lembrete", label: "💬 Lembrete simples", desc: "Mensagem amigável lembrando do cardápio" },
              { id: "desconto", label: "🎁 Com desconto exclusivo", desc: "Envia cupom especial para incentivar retorno" },
              { id: "custom",   label: "✏️ Mensagem personalizada", desc: "Escreva sua própria mensagem" },
            ].map(op => (
              <div key={op.id} onClick={() => setTipoMsg(op.id)} style={{
                background: tipoMsg === op.id ? "rgba(245,197,24,0.08)" : "var(--bg3)",
                border: `1px solid ${tipoMsg === op.id ? "rgba(245,197,24,0.4)" : "var(--border)"}`,
                borderRadius: "var(--radius-sm)", padding: "10px 12px",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{
                  width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                  border: `2px solid ${tipoMsg === op.id ? "var(--gold)" : "var(--border)"}`,
                  background: tipoMsg === op.id ? "var(--gold)" : "transparent",
                }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{op.label}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>{op.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {tipoMsg === "custom" && (
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Sua mensagem (use {"{nome}"}, {"{dias}"}, {"{link}"}, {"{cupom}"})</label>
            <textarea className="form-input" rows={4} value={msgCustom}
              onChange={e => setMsgCustom(e.target.value)}
              placeholder="Olá {nome}! Faz {dias} dias que você não aparece..." />
          </div>
        )}

        {/* Preview */}
        {tipoMsg !== "custom" && (
          <div style={{ background: "rgba(37,211,102,0.06)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: "var(--radius-sm)", padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Preview da mensagem</div>
            <div style={{ fontSize: "0.78rem", color: "var(--text2)", lineHeight: 1.6, whiteSpace: "pre-line" }}>
              {MSG_TEMPLATES[tipoMsg]("João", diasInativo, "acaipurogosto.com.br", cupomRecuperacao || "CUPOM")}
            </div>
          </div>
        )}

        <button className="btn btn-gold btn-full" onClick={carregarClientes} disabled={loading}>
          {loading ? "Carregando..." : "🔍 Buscar clientes inativos"}
        </button>
      </div>

      {/* Resultados */}
      {carregado && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{clientes.length} cliente(s) inativo(s)</div>
              <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>há mais de {diasInativo} dias sem comprar</div>
            </div>
            {clientes.length > 0 && (
              <button onClick={enviarParaTodos} style={{
                background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)",
                borderRadius: 20, padding: "8px 14px", cursor: "pointer",
                color: "#25d366", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.8rem",
              }}>
                💬 Enviar para todos
              </button>
            )}
          </div>

          {clientes.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text2)" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎉</div>
              <p className="text-sm">Nenhum cliente inativo! Todos compraram recentemente.</p>
            </div>
          ) : (
            clientes.map(c => (
              <div key={c.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, var(--purple2), var(--purple))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, color: "#fff",
                }}>
                  {(c.nome || "C")[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{c.nome}</div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 2 }}>
                    📱 {c.telefone} · {c.totalPedidos} pedido(s) · R$ {c.totalGasto.toFixed(2).replace(".", ",")}
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--red)", marginTop: 2, fontWeight: 600 }}>
                    ⏰ {c.diasSemComprar} dias sem comprar
                  </div>
                </div>
                <button
                  onClick={() => enviarWhatsApp(c)}
                  disabled={enviando === c.id}
                  style={{
                    background: "linear-gradient(135deg, #25d366, #128c7e)",
                    border: "none", borderRadius: 10, padding: "8px 14px",
                    color: "#fff", fontFamily: "'Outfit', sans-serif",
                    fontWeight: 700, fontSize: "0.78rem", cursor: "pointer",
                    flexShrink: 0, opacity: enviando === c.id ? 0.7 : 1,
                  }}
                >
                  💬 Enviar
                </button>
              </div>
            ))
          )}
        </>
      )}
    </div>
  );
}

// TabEntregadores — adicionar ao Admin.js
function TabEntregadores() {
  const toast = useToast();
  const { tenantId } = useStore();
  const [entregadores, setEntregadores] = useState([]);
  const [pedidosEntrega, setPedidosEntrega] = useState([]);
  const [form, setForm] = useState({ nome: "", telefone: "" });
  const [salvando, setSalvando] = useState(false);
  const [atribuindo, setAtribuindo] = useState(null);
  const [relPeriodo, setRelPeriodo] = useState("7d");
  const [relPedidos, setRelPedidos] = useState([]);
  const [relLoading, setRelLoading] = useState(true);

  const getRelDates = p => {
    const agora = new Date();
    const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
    if (p === "hoje") {
      return { inicio: new Date(hoje), fim: new Date(hoje.getTime() + 86400000 - 1) };
    } else if (p === "7d") {
      const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 6);
      return { inicio, fim: new Date(hoje.getTime() + 86400000 - 1) };
    } else {
      const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 29);
      return { inicio, fim: new Date(hoje.getTime() + 86400000 - 1) };
    }
  };

  useEffect(() => {
    if (!tenantId) return;
    setRelLoading(true);
    const { inicio, fim } = getRelDates(relPeriodo);
    const q = query(
      collection(db, "pedidos"),
      where("tenantId", "==", tenantId),
      where("tipoEntrega", "==", "entrega"),
      where("status", "in", ["entrega", "entregue"]),
      where("createdAt", ">=", Timestamp.fromDate(inicio)),
      where("createdAt", "<=", Timestamp.fromDate(fim)),
      orderBy("createdAt", "desc"),
      limit(500)
    );
    const unsub = onSnapshot(q, snap => {
      setRelPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setRelLoading(false);
    });
    return unsub;
  }, [tenantId, relPeriodo]);

  const fmt = v => v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

  const statsTotais = {
    entregas: relPedidos.length,
    faturamento: relPedidos.reduce((s, p) => s + (p.total || 0), 0),
    entregue: relPedidos.filter(p => p.status === "entregue").length,
  };

  // Ranking por entregador
  const rankingEntregadores = (() => {
    const map = {};
    relPedidos.forEach(p => {
      const id = p.entregadorId || "sem";
      const nome = p.entregadorNome || "Sem atribuição";
      if (!map[id]) map[id] = { id, nome, entregas: 0, faturamento: 0 };
      map[id].entregas++;
      map[id].faturamento += p.total || 0;
    });
    return Object.values(map).sort((a, b) => b.entregas - a.entregas);
  })();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "entregadores"), snap => {
      setEntregadores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "pedidos"),
      where("tipoEntrega", "==", "entrega"),
      where("status", "in", ["pronto", "entrega"])
    );
    const unsub = onSnapshot(q, snap => {
      setPedidosEntrega(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  const salvarEntregador = async () => {
    if (!form.nome.trim()) { toast("Informe o nome.", "error"); return; }
    setSalvando(true);
    try {
      const id = `entregador_${Date.now()}`;
      await setDoc(doc(db, "entregadores", id), {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        ativo: false,
        createdAt: serverTimestamp(),
      });
      toast(`✅ ${form.nome} cadastrado!`);
      setForm({ nome: "", telefone: "" });
    } catch { toast("Erro.", "error"); }
    finally { setSalvando(false); }
  };

  const atribuirPedido = async (pedidoId, entregadorId, entregadorNome) => {
    setAtribuindo(pedidoId);
    try {
      await updateDoc(doc(db, "pedidos", pedidoId), {
        entregadorId,
        entregadorNome,
        status: "entrega",
      });
      toast(`✅ Pedido atribuído para ${entregadorNome}!`);
    } catch { toast("Erro.", "error"); }
    finally { setAtribuindo(null); }
  };

  const deletarEntregador = async (id) => {
    if (!window.confirm("Remover entregador?")) return;
    await deleteDoc(doc(db, "entregadores", id));
    toast("Removido.");
  };

  const linkEntregador = (id) => `${window.location.origin}/entregador/${id}`;

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        Cadastre entregadores e atribua pedidos. Cada entregador recebe um link único para rastrear sua localização.
      </p>

      {/* Pedidos aguardando entregador */}
      {pedidosEntrega.length > 0 && (
        <>
          <div className="section-label" style={{ color: "#f97316" }}>🛵 Pedidos aguardando entregador</div>
          {pedidosEntrega.map(p => (
            <div key={p.id} style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{p.nomeCliente}</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>📍 {p.endereco}</div>
                  {p.entregadorNome && <div style={{ fontSize: "0.72rem", color: "#f97316", marginTop: 2 }}>🛵 {p.entregadorNome}</div>}
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700 }}>
                  R$ {p.total?.toFixed(2).replace(".", ",")}
                </div>
              </div>
              {!p.entregadorId && entregadores.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 6 }}>Atribuir para:</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {entregadores.map(e => (
                      <button key={e.id} onClick={() => atribuirPedido(p.id, e.id, e.nome)}
                        disabled={atribuindo === p.id}
                        style={{
                          padding: "6px 12px", border: "1px solid rgba(249,115,22,0.4)",
                          borderRadius: 20, cursor: "pointer", background: "rgba(249,115,22,0.1)",
                          color: "#f97316", fontFamily: "'Outfit', sans-serif",
                          fontWeight: 600, fontSize: "0.75rem",
                        }}>
                        🛵 {e.nome}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <div className="divider" />
        </>
      )}

      {/* Lista de entregadores */}
      <div className="section-label">Entregadores cadastrados</div>
      {entregadores.length === 0 && <p className="text-sm text-muted mb-4">Nenhum cadastrado.</p>}
      {entregadores.map(e => (
        <div key={e.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 14px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: e.ativo ? "rgba(34,197,94,0.2)" : "var(--bg3)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem",
            }}>🛵</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700 }}>{e.nome}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>
                {e.telefone && `📱 ${e.telefone} · `}
                <span style={{ color: e.ativo ? "var(--green)" : "var(--text3)", fontWeight: 600 }}>
                  {e.ativo ? "🟢 Online" : "⚫ Offline"}
                </span>
                {e.localizacao && e.ativo && (
                  <a href={`https://maps.google.com/?q=${e.localizacao.latitude},${e.localizacao.longitude}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: "#60a5fa", marginLeft: 6, textDecoration: "none" }}>
                    📍 Ver no mapa
                  </a>
                )}
              </div>
            </div>
            <button className="btn btn-sm btn-danger" onClick={() => deletarEntregador(e.id)}>🗑️</button>
          </div>
          {/* Link do entregador */}
          <div style={{ background: "var(--bg3)", borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ flex: 1, fontSize: "0.68rem", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              🔗 {linkEntregador(e.id)}
            </div>
            <button onClick={() => { navigator.clipboard.writeText(linkEntregador(e.id)); toast("Link copiado!"); }} style={{
              background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6,
              padding: "4px 8px", cursor: "pointer", color: "var(--text2)",
              fontFamily: "'Outfit', sans-serif", fontSize: "0.7rem", flexShrink: 0,
            }}>
              Copiar
            </button>
            <a href={`https://wa.me/${e.telefone?.replace(/\D/g,"")}?text=${encodeURIComponent(`Olá ${e.nome}! Seu link de entregador: ${linkEntregador(e.id)}`)}`}
              target="_blank" rel="noopener noreferrer" style={{
              background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)",
              borderRadius: 6, padding: "4px 8px", textDecoration: "none",
              color: "#25d366", fontSize: "0.7rem", fontWeight: 600, flexShrink: 0,
            }}>
              Enviar
            </a>
          </div>
        </div>
      ))}

      <div className="divider" />

      {/* Novo entregador */}
      <div className="section-label">➕ Cadastrar entregador</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div className="form-group" style={{ flex: "2 1 160px" }}>
          <label className="form-label">Nome *</label>
          <input className="form-input" value={form.nome} onChange={e => setForm(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: João Motoboy" />
        </div>
        <div className="form-group" style={{ flex: "2 1 160px" }}>
          <label className="form-label">WhatsApp</label>
          <input className="form-input" value={form.telefone} onChange={e => setForm(p => ({ ...p, telefone: e.target.value }))} placeholder="(99) 9 9999-9999" />
        </div>
      </div>
      <button className="btn btn-gold btn-full" onClick={salvarEntregador} disabled={salvando}>
        {salvando ? "Salvando..." : "➕ Cadastrar entregador"}
      </button>

      {/* ===== RELATÓRIO DE ENTREGAS ===== */}
      <div style={{ marginTop: 32, borderTop: "2px solid var(--border)", paddingTop: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "rgba(255,255,255,.6)", textTransform: "uppercase", letterSpacing: ".08em" }}>
            📊 Relatório de Entregas
          </div>
          {/* Period selector */}
          <div style={{ display: "flex", gap: 6 }}>
            {["hoje", "7d", "30d"].map(p => (
              <button key={p} onClick={() => setRelPeriodo(p)} style={{
                padding: "5px 12px", borderRadius: 8, border: "none", fontWeight: 700,
                fontSize: "0.7rem", cursor: "pointer",
                background: relPeriodo === p ? "#f97316" : "rgba(255,255,255,.06)",
                color: relPeriodo === p ? "#fff" : "rgba(255,255,255,.4)",
                fontFamily: "'Outfit',sans-serif",
              }}>
                {p === "hoje" ? "HOJE" : p === "7d" ? "7 DIAS" : "30 DIAS"}
              </button>
            ))}
          </div>
        </div>

        {relLoading ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--text3)", fontSize: "0.8rem" }}>Carregando...</div>
        ) : (
          <>
            {/* Stats resumo */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 20 }}>
              {[
                { icon: "🛵", label: "Total Entregas", val: statsTotais.entregas, cor: "#f97316" },
                { icon: "💰", label: "Faturamento", val: fmt(statsTotais.faturamento), cor: "#22c55e" },
                { icon: "📋", label: "Ticket Médio", val: fmt(statsTotais.faturamento / (statsTotais.entregas || 1)), cor: "#60a5fa" },
                { icon: "✅", label: "Entregues", val: statsTotais.entregues, cor: "#a78bfa" },
              ].map(s => (
                <div key={s.label} style={{
                  background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
                  borderRadius: 12, padding: "12px 10px", textAlign: "center"
                }}>
                  <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>{s.icon}</div>
                  <div style={{ fontWeight: 900, fontSize: "1rem", color: s.cor }}>{s.val}</div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: ".06em" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Por entregador */}
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 10 }}>
              Por Entregador
            </div>
            {rankingEntregadores.length === 0 && (
              <div style={{ color: "rgba(255,255,255,.3)", fontSize: "0.8rem", padding: "12px 0" }}>Nenhuma entrega no período</div>
            )}
            {rankingEntregadores.map((e, i) => (
              <div key={e.id} style={{
                display: "flex", alignItems: "center", gap: 10, marginBottom: 10,
                background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)",
                borderRadius: 12, padding: "10px 14px",
              }}>
                <span style={{
                  fontSize: "0.8rem", fontWeight: 900, width: 20,
                  color: i === 0 ? "#f5c518" : "rgba(255,255,255,.3)"
                }}>#{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem" }}>{e.nome}</div>
                  <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.08)", marginTop: 5 }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      background: i === 0 ? "#f97316" : "#7c3aed",
                      width: `${(e.entregas / (rankingEntregadores[0]?.entregas || 1)) * 100}%`,
                      transition: "width .3s"
                    }} />
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#f97316" }}>{e.entregas}x</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.4)" }}>{fmt(e.faturamento)}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

// TabMesas — adicionar ao Admin.js
function TabMesas() {
  const toast = useToast();
  const [mesas, setMesas] = useState([]);
  const [qtdMesas, setQtdMesas] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [imprimindo, setImprimindo] = useState(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "mesas"), orderBy("numero", "asc")),
      snap => setMesas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  const criarMesas = async () => {
    if (qtdMesas < 1) return;
    setSalvando(true);
    try {
      const ultimasMesas = mesas.length > 0 ? Math.max(...mesas.map(m => m.numero)) : 0;
      for (let i = 1; i <= qtdMesas; i++) {
        const numero = ultimasMesas + i;
        const id = `mesa_${numero}`;
        await setDoc(doc(db, "mesas", id), {
          numero,
          ativa: true,
          createdAt: serverTimestamp(),
        });
      }
      toast(`✅ ${qtdMesas} mesa(s) criada(s)!`);
      setQtdMesas(1);
    } catch { toast("Erro.", "error"); }
    finally { setSalvando(false); }
  };

  const deletarMesa = async (id) => {
    if (!window.confirm("Remover esta mesa?")) return;
    await deleteDoc(doc(db, "mesas", id));
    toast("Mesa removida.");
  };

  const toggleMesa = async (mesa) => {
    await updateDoc(doc(db, "mesas", mesa.id), { ativa: !mesa.ativa });
  };

  const urlMesa = (numero) => `https://acaipurogosto.com.br/mesa/${numero}`;

  const imprimirQR = (mesa) => {
    setImprimindo(mesa.id);
    const url = urlMesa(mesa.numero);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&bgcolor=ffffff&color=0f0518&margin=20`;

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #fff; }
  .card { text-align: center; padding: 32px; border: 3px solid #5a2d91; border-radius: 20px; max-width: 320px; }
  .logo { font-size: 2rem; margin-bottom: 8px; }
  .nome { font-size: 1.2rem; font-weight: bold; color: #5a2d91; margin-bottom: 4px; }
  .mesa { font-size: 3rem; font-weight: 900; color: #f5c518; margin: 12px 0; }
  .qr { margin: 16px 0; }
  .instrucao { font-size: 0.85rem; color: #666; margin-top: 12px; line-height: 1.5; }
  .url { font-size: 0.7rem; color: #999; margin-top: 8px; word-break: break-all; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <div class="card">
    <div class="logo">🫐</div>
    <div class="nome">${config.nomeLoja || "Loja"}</div>
    <div class="mesa">Mesa ${mesa.numero}</div>
    <div class="qr"><img src="${qrUrl}" width="200" height="200" /></div>
    <div class="instrucao">📱 Aponte a câmera do celular para o QR Code e faça seu pedido!</div>
    <div class="url">${url}</div>
  </div>
</body>
</html>`;

    const janela = window.open("", "_blank", "width=400,height=600");
    janela.document.write(html);
    janela.document.close();
    setTimeout(() => { janela.print(); setTimeout(() => janela.close(), 2000); }, 800);
    setTimeout(() => setImprimindo(null), 1000);
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        Crie QR Codes para suas mesas. Cliente escaneia e faz o pedido direto pelo celular.
      </p>

      {/* Lista de mesas */}
      <div className="section-label">Mesas cadastradas ({mesas.length})</div>
      {mesas.length === 0 && <p className="text-sm text-muted mb-4">Nenhuma mesa ainda.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        {mesas.map(m => (
          <div key={m.id} style={{
            background: m.ativa ? "var(--bg2)" : "var(--bg3)",
            border: `1px solid ${m.ativa ? "var(--border2)" : "var(--border)"}`,
            borderRadius: "var(--radius)", padding: 12, textAlign: "center",
            opacity: m.ativa ? 1 : 0.6,
          }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.8rem", fontWeight: 900, color: "var(--gold)" }}>
              {m.numero}
            </div>
            <div style={{ fontSize: "0.65rem", color: m.ativa ? "var(--green)" : "var(--text3)", fontWeight: 600, marginBottom: 8 }}>
              {m.ativa ? "🟢 Ativa" : "⚫ Inativa"}
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={() => imprimirQR(m)} disabled={imprimindo === m.id} style={{
                padding: "4px 8px", border: "none", borderRadius: 6, cursor: "pointer",
                background: "var(--gold)", color: "var(--bg)",
                fontFamily: "'Outfit', sans-serif", fontSize: "0.65rem", fontWeight: 700,
              }}>
                🖨️ QR
              </button>
              <button onClick={() => toggleMesa(m)} style={{
                padding: "4px 8px", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer",
                background: "var(--bg3)", color: "var(--text2)",
                fontFamily: "'Outfit', sans-serif", fontSize: "0.65rem",
              }}>
                {m.ativa ? "Pausar" : "Ativar"}
              </button>
              <button onClick={() => deletarMesa(m.id)} style={{
                padding: "4px 8px", border: "none", borderRadius: 6, cursor: "pointer",
                background: "rgba(239,68,68,0.1)", color: "var(--red)",
                fontFamily: "'Outfit', sans-serif", fontSize: "0.65rem",
              }}>
                🗑️
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Imprimir todos */}
      {mesas.length > 0 && (
        <button onClick={() => mesas.forEach((m, i) => setTimeout(() => imprimirQR(m), i * 500))} style={{
          width: "100%", padding: 12, marginBottom: 16,
          background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.3)",
          borderRadius: "var(--radius-sm)", cursor: "pointer",
          color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 700,
        }}>
          🖨️ Imprimir QR Codes de todas as mesas
        </button>
      )}

      <div className="divider" />

      {/* Criar mesas */}
      <div className="section-label">➕ Criar mesas</div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
          <label className="form-label">Quantas mesas adicionar?</label>
          <input className="form-input" type="number" min="1" max="50" value={qtdMesas}
            onChange={e => setQtdMesas(parseInt(e.target.value) || 1)} />
        </div>
        <button className="btn btn-gold" onClick={criarMesas} disabled={salvando} style={{ marginBottom: 0 }}>
          {salvando ? "Criando..." : `➕ Criar ${qtdMesas} mesa(s)`}
        </button>
      </div>
      <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 8 }}>
        As mesas serão numeradas automaticamente continuando da última existente.
      </div>
    </div>
  );
}

// ===== PERFIL DA LOJA =====
function TabPerfilLoja() {
  const toast = useToast();
  const { config, salvarConfig } = useStore();
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  useEffect(() => { setForm({ ...config }); }, [config]);

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarConfig(form);
      toast("✅ Perfil atualizado!");
    } catch { toast("Erro ao salvar.", "error"); }
    finally { setSalvando(false); }
  };

  const PAGAMENTOS = [
    { id: "pix",            icon: "📱", label: "PIX" },
    { id: "dinheiro",       icon: "💵", label: "Dinheiro" },
    { id: "debito",         icon: "💳", label: "Débito" },
    { id: "credito",        icon: "💳", label: "Crédito" },
    { id: "cartao_online",  icon: "💻", label: "Cartão Online" },
    { id: "metade_metade",  icon: "🔀", label: "Metade cartão + metade dinheiro" },
  ];

  const IMGBB_KEY = "4b8379f3bfc7eb113e0820730166a9f8";
  const [uploadandoCapa, setUploadandoCapa] = useState(false);
  const [uploadandoLogo, setUploadandoLogo] = useState(false);

  const uploadImagem = async (file, tipo) => {
    if (!file) return;
    const setUpload = tipo === "capa" ? setUploadandoCapa : setUploadandoLogo;
    const campo = tipo === "capa" ? "imagemCapa" : "logoUrl";
    setUpload(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, {
        method: "POST", body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setForm(p => ({ ...p, [campo]: data.data.url }));
        toast(`✅ Imagem enviada!`);
      }
    } catch { toast("Erro no upload.", "error"); }
    finally { setUpload(false); }
  };

  return (
    <div>
      <p className="text-sm text-muted mb-4">
        Informações exibidas na página "Sobre a loja" para os clientes.
      </p>

      {/* Preview link */}
      <a href="/perfil" target="_blank" rel="noopener noreferrer" style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "10px", marginBottom: 20,
        background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)",
        borderRadius: "var(--radius-sm)", textDecoration: "none",
        color: "#60a5fa", fontWeight: 600, fontSize: "0.85rem",
      }}>
        👁️ Ver como o cliente vê
      </a>

      {/* Imagem de capa */}
      <div className="section-label">🖼️ Imagens</div>
      {/* Imagem de capa */}
      <div className="form-group">
        <label className="form-label">Imagem de capa</label>
        {form.imagemCapa && (
          <img src={form.imagemCapa} alt="Capa" style={{ width: "100%", height: 130, objectFit: "cover", borderRadius: 8, marginBottom: 8 }} />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{
            flex: 1, padding: "10px", textAlign: "center",
            background: "rgba(245,197,24,0.1)", border: "1px dashed rgba(245,197,24,0.4)",
            borderRadius: "var(--radius-sm)", cursor: "pointer",
            color: "var(--gold)", fontFamily: "'Outfit', sans-serif",
            fontWeight: 600, fontSize: "0.82rem",
          }}>
            {uploadandoCapa ? "⏳ Enviando..." : "📷 Fazer upload"}
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => uploadImagem(e.target.files[0], "capa")} />
          </label>
        </div>
        <input className="form-input" style={{ marginTop: 8 }} value={form.imagemCapa || ""} onChange={set("imagemCapa")} placeholder="Ou cole um link de imagem aqui..." />
      </div>

      {/* Logo */}
      <div className="form-group">
        <label className="form-label">Logo</label>
        {form.logoUrl && (
          <img src={form.logoUrl} alt="Logo" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 12, marginBottom: 8, border: "2px solid var(--border)" }} />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{
            flex: 1, padding: "10px", textAlign: "center",
            background: "rgba(245,197,24,0.1)", border: "1px dashed rgba(245,197,24,0.4)",
            borderRadius: "var(--radius-sm)", cursor: "pointer",
            color: "var(--gold)", fontFamily: "'Outfit', sans-serif",
            fontWeight: 600, fontSize: "0.82rem",
          }}>
            {uploadandoLogo ? "⏳ Enviando..." : "📷 Fazer upload"}
            <input type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => uploadImagem(e.target.files[0], "logo")} />
          </label>
        </div>
        <input className="form-input" style={{ marginTop: 8 }} value={form.logoUrl || ""} onChange={set("logoUrl")} placeholder="Ou cole um link de imagem aqui..." />
      </div>

      <div className="divider" />
      <div className="section-label">Perfil</div>
      <div className="form-group">
        <label className="form-label">Quem somos</label>
        <textarea className="form-input" rows={4} value={form.quemSomos || ""} onChange={set("quemSomos")}
          placeholder="Conte a história da sua loja, diferenciais, valores..." />
      </div>
      <div className="form-group">
        <label className="form-label">Informações adicionais</label>
        <textarea className="form-input" rows={3} value={form.infoExtra || ""} onChange={set("infoExtra")}
          placeholder="Ex: Aceitamos encomendas, entregamos em toda a cidade..." />
      </div>

      <div className="divider" />
      <div className="section-label">🕐 Horários</div>
      <div className="form-group">
        <label className="form-label">Horários detalhados</label>
        <textarea className="form-input" rows={5} value={form.horariosDetalhados || ""} onChange={set("horariosDetalhados")}
          placeholder={"Segunda a Sexta: 8h às 21h\nSábado: 8h às 22h\nDomingo: 10h às 20h"} />
        <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>Uma linha por dia/período</div>
      </div>

      <div className="divider" />
      <div className="section-label">🛒 Pedido mínimo</div>
      <div className="form-group">
        <label className="form-label">Valor mínimo (R$)</label>
        <input className="form-input" type="number" step="0.01" value={form.pedidoMinimo || ""} onChange={set("pedidoMinimo")} placeholder="Ex: 15.00 (deixe vazio para sem mínimo)" />
      </div>
<div className="divider" />

      <div className="form-group">
        <label className="form-label">🕐 Tempo de entrega (minutos)</label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input className="form-input" type="number" min="5" max="180" value={form.tempoMin || ""} onChange={set("tempoMin")} placeholder="Min" style={{ width: 80 }} />
          <span style={{ color: "var(--text3)" }}>a</span>
          <input className="form-input" type="number" min="5" max="180" value={form.tempoMax || ""} onChange={set("tempoMax")} placeholder="Max" style={{ width: 80 }} />
          <span style={{ color: "var(--text3)", fontSize: "0.82rem" }}>min</span>
        </div>
      </div>

<div className="divider" />
<div className="section-label">🏷️ Badges do Feed</div>
<div className="form-group">
  <label className="form-label">🔥 Badge 1 (ex: Mais pedido hoje)</label>
  <input className="form-input" value={form.badge1 || ""} onChange={set("badge1")} placeholder="Ex: 🔥 Mais pedido hoje" />
</div>
<div className="form-group">
  <label className="form-label">🥇 Badge 2 (ex: Top da região)</label>
  <input className="form-input" value={form.badge2 || ""} onChange={set("badge2")} placeholder="Ex: 🥇 Top da região" />
</div>
<div className="form-group">
  <label className="form-label">🚀 Badge 3 (ex: Entrega 30-60 min)</label>
  <input className="form-input" value={form.badge3 || ""} onChange={set("badge3")} placeholder="Ex: 🚀 Entrega 30-60 min" />
</div>
<div className="divider" />
<div className="section-label">📋 Tabs do Feed</div>
<div style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: 10 }}>Escolha quais tabs aparecem no feed da loja</div>
<div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
  {["Feed", "Cardápio", "Promoções", "Cupons"].map(tab => {
    const ativas = form.feedTabs || ["Feed", "Cardápio", "Promoções", "Cupons"];
    const ativo = ativas.includes(tab);
    return (
      <button key={tab} onClick={() => {
        const atual = form.feedTabs || ["Feed", "Cardápio", "Promoções", "Cupons"];
        setForm(prev => ({ ...prev, feedTabs: ativo ? atual.filter(x => x !== tab) : [...atual, tab] }));
      }} style={{ padding: "6px 14px", background: ativo ? "rgba(245,197,24,0.15)" : "var(--bg3)", border: `1px solid ${ativo ? "var(--gold)" : "var(--border)"}`, borderRadius: 20, cursor: "pointer", color: ativo ? "var(--gold)" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.78rem" }}>
        {tab}
      </button>
    );
  })}
</div>
<div className="divider" />
      <div className="section-label">💳 Formas de pagamento aceitas</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {PAGAMENTOS.map(p => {
          const ativo = (form.formasPagamento || ["pix","dinheiro"]).includes(p.id);
          return (
            <button key={p.id} onClick={() => {
              const atual = form.formasPagamento || ["pix","dinheiro"];
              setForm(prev => ({
                ...prev,
                formasPagamento: ativo ? atual.filter(x => x !== p.id) : [...atual, p.id]
              }));
            }} style={{
              padding: "8px 14px", border: `1px solid ${ativo ? "rgba(34,197,94,0.5)" : "var(--border)"}`,
              borderRadius: 10, cursor: "pointer",
              background: ativo ? "rgba(34,197,94,0.1)" : "var(--bg3)",
              color: ativo ? "var(--green)" : "var(--text2)",
              fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem",
            }}>
              {p.icon} {p.label} {ativo ? "✓" : ""}
            </button>
          );
        })}
      </div>

      <button className="btn btn-gold btn-full" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando..." : "💾 Salvar perfil da loja"}
      </button>
    </div>
  );
}
// TabFinanceiro — módulo financeiro completo
function TabFinanceiro() {
  const toast = useToast();
  const [caixaAtual, setCaixaAtual] = useState(null);
  const [movimentos, setMovimentos] = useState([]);
  const [despesas, setDespesas] = useState([]);
  const [pedidosHoje, setPedidosHoje] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abaFin, setAbaFin] = useState("caixa");

  // Form abertura
  const [valorAbertura, setValorAbertura] = useState("");
  const [obsAbertura, setObsAbertura] = useState("");

  // Form movimento
  const [tipoMov, setTipoMov] = useState("entrada");
  const [valorMov, setValorMov] = useState("");
  const [descMov, setDescMov] = useState("");
  const [categoriaMov, setCategoriaMov] = useState("outros");

  // Form despesa
  const [nomeDespesa, setNomeDespesa] = useState("");
  const [valorDespesa, setValorDespesa] = useState("");
  const [categoriaDespesa, setCategoriaDespesa] = useState("ingredientes");

  const CATEGORIAS_DESPESA = [
    { id: "ingredientes", label: "🫐 Ingredientes" },
    { id: "embalagens",   label: "📦 Embalagens" },
    { id: "funcionarios", label: "👥 Funcionários" },
    { id: "aluguel",      label: "🏠 Aluguel" },
    { id: "energia",      label: "⚡ Energia" },
    { id: "outros",       label: "📋 Outros" },
  ];

  const hoje = new Date();
  const hojeStr = hoje.toDateString();

  // Carregar caixa atual
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "caixas"), orderBy("aberturaEm", "desc"), limit(1)),
      snap => {
        if (!snap.empty) {
          const c = { id: snap.docs[0].id, ...snap.docs[0].data() };
          setCaixaAtual(c.status === "aberto" ? c : null);
        }
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  // Carregar movimentos do caixa atual
  useEffect(() => {
    if (!caixaAtual) { setMovimentos([]); return; }
    const unsub = onSnapshot(
      query(collection(db, "movimentos_caixa"), where("caixaId", "==", caixaAtual.id), orderBy("createdAt", "desc")),
      snap => setMovimentos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, [caixaAtual]);

  // Carregar despesas do mês
  useEffect(() => {
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const unsub = onSnapshot(
      query(collection(db, "despesas"), where("createdAt", ">=", Timestamp.fromDate(inicioMes)), orderBy("createdAt", "desc")),
      snap => setDespesas(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    return unsub;
  }, []);

  // Pedidos de hoje
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "pedidos"), orderBy("createdAt", "desc"), limit(200)),
      snap => {
        const todos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPedidosHoje(todos.filter(p => {
          const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date();
          return d.toDateString() === hojeStr && p.status !== "cancelado";
        }));
      }
    );
    return unsub;
  }, []);

  const abrirCaixa = async () => {
    if (!valorAbertura) { toast("Informe o valor de abertura.", "error"); return; }
    try {
      await addDoc(collection(db, "caixas"), {
        status: "aberto",
        valorAbertura: parseFloat(valorAbertura),
        obs: obsAbertura,
        aberturaEm: serverTimestamp(),
        operador: "Admin",
      });
      toast("✅ Caixa aberto!");
      setValorAbertura(""); setObsAbertura("");
    } catch { toast("Erro.", "error"); }
  };

  const fecharCaixa = async () => {
    if (!window.confirm("Fechar o caixa agora?")) return;
    const totalEntradas = movimentos.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
    const totalSaidas = movimentos.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
    const faturamentoPedidos = pedidosHoje.reduce((s, p) => s + (p.total || 0), 0);
    const saldoFinal = (caixaAtual.valorAbertura || 0) + totalEntradas + faturamentoPedidos - totalSaidas;
    try {
      await updateDoc(doc(db, "caixas", caixaAtual.id), {
        status: "fechado",
        fechamentoEm: serverTimestamp(),
        totalEntradas,
        totalSaidas,
        faturamentoPedidos,
        saldoFinal,
      });
      toast(`✅ Caixa fechado! Saldo: R$ ${saldoFinal.toFixed(2).replace(".", ",")}`);
    } catch { toast("Erro.", "error"); }
  };

  const adicionarMovimento = async () => {
    if (!valorMov || !descMov) { toast("Preencha todos os campos.", "error"); return; }
    try {
      await addDoc(collection(db, "movimentos_caixa"), {
        caixaId: caixaAtual?.id || "sem_caixa",
        tipo: tipoMov,
        valor: parseFloat(valorMov),
        descricao: descMov,
        categoria: categoriaMov,
        createdAt: serverTimestamp(),
      });
      toast(`✅ ${tipoMov === "entrada" ? "Entrada" : "Saída"} registrada!`);
      setValorMov(""); setDescMov("");
    } catch { toast("Erro.", "error"); }
  };

  const adicionarDespesa = async () => {
    if (!nomeDespesa || !valorDespesa) { toast("Preencha todos os campos.", "error"); return; }
    try {
      await addDoc(collection(db, "despesas"), {
        nome: nomeDespesa,
        valor: parseFloat(valorDespesa),
        categoria: categoriaDespesa,
        createdAt: serverTimestamp(),
      });
      toast("✅ Despesa registrada!");
      setNomeDespesa(""); setValorDespesa("");
    } catch { toast("Erro.", "error"); }
  };

  // Cálculos
  const faturamentoHoje = pedidosHoje.reduce((s, p) => s + (p.total || 0), 0);
  const entradasManuais = movimentos.filter(m => m.tipo === "entrada").reduce((s, m) => s + m.valor, 0);
  const saidasManuais = movimentos.filter(m => m.tipo === "saida").reduce((s, m) => s + m.valor, 0);
  const despesasMes = despesas.reduce((s, d) => s + d.valor, 0);
  const lucroEstimado = faturamentoHoje - saidasManuais;
  const saldoCaixa = (caixaAtual?.valorAbertura || 0) + entradasManuais + faturamentoHoje - saidasManuais;

  const ABAS_FIN = ["caixa", "movimentos", "despesas", "resumo"];
  const LABELS_FIN = ["💰 Caixa", "↕️ Movimentos", "📋 Despesas", "📊 Resumo"];

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Carregando...</div>;

  return (
    <div>
      {/* Sub-abas */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", scrollbarWidth: "none" }}>
        {ABAS_FIN.map((a, i) => (
          <button key={a} onClick={() => setAbaFin(a)} style={{
            flexShrink: 0, padding: "7px 14px",
            background: abaFin === a ? "var(--gold)" : "var(--bg2)",
            border: `1px solid ${abaFin === a ? "var(--gold)" : "var(--border)"}`,
            borderRadius: 20, cursor: "pointer",
            color: abaFin === a ? "var(--bg)" : "var(--text2)",
            fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem",
          }}>{LABELS_FIN[i]}</button>
        ))}
      </div>

      {/* ===== ABA CAIXA ===== */}
      {abaFin === "caixa" && (
        <div>
          {!caixaAtual ? (
            <div>
              <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16, textAlign: "center" }}>
                <div style={{ fontSize: "2rem", marginBottom: 8 }}>🔴</div>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Caixa fechado</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>Abra o caixa para começar o dia</div>
              </div>
              <div className="form-group">
                <label className="form-label">💵 Valor de abertura (troco)</label>
                <input className="form-input" type="number" step="0.01" value={valorAbertura} onChange={e => setValorAbertura(e.target.value)} placeholder="Ex: 50.00" />
              </div>
              <div className="form-group">
                <label className="form-label">📝 Observação (opcional)</label>
                <input className="form-input" value={obsAbertura} onChange={e => setObsAbertura(e.target.value)} placeholder="Ex: Abertura turno manhã" />
              </div>
              <button className="btn btn-gold btn-full" onClick={abrirCaixa}>🟢 Abrir caixa</button>
            </div>
          ) : (
            <div>
              <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
                      <span style={{ fontWeight: 700, color: "var(--green)" }}>Caixa aberto</span>
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>
                      {caixaAtual.aberturaEm?.toDate ? caixaAtual.aberturaEm.toDate().toLocaleString("pt-BR") : "—"}
                    </div>
                  </div>
                  <button onClick={fecharCaixa} style={{
                    background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
                    borderRadius: 10, padding: "8px 14px", cursor: "pointer",
                    color: "var(--red)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.8rem",
                  }}>🔴 Fechar caixa</button>
                </div>
                {/* Cards de saldo */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    { label: "Abertura", value: `R$ ${(caixaAtual.valorAbertura||0).toFixed(2).replace(".",",")}`, color: "var(--text2)" },
                    { label: "Pedidos hoje", value: `R$ ${faturamentoHoje.toFixed(2).replace(".",",")}`, color: "var(--gold)" },
                    { label: "Entradas", value: `R$ ${entradasManuais.toFixed(2).replace(".",",")}`, color: "var(--green)" },
                    { label: "Saídas", value: `R$ ${saidasManuais.toFixed(2).replace(".",",")}`, color: "var(--red)" },
                  ].map((c, i) => (
                    <div key={i} style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: "0.65rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1 }}>{c.label}</div>
                      <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: c.color, fontSize: "1rem", marginTop: 3 }}>{c.value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: "1px solid var(--border)", marginTop: 12, paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 700 }}>💰 Saldo em caixa</span>
                  <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "var(--gold)" }}>
                    R$ {saldoCaixa.toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== ABA MOVIMENTOS ===== */}
      {abaFin === "movimentos" && (
        <div>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>➕ Registrar movimento</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              {["entrada", "saida"].map(t => (
                <button key={t} onClick={() => setTipoMov(t)} style={{
                  flex: 1, padding: "9px",
                  background: tipoMov === t ? (t === "entrada" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)") : "var(--bg3)",
                  border: `1px solid ${tipoMov === t ? (t === "entrada" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)") : "var(--border)"}`,
                  borderRadius: 10, cursor: "pointer",
                  color: tipoMov === t ? (t === "entrada" ? "var(--green)" : "var(--red)") : "var(--text2)",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem",
                }}>
                  {t === "entrada" ? "⬆️ Entrada" : "⬇️ Saída"}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="form-label">Valor</label>
                <input className="form-input" type="number" step="0.01" value={valorMov} onChange={e => setValorMov(e.target.value)} placeholder="R$ 0,00" />
              </div>
              <div className="form-group" style={{ flex: 2, marginBottom: 0 }}>
                <label className="form-label">Descrição</label>
                <input className="form-input" value={descMov} onChange={e => setDescMov(e.target.value)} placeholder="Ex: Sangria, Reforço de caixa..." />
              </div>
            </div>
            <button className="btn btn-gold btn-full" onClick={adicionarMovimento}>✅ Registrar</button>
          </div>

          {movimentos.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text2)" }}>Nenhum movimento registrado.</div>
          ) : (
            movimentos.map(m => (
              <div key={m.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{m.descricao}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
                    {m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString("pt-BR") : "—"}
                  </div>
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "1rem", color: m.tipo === "entrada" ? "var(--green)" : "var(--red)" }}>
                  {m.tipo === "entrada" ? "+" : "-"}R$ {m.valor?.toFixed(2).replace(".", ",")}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== ABA DESPESAS ===== */}
      {abaFin === "despesas" && (
        <div>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>➕ Registrar despesa</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div className="form-group" style={{ flex: "2 1 160px", marginBottom: 8 }}>
                <label className="form-label">Descrição</label>
                <input className="form-input" value={nomeDespesa} onChange={e => setNomeDespesa(e.target.value)} placeholder="Ex: Polpa de açaí 10kg" />
              </div>
              <div className="form-group" style={{ flex: "1 1 100px", marginBottom: 8 }}>
                <label className="form-label">Valor</label>
                <input className="form-input" type="number" step="0.01" value={valorDespesa} onChange={e => setValorDespesa(e.target.value)} placeholder="0,00" />
              </div>
              <div className="form-group" style={{ flex: "100%", marginBottom: 8 }}>
                <label className="form-label">Categoria</label>
                <select className="form-input" value={categoriaDespesa} onChange={e => setCategoriaDespesa(e.target.value)}>
                  {CATEGORIAS_DESPESA.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <button className="btn btn-gold btn-full" onClick={adicionarDespesa}>✅ Registrar despesa</button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div className="section-label" style={{ marginBottom: 0 }}>Despesas do mês</div>
            <div style={{ fontFamily: "'Fraunces', serif", color: "var(--red)", fontWeight: 900 }}>
              R$ {despesasMes.toFixed(2).replace(".", ",")}
            </div>
          </div>

          {despesas.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text2)" }}>Nenhuma despesa registrada.</div>
          ) : (
            despesas.map(d => (
              <div key={d.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>{d.nome}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
                    {CATEGORIAS_DESPESA.find(c => c.id === d.categoria)?.label || d.categoria}
                    {" · "}{d.createdAt?.toDate ? d.createdAt.toDate().toLocaleDateString("pt-BR") : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: "var(--red)" }}>
                    R$ {d.valor?.toFixed(2).replace(".", ",")}
                  </div>
                  <button onClick={async () => { if(window.confirm("Remover?")) { await deleteDoc(doc(db, "despesas", d.id)); toast("Removido."); }}} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "0.9rem" }}>🗑️</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ===== ABA RESUMO ===== */}
      {abaFin === "resumo" && (
        <div>
          <div className="section-label">📊 Resumo de hoje</div>
          {[
            { label: "💰 Faturamento pedidos", value: faturamentoHoje, color: "var(--gold)" },
            { label: "⬆️ Entradas manuais", value: entradasManuais, color: "var(--green)" },
            { label: "⬇️ Saídas manuais", value: saidasManuais, color: "var(--red)" },
            { label: "📦 Despesas do mês", value: despesasMes, color: "var(--red)" },
            { label: "📋 Pedidos hoje", value: pedidosHoje.length, color: "var(--purple2)", isCont: true },
          ].map((item, i) => (
            <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "12px 16px", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--text2)" }}>{item.label}</span>
              <span style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "1.1rem", color: item.color }}>
                {item.isCont ? item.value : `R$ ${item.value.toFixed(2).replace(".", ",")}`}
              </span>
            </div>
          ))}
          <div style={{ background: "linear-gradient(135deg, var(--bg3), var(--bg2))", border: "1px solid var(--border2)", borderRadius: "var(--radius)", padding: "16px", marginTop: 16, textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Lucro estimado hoje</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2rem", fontWeight: 900, color: lucroEstimado >= 0 ? "var(--green)" : "var(--red)" }}>
              R$ {lucroEstimado.toFixed(2).replace(".", ",")}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 4 }}>Faturamento - Saídas manuais</div>
          </div>
        </div>
      )}
    </div>
  );
}
// Componente de gestão de complementos no Admin
// Aparece dentro da edição de cada produto

function TabComplementosAdmin({ produtoId, produtoNome, tenantId }) {
  const toast = useToast();
  const prodBase = tenantId ? `tenants/${tenantId}/produtos` : "produtos";
  const [grupos, setGrupos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editandoGrupo, setEditandoGrupo] = useState(null);
  const [formGrupo, setFormGrupo] = useState({ nome: "", obrigatorio: true, min: 1, max: 1 });
  const [formItem, setFormItem] = useState({ nome: "", preco: 0, foto: "" });
  const [adicionandoItemEm, setAdicionandoItemEm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const IMGBB_KEY = "4b8379f3bfc7eb113e0820730166a9f8";

  useEffect(() => {
    if (!produtoId) return;
    const unsub = onSnapshot(
      query(collection(db, `${prodBase}/${produtoId}/grupos_complementos`), orderBy("ordem", "asc")),
      snap => {
        const gs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        Promise.all(gs.map(async g => {
          const itensSnap = await getDocs(query(collection(db, `${prodBase}/${produtoId}/grupos_complementos/${g.id}/itens`), orderBy("ordem", "asc")));
          return { ...g, itens: itensSnap.docs.map(d => ({ id: d.id, ...d.data() })) };
        })).then(result => { setGrupos(result); setLoading(false); });
      }
    );
    return unsub;
  }, [produtoId]);

  const comprimirImg = async (file) => new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let w = img.width, h = img.height;
        if (w > 800) { h = h * 800 / w; w = 800; }
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(b => resolve(b || file), "image/webp", 0.75);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });

  const uploadFotoItem = async (file) => {
    try {
      const comprimido = await comprimirImg(file);
      const formData = new FormData();
      formData.append("image", comprimido);
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_KEY}`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) { setFormItem(p => ({ ...p, foto: data.data.url })); toast("✅ Imagem enviada!"); }
    } catch { toast("Erro no upload.", "error"); }
  };

  const salvarGrupo = async () => {
    if (!formGrupo.nome.trim()) { toast("Informe o nome do grupo.", "error"); return; }
    setSalvando(true);
    try {
      const data = {
        nome: formGrupo.nome.trim(),
        obrigatorio: formGrupo.obrigatorio,
        min: parseInt(formGrupo.min) || 0,
        max: parseInt(formGrupo.max) || 1,
        tipo: parseInt(formGrupo.max) > 1 ? "checkbox" : "radio",
        precoBase: parseFloat(formGrupo.precoBase) || 0,
        ordem: editandoGrupo ? grupos.find(g => g.id === editandoGrupo)?.ordem : grupos.length + 1,
      };
      if (editandoGrupo) {
        await updateDoc(doc(db, `${prodBase}/${produtoId}/grupos_complementos`, editandoGrupo), data);
        toast("✅ Grupo atualizado!");
      } else {
        await addDoc(collection(db, `${prodBase}/${produtoId}/grupos_complementos`), data);
        toast("✅ Grupo criado!");
      }
      setFormGrupo({ nome: "", obrigatorio: true, min: 1, max: 1, precoBase: "" });
      setEditandoGrupo(null);
    } catch { toast("Erro.", "error"); }
    finally { setSalvando(false); }
  };

  const deletarGrupo = async (grupoId) => {
    if (!window.confirm("Remover grupo e todos os itens?")) return;
    await deleteDoc(doc(db, `${prodBase}/${produtoId}/grupos_complementos`, grupoId));
    toast("Grupo removido.");
  };

  const duplicarGrupo = async (grupo) => {
    try {
      const novoRef = await addDoc(collection(db, `${prodBase}/${produtoId}/grupos_complementos`), {
        nome: grupo.nome + " (cópia)", obrigatorio: grupo.obrigatorio,
        min: grupo.min, max: grupo.max, tipo: grupo.tipo || "radio", ordem: grupos.length + 1,
      });
      for (const item of grupo.itens || []) {
        await addDoc(collection(db, `${prodBase}/${produtoId}/grupos_complementos/${novoRef.id}/itens`), {
          nome: item.nome, preco: item.preco, foto: item.foto || "", ordem: item.ordem, ativo: true,
        });
      }
      toast("✅ Grupo duplicado!");
    } catch { toast("Erro.", "error"); }
  };

  const salvarItem = async (grupoId) => {
    if (!formItem.nome.trim()) { toast("Informe o nome do item.", "error"); return; }
    setSalvando(true);
    try {
      const itensRef = collection(db, `${prodBase}/${produtoId}/grupos_complementos/${grupoId}/itens`);
      const snap = await getDocs(itensRef);
      await addDoc(itensRef, {
        nome: formItem.nome.trim(), preco: parseFloat(formItem.preco) || 0,
        foto: formItem.foto || "", ordem: snap.size + 1, ativo: true,
      });
      toast("✅ Item adicionado!");
      setFormItem({ nome: "", preco: 0, foto: "" });
      setAdicionandoItemEm(null);
    } catch { toast("Erro.", "error"); }
    finally { setSalvando(false); }
  };

  const deletarItem = async (grupoId, itemId) => {
    await deleteDoc(doc(db, `${prodBase}/${produtoId}/grupos_complementos/${grupoId}/itens`, itemId));
    toast("Item removido.");
  };

  if (loading) return <div style={{ padding: 20, color: "var(--text2)", textAlign: "center" }}>Carregando...</div>;

  return (
    <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
      <div className="section-label" style={{ marginBottom: 12 }}>🧩 Grupos de complementos</div>
      <p style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 14 }}>
        Configure as etapas de escolha. Arraste ⠿ para reordenar. 📋 para duplicar.
      </p>

      {grupos.map(grupo => (
        <div
          key={grupo.id}
          draggable
          onDragStart={e => { e.dataTransfer.setData("gid", grupo.id); }}
          onDragOver={e => e.preventDefault()}
          onDrop={async e => {
            const fromId = e.dataTransfer.getData("gid");
            if (!fromId || fromId === grupo.id) return;
            const from = grupos.find(g => g.id === fromId);
            if (!from) return;
            try {
              await updateDoc(doc(db, `${prodBase}/${produtoId}/grupos_complementos`, fromId), { ordem: grupo.ordem });
              await updateDoc(doc(db, `${prodBase}/${produtoId}/grupos_complementos`, grupo.id), { ordem: from.ordem });
              toast("✅ Reordenado!");
            } catch {}
          }}
          style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", marginBottom: 12, overflow: "hidden", cursor: "grab" }}
        >
          {/* Header do grupo */}
          <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--text3)", fontSize: "1rem" }}>⠿</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{grupo.nome}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2, display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{ color: grupo.obrigatorio ? "var(--gold)" : "var(--text3)" }}>
                  {grupo.obrigatorio ? "✅ Obrigatório" : "⬜ Opcional"}
                </span>
                <span>· Escolha {grupo.min === grupo.max ? grupo.min : `${grupo.min}-${grupo.max}`}</span>
                <span>· {grupo.itens?.length || 0} itens</span>
                {grupo.precoBase > 0 && (
                  <span style={{ color: "var(--gold)", fontWeight: 600 }}>
                    · 💰 +R$ {parseFloat(grupo.precoBase).toFixed(2).replace(".", ",")} por item
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => { setEditandoGrupo(grupo.id); setFormGrupo({ nome: grupo.nome, obrigatorio: grupo.obrigatorio, min: grupo.min, max: grupo.max }); }} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--text2)", fontSize: "0.72rem" }}>✏️</button>
              <button onClick={() => duplicarGrupo(grupo)} style={{ background: "rgba(96,165,250,0.1)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#60a5fa", fontSize: "0.72rem" }}>📋</button>
              <button onClick={() => deletarGrupo(grupo.id)} style={{ background: "rgba(239,68,68,0.1)", border: "none", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "var(--red)", fontSize: "0.72rem" }}>🗑️</button>
            </div>
          </div>

          {/* Itens */}
          <div
            style={{ padding: "0 14px 10px" }}
            onDragOver={e => e.preventDefault()}
            onDrop={async e => {
              const itemId = e.dataTransfer.getData("itemId");
              const fromGrupoId = e.dataTransfer.getData("fromGrupoId");
              if (!itemId || fromGrupoId === grupo.id) return;
              const fromGrupo = grupos.find(g => g.id === fromGrupoId);
              const item = fromGrupo?.itens?.find(i => i.id === itemId);
              if (!item) return;
              try {
                await addDoc(collection(db, `${prodBase}/${produtoId}/grupos_complementos/${grupo.id}/itens`), {
                  nome: item.nome, preco: item.preco, foto: item.foto || "", ordem: (grupo.itens?.length || 0) + 1, ativo: true,
                });
                toast(`✅ "${item.nome}" copiado!`);
              } catch { toast("Erro.", "error"); }
            }}
          >
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {grupo.itens?.map(item => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={e => { e.dataTransfer.setData("itemId", item.id); e.dataTransfer.setData("fromGrupoId", grupo.id); e.stopPropagation(); }}
                  style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", display: "flex", alignItems: "center", gap: 8, cursor: "grab" }}
                >
                  {item.foto && <img src={item.foto} alt={item.nome} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>{item.nome}</div>
                    <div style={{ fontSize: "0.65rem", color: item.preco > 0 ? "var(--gold)" : "var(--text3)" }}>
                      {item.preco > 0 ? `+R$ ${item.preco.toFixed(2).replace(".", ",")}` : "Incluso"}
                    </div>
                  </div>
                  <button onClick={() => deletarItem(grupo.id, item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "0.8rem", padding: 0 }}>✕</button>
                </div>
              ))}
            </div>

            {adicionandoItemEm === grupo.id ? (
              <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10 }}>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <input className="form-input" style={{ flex: "2 1 120px" }} value={formItem.nome} onChange={e => setFormItem(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do item" />
                  <input className="form-input" style={{ flex: "1 1 80px" }} type="number" step="0.50" value={formItem.preco} onChange={e => setFormItem(p => ({ ...p, preco: e.target.value }))} placeholder="Preço adicional" />
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <label style={{ flex: 1, padding: "7px", textAlign: "center", background: "rgba(245,197,24,0.1)", border: "1px dashed rgba(245,197,24,0.3)", borderRadius: 6, cursor: "pointer", fontSize: "0.75rem", color: "var(--gold)" }}>
                    📷 Foto (opcional)
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => uploadFotoItem(e.target.files[0])} />
                  </label>
                  {formItem.foto && <img src={formItem.foto} alt="preview" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }} />}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-gold" style={{ flex: 1 }} onClick={() => salvarItem(grupo.id)} disabled={salvando}>✅ Adicionar</button>
                  <button style={{ padding: "8px 12px", background: "var(--bg3)", border: "none", borderRadius: 8, cursor: "pointer", color: "var(--text2)", fontFamily: "'Outfit', sans-serif" }} onClick={() => setAdicionandoItemEm(null)}>Cancelar</button>
                </div>
              </div>
            ) : (
              <button onClick={() => { setAdicionandoItemEm(grupo.id); setFormItem({ nome: "", preco: grupo.precoBase || 0, foto: "" }); }} style={{ background: "rgba(34,197,94,0.08)", border: "1px dashed rgba(34,197,94,0.3)", borderRadius: 8, padding: "8px 12px", cursor: "pointer", color: "var(--green)", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", width: "100%", fontWeight: 600 }}>
                ➕ Adicionar item{grupo.precoBase > 0 ? ` (+R$ ${parseFloat(grupo.precoBase).toFixed(2).replace(".",",")})` : ""}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Form criar/editar grupo */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: 14 }}>
        <div style={{ fontWeight: 600, fontSize: "0.85rem", marginBottom: 12 }}>
          {editandoGrupo ? "✏️ Editar grupo" : "➕ Novo grupo de complementos"}
        </div>
        <div className="form-group">
          <label className="form-label">Nome do grupo *</label>
          <input className="form-input" value={formGrupo.nome} onChange={e => setFormGrupo(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Base, Proteínas, Adicionais, Sabor 1..." />
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div className="form-group" style={{ flex: "1 1 80px", marginBottom: 8 }}>
            <label className="form-label">Mín.</label>
            <input className="form-input" type="number" min="0" value={formGrupo.min} onChange={e => setFormGrupo(p => ({ ...p, min: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: "1 1 80px", marginBottom: 8 }}>
            <label className="form-label">Máx.</label>
            <input className="form-input" type="number" min="1" value={formGrupo.max} onChange={e => setFormGrupo(p => ({ ...p, max: e.target.value }))} />
          </div>
          <div className="form-group" style={{ flex: "2 1 120px", marginBottom: 8 }}>
            <label className="form-label">Tipo</label>
            <select className="form-input" value={formGrupo.obrigatorio ? "obrigatorio" : "opcional"} onChange={e => setFormGrupo(p => ({ ...p, obrigatorio: e.target.value === "obrigatorio" }))}>
              <option value="obrigatorio">✅ Obrigatório</option>
              <option value="opcional">⬜ Opcional</option>
            </select>
          </div>
          <div className="form-group" style={{ flex: "1 1 100px", marginBottom: 8 }}>
            <label className="form-label">💰 Preço padrão</label>
            <input className="form-input" type="number" step="0.50" value={formGrupo.precoBase || ""} onChange={e => setFormGrupo(p => ({ ...p, precoBase: e.target.value }))} placeholder="R$ 0,00" />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-gold" style={{ flex: 1 }} onClick={salvarGrupo} disabled={salvando}>
            {salvando ? "Salvando..." : editandoGrupo ? "💾 Salvar" : "➕ Criar grupo"}
          </button>
          {editandoGrupo && (
            <button onClick={() => { setEditandoGrupo(null); setFormGrupo({ nome: "", obrigatorio: true, min: 1, max: 1, precoBase: "" }); }} style={{ padding: "8px 12px", background: "var(--bg3)", border: "none", borderRadius: 8, cursor: "pointer", color: "var(--text2)", fontFamily: "'Outfit', sans-serif" }}>Cancelar</button>
          )}
        </div>
      </div>
    </div>
  );
}


// TabVisitantes — aba de analytics no Admin
function TabVisitantes() {
  const [dados, setDados] = useState([]);
  const [online, setOnline] = useState(0);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(7);

  useEffect(() => {
    // Buscar visitas dos últimos N dias
    const buscarDados = async () => {
      setLoading(true);
      try {
        const datas = [];
        for (let i = periodo - 1; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          datas.push(d.toISOString().split("T")[0]);
        }
        const resultados = await Promise.all(
          datas.map(async data => {
            const snap = await getDoc(doc(db, "analytics", data));
            return { data, visitas: snap.exists() ? snap.data().visitas || 0 : 0 };
          })
        );
        setDados(resultados);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    buscarDados();
  }, [periodo]);

  useEffect(() => {
    // Contar usuários online (ativos nos últimos 2 min)
    const q = query(
      collection(db, "analytics_online"),
      where("timestamp", ">=", new Timestamp(Math.floor(Date.now() / 1000) - 120, 0)),
      where("saiu", "!=", true)
    );
    const unsub = onSnapshot(q, snap => {
      setOnline(snap.docs.filter(d => !d.data().saiu).length);
    });
    return unsub;
  }, []);

  const totalVisitas = dados.reduce((s, d) => s + d.visitas, 0);
  const mediaVisitas = dados.length > 0 ? Math.round(totalVisitas / dados.length) : 0;
  const maxVisitas = Math.max(...dados.map(d => d.visitas), 1);
  const hoje = dados[dados.length - 1]?.visitas || 0;

  const formatarData = (data) => {
    const [, mes, dia] = data.split("-");
    return `${dia}/${mes}`;
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 0 }}>📊 Analytics de Visitantes</div>
        <select
          value={periodo}
          onChange={e => setPeriodo(Number(e.target.value))}
          style={{ padding: "6px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text)", fontFamily: "'Outfit',sans-serif", fontSize: "0.78rem", cursor: "pointer" }}
        >
          <option value={7}>Últimos 7 dias</option>
          <option value={14}>Últimos 14 dias</option>
          <option value={30}>Últimos 30 dias</option>
        </select>
      </div>

      {/* Cards de métricas */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {/* Online agora */}
        <div style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(34,197,94,0.05))", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 14, padding: "16px 14px", gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "pulse 2s infinite", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "0.72rem", color: "var(--text2)", textTransform: "uppercase", letterSpacing: 1 }}>Online agora</div>
              <div style={{ fontFamily: "'Fraunces',serif", fontSize: "2rem", fontWeight: 900, color: "#22c55e", lineHeight: 1 }}>{online}</div>
            </div>
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>visitante{online !== 1 ? "s" : ""} ativo{online !== 1 ? "s" : ""}</div>
              <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>nos últimos 2 minutos</div>
            </div>
          </div>
        </div>

        {/* Hoje */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Hoje</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.8rem", fontWeight: 900, color: "var(--gold)" }}>{hoje}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>visitas</div>
        </div>

        {/* Total */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Total ({periodo}d)</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.8rem", fontWeight: 900, color: "var(--purple2)" }}>{totalVisitas}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>visitas únicas</div>
        </div>

        {/* Média */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Média diária</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.8rem", fontWeight: 900, color: "#60a5fa" }}>{mediaVisitas}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>visitas/dia</div>
        </div>

        {/* Melhor dia */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px" }}>
          <div style={{ fontSize: "0.68rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Melhor dia</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.8rem", fontWeight: 900, color: "#f59e0b" }}>{maxVisitas}</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
            {dados.find(d => d.visitas === maxVisitas)?.data ? formatarData(dados.find(d => d.visitas === maxVisitas).data) : "-"}
          </div>
        </div>
      </div>

      {/* Gráfico de barras */}
      {!loading && dados.length > 0 && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 14, fontWeight: 600 }}>📈 Visitas por dia</div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100 }}>
            {dados.map((d, i) => {
              const altura = maxVisitas > 0 ? (d.visitas / maxVisitas) * 100 : 0;
              const isHoje = i === dados.length - 1;
              return (
                <div key={d.data} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  {d.visitas > 0 && (
                    <div style={{ fontSize: "0.55rem", color: "var(--text3)" }}>{d.visitas}</div>
                  )}
                  <div style={{
                    width: "100%", height: `${Math.max(altura, 4)}%`,
                    background: isHoje
                      ? "linear-gradient(180deg, var(--gold), #e6a817)"
                      : "linear-gradient(180deg, var(--purple2), var(--purple))",
                    borderRadius: "4px 4px 0 0",
                    minHeight: 4,
                    transition: "height 0.5s ease",
                    boxShadow: isHoje ? "0 0 8px rgba(245,197,24,0.4)" : "none",
                  }} />
                  <div style={{ fontSize: "0.55rem", color: isHoje ? "var(--gold)" : "var(--text3)", fontWeight: isHoje ? 700 : 400 }}>
                    {formatarData(d.data)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 30, color: "var(--text2)" }}>
          Carregando dados...
        </div>
      )}

      {/* Dica */}
      <div style={{ background: "rgba(96,165,250,0.06)", border: "1px solid rgba(96,165,250,0.15)", borderRadius: 10, padding: "10px 14px", fontSize: "0.72rem", color: "var(--text3)" }}>
        💡 Cada visita única é contada uma vez por dia por dispositivo. "Online agora" mostra quem acessou nos últimos 2 minutos.
      </div>
    </div>
  );
}

// ===== TAB NEXFOODY =====
function TabNexfoody() {
  const { tenantId } = useStore();
  const [lojaDocId, setLojaDocId] = useState(null);
  const [placeId, setPlaceId] = useState(null);
  const [chatAberto, setChatAberto] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    getDocs(query(collection(db, "lojas"), where("tenantId", "==", tenantId))).then(snap => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setLojaDocId(d.id);
        setPlaceId(d.data().placeId || null);
        setChatAberto(d.data().chatAberto ?? false);
      }
      setLoading(false);
    });
  }, [tenantId]);

  const salvarPlaceId = async (id) => {
    if (!lojaDocId) return;
    setSalvando(true);
    await updateDoc(doc(db, "lojas", lojaDocId), { placeId: id });
    setPlaceId(id);
    setVinculando(false);
    setSalvando(false);
  };

  const toggleChat = async () => {
    if (!lojaDocId) return;
    const novo = !chatAberto;
    setChatAberto(novo);
    await updateDoc(doc(db, "lojas", lojaDocId), { chatAberto: novo });
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Carregando...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", margin: 0 }}>🗺️ Integração NexFoody</h3>

      {/* Status no mapa */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
        <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 12 }}>📍 Vínculo com Google Maps</div>
        {placeId ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 12, padding: "12px 14px" }}>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#22c55e" }}>✅ Loja vinculada ao mapa</div>
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 2 }}>Sua loja aparece corretamente no mapa NexFoody</div>
            </div>
            <button onClick={() => setVinculando(true)} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", fontSize: "0.65rem", color: "var(--text2)", cursor: "pointer" }}>Alterar</button>
          </div>
        ) : (
          <div style={{ background: "rgba(245,197,24,0.07)", border: "1px solid rgba(245,197,24,0.22)", borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--gold)", marginBottom: 6 }}>⚠️ Loja não vinculada</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 12, lineHeight: 1.6 }}>
              Sem vínculo, outras lojas com nome parecido podem aparecer como cadastradas no mapa NexFoody.
            </div>
            {!vinculando && (
              <button onClick={() => setVinculando(true)} style={{ background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 10, padding: "8px 16px", fontWeight: 800, fontSize: "0.78rem", color: "#0a0414", cursor: "pointer" }}>
                Vincular agora
              </button>
            )}
          </div>
        )}
        {vinculando && (
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <PlaceSearch placeholder="Busque o nome da sua loja no Google Maps..." onSelect={(id) => salvarPlaceId(id)} />
            {salvando && <div style={{ fontSize: "0.72rem", color: "var(--text2)", textAlign: "center" }}>Salvando...</div>}
            <button onClick={() => setVinculando(false)} style={{ background: "none", border: "none", fontSize: "0.7rem", color: "var(--text3)", cursor: "pointer" }}>Cancelar</button>
          </div>
        )}
      </div>

      {/* Chat toggle */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 4 }}>💬 Chat com clientes</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>Permite que clientes te enviem mensagens pelo app</div>
          </div>
          <button
            onClick={toggleChat}
            style={{
              width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer",
              background: chatAberto ? "#22c55e" : "rgba(255,255,255,0.15)",
              position: "relative", transition: "background 0.2s", flexShrink: 0,
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: "50%", background: "#fff",
              position: "absolute", top: 3, transition: "left 0.2s",
              left: chatAberto ? 25 : 4,
            }} />
          </button>
        </div>
        <div style={{ marginTop: 8, fontSize: "0.7rem", color: chatAberto ? "#22c55e" : "var(--text3)", fontWeight: 600 }}>
          {chatAberto ? "✅ Chat ativado" : "⭕ Chat desativado"}
        </div>
      </div>

      {/* Link da loja no NexFoody */}
      {tenantId && (
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", marginBottom: 8 }}>🔗 Sua loja no NexFoody</div>
          <div style={{ fontSize: "0.78rem", color: "var(--purple2)", background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 10, padding: "10px 12px", wordBreak: "break-all" }}>
            nexfoody.com/loja/{tenantId}
          </div>
          <button
            onClick={() => { navigator.clipboard?.writeText(`https://nexfoody.com/loja/${tenantId}`); }}
            style={{ marginTop: 8, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", fontSize: "0.72rem", color: "var(--text2)", cursor: "pointer" }}
          >
            📋 Copiar link
          </button>
        </div>
      )}
    </div>
  );
}

// ===== TAB CHAT =====
function TabChat() {
  const { tenantId, config, salvarConfig } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [lojaDocId, setLojaDocId] = useState(null);
  const [chats, setChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [botAtivo, setBotAtivo] = useState(false);
  const [botIA, setBotIA] = useState(false);
  const [pixAutoConfirmar, setPixAutoConfirmar] = useState(false);
  const [salvandoBot, setSalvandoBot] = useState(false);
  const [salvandoBotIA, setSalvandoBotIA] = useState(false);
  const [treinamento, setTreinamento] = useState(null);
  const [treinando, setTreinando] = useState(false);
  const [canalAtendimento, setCanalAtendimento] = useState("ambos");
  const [whatsappNum, setWhatsappNum] = useState("");
  const [salvandoCanal, setSalvandoCanal] = useState(false);

  // Carrega lojaDocId + botAtivo + botIA em tempo real
  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, "lojas"), where("tenantId", "==", tenantId), limit(1));
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        const data = snap.docs[0].data();
        setLojaDocId(snap.docs[0].id);
        setBotAtivo(data.botAtivo || false);
        setBotIA(data.botIA || false);
        setPixAutoConfirmar(data.pixAutoConfirmar || false);
        setCanalAtendimento(data.canalAtendimento || "ambos");
        setWhatsappNum(data.whatsapp || "");
      }
      setLoading(false);
    });
  }, [tenantId]);

  // Carrega status do treinamento em tempo real
  useEffect(() => {
    if (!lojaDocId) return;
    return onSnapshot(doc(db, "lojas", lojaDocId, "_config", "baseConhecimento"), snap => {
      if (snap.exists()) setTreinamento(snap.data());
      else setTreinamento(null);
    });
  }, [lojaDocId]);

  // Carrega conversas da loja
  useEffect(() => {
    if (!lojaDocId) return;
    const lojaVirtualId = `loja_${lojaDocId}`;
    const q = query(collection(db, "chats"), where("participantes", "array-contains", lojaVirtualId));
    return onSnapshot(q, snap => {
      setChats(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0))
      );
    });
  }, [lojaDocId]);

  const toggleBot = async () => {
    if (!lojaDocId || salvandoBot) return;
    setSalvandoBot(true);
    try {
      const novo = !botAtivo;
      await updateDoc(doc(db, "lojas", lojaDocId), { botAtivo: novo });
      toast(novo ? "🤖 Robô ativado! Respondendo clientes 24/7." : "🔇 Robô desativado.");
    } catch { toast("Erro ao salvar configuração.", "error"); }
    finally { setSalvandoBot(false); }
  };

  const toggleBotIA = async () => {
    if (!lojaDocId || salvandoBotIA) return;
    setSalvandoBotIA(true);
    try {
      const novo = !botIA;
      await updateDoc(doc(db, "lojas", lojaDocId), { botIA: novo });
      toast(novo ? "✨ Bot com IA ativado! Clientes podem pedir pelo chat." : "🔇 Bot com IA desativado.");
    } catch { toast("Erro ao salvar configuração.", "error"); }
    finally { setSalvandoBotIA(false); }
  };

  const iniciarTreinamento = async () => {
    if (!lojaDocId || treinando) return;
    setTreinando(true);
    try {
      const fns = getFunctions(getApp(), "us-east1");
      const treinar = httpsCallable(fns, "treinarRobo");
      await treinar({ lojaId: lojaDocId });
      toast("🧠 Treinamento concluído! O robô agora conhece sua loja.");
    } catch (e) {
      toast("Erro no treinamento. Tente novamente.", "error");
      console.error(e);
    } finally {
      setTreinando(false);
    }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Carregando...</div>;

  const lojaVirtualId = lojaDocId ? `loja_${lojaDocId}` : null;
  const totalNaoLido = chats.reduce((sum, c) => sum + (lojaVirtualId ? (c.naoLido?.[lojaVirtualId] || 0) : 0), 0);
  const conversasPendentes = chats.filter(c => c.bloqueado).length;
  const chatsAtendente = chats.filter(c => c.precisaAtendente);

  const marcarAtendenteResolvido = async (chatItem) => {
    if (!lojaDocId) return;
    await Promise.all([
      updateDoc(doc(db, "chats", chatItem.id), { precisaAtendente: false }),
      updateDoc(doc(db, "lojas", lojaDocId, "alertasAtendimento", chatItem.id), { resolvido: true }),
    ]).catch(() => {});
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", margin: 0 }}>💬 Chat com Clientes</h3>
        {totalNaoLido > 0 && (
          <div style={{ background: "var(--purple2)", color: "#fff", borderRadius: 20, padding: "3px 10px", fontSize: "0.72rem", fontWeight: 800 }}>
            {totalNaoLido} nova{totalNaoLido > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* ── Alerta de atendentes solicitados ── */}
      {chatsAtendente.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.35)", borderRadius: 14, padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: "1.2rem", animation: "pbadge 1s infinite" }}>🚨</span>
            <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "#ef4444" }}>
              {chatsAtendente.length} cliente{chatsAtendente.length > 1 ? "s precisam" : " precisa"} de atendimento humano
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {chatsAtendente.map(c => {
              const outroId = c.participantes?.find(p => !p.startsWith("loja_"));
              const outroInfo = c.participantesInfo?.[outroId] || {};
              return (
                <div key={c.id} style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0 }}>
                    {outroInfo.foto ? <img src={outroInfo.foto} alt="" style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} /> : "👤"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>{outroInfo.nome || "Cliente"}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 1 }}>{c.motivoAtendente || "Sem motivo especificado"}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => navigate(`/chat/${c.id}`)}
                      style={{ padding: "6px 10px", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.7rem", cursor: "pointer" }}>
                      Atender
                    </button>
                    <button onClick={() => marcarAtendenteResolvido(c)}
                      style={{ padding: "6px 10px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text3)", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.7rem", cursor: "pointer" }}>
                      ✓ Resolvido
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Robô Assistente ── */}
      <div style={{
        background: botAtivo ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${botAtivo ? "rgba(34,197,94,0.35)" : "var(--border)"}`,
        borderRadius: 16, padding: 16, transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: botAtivo ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem", transition: "background 0.3s",
          }}>🤖</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: "0.92rem", color: botAtivo ? "var(--green)" : "var(--text)" }}>
                Robô Assistente
              </span>
              {botAtivo && (
                <span style={{ fontSize: "0.58rem", fontWeight: 700, background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 20, padding: "2px 8px", color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                  ATIVO 24/7
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", lineHeight: 1.55 }}>
              {botAtivo
                ? "Respondendo automaticamente com status do pedido, entregador e mais"
                : "Ative para o robô responder clientes automaticamente — mesmo com a loja fechada"
              }
            </div>
          </div>
          {/* Toggle */}
          <button
            onClick={toggleBot}
            disabled={salvandoBot}
            style={{
              width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
              background: botAtivo ? "var(--green)" : "var(--bg3)", position: "relative",
              transition: "background 0.3s", flexShrink: 0, opacity: salvandoBot ? 0.6 : 1,
            }}
          >
            <div style={{
              position: "absolute", top: 3, left: botAtivo ? 27 : 3,
              width: 22, height: 22, borderRadius: "50%",
              background: botAtivo ? "var(--bg)" : "var(--text3)",
              transition: "left 0.25s",
            }} />
          </button>
        </div>

        {/* O que o robô sabe responder */}
        {botAtivo && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(34,197,94,0.15)" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(34,197,94,0.6)", marginBottom: 8 }}>
              O robô responde automaticamente sobre:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {[
                ["📦", "Status do pedido"],
                ["🛵", "Localização do entregador"],
                ["⏱", "Tempo estimado de entrega"],
                ["💳", "Pagamento e valor total"],
                ["📋", "Itens do pedido"],
                ["📍", "Endereço de entrega"],
              ].map(([icon, txt], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "var(--text2)" }}>
                  <span>{icon}</span> {txt}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Bot com IA (Claude) ── */}
      <div style={{
        background: botIA ? "rgba(124,58,237,0.08)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${botIA ? "rgba(124,58,237,0.35)" : "var(--border)"}`,
        borderRadius: 16, padding: 16, transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: botIA ? "rgba(124,58,237,0.18)" : "rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem", transition: "background 0.3s",
          }}>✨</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontWeight: 800, fontSize: "0.92rem", color: botIA ? "var(--purple2)" : "var(--text)" }}>
                Bot com IA
              </span>
              {botIA && (
                <span style={{ fontSize: "0.58rem", fontWeight: 700, background: "rgba(124,58,237,0.2)", border: "1px solid rgba(124,58,237,0.35)", borderRadius: 20, padding: "2px 8px", color: "var(--purple2)", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--purple2)", display: "inline-block" }} />
                  ATIVO
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", lineHeight: 1.55 }}>
              {botIA
                ? "Cliente pode pedir pelo chat conversando naturalmente — robô entende e cria o pedido"
                : "Ative para o cliente pedir via chat como no WhatsApp, usando Inteligência Artificial"
              }
            </div>
          </div>
          {/* Toggle */}
          <button
            onClick={toggleBotIA}
            disabled={salvandoBotIA}
            style={{
              width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
              background: botIA ? "var(--purple2)" : "var(--bg3)", position: "relative",
              transition: "background 0.3s", flexShrink: 0, opacity: salvandoBotIA ? 0.6 : 1,
            }}
          >
            <div style={{
              position: "absolute", top: 3, left: botIA ? 27 : 3,
              width: 22, height: 22, borderRadius: "50%",
              background: botIA ? "var(--bg)" : "var(--text3)",
              transition: "left 0.25s",
            }} />
          </button>
        </div>

        {botIA && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid rgba(124,58,237,0.15)" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(124,58,237,0.6)", marginBottom: 8 }}>
              O que o cliente pode fazer pelo chat:
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5 }}>
              {[
                ["🗣️", "Pedir naturalmente"],
                ["📋", "Ver e montar carrinho"],
                ["🏠", "Informar endereço"],
                ["💳", "Escolher pagamento"],
                ["✅", "Confirmar pedido"],
                ["📦", "Acompanhar status"],
              ].map(([icon, txt], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.72rem", color: "var(--text2)" }}>
                  <span>{icon}</span> {txt}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: "0.65rem", color: "rgba(124,58,237,0.5)", fontStyle: "italic" }}>
              Powered by Claude (Anthropic AI) • Requer configuração da chave de API
            </div>

            {/* Bloco de treinamento */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(124,58,237,0.15)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "var(--text)", marginBottom: 3 }}>
                    🧠 Treinar o Robô
                  </div>
                  <div style={{ fontSize: "0.7rem", color: "var(--text3)", lineHeight: 1.5 }}>
                    {treinamento?.status === "pronto"
                      ? `Treinado com ${treinamento.totalProdutos || 0} produto(s) e ${treinamento.totalClientes || 0} cliente(s). O robô conhece seu cardápio, preços e clientes frequentes.`
                      : treinamento?.status === "treinando"
                      ? "Treinamento em andamento... aguarde alguns instantes."
                      : "Clique para ensinar o robô sobre sua loja: cardápio completo, horários, clientes frequentes e endereços cadastrados."
                    }
                  </div>
                </div>
                <button
                  onClick={iniciarTreinamento}
                  disabled={treinando || treinamento?.status === "treinando"}
                  style={{
                    flexShrink: 0, padding: "9px 16px", borderRadius: 12, border: "none",
                    cursor: (treinando || treinamento?.status === "treinando") ? "default" : "pointer",
                    background: treinamento?.status === "pronto"
                      ? "linear-gradient(135deg, #059669, #10b981)"
                      : "linear-gradient(135deg, #7c3aed, #6d28d9)",
                    color: "white", fontFamily: "'Outfit', sans-serif",
                    fontWeight: 800, fontSize: "0.78rem",
                    opacity: (treinando || treinamento?.status === "treinando") ? 0.6 : 1,
                  }}
                >
                  {treinando || treinamento?.status === "treinando"
                    ? "⏳ Treinando..."
                    : treinamento?.status === "pronto"
                    ? "🔄 Retreinar"
                    : "▶ Iniciar"}
                </button>
              </div>
              {treinamento?.status === "pronto" && (
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    `📋 ${treinamento.totalProdutos || 0} produtos`,
                    `👥 ${treinamento.totalClientes || 0} clientes`,
                    "✅ Endereços cadastrados",
                    "✅ Histórico de pedidos",
                  ].map((tag, i) => (
                    <span key={i} style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 20, padding: "2px 8px", fontSize: "0.63rem", color: "#10b981", fontWeight: 600 }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toggle PIX automático */}
      <div style={{
        background: pixAutoConfirmar ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${pixAutoConfirmar ? "rgba(16,185,129,0.35)" : "var(--border)"}`,
        borderRadius: 16, padding: 16, transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 11, flexShrink: 0, background: pixAutoConfirmar ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
            ⚡
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "0.9rem", color: pixAutoConfirmar ? "#10b981" : "var(--text)", marginBottom: 3 }}>
              PIX Automático
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)", lineHeight: 1.55 }}>
              {pixAutoConfirmar
                ? "Pedidos PIX são confirmados automaticamente — cliente não precisa enviar comprovante."
                : "Quando ativo, o pedido PIX é confirmado na hora. Ideal para lojas movimentadas. O cliente só precisa pagar."}
            </div>
          </div>
          <button
            onClick={async () => {
              if (!lojaDocId) return;
              const novo = !pixAutoConfirmar;
              await updateDoc(doc(db, "lojas", lojaDocId), { pixAutoConfirmar: novo });
              toast(novo ? "⚡ PIX automático ativado!" : "PIX automático desativado.");
            }}
            style={{
              width: 52, height: 28, borderRadius: 14, border: "none", cursor: "pointer",
              background: pixAutoConfirmar ? "#10b981" : "var(--bg3)", position: "relative",
              transition: "background 0.3s", flexShrink: 0,
            }}
          >
            <div style={{
              position: "absolute", top: 3, left: pixAutoConfirmar ? 27 : 3,
              width: 22, height: 22, borderRadius: "50%",
              background: pixAutoConfirmar ? "var(--bg)" : "var(--text3)",
              transition: "left 0.25s",
            }} />
          </button>
        </div>
        {pixAutoConfirmar && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid rgba(16,185,129,0.15)", display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Token Mercado Pago */}
            <div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#10b981", marginBottom: 6 }}>
                🤖 Detecção automática de pagamento
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginBottom: 8, lineHeight: 1.5 }}>
                Com o token Mercado Pago, o sistema detecta o pagamento PIX automaticamente e move o pedido para preparo sem você precisar fazer nada.
              </div>
              <MpTokenField lojaDocId={lojaDocId} />
            </div>

            {/* Prazo de cancelamento */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: "0.72rem", color: "var(--text2)", whiteSpace: "nowrap" }}>⏰ Cancelar em</span>
              <select
                value={config.pixPrazoMinutos || 30}
                onChange={async e => {
                  await salvarConfig({ pixPrazoMinutos: Number(e.target.value) });
                  toast("Prazo salvo!");
                }}
                style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", cursor: "pointer" }}
              >
                {[10, 15, 20, 30, 45, 60].map(m => (
                  <option key={m} value={m}>{m} minutos</option>
                ))}
              </select>
              <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>sem pagamento → cancela</span>
            </div>

            <div style={{ fontSize: "0.65rem", color: "rgba(16,185,129,0.5)", display: "flex", alignItems: "flex-start", gap: 5 }}>
              <span>ℹ️</span>
              <span>Sem token MP: o sistema confia no cliente e confirma direto (sem verificação real).</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Canais de Atendimento ── */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
        <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text)", marginBottom: 4 }}>📞 Canais de Atendimento Humano</div>
        <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 14 }}>
          Quando o cliente pedir atendimento humano, como prefere ser chamado?
        </div>

        {/* Seletor de canal */}
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          {[
            { val: "chat",     label: "💬 Chat", desc: "Só no chat" },
            { val: "whatsapp", label: "📱 WhatsApp", desc: "Só WhatsApp" },
            { val: "ambos",    label: "✅ Ambos", desc: "Cliente escolhe" },
          ].map(op => (
            <button key={op.val} onClick={() => setCanalAtendimento(op.val)}
              style={{
                flex: 1, padding: "10px 6px", borderRadius: 10, border: "none", cursor: "pointer",
                fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.72rem", textAlign: "center",
                background: canalAtendimento === op.val ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
                color: canalAtendimento === op.val ? "var(--purple2)" : "var(--text3)",
                outline: canalAtendimento === op.val ? "1px solid rgba(124,58,237,0.5)" : "1px solid transparent",
                transition: "all 0.15s",
              }}>
              <div>{op.label}</div>
              <div style={{ fontWeight: 400, fontSize: "0.6rem", marginTop: 2, opacity: 0.7 }}>{op.desc}</div>
            </button>
          ))}
        </div>

        {/* Campo WhatsApp */}
        {(canalAtendimento === "whatsapp" || canalAtendimento === "ambos") && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 6 }}>Número do WhatsApp (com DDD)</div>
            <input
              value={whatsappNum}
              onChange={e => setWhatsappNum(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 41999998888"
              maxLength={11}
              style={{ width: "100%", padding: "10px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", boxSizing: "border-box" }}
            />
            {whatsappNum && (
              <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 4 }}>
                Link: wa.me/55{whatsappNum}
              </div>
            )}
          </div>
        )}

        <button
          onClick={async () => {
            if (!lojaDocId) return;
            setSalvandoCanal(true);
            await updateDoc(doc(db, "lojas", lojaDocId), {
              canalAtendimento,
              whatsapp: whatsappNum || null,
            }).catch(() => {});
            setSalvandoCanal(false);
            toast("✅ Canais de atendimento salvos!");
          }}
          disabled={salvandoCanal}
          style={{ width: "100%", padding: "10px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", opacity: salvandoCanal ? 0.7 : 1 }}>
          {salvandoCanal ? "Salvando…" : "Salvar configuração"}
        </button>
      </div>

      {/* Pedidos aguardando confirmação */}
      {conversasPendentes > 0 && (
        <div style={{ background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.1rem" }}>🔒</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#f5c518" }}>
              {conversasPendentes} pedido{conversasPendentes > 1 ? "s" : ""} aguardando confirmação
            </div>
            <div style={{ fontSize: "0.65rem", color: "rgba(245,197,24,0.6)" }}>
              Confirme na aba Pedidos para liberar o chat
            </div>
          </div>
        </div>
      )}

      {/* Lista de conversas */}
      {chats.length === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>💬</div>
          <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text2)" }}>Nenhuma conversa ainda</div>
          <div style={{ fontSize: "0.72rem", marginTop: 4 }}>As mensagens dos clientes aparecem aqui</div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)", marginBottom: 8 }}>
            Conversas ({chats.length})
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {chats.map(conv => {
              const userId = conv.participantes?.find(p => p !== lojaVirtualId);
              const userInfo = conv.participantesInfo?.[userId] || {};
              const naoLido = lojaVirtualId ? (conv.naoLido?.[lojaVirtualId] || 0) : 0;
              const temPedido = !!conv.pedidoId;
              const bloqueado = !!conv.bloqueado;
              const ultimaMsg = conv.ultimaMensagem?.texto || "Nova conversa";
              const ehBot = conv.ultimaMensagem?.autorId === lojaVirtualId;

              return (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/chat/${conv.id}`)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                    background: naoLido > 0 ? "rgba(124,58,237,0.08)" : "var(--bg2)",
                    border: `1px solid ${naoLido > 0 ? "rgba(124,58,237,0.3)" : "var(--border)"}`,
                    borderRadius: 14, cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {/* Avatar */}
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: "50%",
                      background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                      overflow: "hidden", display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: "1.1rem", fontWeight: 800, color: "#fff",
                    }}>
                      {userInfo.foto
                        ? <img src={userInfo.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : (userInfo.nome?.[0]?.toUpperCase() || "?")}
                    </div>
                    {bloqueado && (
                      <div style={{ position: "absolute", bottom: -3, right: -3, width: 17, height: 17, borderRadius: "50%", background: "#f5c518", border: "2px solid var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem" }}>🔒</div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                      <span style={{ fontWeight: naoLido > 0 ? 800 : 600, fontSize: "0.88rem" }}>
                        {userInfo.nome || "Cliente"}
                      </span>
                      {temPedido && !bloqueado && (
                        <span style={{ fontSize: "0.52rem", fontWeight: 700, color: "#22d3ee", background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.25)", borderRadius: 6, padding: "1px 5px" }}>PEDIDO</span>
                      )}
                      {bloqueado && (
                        <span style={{ fontSize: "0.52rem", fontWeight: 700, color: "#f5c518", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 6, padding: "1px 5px" }}>AGUARD.</span>
                      )}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: naoLido > 0 ? "var(--text)" : "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: naoLido > 0 ? 600 : 400 }}>
                      {ehBot ? <span style={{ color: "var(--green)" }}>🤖 </span> : ""}
                      {ultimaMsg}
                    </div>
                  </div>

                  {/* Badge não-lido */}
                  {naoLido > 0 ? (
                    <div style={{ minWidth: 22, height: 22, borderRadius: 11, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 800, color: "#fff", padding: "0 6px", flexShrink: 0 }}>
                      {naoLido}
                    </div>
                  ) : (
                    <span style={{ color: "var(--text3)", fontSize: "0.9rem", flexShrink: 0 }}>›</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ===== DESTAQUES DO DIA =====
const TIPOS_DESTAQUE = [
  { id: "cardapio_dia", label: "🍽️ Prato do Dia" },
  { id: "mais_pedidos", label: "🔥 Mais Pedidos" },
  { id: "combos",       label: "🎁 Combos" },
  { id: "promocoes",    label: "💥 Promoções" },
  { id: "novidades",    label: "✨ Novidades" },
];

function DestaquesDoDiaPanel() {
  const { config, salvarConfig, produtos } = useStore();
  const { toast } = useToast();
  const [form, setForm] = useState({ ativo: false, titulo: "Hoje no cardápio", tipo: "cardapio_dia", produtoIds: [] });
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (config?.destaquesHoje) setForm(prev => ({ ...prev, ...config.destaquesHoje }));
  }, [config?.destaquesHoje]);

  const toggleProduto = (id) => setForm(prev => ({
    ...prev,
    produtoIds: prev.produtoIds.includes(id)
      ? prev.produtoIds.filter(x => x !== id)
      : [...prev.produtoIds, id],
  }));

  const salvar = async () => {
    setSalvando(true);
    try { await salvarConfig({ destaquesHoje: form }); toast("✅ Destaques salvos!"); }
    catch { toast("Erro ao salvar.", "error"); }
    finally { setSalvando(false); }
  };

  const prodsFiltrados = (produtos || [])
    .filter(p => p.ativo !== false)
    .filter(p => !busca.trim() || p.nome?.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: form.ativo ? "1px solid var(--border)" : "none" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>🌟 Destaque do Dia</div>
          <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 2 }}>Carrosel que aparece no feed da loja</div>
        </div>
        <button
          onClick={() => setForm(p => ({ ...p, ativo: !p.ativo }))}
          style={{ padding: "5px 14px", background: form.ativo ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)", border: `1px solid ${form.ativo ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.12)"}`, borderRadius: 20, fontSize: "0.72rem", fontWeight: 700, color: form.ativo ? "var(--green)" : "var(--text3)", cursor: "pointer" }}>
          {form.ativo ? "● Ativo" : "○ Inativo"}
        </button>
      </div>

      {form.ativo && (
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Título */}
          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginBottom: 5 }}>Título do carrosel</div>
            <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))} className="form-input" placeholder="Ex: Prato do Dia, Combos de Hoje..." />
          </div>

          {/* Tipo */}
          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginBottom: 7 }}>Categoria</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TIPOS_DESTAQUE.map(t => (
                <button key={t.id} onClick={() => setForm(p => ({ ...p, tipo: t.id }))}
                  style={{ padding: "5px 12px", borderRadius: 20, border: `1px solid ${form.tipo === t.id ? "rgba(138,92,246,0.5)" : "var(--border)"}`, background: form.tipo === t.id ? "rgba(138,92,246,0.12)" : "transparent", color: form.tipo === t.id ? "var(--purple2)" : "var(--text3)", fontSize: "0.73rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Produtos */}
          <div>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginBottom: 6 }}>
              Produtos em destaque <span style={{ color: "var(--purple2)", fontWeight: 700 }}>({form.produtoIds.length} selecionados)</span>
            </div>
            <input value={busca} onChange={e => setBusca(e.target.value)} className="form-input" placeholder="Buscar produto..." style={{ marginBottom: 8 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 260, overflowY: "auto" }}>
              {prodsFiltrados.map(p => {
                const sel = form.produtoIds.includes(p.id);
                return (
                  <div key={p.id} onClick={() => toggleProduto(p.id)}
                    style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: sel ? "rgba(138,92,246,0.07)" : "transparent", border: `1px solid ${sel ? "rgba(138,92,246,0.3)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                      {p.foto ? <img src={p.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (p.emoji || "🫐")}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nome}</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--gold)" }}>R$ {p.preco?.toFixed(2).replace(".", ",")}</div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${sel ? "var(--purple2)" : "var(--border)"}`, background: sel ? "var(--purple2)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {sel && <span style={{ color: "#fff", fontSize: "0.6rem", fontWeight: 900 }}>✓</span>}
                    </div>
                  </div>
                );
              })}
              {prodsFiltrados.length === 0 && <div style={{ textAlign: "center", padding: "20px 0", fontSize: "0.78rem", color: "var(--text3)" }}>Nenhum produto encontrado</div>}
            </div>
          </div>

          <button onClick={salvar} disabled={salvando}
            style={{ padding: "11px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", opacity: salvando ? 0.6 : 1 }}>
            {salvando ? "Salvando..." : "💾 Salvar destaques"}
          </button>
        </div>
      )}
    </div>
  );
}

// ===== TAB FEED =====
function TabFeed() {
  const { tenantId } = useStore();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", margin: 0 }}>📸 Feed / Posts NexFoody</h3>
        <a href="/" target="_blank" rel="noreferrer" style={{ fontSize: "0.72rem", color: "var(--text3)", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px" }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Ver Home
        </a>
      </div>
      <div style={{ fontSize: "0.78rem", color: "var(--text3)", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
        Configure quais eventos da sua loja aparecem automaticamente no feed da NexFoody para atrair novos clientes.
      </div>
      <DestaquesDoDiaPanel />
      {tenantId
        ? <FeedRulesPanel tenantId={tenantId} />
        : <div style={{ textAlign: "center", padding: 30, color: "var(--text3)" }}>Loja não identificada.</div>
      }
    </div>
  );
}

// ===== COMUNICAR: Stories + Broadcast + Auto Mensagens =====
const STORY_CORES = [
  "linear-gradient(135deg, #7c3aed, #ec4899)",
  "linear-gradient(135deg, #f5c518, #f97316)",
  "linear-gradient(135deg, #059669, #22c55e)",
  "linear-gradient(135deg, #0ea5e9, #6366f1)",
  "linear-gradient(135deg, #ec4899, #ef4444)",
  "linear-gradient(135deg, #1e293b, #475569)",
];

function MpTokenField({ lojaDocId }) {
  const [token, setToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!lojaDocId) return;
    getDoc(doc(db, "lojas", lojaDocId)).then(snap => {
      if (snap.exists()) setToken(snap.data().mpAccessToken || "");
    });
  }, [lojaDocId]);

  const salvar = async () => {
    if (!lojaDocId) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, "lojas", lojaDocId), { mpAccessToken: token.trim() });
      setSalvo(true); setTimeout(() => setSalvo(false), 2500);
      toast("✅ Token Mercado Pago salvo!");
    } catch { toast("Erro ao salvar token.", "error"); }
    finally { setSalvando(false); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 6 }}>
        <input
          type={mostrar ? "text" : "password"}
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="APP_USR-... (Access Token de Produção)"
          style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 10px", color: "var(--text)", fontFamily: "monospace", fontSize: "0.72rem", outline: "none" }}
        />
        <button onClick={() => setMostrar(v => !v)} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontSize: "0.78rem", color: "var(--text2)" }}>
          {mostrar ? "🙈" : "👁️"}
        </button>
        <button onClick={salvar} disabled={salvando} style={{ background: salvo ? "#059669" : "linear-gradient(135deg,#10b981,#059669)", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer", color: "white", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.72rem", whiteSpace: "nowrap" }}>
          {salvo ? "✓ Salvo" : salvando ? "..." : "Salvar"}
        </button>
      </div>
      {token && (
        <div style={{ fontSize: "0.63rem", color: "#10b981" }}>
          ✅ Token configurado — pagamentos PIX serão detectados automaticamente
        </div>
      )}
      <div style={{ fontSize: "0.62rem", color: "var(--text3)", lineHeight: 1.5 }}>
        Obtenha em <strong>mercadopago.com.br</strong> → Sua conta → Credenciais → Access Token de Produção.
        Após salvar, configure o webhook no MP: <code style={{ fontSize: "0.6rem", background: "var(--bg2)", padding: "1px 4px", borderRadius: 4 }}>https://us-east1-acaipedidos-f53cc.cloudfunctions.net/mpWebhook</code>
      </div>
    </div>
  );
}

function TabComunicar() {
  const { tenantId } = useStore();
  const toast = useToast();
  const [lojaDocId, setLojaDocId] = useState(null);
  const [lojaData, setLojaData] = useState(null);
  const [aba, setAba] = useState("stories");

  const [stories, setStories] = useState([]);
  const [novoStoryTexto, setNovoStoryTexto] = useState("");
  const [novoStoryCor, setNovoStoryCor] = useState(STORY_CORES[0]);
  const [storyFile, setStoryFile] = useState(null);
  const [storyPreview, setStoryPreview] = useState(null);
  const [enviandoStory, setEnviandoStory] = useState(false);
  const [uploadProg, setUploadProg] = useState(null);
  const storyFileRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [novoPostTipo, setNovoPostTipo] = useState("novidade");
  const [novoPostTexto, setNovoPostTexto] = useState("");
  const [novoPostFixado, setNovoPostFixado] = useState(false);
  const [postFile, setPostFile] = useState(null);
  const [postPreview, setPostPreview] = useState(null);
  const [enviandoPost, setEnviandoPost] = useState(false);
  const postFileRef = useRef(null);

  const [clientes, setClientes] = useState([]);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [enviandoBroadcast, setEnviandoBroadcast] = useState(false);
  const [broadcastHistorico, setBroadcastHistorico] = useState([]);

  const [autoMsgs, setAutoMsgs] = useState({
    pedido_confirmado: "✅ Seu pedido foi confirmado! Estamos preparando com carinho. 🫐",
    pedido_entregue: "🎉 Seu pedido foi entregue! Esperamos que tenha adorado. Avalie nossa loja! ⭐",
    inatividade_3dias: "🫐 Sentimos sua falta! Faz 3 dias que você não pede. Temos novidades no cardápio!",
  });
  const [salvandoAuto, setSalvandoAuto] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, "lojas"), where("tenantId", "==", tenantId), limit(1));
    return onSnapshot(q, snap => {
      if (!snap.empty) {
        setLojaDocId(snap.docs[0].id);
        const d = snap.docs[0].data();
        setLojaData(d);
        if (d.autoMensagens) setAutoMsgs(prev => ({ ...prev, ...d.autoMensagens }));
      }
    });
  }, [tenantId]);

  useEffect(() => {
    if (!lojaDocId) return;
    const limite = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const q = query(
      collection(db, "lojas", lojaDocId, "stories"),
      where("criadoEm", ">=", Timestamp.fromDate(limite)),
      orderBy("criadoEm", "desc"),
      limit(20)
    );
    return onSnapshot(q, snap => setStories(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [lojaDocId]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, `tenants/${tenantId}/posts`),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    return onSnapshot(q, snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [tenantId]);

  useEffect(() => {
    if (!lojaDocId) return;
    const lojaVirtualId = `loja_${lojaDocId}`;
    getDocs(query(collection(db, "chats"), where("participantes", "array-contains", lojaVirtualId), limit(200)))
      .then(snap => {
        const lista = snap.docs.map(d => {
          const data = d.data();
          const uid = data.participantes?.find(p => !p.startsWith("loja_"));
          const info = data.participantesInfo?.[uid] || {};
          return { uid, nome: info.nome || "Cliente", chatId: d.id };
        }).filter(c => c.uid);
        setClientes(lista);
      }).catch(() => {});
  }, [lojaDocId]);

  useEffect(() => {
    if (!lojaDocId) return;
    const q = query(collection(db, "lojas", lojaDocId, "broadcasts"), orderBy("criadoEm", "desc"), limit(10));
    return onSnapshot(q, snap => setBroadcastHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, [lojaDocId]);

  const publicarStory = async () => {
    if (!lojaDocId) return;
    if (!storyFile && !novoStoryTexto.trim()) { toast("Adicione uma imagem ou texto", "error"); return; }
    setEnviandoStory(true);
    try {
      let midiaUrl = null;
      let tipo = "texto";
      if (storyFile) {
        tipo = storyFile.type.startsWith("video") ? "video" : "imagem";
        const path = `stories/${lojaDocId}/${Date.now()}_${storyFile.name.replace(/[^a-z0-9.]/gi, "_")}`;
        const sRef = storageRef(storage, path);
        const task = uploadBytesResumable(sRef, storyFile);
        setUploadProg(0);
        await new Promise((res, rej) => {
          task.on("state_changed",
            s => setUploadProg(Math.round(s.bytesTransferred / s.totalBytes * 100)),
            rej,
            async () => { midiaUrl = await getDownloadURL(task.snapshot.ref); res(); }
          );
        });
        setUploadProg(null);
      }
      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await addDoc(collection(db, "lojas", lojaDocId, "stories"), {
        tipo, midia: midiaUrl, texto: novoStoryTexto.trim() || null,
        cor: novoStoryCor, lojaNome: lojaData?.nome || "Loja", lojaFoto: lojaData?.logo || null,
        criadoEm: serverTimestamp(), expiraEm: Timestamp.fromDate(expiraEm), views: {},
      });
      toast("📸 Story publicado! Clientes verão por 24h.", "success");
      setNovoStoryTexto(""); setStoryFile(null); setStoryPreview(null);
    } catch (e) { toast("Erro ao publicar story", "error"); console.error(e); }
    finally { setEnviandoStory(false); }
  };

  const excluirStory = async (storyId) => {
    if (!lojaDocId) return;
    await deleteDoc(doc(db, "lojas", lojaDocId, "stories", storyId)).catch(() => {});
    toast("Story removido.");
  };

  const publicarPost = async () => {
    if (!tenantId) return;
    if (!novoPostTexto.trim()) { toast("Digite o texto do post", "error"); return; }
    setEnviandoPost(true);
    try {
      let fotoUrl = null;
      if (postFile) {
        const path = `posts/${tenantId}/${Date.now()}_${postFile.name.replace(/[^a-z0-9.]/gi, "_")}`;
        const sRef = storageRef(storage, path);
        const task = uploadBytesResumable(sRef, postFile);
        await new Promise((res, rej) => {
          task.on("state_changed", null, rej,
            async () => { fotoUrl = await getDownloadURL(task.snapshot.ref); res(); }
          );
        });
      }
      await addDoc(collection(db, `tenants/${tenantId}/posts`), {
        tipo: novoPostTipo,
        texto: novoPostTexto.trim(),
        foto: fotoUrl,
        fixado: novoPostFixado,
        createdAt: serverTimestamp(),
      });
      toast("✅ Post publicado no feed!", "success");
      setNovoPostTexto(""); setPostFile(null); setPostPreview(null); setNovoPostFixado(false);
    } catch (e) { toast("Erro ao publicar post", "error"); console.error(e); }
    finally { setEnviandoPost(false); }
  };

  const excluirPost = async (postId) => {
    if (!tenantId) return;
    await deleteDoc(doc(db, `tenants/${tenantId}/posts`, postId)).catch(() => {});
    toast("Post removido.");
  };

  const enviarBroadcast = async () => {
    if (!broadcastMsg.trim() || !lojaDocId || clientes.length === 0) return;
    setEnviandoBroadcast(true);
    try {
      await addDoc(collection(db, "lojas", lojaDocId, "broadcasts"), {
        mensagem: broadcastMsg.trim(), total: clientes.length, enviados: 0,
        criadoEm: serverTimestamp(), lojaId: lojaDocId, lojaNome: lojaData?.nome || "Loja",
      });
      toast(`📢 Broadcast enviado para ${clientes.length} cliente${clientes.length > 1 ? "s" : ""}!`, "success");
      setBroadcastMsg("");
    } catch { toast("Erro ao enviar broadcast", "error"); }
    finally { setEnviandoBroadcast(false); }
  };

  const salvarAutoMsgs = async () => {
    if (!lojaDocId) return;
    setSalvandoAuto(true);
    try { await updateDoc(doc(db, "lojas", lojaDocId), { autoMensagens: autoMsgs }); toast("✅ Mensagens automáticas salvas!"); }
    catch { toast("Erro ao salvar", "error"); }
    finally { setSalvandoAuto(false); }
  };

  if (!lojaDocId) return <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>Carregando…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <h3 style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", margin: 0 }}>📢 Comunicar com Clientes</h3>
      <p style={{ fontSize: "0.78rem", color: "var(--text3)", margin: 0, lineHeight: 1.6 }}>
        Mantenha seus clientes engajados direto pelo NexFoody — sem precisar do WhatsApp.
      </p>

      <div style={{ display: "flex", gap: 6, background: "var(--bg2)", borderRadius: 14, padding: 4, overflowX: "auto", scrollbarWidth: "none" }}>
        {[{ id: "posts", label: "📝 Posts" }, { id: "stories", label: "📸 Stories" }, { id: "broadcast", label: "📣 Broadcast" }, { id: "auto", label: "🤖 Automático" }].map(a => (
          <button key={a.id} onClick={() => setAba(a.id)} style={{ flex: "0 0 auto", padding: "8px 12px", border: "none", borderRadius: 10, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem", background: aba === a.id ? "linear-gradient(135deg, #ec4899, #7c3aed)" : "transparent", color: aba === a.id ? "white" : "var(--text3)", transition: "all 0.2s", whiteSpace: "nowrap" }}>{a.label}</button>
        ))}
      </div>

      {aba === "posts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Formulário de criação */}
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: "0.92rem", marginBottom: 4 }}>✍️ Criar novo post</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 14, lineHeight: 1.6 }}>
              Posts aparecem permanentemente no feed da sua loja ({tenantId}/feed) e podem ser vistos por qualquer cliente.
            </div>

            {/* Tipo */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[{ id: "novidade", emoji: "✨", label: "Novidade" }, { id: "promo", emoji: "🔥", label: "Promoção" }, { id: "aviso", emoji: "📢", label: "Aviso" }].map(t => (
                <button key={t.id} onClick={() => setNovoPostTipo(t.id)}
                  style={{ flex: 1, padding: "7px 4px", border: `1px solid ${novoPostTipo === t.id ? "rgba(245,197,24,.5)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.72rem", background: novoPostTipo === t.id ? "rgba(245,197,24,.08)" : "var(--bg3)", color: novoPostTipo === t.id ? "var(--gold)" : "var(--text3)", transition: "all 0.2s" }}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>

            {/* Preview da foto */}
            {postPreview && (
              <div style={{ position: "relative", marginBottom: 10 }}>
                <img src={postPreview} alt="" style={{ width: "100%", maxHeight: 200, objectFit: "cover", borderRadius: 10 }} />
                <button onClick={() => { setPostFile(null); setPostPreview(null); }}
                  style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,.6)", border: "none", borderRadius: "50%", width: 26, height: 26, cursor: "pointer", color: "white", fontSize: "0.85rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
              </div>
            )}

            <input ref={postFileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (!f) return; setPostFile(f); setPostPreview(URL.createObjectURL(f)); e.target.value = ""; }} />
            <button onClick={() => postFileRef.current?.click()}
              style={{ width: "100%", padding: "9px", background: "rgba(124,58,237,0.08)", border: "1px dashed rgba(124,58,237,0.4)", borderRadius: 10, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: "0.8rem", color: "var(--purple2)", fontWeight: 700, marginBottom: 10 }}>
              {postFile ? `📁 ${postFile.name}` : "🖼️ Adicionar foto (opcional)"}
            </button>

            <textarea value={novoPostTexto} onChange={e => setNovoPostTexto(e.target.value)}
              placeholder="Texto do post… Ex: 🫐 Novidade no cardápio! Açaí Especial com coberturas premium por R$18."
              rows={3}
              style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
            />

            <button onClick={() => setNovoPostFixado(p => !p)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: novoPostFixado ? "rgba(245,197,24,.1)" : "var(--bg3)", border: `1px solid ${novoPostFixado ? "rgba(245,197,24,.4)" : "var(--border)"}`, borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: "0.75rem", fontWeight: 700, color: novoPostFixado ? "var(--gold)" : "var(--text3)", marginBottom: 12 }}>
              📌 {novoPostFixado ? "Fixado no topo" : "Fixar no topo"}
            </button>

            <button onClick={publicarPost} disabled={enviandoPost || !novoPostTexto.trim()}
              style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg, #7c3aed, #ec4899)", border: "none", borderRadius: 12, color: "white", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.88rem", cursor: "pointer", opacity: enviandoPost ? 0.6 : 1 }}>
              {enviandoPost ? "Publicando…" : "📝 Publicar no feed"}
            </button>
          </div>

          {/* Lista de posts */}
          {posts.length > 0 ? (
            <div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)", marginBottom: 10 }}>Posts publicados ({posts.length})</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {posts.map(p => {
                  const cfg = { promo: { emoji: "🔥", color: "var(--gold)" }, novidade: { emoji: "✨", color: "var(--green)" }, aviso: { emoji: "📢", color: "#60a5fa" } }[p.tipo] || { emoji: "📢", color: "#60a5fa" };
                  return (
                    <div key={p.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                      {p.foto && <img src={p.foto} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />}
                      <div style={{ padding: "10px 12px", display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                            {p.fixado && <span style={{ fontSize: "0.65rem", color: "var(--gold)" }}>📌</span>}
                            <span style={{ fontSize: "0.65rem", fontWeight: 700, color: cfg.color }}>{cfg.emoji} {(p.tipo || "aviso").toUpperCase()}</span>
                          </div>
                          <div style={{ fontSize: "0.82rem", color: "var(--text)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.texto}</div>
                          <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 4 }}>❤️ {p.curtidas || 0} · ↗️ {p.compartilhamentos || 0}</div>
                        </div>
                        <button onClick={() => excluirPost(p.id)}
                          style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: "0.72rem", color: "#ef4444", fontFamily: "'Outfit', sans-serif", fontWeight: 700, flexShrink: 0 }}>
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text3)", fontSize: "0.82rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📝</div>
              Nenhum post ainda. Crie o primeiro!
            </div>
          )}
        </div>
      )}

      {aba === "stories" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
            <div style={{ fontWeight: 800, fontSize: "0.92rem", marginBottom: 8 }}>✨ Publicar novo story</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 12 }}>Apareça no topo do chat dos seus clientes! Fotos de pratos, promoções — fica visível por 24h. 🔥</div>

            {(storyPreview || novoStoryTexto) && (
              <div style={{ width: "100%", maxWidth: 180, height: 290, borderRadius: 14, overflow: "hidden", margin: "0 auto 14px", border: "2px solid var(--purple2)", position: "relative" }}>
                {storyPreview
                  ? <img src={storyPreview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <div style={{ width: "100%", height: "100%", background: novoStoryCor, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}>
                      <div style={{ fontSize: "1rem", fontWeight: 800, color: "white", textAlign: "center", lineHeight: 1.4 }}>{novoStoryTexto}</div>
                    </div>
                }
                {storyPreview && novoStoryTexto && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "20px 10px 10px", background: "linear-gradient(to top, rgba(0,0,0,0.7), transparent)" }}>
                    <div style={{ fontSize: "0.78rem", color: "white", fontWeight: 600 }}>{novoStoryTexto}</div>
                  </div>
                )}
              </div>
            )}

            <input ref={storyFileRef} type="file" accept="image/*,video/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (!f) return; setStoryFile(f); setStoryPreview(URL.createObjectURL(f)); e.target.value = ""; }} />
            <button onClick={() => storyFileRef.current?.click()} style={{ width: "100%", padding: "10px", background: "rgba(124,58,237,0.08)", border: "1px dashed rgba(124,58,237,0.4)", borderRadius: 12, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", color: "var(--purple2)", fontWeight: 700, marginBottom: 10 }}>
              {storyFile ? `📁 ${storyFile.name}` : "📷 Escolher foto ou vídeo"}
            </button>

            <textarea value={novoStoryTexto} onChange={e => setNovoStoryTexto(e.target.value)}
              placeholder="Legenda ou texto do story… 🫐"
              rows={2}
              style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: "9px 12px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 10 }}
            />

            {!storyFile && (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                {STORY_CORES.map(c => (
                  <div key={c} onClick={() => setNovoStoryCor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, cursor: "pointer", border: novoStoryCor === c ? "3px solid white" : "3px solid transparent", boxShadow: novoStoryCor === c ? "0 0 0 2px var(--purple2)" : "none", flexShrink: 0 }} />
                ))}
              </div>
            )}

            {uploadProg !== null && (
              <div style={{ height: 3, background: "var(--bg3)", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                <div style={{ height: "100%", width: `${uploadProg}%`, background: "linear-gradient(90deg, var(--purple2), #ec4899)", transition: "width 0.3s" }} />
              </div>
            )}

            <button onClick={publicarStory} disabled={enviandoStory || (!storyFile && !novoStoryTexto.trim())}
              style={{ width: "100%", padding: "11px", background: "linear-gradient(135deg, #ec4899, #7c3aed)", border: "none", borderRadius: 12, color: "white", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.88rem", cursor: "pointer", opacity: enviandoStory ? 0.6 : 1 }}>
              {enviandoStory ? "Publicando…" : "📸 Publicar story (24h)"}
            </button>
          </div>

          {stories.length > 0 && (
            <div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)", marginBottom: 10 }}>Stories ativos</div>
              <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 4 }}>
                {stories.map(s => (
                  <div key={s.id} style={{ flexShrink: 0, width: 110, borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", background: "var(--bg2)" }}>
                    <div style={{ height: 160, background: s.midia ? undefined : (s.cor || STORY_CORES[0]), position: "relative" }}>
                      {s.midia && <img src={s.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      {!s.midia && <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 8px" }}><div style={{ fontSize: "0.75rem", color: "white", fontWeight: 700, textAlign: "center" }}>{s.texto}</div></div>}
                      <button onClick={() => excluirStory(s.id)} style={{ position: "absolute", top: 6, right: 6, background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer", color: "white", fontSize: "0.7rem", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                    </div>
                    <div style={{ padding: "6px 8px", fontSize: "0.65rem", color: "var(--text3)" }}>
                      👁 {Object.keys(s.views || {}).length} views
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {stories.length === 0 && (
            <div style={{ textAlign: "center", padding: "30px 0", color: "var(--text3)", fontSize: "0.82rem" }}>
              <div style={{ fontSize: "2rem", marginBottom: 8 }}>📸</div>
              Nenhum story ativo. Publique agora!
            </div>
          )}
        </div>
      )}

      {aba === "broadcast" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(236,72,153,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>📣</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>Mensagem em massa</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>{clientes.length} cliente{clientes.length !== 1 ? "s" : ""} no chat</div>
              </div>
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", background: "rgba(245,197,24,0.06)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 12, lineHeight: 1.6 }}>
              💡 Chega no chat de cada cliente como mensagem direta da loja. Sem spam, sem WhatsApp.
            </div>
            <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)}
              placeholder={"Ex: 🫐 Novidade hoje! Açaí 500ml com granola por R$18.\n\nAproveite enquanto durar! 👉"}
              rows={4}
              style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", resize: "none", outline: "none", boxSizing: "border-box", marginBottom: 10, lineHeight: 1.5 }}
            />
            <button onClick={enviarBroadcast} disabled={enviandoBroadcast || !broadcastMsg.trim() || clientes.length === 0}
              style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #ec4899, #7c3aed)", border: "none", borderRadius: 12, color: "white", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.9rem", cursor: "pointer", opacity: enviandoBroadcast ? 0.6 : 1 }}>
              {enviandoBroadcast ? "Enviando…" : `📣 Enviar para ${clientes.length} cliente${clientes.length !== 1 ? "s" : ""}`}
            </button>
          </div>

          {broadcastHistorico.length > 0 && (
            <div>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)", marginBottom: 8 }}>Histórico</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {broadcastHistorico.map(b => (
                  <div key={b.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px" }}>
                    <div style={{ fontSize: "0.82rem", color: "var(--text)", marginBottom: 5, lineHeight: 1.4 }}>{b.mensagem}</div>
                    <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>📣 {b.total} destinatários · {b.criadoEm ? new Date(b.criadoEm.toDate()).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {aba === "auto" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: "0.78rem", color: "var(--text3)", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", lineHeight: 1.6 }}>
            🤖 Mensagens enviadas automaticamente nos momentos-chave da jornada do cliente.
          </div>
          {[
            { id: "pedido_confirmado", icon: "✅", label: "Pedido confirmado", desc: "Quando o pedido muda para confirmado" },
            { id: "pedido_entregue",   icon: "🎉", label: "Pedido entregue",   desc: "Quando o status muda para entregue" },
            { id: "inatividade_3dias", icon: "🫐", label: "Saudade (3 dias)",  desc: "Para clientes inativos há 3+ dias" },
          ].map(item => (
            <div key={item.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: "1.3rem" }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{item.label}</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>{item.desc}</div>
                </div>
              </div>
              <textarea value={autoMsgs[item.id] || ""} onChange={e => setAutoMsgs(prev => ({ ...prev, [item.id]: e.target.value }))}
                rows={2} style={{ width: "100%", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, padding: "8px 12px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", resize: "none", outline: "none", boxSizing: "border-box" }} />
            </div>
          ))}
          <button onClick={salvarAutoMsgs} disabled={salvandoAuto}
            style={{ padding: "12px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 12, color: "white", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.9rem", cursor: "pointer", opacity: salvandoAuto ? 0.6 : 1 }}>
            {salvandoAuto ? "Salvando…" : "💾 Salvar mensagens automáticas"}
          </button>
        </div>
      )}
    </div>
  );
}

// ===== GERENTE IA =====
function gerarPdfRelatorio(dadosPdf) {
  const { nomeLoja, dataHoje, horaAtual, graficos } = dadosPdf;
  const g = graficos || {};
  const kpis = g.kpis || {};
  const fmtR = v => `R$ ${(v || 0).toFixed(2).replace(".", ",")}`;
  const fmtN = v => (v || 0).toLocaleString("pt-BR");

  // ── KPI cards ──────────────────────────────────────────────
  const varCor   = kpis.varOntem >= 0 ? "#16a34a" : "#dc2626";
  const varSinal = kpis.varOntem >= 0 ? "▲" : "▼";
  const varTexto = kpis.varOntem !== null && kpis.varOntem !== undefined
    ? `<span style="color:${varCor};font-weight:700;font-size:11px">${varSinal} ${Math.abs(kpis.varOntem)}% vs ontem</span>` : "";

  const kpiCards = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
      ${[
        { label: "Faturamento", value: fmtR(kpis.faturamento), sub: varTexto, color: "#7c3aed", bg: "#f3e8ff" },
        { label: "Pedidos", value: fmtN(kpis.pedidos), sub: `${kpis.concluidos} concluídos`, color: "#2563eb", bg: "#eff6ff" },
        { label: "Ticket Médio", value: fmtR(kpis.ticketMedio), sub: `Média 7d: ${fmtR(kpis.mediaDiaria7d)}`, color: "#0891b2", bg: "#ecfeff" },
        { label: "Clientes", value: fmtN(kpis.clientes), sub: `Pico: ${kpis.horaPico || "—"}`, color: "#d97706", bg: "#fffbeb" },
      ].map(c => `
        <div style="background:${c.bg};border-radius:12px;padding:14px 16px;border-left:4px solid ${c.color}">
          <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${c.label}</div>
          <div style="font-size:20px;font-weight:900;color:${c.color};line-height:1">${c.value}</div>
          <div style="font-size:10px;color:#6b7280;margin-top:4px">${c.sub}</div>
        </div>`).join("")}
    </div>`;

  // ── Dados para Chart.js ────────────────────────────────────
  const horasLabels   = JSON.stringify((g.vendaPorHora || []).map(h => `${h.hora}h`));
  const horasData     = JSON.stringify((g.vendaPorHora || []).map(h => h.qtd));
  const pagLabels     = JSON.stringify((g.pagamentos  || []).map(p => p.nome));
  const pagData       = JSON.stringify((g.pagamentos  || []).map(p => p.valor));
  const prodLabels    = JSON.stringify((g.topProdutos || []).map(p => p.nome));
  const prodQty       = JSON.stringify((g.topProdutos || []).map(p => p.qty));
  const prodTotal     = JSON.stringify((g.topProdutos || []).map(p => p.total));
  const pagCores      = JSON.stringify(["#7c3aed","#2563eb","#0891b2","#d97706","#16a34a","#dc2626"].slice(0, (g.pagamentos || []).length));

  // Comparativo semanal
  const semanal       = g.comparativoSemanal || {};
  const semDias       = semanal.dias || [];
  const semLabels     = JSON.stringify(semDias.map(d => `${d.diaSemana}\n${d.label}`));
  const semFatAtual   = JSON.stringify(semDias.map(d => +d.fatAtual.toFixed(2)));
  const semFatAnt     = JSON.stringify(semDias.map(d => +d.fatAnterior.toFixed(2)));
  const semPedAtual   = JSON.stringify(semDias.map(d => d.pedAtual));
  const semPedAnt     = JSON.stringify(semDias.map(d => d.pedAnterior));
  const semVarCor     = (semanal.varSemana || 0) >= 0 ? "#16a34a" : "#dc2626";
  const semVarTexto   = semanal.varSemana !== null && semanal.varSemana !== undefined
    ? `${semanal.varSemana >= 0 ? "▲ +" : "▼ "}${Math.abs(semanal.varSemana)}% vs semana passada` : "";
  const fmtR2 = v => `R$ ${(v || 0).toFixed(2).replace(".", ",")}`;

  const semKpiHtml = semDias.length > 0 ? `
    <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap">
      <div style="flex:1;min-width:140px;background:#f3e8ff;border-radius:10px;padding:12px 14px;border-left:4px solid #7c3aed">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;margin-bottom:3px">Esta semana</div>
        <div style="font-size:18px;font-weight:900;color:#7c3aed">${fmtR2(semanal.fat7dAtual)}</div>
      </div>
      <div style="flex:1;min-width:140px;background:#f1f5f9;border-radius:10px;padding:12px 14px;border-left:4px solid #94a3b8">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;margin-bottom:3px">Semana passada</div>
        <div style="font-size:18px;font-weight:900;color:#475569">${fmtR2(semanal.fat7dAnterior)}</div>
      </div>
      ${semVarTexto ? `<div style="flex:1;min-width:140px;background:${semanal.varSemana >= 0 ? "#f0fdf4" : "#fef2f2"};border-radius:10px;padding:12px 14px;border-left:4px solid ${semVarCor}">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;margin-bottom:3px">Variação</div>
        <div style="font-size:18px;font-weight:900;color:${semVarCor}">${semVarTexto}</div>
      </div>` : ""}
    </div>` : "";

  // ── Estoque / alertas ──────────────────────────────────────
  const alertasHtml = (() => {
    const itens = [];
    if ((g.estoqueBaixo || []).length > 0) {
      itens.push(`<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:10px 14px;margin-bottom:8px">
        <div style="font-weight:700;color:#dc2626;font-size:11px;margin-bottom:6px">⚠️ ESTOQUE BAIXO / ESGOTADO</div>
        ${g.estoqueBaixo.map(e => `<div style="font-size:11px;color:#7f1d1d">• ${e.nome}: ${e.estoque <= 0 ? "ESGOTADO" : e.estoque + " un restantes"}</div>`).join("")}
      </div>`);
    }
    if ((g.avaliacoesPublicas || 0) + (g.avaliacoesPrivadas || 0) > 0) {
      itens.push(`<div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:10px 14px;margin-bottom:8px">
        <div style="font-weight:700;color:#d97706;font-size:11px;margin-bottom:6px">⭐ AVALIAÇÕES PENDENTES</div>
        <div style="font-size:11px;color:#78350f">• Públicas: ${g.avaliacoesPublicas} &nbsp;|&nbsp; Privadas: ${g.avaliacoesPrivadas}</div>
      </div>`);
    }
    if ((g.vipsInativos || 0) > 0) {
      itens.push(`<div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:8px;padding:10px 14px;margin-bottom:8px">
        <div style="font-weight:700;color:#7c3aed;font-size:11px;margin-bottom:6px">🎯 CLIENTES VIP INATIVOS</div>
        <div style="font-size:11px;color:#4c1d95">• ${g.vipsInativos} cliente(s) VIP sem pedir há +21 dias</div>
      </div>`);
    }
    return itens.length > 0 ? `<div style="margin-bottom:28px">${itens.join("")}</div>` : "";
  })();

  const janela = window.open("", "_blank", "width=900,height=950");
  if (!janela) { alert("Permita pop-ups para baixar o PDF."); return; }

  janela.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatório ${nomeLoja} — ${dataHoje}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"><\/script>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#1a1a2e;max-width:820px;margin:0 auto;padding:36px 40px}
  .header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:28px;padding-bottom:18px;border-bottom:3px solid #7c3aed}
  .logo{font-size:24px;font-weight:900;color:#7c3aed;letter-spacing:-0.5px}
  .logo span{color:#1a1a2e}
  .meta{text-align:right;font-size:11px;color:#6b7280;line-height:1.8}
  .badge{display:inline-block;background:#f3e8ff;color:#7c3aed;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700}
  .section-title{font-size:12px;font-weight:800;color:#374151;text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px;padding-bottom:5px;border-bottom:1px solid #e5e7eb}
  .charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:28px}
  .chart-box{background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:16px}
  .chart-title{font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px}
  .chart-full{background:#fafafa;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin-bottom:28px}
  .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
  @media print{body{padding:20px 28px}@page{margin:1.2cm}canvas{max-width:100%!important}}
</style>
</head>
<body>

<div class="header">
  <div>
    <div class="logo">NexFoody <span>| ${nomeLoja}</span></div>
    <div class="badge" style="margin-top:6px">🤖 Gerado pelo Gerente IA</div>
  </div>
  <div class="meta">
    <div style="font-weight:700;color:#1a1a2e;font-size:13px">${dataHoje}</div>
    <div>Gerado às ${horaAtual}</div>
  </div>
</div>

<div class="section-title">📊 Resumo Executivo</div>
${kpiCards}

${alertasHtml}

<div class="charts-grid">
  <div class="chart-box">
    <div class="chart-title">💳 Faturamento por forma de pagamento</div>
    <canvas id="chartPag" height="200"></canvas>
  </div>
  <div class="chart-box">
    <div class="chart-title">🏆 Top produtos — unidades vendidas</div>
    <canvas id="chartProd" height="200"></canvas>
  </div>
</div>

<div class="chart-full">
  <div class="chart-title">📈 Pedidos por hora do dia</div>
  <canvas id="chartHoras" height="110"></canvas>
</div>

<div class="section-title" style="margin-top:8px">📅 Comparativo Semanal — Esta semana vs semana passada</div>
${semKpiHtml}
<div class="charts-grid">
  <div class="chart-box">
    <div class="chart-title">💰 Faturamento diário (R$)</div>
    <canvas id="chartSemFat" height="200"></canvas>
  </div>
  <div class="chart-box">
    <div class="chart-title">🛒 Pedidos por dia</div>
    <canvas id="chartSemPed" height="200"></canvas>
  </div>
</div>

<div class="footer">
  Relatório gerado automaticamente pelo Gerente IA NexFoody · ${new Date().toLocaleString("pt-BR")}
</div>

<script>
const PURPLE = '#7c3aed', BLUE = '#2563eb', CYAN = '#0891b2', AMBER = '#d97706';

// Gráfico de pizza — pagamentos
(function() {
  const labels = ${pagLabels};
  const data   = ${pagData};
  const colors = ${pagCores};
  if (!labels.length) return;
  new Chart(document.getElementById('chartPag'), {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff', hoverOffset: 6 }] },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 10 } },
        tooltip: { callbacks: { label: ctx => ' R$ ' + ctx.parsed.toFixed(2).replace('.', ',') } }
      },
      animation: false,
    }
  });
})();

// Gráfico de barras horizontais — produtos
(function() {
  const labels = ${prodLabels};
  const qty    = ${prodQty};
  if (!labels.length) return;
  new Chart(document.getElementById('chartProd'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Unidades',
        data: qty,
        backgroundColor: labels.map((_, i) => ['#7c3aed','#6d28d9','#5b21b6','#4c1d95','#3b0764'][i] || '#7c3aed'),
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { font: { size: 10 } } }
      },
      animation: false,
    }
  });
})();

// Gráfico de barras — pedidos por hora
(function() {
  const labels = ${horasLabels};
  const data   = ${horasData};
  if (!labels.length) return;
  const maxIdx = data.indexOf(Math.max(...data));
  new Chart(document.getElementById('chartHoras'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Pedidos',
        data,
        backgroundColor: data.map((_, i) => i === maxIdx ? '#7c3aed' : '#c4b5fd'),
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: {
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y + ' pedidos' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 10 }, stepSize: 1 } }
      },
      animation: false,
    }
  });
})();

// Comparativo semanal — faturamento
(function() {
  const labels = ${semLabels};
  const atual  = ${semFatAtual};
  const ant    = ${semFatAnt};
  if (!labels.length) return;
  new Chart(document.getElementById('chartSemFat'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Esta semana', data: atual, backgroundColor: '#7c3aed', borderRadius: 5, borderSkipped: false },
        { label: 'Semana passada', data: ant, backgroundColor: '#e2e8f0', borderRadius: 5, borderSkipped: false },
      ]
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8 } },
        tooltip: { callbacks: { label: ctx => ' R$ ' + ctx.parsed.y.toFixed(2).replace('.', ',') } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 }, callback: v => 'R$' + v } }
      },
      animation: false,
    }
  });
})();

// Comparativo semanal — pedidos
(function() {
  const labels = ${semLabels};
  const atual  = ${semPedAtual};
  const ant    = ${semPedAnt};
  if (!labels.length) return;
  new Chart(document.getElementById('chartSemPed'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Esta semana', data: atual, backgroundColor: '#0891b2', borderRadius: 5, borderSkipped: false },
        { label: 'Semana passada', data: ant, backgroundColor: '#e2e8f0', borderRadius: 5, borderSkipped: false },
      ]
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 10 }, padding: 8 } },
        tooltip: { callbacks: { label: ctx => ' ' + ctx.parsed.y + ' pedidos' } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 9 } } },
        y: { grid: { color: '#f0f0f0' }, ticks: { font: { size: 9 }, stepSize: 1 } }
      },
      animation: false,
    }
  });
})();

window.addEventListener('load', () => setTimeout(() => window.print(), 800));
<\/script>
</body>
</html>`);
  janela.document.close();
}

function TabGerenteIA() {
  const { tenantId, config, salvarConfig } = useStore();
  const [lojaDocId, setLojaDocId] = useState(null);
  const [msgs, setMsgs] = useState([
    { role: "assistant", content: "Olá! 👋 Sou seu Gerente IA. Estou conectado em tempo real aos dados da sua loja.\n\nPosso te ajudar com:\n• 📊 Resumo de vendas do dia\n• 📦 Status do estoque\n• ⭐ Avaliações pendentes\n• 📈 Comparativos de faturamento\n• 🎯 Clientes VIP inativos\n• 📄 Relatório em PDF do dia\n• 📱 Enviar relatório por WhatsApp\n\nComo posso ajudar?" },
  ]);
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [editandoWpp, setEditandoWpp] = useState(false);
  const [wppInput, setWppInput] = useState("");
  const fimRef = useRef(null);
  const inputRef = useRef(null);
  const chamarGerenteRef = useRef(null);

  const whatsappGerente = config?.whatsappGerente || "";

  useEffect(() => {
    const funcs = getFunctions(getApp(), "us-east1");
    chamarGerenteRef.current = httpsCallable(funcs, "gerenteLoja");
  }, []);

  useEffect(() => {
    if (!tenantId) return;
    getDocs(query(collection(db, "lojas"), where("tenantId", "==", tenantId))).then(snap => {
      if (!snap.empty) setLojaDocId(snap.docs[0].id);
    });
  }, [tenantId]);

  const salvarWpp = async () => {
    const num = wppInput.replace(/\D/g, "");
    if (num.length < 10) return;
    await salvarConfig({ whatsappGerente: num });
    setEditandoWpp(false);
  };

  const enviarWhatsApp = (conteudo, nomeLoja, dataHoje) => {
    const numero = whatsappGerente.replace(/\D/g, "");
    if (!numero) { setEditandoWpp(true); setWppInput(""); return; }
    const texto = `📊 *RELATÓRIO DO DIA — ${nomeLoja}*\n_${dataHoje}_\n\n${conteudo}`;
    const url = `https://wa.me/${numero.startsWith("55") ? numero : "55" + numero}?text=${encodeURIComponent(texto)}`;
    window.open(url, "_blank");
  };

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, carregando]);

  const enviar = async () => {
    const msg = texto.trim();
    if (!msg || carregando) return;
    setTexto("");
    const novasMsgs = [...msgs, { role: "user", content: msg }];
    setMsgs(novasMsgs);
    setCarregando(true);
    try {
      const historico = novasMsgs.slice(0, -1).slice(-20).map(m => ({ role: m.role, content: m.content }));
      const res = await chamarGerenteRef.current({ tenantId, lojaId: lojaDocId, mensagem: msg, historico });
      const resposta = res.data?.resposta || "Não consegui processar sua pergunta.";
      const gerarPdf = res.data?.gerarPdf || false;
      const dadosPdf = res.data?.dadosPdf || null;
      setMsgs(prev => [...prev, { role: "assistant", content: resposta, gerarPdf, dadosPdf }]);
    } catch (e) {
      setMsgs(prev => [...prev, { role: "assistant", content: "❌ Erro ao consultar o Gerente IA. Tente novamente." }]);
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const sugestoes = ["Como foi o dia hoje?", "Produto mais vendido?", "Tem estoque baixo?", "Avaliações pendentes?", "Compare com ontem", "Resumo do dia em PDF"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", maxHeight: 700, background: "var(--bg)", borderRadius: 16, overflow: "hidden", border: "1px solid var(--border)" }}>
      <div style={{ padding: "14px 16px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>🤖</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: "#fff", fontSize: "0.95rem" }}>Gerente IA</div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.75)" }}>Dados em tempo real da sua loja</div>
        </div>
        {/* WhatsApp do gerente */}
        {editandoWpp ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              autoFocus
              value={wppInput}
              onChange={e => setWppInput(e.target.value)}
              placeholder="55119XXXXXXXX"
              style={{ width: 148, padding: "5px 8px", borderRadius: 8, border: "none", fontSize: "0.78rem", fontFamily: "'Outfit', sans-serif", outline: "none" }}
            />
            <button onClick={salvarWpp} style={{ padding: "5px 10px", background: "#4ade80", border: "none", borderRadius: 8, fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}>Salvar</button>
            <button onClick={() => setEditandoWpp(false)} style={{ padding: "5px 8px", background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 8, color: "#fff", fontSize: "0.75rem", cursor: "pointer" }}>✕</button>
          </div>
        ) : (
          <button
            onClick={() => { setEditandoWpp(true); setWppInput(whatsappGerente); }}
            title={whatsappGerente ? `WhatsApp: ${whatsappGerente}` : "Cadastrar WhatsApp para receber relatórios"}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: whatsappGerente ? "rgba(74,222,128,0.25)" : "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 20, color: "#fff", fontSize: "0.72rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}
          >
            📱 {whatsappGerente ? "WhatsApp ✓" : "Cadastrar WhatsApp"}
          </button>
        )}
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80", flexShrink: 0 }} />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            {m.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", marginRight: 8, flexShrink: 0, alignSelf: "flex-end" }}>🤖</div>
            )}
            <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ padding: "10px 14px", borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", background: m.role === "user" ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "var(--bg2)", color: m.role === "user" ? "#fff" : "var(--text)", fontSize: "0.83rem", lineHeight: 1.55, border: m.role === "assistant" ? "1px solid var(--border)" : "none", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {m.content}
              </div>
              {m.gerarPdf && m.dadosPdf && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => gerarPdfRelatorio(m.dadosPdf)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", boxShadow: "0 2px 8px rgba(124,58,237,0.35)" }}
                  >
                    📥 Baixar PDF
                  </button>
                  <button
                    onClick={() => enviarWhatsApp(m.dadosPdf.conteudo, m.dadosPdf.nomeLoja, m.dadosPdf.dataHoje)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 20, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", boxShadow: "0 2px 8px rgba(22,163,74,0.35)" }}
                  >
                    📱 Enviar WhatsApp
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {carregando && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>🤖</div>
            <div style={{ padding: "10px 16px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "18px 18px 18px 4px", display: "flex", gap: 5, alignItems: "center" }}>
              {[0,1,2].map(j => <div key={j} style={{ width: 7, height: 7, borderRadius: "50%", background: "#7c3aed", opacity: 0.7, animation: "bounce 1.2s infinite", animationDelay: `${j*0.2}s` }} />)}
            </div>
          </div>
        )}
        <div ref={fimRef} />
      </div>

      {msgs.length <= 2 && (
        <div style={{ padding: "0 14px 10px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          {sugestoes.map(s => (
            <button key={s} onClick={() => { setTexto(s); setTimeout(() => inputRef.current?.focus(), 50); }}
              style={{ padding: "5px 10px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, fontSize: "0.73rem", color: "var(--text2)", cursor: "pointer", fontFamily: "'Outfit', sans-serif" }}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", display: "flex", gap: 8, alignItems: "flex-end" }}>
        <textarea ref={inputRef} value={texto} onChange={e => setTexto(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
          placeholder="Pergunte sobre vendas, estoque, clientes..." rows={1}
          style={{ flex: 1, resize: "none", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", outline: "none", maxHeight: 100, overflowY: "auto" }} />
        <button onClick={enviar} disabled={!texto.trim() || carregando}
          style={{ width: 40, height: 40, borderRadius: "50%", background: texto.trim() && !carregando ? "linear-gradient(135deg, #7c3aed, #6d28d9)" : "var(--bg3)", border: "none", cursor: texto.trim() && !carregando ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", flexShrink: 0, transition: "all 0.2s" }}>
          ➤
        </button>
      </div>
    </div>
  );
}

// ===== DÍVIDAS A PAGAR =====
function TabDividas() {
  const { tenantId } = useStore();
  const { showToast } = useToast();
  const [dividas, setDividas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | "nova" | {id, ...dados}
  const [pagModal, setPagModal] = useState(null); // {id, valorTotal, valorPago}

  // Form nova dívida
  const [form, setForm] = useState({ descricao: "", fornecedor: "", dataCompra: "", dataVencimento: "", valorTotal: "", categoria: "", obs: "" });

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, `tenants/${tenantId}/dividas`), orderBy("dataVencimento", "asc"));
    const unsub = onSnapshot(q, snap => {
      setDividas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [tenantId]);

  const salvarDivida = async () => {
    if (!form.descricao.trim() || !form.valorTotal) return;
    const dados = {
      descricao: form.descricao.trim(),
      fornecedor: form.fornecedor.trim(),
      dataCompra: form.dataCompra || null,
      dataVencimento: form.dataVencimento || null,
      valorTotal: parseFloat(form.valorTotal) || 0,
      valorPago: modal?.valorPago || 0,
      status: modal?.status || "aberta",
      categoria: form.categoria.trim(),
      obs: form.obs.trim(),
      createdAt: modal?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      if (modal?.id) {
        await updateDoc(doc(db, `tenants/${tenantId}/dividas`, modal.id), dados);
        showToast("Dívida atualizada!", "success");
      } else {
        await addDoc(collection(db, `tenants/${tenantId}/dividas`), dados);
        showToast("Dívida cadastrada!", "success");
      }
      setModal(null);
      setForm({ descricao: "", fornecedor: "", dataCompra: "", dataVencimento: "", valorTotal: "", categoria: "", obs: "" });
    } catch { showToast("Erro ao salvar", "error"); }
  };

  const registrarPagamento = async () => {
    if (!pagModal) return;
    const { id, valorTotal, valorPagoAtual, adicional } = pagModal;
    const novoValorPago = (valorPagoAtual || 0) + (parseFloat(adicional) || 0);
    const novoStatus = novoValorPago >= valorTotal ? "paga" : novoValorPago > 0 ? "parcial" : "aberta";
    try {
      await updateDoc(doc(db, `tenants/${tenantId}/dividas`, id), {
        valorPago: novoValorPago,
        status: novoStatus,
        updatedAt: serverTimestamp(),
      });
      showToast(novoStatus === "paga" ? "Dívida quitada! ✅" : "Pagamento registrado!", "success");
      setPagModal(null);
    } catch { showToast("Erro ao registrar pagamento", "error"); }
  };

  const marcarPaga = async (id) => {
    const d = dividas.find(x => x.id === id);
    if (!d) return;
    await updateDoc(doc(db, `tenants/${tenantId}/dividas`, id), {
      valorPago: d.valorTotal,
      status: "paga",
      updatedAt: serverTimestamp(),
    });
    showToast("Dívida quitada! ✅", "success");
  };

  const excluir = async (id) => {
    if (!window.confirm("Excluir esta dívida?")) return;
    await deleteDoc(doc(db, `tenants/${tenantId}/dividas`, id));
    showToast("Dívida removida", "success");
  };

  const abrirEditar = (d) => {
    setForm({
      descricao: d.descricao || "",
      fornecedor: d.fornecedor || "",
      dataCompra: d.dataCompra || "",
      dataVencimento: d.dataVencimento || "",
      valorTotal: d.valorTotal?.toString() || "",
      categoria: d.categoria || "",
      obs: d.obs || "",
    });
    setModal(d);
  };

  const fmtR = (v) => `R$\u00a0${(v || 0).toFixed(2).replace(".", ",")}`;
  const fmtData = (s) => {
    if (!s) return "—";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  };

  const totalDevido  = dividas.filter(d => d.status !== "paga").reduce((s, d) => s + ((d.valorTotal || 0) - (d.valorPago || 0)), 0);
  const totalPago    = dividas.reduce((s, d) => s + (d.valorPago || 0), 0);
  const totalGeral   = dividas.reduce((s, d) => s + (d.valorTotal || 0), 0);
  const vencidas     = dividas.filter(d => {
    if (!d.dataVencimento || d.status === "paga") return false;
    return new Date(d.dataVencimento) < new Date();
  });

  const statusColor  = { aberta: "#ef4444", parcial: "#f59e0b", paga: "#22c55e" };
  const statusLabel  = { aberta: "Aberta", parcial: "Parcial", paga: "Paga" };

  const inputStyle = { width: "100%", padding: "9px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text)", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" };
  const labelStyle = { fontSize: "0.72rem", color: "var(--text3)", marginBottom: 4, display: "block" };

  return (
    <div style={{ padding: "0 0 60px" }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 18 }}>
        {[
          { label: "Total a pagar", value: fmtR(totalDevido), color: "#ef4444" },
          { label: "Já pago", value: fmtR(totalPago), color: "#22c55e" },
          { label: "Vencidas", value: vencidas.length, color: vencidas.length > 0 ? "#ef4444" : "#64748b" },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: k.color }}>{k.value}</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 2 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {vencidas.length > 0 && (
        <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: "0.83rem", color: "#ef4444" }}>
          ⚠️ {vencidas.length} dívida{vencidas.length > 1 ? "s" : ""} vencida{vencidas.length > 1 ? "s" : ""}
        </div>
      )}

      <button
        onClick={() => { setForm({ descricao: "", fornecedor: "", dataCompra: "", dataVencimento: "", valorTotal: "", categoria: "", obs: "" }); setModal("nova"); }}
        style={{ width: "100%", padding: "11px 0", background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", marginBottom: 16, fontFamily: "'Outfit',sans-serif" }}
      >
        + Cadastrar Dívida
      </button>

      {loading ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}><div className="spinner" /></div>
      ) : dividas.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>📑</div>
          <div style={{ fontSize: "0.85rem" }}>Nenhuma dívida cadastrada</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {dividas.map(d => {
            const saldo = (d.valorTotal || 0) - (d.valorPago || 0);
            const vencida = d.dataVencimento && d.status !== "paga" && new Date(d.dataVencimento) < new Date();
            return (
              <div key={d.id} style={{ background: "var(--bg2)", border: `1px solid ${vencida ? "rgba(239,68,68,0.4)" : "var(--border)"}`, borderRadius: 14, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.92rem", color: "var(--text1)" }}>{d.descricao}</div>
                    {d.fornecedor && <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>🏢 {d.fornecedor}</div>}
                    {d.categoria && <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>🏷️ {d.categoria}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: statusColor[d.status] || "#64748b", background: `${statusColor[d.status]}18`, padding: "3px 8px", borderRadius: 20 }}>
                      {statusLabel[d.status] || d.status}
                    </span>
                    {vencida && <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#ef4444" }}>VENCIDA</span>}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>Total</div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text1)" }}>{fmtR(d.valorTotal)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>Pago</div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#22c55e" }}>{fmtR(d.valorPago)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>Saldo</div>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: saldo > 0 ? "#ef4444" : "#22c55e" }}>{fmtR(saldo)}</div>
                  </div>
                </div>

                {(d.dataCompra || d.dataVencimento) && (
                  <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                    {d.dataCompra && <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>📅 Compra: {fmtData(d.dataCompra)}</div>}
                    {d.dataVencimento && <div style={{ fontSize: "0.72rem", color: vencida ? "#ef4444" : "var(--text3)", fontWeight: vencida ? 700 : 400 }}>⏰ Vence: {fmtData(d.dataVencimento)}</div>}
                  </div>
                )}

                {d.obs && <div style={{ fontSize: "0.76rem", color: "var(--text3)", fontStyle: "italic", marginBottom: 10 }}>"{d.obs}"</div>}

                {/* Progress bar */}
                {d.valorTotal > 0 && (
                  <div style={{ height: 4, background: "var(--border)", borderRadius: 4, marginBottom: 12, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(100, ((d.valorPago || 0) / d.valorTotal) * 100)}%`, background: d.status === "paga" ? "#22c55e" : "#f59e0b", borderRadius: 4, transition: "width 0.4s" }} />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {d.status !== "paga" && (
                    <>
                      <button
                        onClick={() => setPagModal({ id: d.id, valorTotal: d.valorTotal, valorPagoAtual: d.valorPago || 0, adicional: "" })}
                        style={{ padding: "6px 12px", background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.4)", borderRadius: 8, color: "#f59e0b", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}
                      >
                        💰 Registrar Pagamento
                      </button>
                      <button
                        onClick={() => marcarPaga(d.id)}
                        style={{ padding: "6px 12px", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", borderRadius: 8, color: "#22c55e", fontSize: "0.75rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}
                      >
                        ✅ Quitar
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => abrirEditar(d)}
                    style={{ padding: "6px 12px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text2)", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}
                  >
                    ✏️ Editar
                  </button>
                  <button
                    onClick={() => excluir(d.id)}
                    style={{ padding: "6px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, color: "#ef4444", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal nova/editar dívida */}
      {(modal === "nova" || modal?.id) && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "flex-end" }} onClick={e => { if (e.target === e.currentTarget) setModal(null); }}>
          <div style={{ background: "var(--bg2)", borderRadius: "20px 20px 0 0", padding: "20px 18px 32px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text1)", marginBottom: 18 }}>
              {modal?.id ? "✏️ Editar Dívida" : "📑 Nova Dívida"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Descrição *</label>
                <input style={inputStyle} value={form.descricao} onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Compra de insumos acaí" />
              </div>
              <div>
                <label style={labelStyle}>Fornecedor</label>
                <input style={inputStyle} value={form.fornecedor} onChange={e => setForm(p => ({ ...p, fornecedor: e.target.value }))} placeholder="Nome do fornecedor" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Data da compra</label>
                  <input type="date" style={inputStyle} value={form.dataCompra} onChange={e => setForm(p => ({ ...p, dataCompra: e.target.value }))} />
                </div>
                <div>
                  <label style={labelStyle}>Data de vencimento</label>
                  <input type="date" style={inputStyle} value={form.dataVencimento} onChange={e => setForm(p => ({ ...p, dataVencimento: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={labelStyle}>Valor total (R$) *</label>
                <input type="number" step="0.01" min="0" style={inputStyle} value={form.valorTotal} onChange={e => setForm(p => ({ ...p, valorTotal: e.target.value }))} placeholder="0,00" />
              </div>
              <div>
                <label style={labelStyle}>Categoria</label>
                <input style={inputStyle} value={form.categoria} onChange={e => setForm(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Insumos, Aluguel, Equipamento..." />
              </div>
              <div>
                <label style={labelStyle}>Observações</label>
                <textarea style={{ ...inputStyle, resize: "none" }} rows={2} value={form.obs} onChange={e => setForm(p => ({ ...p, obs: e.target.value }))} placeholder="Notas adicionais..." />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => setModal(null)} style={{ flex: 1, padding: "11px 0", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text2)", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>Cancelar</button>
              <button onClick={salvarDivida} style={{ flex: 2, padding: "11px 0", background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>
                {modal?.id ? "Salvar alterações" : "Cadastrar dívida"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal pagamento parcial */}
      {pagModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 18px" }} onClick={e => { if (e.target === e.currentTarget) setPagModal(null); }}>
          <div style={{ background: "var(--bg2)", borderRadius: 16, padding: "20px 18px", width: "100%", maxWidth: 360 }}>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text1)", marginBottom: 14 }}>💰 Registrar Pagamento</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.82rem", color: "var(--text2)" }}>
              <span>Valor total: <b>{fmtR(pagModal.valorTotal)}</b></span>
              <span>Já pago: <b style={{ color: "#22c55e" }}>{fmtR(pagModal.valorPagoAtual)}</b></span>
            </div>
            <div style={{ marginBottom: 4, fontSize: "0.72rem", color: "var(--text3)" }}>Valor pago agora (R$)</div>
            <input
              autoFocus
              type="number" step="0.01" min="0"
              style={inputStyle}
              value={pagModal.adicional}
              onChange={e => setPagModal(p => ({ ...p, adicional: e.target.value }))}
              placeholder="0,00"
            />
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setPagModal(null)} style={{ flex: 1, padding: "10px 0", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 10, color: "var(--text2)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>Cancelar</button>
              <button onClick={registrarPagamento} style={{ flex: 2, padding: "10px 0", background: "linear-gradient(135deg, #16a34a, #15803d)", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Outfit',sans-serif" }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🎨 TAB APARÊNCIA — Personalização visual da loja
// ═══════════════════════════════════════════════════════════════

/** Retorna true se a cor hex for escura (luminância < 0.35) */
const hexEscuro = (hex) => {
  try {
    const h = hex.replace("#","");
    const r = parseInt(h.slice(0,2),16)/255;
    const g = parseInt(h.slice(2,4),16)/255;
    const b = parseInt(h.slice(4,6),16)/255;
    // relative luminance (simplified)
    return (0.299*r + 0.587*g + 0.114*b) < 0.45;
  } catch { return true; }
};

/** Preview completo — mockup de celular com as cores do visual */
function PreviewLojaModal({ visual, onClose }) {
  const bannerBg = visual.bannerGradiente
    ? `linear-gradient(${visual.bannerDirecao}, ${visual.bannerCorA}, ${visual.bannerCorB})`
    : visual.bannerCorA;
  const isClaro = visual.temaBase === "light" || visual.temaBase === "white";
  const bgPuro   = visual.temaBase === "white" ? "#ffffff" : isClaro ? "#f8f8f8" : visual.corFundo;
  const bg2      = visual.temaBase === "white" ? "#f4f4f4" : isClaro ? "#eeeeee" : "rgba(255,255,255,.06)";
  const textoPrincipal   = isClaro ? "#111111" : "#f0e9ff";
  const textoMudo        = isClaro ? "#888888" : "#7a6a9a";
  const borderColor      = isClaro ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.08)";
  const topbarBg = visual.topbarBg || (isClaro ? "rgba(255,255,255,0.98)" : "rgba(15,5,24,0.95)");
  const navBg    = visual.navBg    || (isClaro ? "rgba(255,255,255,0.98)" : "rgba(19,8,42,0.97)");
  const navTexto = visual.navTexto || textoMudo;
  const btnTextColor = hexEscuro(visual.corPrimaria) ? "#ffffff" : "#111111";
  const radius = visual.bordaArredondada ? 16 : 8;

  return (
    <div onClick={onClose} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.88)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ position:"relative", width:"100%", maxWidth:360 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
          <span style={{ color:"rgba(255,255,255,.55)", fontSize:"0.72rem" }}>Preview — como o cliente verá a loja</span>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(255,255,255,.7)", fontSize:"1.4rem", cursor:"pointer", lineHeight:1 }}>✕</button>
        </div>

        {/* Phone frame */}
        <div style={{ borderRadius:32, overflow:"hidden", border:"3px solid rgba(255,255,255,.14)", boxShadow:"0 32px 80px rgba(0,0,0,.7)", background:bgPuro, fontFamily:`'${visual.fonte}',sans-serif` }}>

          {/* Topbar */}
          <div style={{ background:topbarBg, padding:"11px 16px", display:"flex", alignItems:"center", justifyContent:"space-between", borderBottom:`1px solid ${borderColor}` }}>
            <span style={{ fontWeight:800, fontSize:"0.85rem", color:visual.corPrimaria }}>🍇 Minha Loja</span>
            <div style={{ display:"flex", gap:14, fontSize:"0.85rem" }}>
              <span style={{ color:textoMudo }}>🔔</span>
              <span style={{ color:textoMudo }}>👤</span>
            </div>
          </div>

          {/* Banner */}
          <div style={{ background:bannerBg, padding:"20px 16px 18px", display:"flex", flexDirection:"column", alignItems:"center" }}>
            <div style={{ width:56, height:56, borderRadius:"50%", background:"rgba(255,255,255,.15)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.8rem", border:`3px solid ${visual.corPrimaria}80`, marginBottom:8 }}>🍇</div>
            <div style={{ fontWeight:800, fontSize:"1rem", color:"#ffffff", marginBottom:3 }}>Minha Loja</div>
            <div style={{ fontSize:"0.68rem", color:"rgba(255,255,255,.7)" }}>⏰ Aberto · ⭐ 4.9 · 🛵 20–35 min</div>
          </div>

          {/* Categories */}
          <div style={{ padding:"10px 12px 4px", display:"flex", gap:7, overflowX:"auto", background:bgPuro, scrollbarWidth:"none" }}>
            {["Todos","Açaí","Frutas","Adicionais","Bebidas"].map((cat,i) => (
              <div key={cat} style={{ flexShrink:0, padding:"5px 13px", borderRadius:20, background: i===0 ? visual.corPrimaria : bg2, color: i===0 ? btnTextColor : textoMudo, fontSize:"0.7rem", fontWeight:600, border:`1px solid ${i===0?"transparent":borderColor}` }}>{cat}</div>
            ))}
          </div>

          {/* Products */}
          <div style={{ padding:"8px 12px 10px", background:bgPuro }}>
            {[
              { nome:"Açaí 500ml",  preco:"R$ 18,00", emoji:"🍇", desc:"Com granola e banana" },
              { nome:"Smoothie Mix",preco:"R$ 22,00", emoji:"🥤", desc:"Vitamina especial da casa" },
            ].map(prod => (
              <div key={prod.nome} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:bg2, border:`1px solid ${borderColor}`, borderRadius:radius, padding:"10px 12px", marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, flex:1, minWidth:0 }}>
                  <div style={{ width:44, height:44, borderRadius:visual.bordaArredondada?12:6, background:visual.corHeader, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.5rem", flexShrink:0 }}>{prod.emoji}</div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:"0.82rem", color:textoPrincipal, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{prod.nome}</div>
                    <div style={{ fontSize:"0.68rem", color:textoMudo, marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{prod.desc}</div>
                    <div style={{ fontSize:"0.8rem", color:visual.corPrimaria, fontWeight:800, marginTop:3 }}>{prod.preco}</div>
                  </div>
                </div>
                <div style={{ width:30, height:30, borderRadius:visual.bordaArredondada?10:5, background:visual.corPrimaria, display:"flex", alignItems:"center", justifyContent:"center", color:btnTextColor, fontWeight:900, fontSize:"1.2rem", flexShrink:0, marginLeft:8 }}>+</div>
              </div>
            ))}
          </div>

          {/* Promo banner */}
          <div style={{ margin:"0 12px 10px", padding:"10px 14px", background:`${visual.corAcento}22`, border:`1px solid ${visual.corAcento}44`, borderRadius:radius }}>
            <span style={{ fontSize:"0.72rem", color:visual.corAcento, fontWeight:700 }}>🎉 Novidade — Açaí Especial chegou!</span>
          </div>

          {/* Bottom nav */}
          <div style={{ background:navBg, borderTop:`1px solid ${borderColor}`, padding:"8px 0 14px", display:"grid", gridTemplateColumns:"repeat(5,1fr)" }}>
            {[{icon:"🍇",label:"Cardápio"},{icon:"🛒",label:"Carrinho"},{icon:"⭐",label:"Pontos"},{icon:"📋",label:"Pedidos"},{icon:"👤",label:"Conta"}].map((item,i) => (
              <div key={item.label} style={{ textAlign:"center" }}>
                <div style={{ fontSize:"1.1rem" }}>{item.icon}</div>
                <div style={{ fontSize:"0.52rem", fontWeight: i===0?700:500, color: i===0 ? visual.corPrimaria : navTexto, marginTop:2 }}>{item.label}</div>
                {i === 0 && <div style={{ width:16, height:2, background:visual.corPrimaria, borderRadius:2, margin:"3px auto 0" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const VISUAL_PADRAO_ADMIN = {
  corPrimaria: "#a855f7", corAcento: "#7c3aed",
  corHeader: "#1a0a36", corFundo: "#080412",
  bannerGradiente: true, bannerCorA: "#1a0a36", bannerCorB: "#2d1060",
  bannerDirecao: "135deg", fonte: "Outfit", bordaArredondada: true,
  temaBase: "dark",
};

const PRESETS = [
  // ── TEMAS ESCUROS ──────────────────────────────────────────────
  { grupo: "🌑 Escuro",
    temas: [
      { nome: "✨ Original NexFoody", temaBase:"dark", corPrimaria:"#a855f7", corAcento:"#7c3aed", corHeader:"#1a0a36", corFundo:"#080412", bannerCorA:"#1a0a36", bannerCorB:"#2d1060", _nexfoody: true, _original: true },
      { nome: "🍇 Açaí Dark",     temaBase:"dark",  corPrimaria:"#a855f7", corAcento:"#7c3aed", corHeader:"#1a0a36", corFundo:"#080412", bannerCorA:"#1a0a36", bannerCorB:"#2d1060" },
      { nome: "🍕 Pizza Fire",    temaBase:"dark",  corPrimaria:"#f97316", corAcento:"#dc2626", corHeader:"#1c0a00", corFundo:"#0f0500", bannerCorA:"#1c0a00", bannerCorB:"#7f1d1d" },
      { nome: "🌿 Saudável Dark", temaBase:"dark",  corPrimaria:"#22c55e", corAcento:"#16a34a", corHeader:"#052e16", corFundo:"#020d07", bannerCorA:"#052e16", bannerCorB:"#065f46" },
      { nome: "🍣 Sushi Zen",     temaBase:"dark",  corPrimaria:"#e11d48", corAcento:"#be123c", corHeader:"#0f0a0a", corFundo:"#080404", bannerCorA:"#0f0a0a", bannerCorB:"#1a0505" },
      { nome: "🧁 Candy Rosa",    temaBase:"dark",  corPrimaria:"#ec4899", corAcento:"#db2777", corHeader:"#1a0714", corFundo:"#0f0308", bannerCorA:"#1a0714", bannerCorB:"#4a044e" },
      { nome: "☕ Café Dark",     temaBase:"dark",  corPrimaria:"#d97706", corAcento:"#b45309", corHeader:"#1c1002", corFundo:"#0f0800", bannerCorA:"#1c1002", bannerCorB:"#451a03" },
      { nome: "🌊 Oceano Dark",   temaBase:"dark",  corPrimaria:"#0ea5e9", corAcento:"#0284c7", corHeader:"#0c1a2e", corFundo:"#060d18", bannerCorA:"#0c1a2e", bannerCorB:"#1e3a5f" },
      { nome: "🖤 Preto Total",   temaBase:"dark",  corPrimaria:"#ffffff", corAcento:"#aaaaaa", corHeader:"#000000", corFundo:"#000000", bannerCorA:"#000000", bannerCorB:"#111111" },
      { nome: "⚡ Neon Amarelo",  temaBase:"dark",  corPrimaria:"#eab308", corAcento:"#ca8a04", corHeader:"#1a1500", corFundo:"#0a0900", bannerCorA:"#1a1500", bannerCorB:"#1c1400" },
    ]
  },
  // ── TEMAS CLAROS (estilo iFood / Rappi) ───────────────────────
  { grupo: "☀️ Claro",
    temas: [
      { nome: "☁️ Clean Branco",  temaBase:"white", corPrimaria:"#111111", corAcento:"#333333", corHeader:"#ffffff", corFundo:"#ffffff", bannerCorA:"#ffffff", bannerCorB:"#f0f0f0", bannerGradiente:false },
      { nome: "🔴 iFood",         temaBase:"white", corPrimaria:"#ea1d2c", corAcento:"#c41020", corHeader:"#ea1d2c", corFundo:"#ffffff", bannerCorA:"#ea1d2c", bannerCorB:"#c41020" },
      { nome: "🟠 Rappi",         temaBase:"white", corPrimaria:"#ff441f", corAcento:"#e03010", corHeader:"#ff441f", corFundo:"#ffffff", bannerCorA:"#ff441f", bannerCorB:"#e03010" },
      { nome: "🟡 McDonald's",    temaBase:"white", corPrimaria:"#ffbc0d", corAcento:"#da291c", corHeader:"#da291c", corFundo:"#ffffff", bannerCorA:"#da291c", bannerCorB:"#b71c1c" },
      { nome: "🟢 Delivery Much", temaBase:"white", corPrimaria:"#00a652", corAcento:"#007a3d", corHeader:"#00a652", corFundo:"#ffffff", bannerCorA:"#00a652", bannerCorB:"#007a3d" },
      { nome: "🟣 Loggi",         temaBase:"white", corPrimaria:"#5d2d91", corAcento:"#4a2075", corHeader:"#5d2d91", corFundo:"#ffffff", bannerCorA:"#5d2d91", bannerCorB:"#3d1a60" },
      { nome: "🩷 Rosa Premium",  temaBase:"light", corPrimaria:"#ec4899", corAcento:"#db2777", corHeader:"#fdf2f8", corFundo:"#fdf2f8", bannerCorA:"#ec4899", bannerCorB:"#db2777" },
      { nome: "💙 Azul Clean",    temaBase:"light", corPrimaria:"#2563eb", corAcento:"#1d4ed8", corHeader:"#eff6ff", corFundo:"#f8faff", bannerCorA:"#2563eb", bannerCorB:"#1d4ed8" },
      { nome: "🍊 Laranja Fresh", temaBase:"light", corPrimaria:"#ea580c", corAcento:"#c2410c", corHeader:"#fff7ed", corFundo:"#fff7ed", bannerCorA:"#ea580c", bannerCorB:"#c2410c" },
      { nome: "🌿 Verde Fresco",  temaBase:"light", corPrimaria:"#16a34a", corAcento:"#15803d", corHeader:"#f0fdf4", corFundo:"#f0fdf4", bannerCorA:"#16a34a", bannerCorB:"#15803d" },
    ]
  },
];

// ===== EQUIPE — gerenciamento de funcionarios =====
function TabEquipe() {
  const { tenantId, userData } = useStore();
  const { criarFuncionario } = useAuth();
  const toast = useToast();
  const [funcionarios, setFuncionarios] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search
  const [busca, setBusca] = useState("");

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [pin, setPin] = useState("");
  const [mostrarPin, setMostrarPin] = useState(false);
  const [papel, setPapel] = useState("atendente");
  const [criando, setCriando] = useState(false);

  // Edit modal
  const [editUid, setEditUid] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editTelefone, setEditTelefone] = useState("");
  const [editPapel, setEditPapel] = useState("");

  // Reset PIN modal
  const [resetUid, setResetUid] = useState(null);
  const [resetPin, setResetPin] = useState("");
  const [mostrarResetPin, setMostrarResetPin] = useState(false);
  const [resetando, setResetando] = useState(false);

  // Delete confirmation
  const [delUid, setDelUid] = useState(null);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, "users"), where("tenantId", "==", tenantId), where("role", "==", "funcionario"));
    const unsub = onSnapshot(q, snap => {
      setFuncionarios(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [tenantId]);

  const PAPIS_DISPONIVEIS = [
    { value: "atendente", label: "Atendente" },
    { value: "caixa", label: "Caixa" },
    { value: "cozinha", label: "Cozinha" },
    { value: "gerencia", label: "Gerência" },
  ];

  const gerarPin = () => {
    const p = String(Math.floor(1000 + Math.random() * 9000));
    setPin(p);
  };

  const formatarTelefone = (t) => {
    const d = (t || "").replace(/\D/g, "");
    if (d.length >= 11) return `(${d.slice(-11,-9)}) ${d.slice(-9,-4)}-${d.slice(-4)}`;
    if (d.length >= 7) return `${d.slice(-7,-4)}-${d.slice(-4)}`;
    return t;
  };

  const ultimoAcesso = (func) => {
    if (!func.lastLogin) return "—";
    const d = func.lastLogin.toDate ? func.lastLogin.toDate() : new Date(func.lastLogin);
    const diff = Date.now() - d.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min}min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  };

  const funcionariosAtivos = funcionarios.filter(f => !f.bloqueado);
  const funcionariosBloqueados = funcionarios.filter(f => f.bloqueado);
  const listaFiltrada = funcionarios.filter(f => {
    if (!busca) return true;
    const b = busca.toLowerCase();
    return (f.nome || "").toLowerCase().includes(b) || (f.telefone || "").includes(b);
  });

  const handleCriar = async (e) => {
    e?.preventDefault();
    if (!nome || !telefone || !pin) return;
    if (!/^\d{4}$/.test(pin)) { toast("PIN precisa ter 4 números."); return; }
    setCriando(true);
    try {
      if (!tenantId) { toast("Erro: loja não identificada."); setCriando(false); return; }
      const result = await criarFuncionario(nome, telefone, telefone, tenantId, papel, userData?.uid || "", pin);
      toast(result.jaExistia ? "✅ Atualizado!" : "✅ Funcionário criado!");
      const clean = telefone.replace(/\D/g, "");
      const msg = encodeURIComponent(`Seu acesso:\nWhatsApp: ${telefone}\nPIN: ${pin}\n\nAcesse: nexfoody.com/lojista/funcionario/${tenantId}`);
      setTimeout(() => window.open(`https://wa.me/55${clean}?text=${msg}`, "_blank"), 500);
      setNome(""); setTelefone(""); setPin(""); setShowCreate(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Erro criar func:", msg);
      toast("⚠️ " + msg);
    } finally {
      setCriando(false);
    }
  };

  const handleResetPin = async () => {
    if (!resetUid || !resetPin || !/^\d{4}$/.test(resetPin)) return;
    setResetando(true);
    try {
      const func = funcionarios.find(f => f.uid === resetUid);
      await updateDoc(doc(db, "users", resetUid), { pinHash: resetPin });
      if (func?.telefone) {
        const clean = func.telefone.replace(/\D/g, "");
        const msg = encodeURIComponent(`Seu PIN foi alterado!\nNovo PIN: ${resetPin}`);
        setTimeout(() => window.open(`https://wa.me/55${clean}?text=${msg}`, "_blank"), 300);
      }
      toast("✅ PIN alterado!");
      setResetUid(null); setResetPin("");
    } catch {
      toast("Erro ao resetar PIN.");
    } finally {
      setResetando(false);
    }
  };

  const handleBloquear = async (uid, bloqueado) => {
    try {
      await updateDoc(doc(db, "users", uid), { bloqueado });
      toast(bloqueado ? "🔒 Funcionário bloqueado" : "🔓 Funcionário desbloqueado");
    } catch {
      toast("Erro ao atualizar status.");
    }
  };

  const handleExcluir = async (uid) => {
    try {
      await deleteDoc(doc(db, "users", uid));
      toast("🗑️ Removido!");
      setDelUid(null);
    } catch {
      toast("Erro ao remover.");
    }
  };

  const handleEnviarAcesso = (func) => {
    if (!func?.telefone) return;
    const clean = func.telefone.replace(/\D/g, "");
    const msg = encodeURIComponent(`Olá ${func.nome}!\n\nSeu acesso:\nWhatsApp: ${func.telefone}\nPIN: ${func.pinHash || "XXXX"}\n\nAcesse: nexfoody.com/lojista/funcionario/${tenantId}`);
    window.open(`https://wa.me/55${clean}?text=${msg}`, "_blank");
  };

  return (
    <div style={{ padding: "0 0 40px 0" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: "1.2rem" }}>👤</span>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 900, color: "var(--purple2)", margin: 0 }}>
            FUNCIONÁRIOS
          </h2>
        </div>
        <p style={{ fontSize: "0.8rem", color: "var(--text3)", margin: 0 }}>
          Gerencie acessos à operação
        </p>
      </div>

      {/* Search + New button bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.9rem" }}>🔍</span>
          <input
            className="input"
            placeholder="Buscar por nome ou WhatsApp..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            style={{ paddingLeft: 36, width: "100%", boxSizing: "border-box" }}
          />
        </div>
        <button
          onClick={() => setShowCreate(true)}
          style={{
            background: "linear-gradient(135deg, #14b8a6, #0d9488)",
            border: "none", borderRadius: 12, padding: "10px 18px",
            color: "#fff", fontFamily: "'Outfit', sans-serif",
            fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
          }}>
          + Novo Funcionário
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.25)", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "#14b8a6" }}>{funcionariosAtivos.length}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>Ativos</div>
        </div>
        <div style={{ flex: 1, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--red)" }}>{funcionariosBloqueados.length}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>Bloqueados</div>
        </div>
        <div style={{ flex: 1, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", textAlign: "center" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--text)" }}>{funcionarios.length}</div>
          <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>Total</div>
        </div>
      </div>

      {/* Table header */}
      {listaFiltrada.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 1fr 100px",
          gap: 8, padding: "8px 14px",
          fontSize: "0.68rem", fontWeight: 700, color: "var(--text3)",
          textTransform: "uppercase", letterSpacing: "0.05em",
        }}>
          <div>Nome</div>
          <div>WhatsApp</div>
          <div>Função</div>
          <div style={{ textAlign: "center" }}>Status</div>
          <div>Último acesso</div>
          <div style={{ textAlign: "center" }}>Ações</div>
        </div>
      )}

      {/* Table rows */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text3)" }}>Carregando...</div>
      ) : listaFiltrada.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "40px 0", color: "var(--text3)",
          background: "var(--bg2)", borderRadius: 14, border: "1px solid var(--border)",
        }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>👥</div>
          <p style={{ fontSize: "0.9rem" }}>{busca ? "Nenhum resultado encontrado." : "Nenhum funcionário ainda."}</p>
          {!busca && <p style={{ fontSize: "0.78rem", marginTop: 4 }}>Clique em "+ Novo Funcionário" para criar o primeiro.</p>}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {listaFiltrada.map(func => (
            <div key={func.uid} style={{
              background: "var(--bg2)", border: `1px solid ${func.bloqueado ? "rgba(239,68,68,0.2)" : "var(--border)"}`,
              borderRadius: 12, padding: "12px 14px",
              display: "grid", gridTemplateColumns: "2fr 1.5fr 1fr 0.8fr 1fr 100px",
              gap: 8, alignItems: "center",
              opacity: func.bloqueado ? 0.65 : 1,
            }}>
              {/* Nome */}
              <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {func.nome}
              </div>
              {/* WhatsApp */}
              <div style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
                {formatarTelefone(func.telefone)}
              </div>
              {/* Função */}
              <div>
                <span style={{
                  background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.25)",
                  borderRadius: 20, padding: "2px 8px",
                  fontSize: "0.65rem", fontWeight: 700, color: "#14b8a6",
                }}>
                  {PAPIS_DISPONIVEIS.find(p => p.value === func.papel)?.label || func.papel}
                </span>
              </div>
              {/* Status */}
              <div style={{ textAlign: "center" }}>
                <span style={{
                  background: func.bloqueado ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                  border: `1px solid ${func.bloqueado ? "rgba(239,68,68,0.3)" : "rgba(34,197,94,0.3)"}`,
                  borderRadius: 20, padding: "2px 8px",
                  fontSize: "0.65rem", fontWeight: 700,
                  color: func.bloqueado ? "var(--red)" : "#22c55e",
                }}>
                  {func.bloqueado ? "🔴 Bloq" : "🟢 Ativo"}
                </span>
              </div>
              {/* Último acesso */}
              <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
                {ultimoAcesso(func)}
              </div>
              {/* Ações */}
              <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "nowrap" }}>
                <button onClick={() => { setEditUid(func.uid); setEditNome(func.nome || ""); setEditTelefone(func.telefone || ""); setEditPapel(func.papel || "atendente"); }}
                  title="Editar" style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", borderRadius: 7, padding: "4px 6px", color: "#6366f1", fontSize: "0.75rem", cursor: "pointer" }}>✏️</button>
                <button onClick={() => { setResetUid(func.uid); setResetPin(""); }}
                  title="Resetar PIN" style={{ background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 7, padding: "4px 6px", color: "var(--gold)", fontSize: "0.75rem", cursor: "pointer" }}>🔑</button>
                <button onClick={() => handleBloquear(func.uid, !func.bloqueado)}
                  title={func.bloqueado ? "Desbloquear" : "Bloquear"}
                  style={{ background: func.bloqueado ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)", border: `1px solid ${func.bloqueado ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 7, padding: "4px 6px", color: func.bloqueado ? "#22c55e" : "var(--red)", fontSize: "0.75rem", cursor: "pointer" }}>
                  {func.bloqueado ? "🔓" : "🔒"}
                </button>
                <button onClick={() => handleEnviarAcesso(func)}
                  title="Enviar acesso via WhatsApp"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 7, padding: "4px 6px", color: "#22c55e", fontSize: "0.75rem", cursor: "pointer" }}>📲</button>
                <button onClick={() => setDelUid(func.uid)}
                  title="Remover"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 7, padding: "4px 6px", color: "var(--red)", fontSize: "0.75rem", cursor: "pointer" }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── MODAL: Novo funcionário ─── */}
      {showCreate && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={e => { if (e.target === e.currentTarget) setShowCreate(false); }}>
          <div style={{
            background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 18,
            padding: "24px", width: 400, maxHeight: "90vh", overflowY: "auto",
          }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 900, color: "var(--purple2)", marginBottom: 20 }}>
              ➕ Novo Funcionário
            </h3>
            <form onSubmit={handleCriar} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>👤 Nome completo</label>
                <input className="input" placeholder="João da Silva" value={nome} onChange={e => setNome(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>📱 WhatsApp</label>
                <input className="input" type="tel" placeholder="(11) 99999-9999" value={telefone} onChange={e => setTelefone(e.target.value)} required />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>🔢 PIN (4 dígitos)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <div style={{ flex: 1, position: "relative" }}>
                    <input
                      className="input" type={mostrarPin ? "text" : "password"} inputMode="numeric" pattern="[0-9]*"
                      placeholder="••••" maxLength={4} value={pin}
                      onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
                      required style={{ fontSize: "1.4rem", letterSpacing: "0.4em", textAlign: "center" }}
                    />
                    <button type="button" onClick={() => setMostrarPin(v => !v)}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>
                      {mostrarPin ? "👁️" : "👁️‍🗨️"}
                    </button>
                  </div>
                  <button type="button" onClick={gerarPin}
                    style={{ padding: "8px 12px", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 10, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                    Gerar PIN
                  </button>
                </div>
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>🧩 Função</label>
                <select className="input" value={papel} onChange={e => setPapel(e.target.value)} style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {PAPIS_DISPONIVEIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <p style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 10 }}>
                  📲 Os dados de acesso serão enviados automaticamente via WhatsApp do funcionário.
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" onClick={() => setShowCreate(false)}
                  style={{ flex: 1, padding: "10px 0", border: "1px solid var(--border)", borderRadius: 12, background: "var(--bg2)", color: "var(--text2)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button type="submit" disabled={criando}
                  style={{ flex: 1, padding: "10px 0", border: "none", borderRadius: 12, background: "linear-gradient(135deg, #14b8a6, #0d9488)", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer", opacity: criando ? 0.5 : 1 }}>
                  {criando ? "Criando..." : "💾 Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: Editar ─── */}
      {editUid && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={e => { if (e.target === e.currentTarget) setEditUid(null); }}>
          <div style={{
            background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 18,
            padding: "24px", width: 360,
          }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "1rem", fontWeight: 900, color: "var(--purple2)", marginBottom: 16 }}>
              ✏️ Editar {editNome}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: "0.68rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>Nome</label>
                <input className="input" value={editNome} onChange={e => setEditNome(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: "0.68rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>WhatsApp</label>
                <input className="input" type="tel" value={editTelefone} onChange={e => setEditTelefone(e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: "0.68rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>Função</label>
                <select className="input" value={editPapel} onChange={e => setEditPapel(e.target.value)} style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {PAPIS_DISPONIVEIS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
              <button onClick={() => setEditUid(null)}
                style={{ flex: 1, padding: "9px 0", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg2)", color: "var(--text2)", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", cursor: "pointer" }}>
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await updateDoc(doc(db, "users", editUid), { nome: editNome, telefone: editTelefone, papel: editPapel });
                  toast("✅ Atualizado!");
                  setEditUid(null);
                }}
                style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Resetar PIN ─── */}
      {resetUid && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={e => { if (e.target === e.currentTarget) { setResetUid(null); setResetPin(""); } }}>
          <div style={{
            background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 18,
            padding: "24px", width: 340,
          }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "1rem", fontWeight: 900, color: "var(--purple2)", marginBottom: 16 }}>
              🔑 Resetar PIN
            </h3>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: "0.72rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>Novo PIN (4 dígitos)</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ flex: 1, position: "relative" }}>
                  <input className="input" type={mostrarResetPin ? "text" : "password"} inputMode="numeric" pattern="[0-9]*"
                    placeholder="••••" maxLength={4} value={resetPin}
                    onChange={e => setResetPin(e.target.value.replace(/\D/g, ""))}
                    style={{ fontSize: "1.4rem", letterSpacing: "0.4em", textAlign: "center" }} />
                  <button type="button" onClick={() => setMostrarResetPin(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "0.85rem" }}>
                    {mostrarResetPin ? "👁️" : "👁️‍🗨️"}
                  </button>
                </div>
                <button type="button" onClick={() => setResetPin(String(Math.floor(1000 + Math.random() * 9000)))}
                  style={{ padding: "8px 12px", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 10, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>
                  Gerar
                </button>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <button
                onClick={() => {
                  if (!resetPin || !/^\d{4}$/.test(resetPin)) { toast("PIN precisa de 4 números."); return; }
                  const func = funcionarios.find(f => f.uid === resetUid);
                  if (func?.telefone) {
                    const clean = func.telefone.replace(/\D/g, "");
                    const msg = encodeURIComponent(`Seu PIN foi alterado!\nNovo PIN: ${resetPin}`);
                    window.open(`https://wa.me/55${clean}?text=${msg}`, "_blank");
                  }
                }}
                style={{ width: "100%", padding: "8px 0", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", borderRadius: 10, color: "#22c55e", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                📲 Enviar via WhatsApp
              </button>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setResetUid(null); setResetPin(""); }}
                style={{ flex: 1, padding: "9px 0", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg2)", color: "var(--text2)", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={handleResetPin} disabled={resetando}
                style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 10, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", opacity: resetando ? 0.5 : 1 }}>
                {resetando ? "Salvando..." : "✅ Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: Confirmar exclusão ─── */}
      {delUid && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.7)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={e => { if (e.target === e.currentTarget) setDelUid(null); }}>
          <div style={{
            background: "var(--bg)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 18,
            padding: "24px", width: 320,
          }}>
            <h3 style={{ fontFamily: "'Fraunces', serif", fontSize: "1rem", fontWeight: 900, color: "var(--red)", marginBottom: 10 }}>
              🗑️ Remover funcionário
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 20 }}>
              Tem certeza? Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDelUid(null)}
                style={{ flex: 1, padding: "9px 0", border: "1px solid var(--border)", borderRadius: 10, background: "var(--bg2)", color: "var(--text2)", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={() => handleExcluir(delUid)}
                style={{ flex: 1, padding: "9px 0", border: "none", borderRadius: 10, background: "var(--red)", color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                🗑️ Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TabAparencia() {
  const { config, salvarConfig, tenantId } = useStore();
  const toast = useToast();
  const [visual, setVisual] = React.useState({ ...VISUAL_PADRAO_ADMIN, ...(config.visual || {}) });
  const [salvando, setSalvando] = React.useState(false);
  const [savedOk, setSavedOk] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(false);

  // Aplica preview em tempo real — espelha exatamente o ThemeManager do App.tsx
  React.useEffect(() => {
    const html = document.documentElement;
    const v = visual;
    const temaBase = v.temaBase || "dark";

    html.setAttribute("data-tema", temaBase === "dark" ? "dark" : "light");

    const bannerBg = v.bannerGradiente
      ? `linear-gradient(${v.bannerDirecao}, ${v.bannerCorA}, ${v.bannerCorB})`
      : v.bannerCorA;

    const isClaro = temaBase === "light" || temaBase === "white";
    const bgPuro  = temaBase === "white" ? "#ffffff" : isClaro ? "#f8f8f8" : v.corFundo;
    const textoSecundario = isClaro ? "#444444" : "#b09fd0";
    const textoMudo       = isClaro ? "#888888" : "#7a6a9a";

    if (isClaro) {
      html.style.setProperty("--bg",      bgPuro);
      html.style.setProperty("--bg2",     temaBase === "white" ? "#f4f4f4" : "#eeeeee");
      html.style.setProperty("--bg3",     temaBase === "white" ? "#e8e8e8" : "#dddddd");
      html.style.setProperty("--text",    "#111111");
      html.style.setProperty("--text2",   textoSecundario);
      html.style.setProperty("--text3",   textoMudo);
      html.style.setProperty("--border",  "rgba(0,0,0,0.1)");
      html.style.setProperty("--border2", "rgba(0,0,0,0.18)");
      html.style.setProperty("--gold",    v.corPrimaria);
    } else {
      ["--bg","--bg2","--bg3","--text","--text2","--text3","--border","--border2","--gold"]
        .forEach(k => html.style.removeProperty(k));
    }

    // Loja vars
    const bannerTexto = hexEscuro(v.bannerCorA) ? "#ffffff" : "#111111";
    const btnTexto    = hexEscuro(v.corPrimaria)  ? "#ffffff" : "#111111";
    html.style.setProperty("--loja-cor-primaria",  v.corPrimaria);
    html.style.setProperty("--loja-cor-acento",    v.corAcento);
    html.style.setProperty("--loja-header-bg",     v.corHeader);
    html.style.setProperty("--loja-fundo",         bgPuro);
    html.style.setProperty("--loja-banner-bg",     bannerBg);
    html.style.setProperty("--loja-banner-texto",  bannerTexto);
    html.style.setProperty("--loja-btn-texto",     btnTexto);
    html.style.setProperty("--loja-fonte",         `'${v.fonte}', sans-serif`);
    html.style.setProperty("--loja-radius",        v.bordaArredondada ? "16px" : "8px");

    // Topbar
    html.style.setProperty("--loja-topbar-bg",     v.topbarBg || (isClaro ? "rgba(255,255,255,0.97)" : "rgba(15,5,24,0.92)"));
    html.style.setProperty("--loja-topbar-border", isClaro ? "rgba(0,0,0,0.1)" : "rgba(138,92,246,0.18)");
    html.style.setProperty("--loja-topbar-texto",  v.topbarTexto || v.corPrimaria);

    // Nav
    html.style.setProperty("--loja-nav-bg",     v.navBg     || (isClaro ? "rgba(255,255,255,0.97)" : "rgba(19,8,42,0.96)"));
    html.style.setProperty("--loja-nav-border", v.navBorder || (isClaro ? "rgba(0,0,0,0.1)" : "rgba(138,92,246,0.18)"));
    html.style.setProperty("--loja-nav-texto",  v.navTexto  || textoMudo);
    html.style.setProperty("--loja-nav-ativo",  v.corPrimaria);

    return () => {
      html.removeAttribute("data-tema");
      ["--bg","--bg2","--bg3","--text","--text2","--text3","--border","--border2","--gold",
       "--loja-cor-primaria","--loja-cor-acento","--loja-header-bg","--loja-fundo",
       "--loja-banner-bg","--loja-banner-texto","--loja-btn-texto","--loja-fonte","--loja-radius",
       "--loja-topbar-bg","--loja-topbar-border","--loja-topbar-texto",
       "--loja-nav-bg","--loja-nav-border","--loja-nav-texto","--loja-nav-ativo",
      ].forEach(k => html.style.removeProperty(k));
    };
  }, [visual]);

  // Aplica o preset inteiro — respeita bannerGradiente e outros valores específicos do tema
  const aplicarPreset = (p) => setVisual({
    ...VISUAL_PADRAO_ADMIN,
    ...p,
    fonte:            p.fonte            ?? "Outfit",
    bordaArredondada: p.bordaArredondada ?? true,
    bannerGradiente:  p.bannerGradiente  ?? true,
    bannerDirecao:    p.bannerDirecao    ?? "135deg",
  });

  const salvar = async () => {
    setSalvando(true);
    try {
      await salvarConfig({ visual });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
      toast("🎨 Aparência salva!");
    } catch { toast("Erro ao salvar.", "error"); }
    finally { setSalvando(false); }
  };

  // Cores adaptativas da UI do painel conforme o tema selecionado
  const isClaro = visual.temaBase === "light" || visual.temaBase === "white";
  const ui = {
    label:     isClaro ? "rgba(0,0,0,.72)"  : "rgba(255,255,255,.7)",
    hint:      isClaro ? "rgba(0,0,0,.42)"  : "rgba(255,255,255,.4)",
    rowBorder: isClaro ? "rgba(0,0,0,.07)"  : "rgba(255,255,255,.05)",
    pickerBdr: isClaro ? "rgba(0,0,0,.25)"  : "rgba(255,255,255,.2)",
    selectBg:  isClaro ? "#e5e7eb"          : "var(--bg3)",
    selectClr: isClaro ? "#111111"          : "#ffffff",
    grpLabel:  isClaro ? "rgba(0,0,0,.38)"  : "rgba(255,255,255,.38)",
  };

  const row = (label, key) => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${ui.rowBorder}` }}>
      <span style={{ fontSize: "0.85rem", color: ui.label }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 28, height: 28, borderRadius: 8, background: visual[key], border: `2px solid ${ui.pickerBdr}`, overflow: "hidden", flexShrink: 0 }}>
          <input type="color" value={visual[key]} onChange={e => setVisual(p => ({ ...p, [key]: e.target.value }))}
            style={{ width: "200%", height: "200%", transform: "translate(-25%,-25%)", border: "none", cursor: "pointer", background: "none" }} />
        </div>
        <span style={{ fontSize: "0.72rem", color: ui.hint, fontFamily: "monospace" }}>{visual[key]}</span>
      </div>
    </div>
  );

  return (
    <div style={{ paddingBottom: 40 }}>
      {showPreview && <PreviewLojaModal visual={visual} onClose={() => setShowPreview(false)} />}
      {/* Presets */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 12 }}>⚡ Temas prontos</div>
        {PRESETS.map(group => (
          <div key={group.grupo} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.68rem", color: ui.grpLabel, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{group.grupo}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {group.temas.map((p, i) => {
                const bgA = p.bannerCorA || "#1a0a36";
                const bgB = p.bannerCorB || bgA;
                const btnEscuro = hexEscuro(bgA) && hexEscuro(bgB);
                const txtColor = btnEscuro ? "#ffffff" : (hexEscuro(p.corPrimaria) ? p.corPrimaria : "#111111");
                const isNexfoody = !!p._nexfoody;
                return (
                  <button key={i} onClick={() => aplicarPreset(p)}
                    style={{ padding: "10px 12px", background: isNexfoody ? "linear-gradient(135deg,#1a0a36,#0f0518)" : `linear-gradient(135deg, ${bgA}, ${bgB})`, border: isNexfoody ? "2px solid #f5c518" : `2px solid ${p.corPrimaria}55`, borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.8rem", color: isNexfoody ? "#f5c518" : txtColor, textShadow: btnEscuro ? "none" : "0 1px 3px rgba(0,0,0,.25)", boxShadow: isNexfoody ? "0 0 12px rgba(245,197,24,.2)" : "none" }}>
                    {p.nome}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button onClick={() => aplicarPreset(VISUAL_PADRAO_ADMIN)}
          style={{ width: "100%", marginTop: 10, padding: "11px", background: "var(--bg2)", border: "1.5px solid var(--border)", borderRadius: 12, color: "var(--gold)", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.82rem", cursor: "pointer", letterSpacing: ".01em" }}>
          🏠 Voltar ao padrão NexFoody
        </button>
      </div>

      {/* Cores */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 4 }}>🎨 Cores</div>
        <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 12 }}>Clique na bolinha colorida para trocar</div>
        {row("Cor primária (botões, destaques)", "corPrimaria")}
        {row("Cor de acento (bordas, links)", "corAcento")}
        {row("Cor do cabeçalho", "corHeader")}
        {row("Cor do fundo geral", "corFundo")}
      </div>

      {/* Banner */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 12 }}>🖼️ Banner / Capa</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: "0.85rem", color: ui.label }}>Usar gradiente</span>
          <div onClick={() => setVisual(p => ({ ...p, bannerGradiente: !p.bannerGradiente }))} style={{ cursor: "pointer" }}>
            <div className={`toggle-switch ${visual.bannerGradiente ? "on" : ""}`} />
          </div>
        </div>
        {row("Cor inicial do banner", "bannerCorA")}
        {visual.bannerGradiente && (
          <>
            {row("Cor final do banner", "bannerCorB")}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}>
              <span style={{ fontSize: "0.85rem", color: ui.label }}>Direção</span>
              <select value={visual.bannerDirecao} onChange={e => setVisual(p => ({ ...p, bannerDirecao: e.target.value }))}
                style={{ background: ui.selectBg, border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", color: ui.selectClr, fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem", cursor: "pointer" }}>
                {["90deg","135deg","160deg","180deg","225deg"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </>
        )}
        {/* Preview do banner */}
        <div style={{ marginTop: 12, height: 60, borderRadius: 12, background: visual.bannerGradiente ? `linear-gradient(${visual.bannerDirecao}, ${visual.bannerCorA}, ${visual.bannerCorB})` : visual.bannerCorA, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: "0.75rem", color: hexEscuro(visual.bannerCorA) ? "rgba(255,255,255,.6)" : "rgba(0,0,0,.5)", fontWeight: 600 }}>Preview do banner</span>
        </div>
      </div>

      {/* Fonte e bordas */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: "0.9rem", marginBottom: 12 }}>✏️ Tipografia & Estilo</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: "0.85rem", color: ui.label }}>Fonte da loja</span>
          <select value={visual.fonte} onChange={e => setVisual(p => ({ ...p, fonte: e.target.value }))}
            style={{ background: ui.selectBg, border: "1px solid var(--border)", borderRadius: 8, padding: "5px 10px", color: ui.selectClr, fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem", cursor: "pointer" }}>
            {["Outfit","Fraunces","Inter","Poppins"].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "0.85rem", color: ui.label }}>Bordas arredondadas</div>
            <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 2 }}>Cards e botões com cantos mais suaves</div>
          </div>
          <div onClick={() => setVisual(p => ({ ...p, bordaArredondada: !p.bordaArredondada }))} style={{ cursor: "pointer" }}>
            <div className={`toggle-switch ${visual.bordaArredondada ? "on" : ""}`} />
          </div>
        </div>
      </div>

      {/* Preview + Salvar */}
      <button onClick={() => setShowPreview(true)}
        style={{ width:"100%", padding:"14px", background:"rgba(124,58,237,.12)", border:"1.5px solid rgba(124,58,237,.4)", borderRadius:14, fontFamily:"'Outfit',sans-serif", fontWeight:700, fontSize:"0.95rem", color:"#a78bfa", cursor:"pointer", marginBottom:10 }}>
        👁 Ver preview da loja
      </button>
      <button onClick={salvar} disabled={salvando}
        style={{ width: "100%", padding: "16px", background: savedOk ? "rgba(34,197,94,.25)" : "linear-gradient(135deg,#7c3aed,#5b21b6)", border: savedOk ? "1px solid rgba(34,197,94,.5)" : "none", borderRadius: 14, fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: "1rem", color: savedOk ? "#4ade80" : "#fff", cursor: salvando ? "default" : "pointer", boxShadow: "0 8px 24px rgba(124,58,237,.3)" }}>
        {salvando ? "⏳ Salvando..." : savedOk ? "✅ Aparência salva!" : "💾 Salvar aparência"}
      </button>
    </div>
  );
}

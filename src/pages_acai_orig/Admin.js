// src/pages/Admin.js
import React, { useEffect, useState, useRef, useCallback } from "react";
import { doc, collection, getDocs, updateDoc, increment, query, orderBy, onSnapshot, limit, setDoc, deleteDoc, serverTimestamp, where, addDoc, Timestamp, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useStore } from "../contexts/StoreContext";
import { useToast } from "../components/Toast";
import StoreLocationPicker from "../components/StoreLocationPicker";

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
];

const STATUS_LIST = [
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
  const setSilenciado = useCallback((val) => { silenciadoRef.current = val; }, []);
  return { tocarNovoPedido, setSilenciado };
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
  const orderedMenus = menuOrder.map(id => dashboardMenus.find(m => m.id === id));

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

// ===== ADMIN PRINCIPAL =====
export default function Admin() {
  const { config, salvarConfig } = useStore();
  const [tab, setTab] = useState(() => {
    try {
      const saved = localStorage.getItem("admin_tab");
      if (saved !== null) return parseInt(saved);
    } catch {}
    return -1;
  });
  const [novoPedidoBadge, setNovoPedidoBadge] = useState(0);
  const [editarCards, setEditarCards] = useState(false);
  const dashboardMenus = config?.adminDashboardMenus || DASHBOARD_MENUS;
  const [menuOrder, setMenuOrder] = useState(() => {
    const saved = localStorage.getItem("admin_dashboard_order");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 16) return parsed;
      } catch {}
    }
    return config?.adminDashboardOrder || dashboardMenus.map(m => m.id);
  });

  // Listen for cross-component reorder events
  useEffect(() => {
    const handler = (e) => setMenuOrder(e.detail);
    window.addEventListener("dashboard-reorder", handler);
    return () => window.removeEventListener("dashboard-reorder", handler);
  }, []);

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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h2 className="display-title mb-0">Painel <span>Admin</span></h2>
        <button onClick={() => setEditarCards(true)} style={{ padding: "8px 16px", background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: 10, color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.82rem", cursor: "pointer" }}>✏️ Editar Cards</button>
      </div>
      <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.3)} }`}</style>

      {tab === -1 ? (
        <DashboardGrid
          menuOrder={menuOrder}
          dashboardMenus={dashboardMenus}
          activeTab={-1}
          onSelectMenu={handleSelectMenu}
        />
      ) : (
        <>
          <button className="dash-back-btn" onClick={handleBackToDashboard}>
            ← Dashboard
          </button>
          {tab === 0 && <TabPedidos onNovoPedido={() => setNovoPedidoBadge(n => n + 1)} />}
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
function TabPedidos({ onNovoPedido }) {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [atualizando, setAtualizando] = useState(null);
  const [silenciado, setSilenciadoState] = useState(false);
  const [impressaoAtiva, setImpressaoAtiva] = useState(true);
  const [ativado, setAtivado] = useState(false);
  const pedidosAnteriores = useRef(null);
  const { tocarNovoPedido, setSilenciado } = useSom();

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

  useEffect(() => {
    const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"), limit(50));
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
  }, [tocarNovoPedido]);

  useEffect(() => {
    if (Notification.permission === "default") Notification.requestPermission();
  }, []);

  // Atualiza status SEM abrir WhatsApp — Firebase Function cuida das notificações
  const atualizarStatus = async (pedidoId, novoStatus) => {
    ativarAudio();
    setAtualizando(pedidoId);
    try {
      await updateDoc(doc(db, "pedidos", pedidoId), { status: novoStatus });
    } catch { alert("Erro ao atualizar status."); }
    finally { setAtualizando(null); }
  };

  const pedidosFiltrados = filtro === "todos" ? pedidos : pedidos.filter(p => p.status === filtro);
  const contadores = STATUS_LIST.reduce((acc, s) => { acc[s.id] = pedidos.filter(p => p.status === s.id).length; return acc; }, {});

  if (loading) return <div style={{ textAlign: "center", padding: 40, color: "var(--text2)" }}>Carregando pedidos...</div>;

  return (
    <div onClick={ativarAudio}>
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
        </div>
      </div>

      {!ativado && (
        <div style={{ background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 12, fontSize: "0.78rem", color: "var(--gold)" }}>
          💡 Toque em qualquer lugar para ativar o som
        </div>
      )}

      <div style={{ background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.2)", borderRadius: "var(--radius-sm)", padding: "10px 14px", marginBottom: 14, fontSize: "0.78rem", color: "#25d366" }}>
        ✅ Notificações automáticas ativas — o cliente recebe WhatsApp ao mudar o status
      </div>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 16 }}>
        {[
          { id: "todos",    label: "Todos",      count: pedidos.length,      color: "var(--text)" },
          { id: "pendente", label: "Pendentes",  count: contadores.pendente, color: "var(--gold)" },
          { id: "preparo",  label: "Em preparo", count: contadores.preparo,  color: "var(--purple2)" },
          { id: "entrega",  label: "Em entrega", count: contadores.entrega,  color: "#f97316" },
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
      </div>

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
            background: "linear-gradient(135deg, var(--bg3), var(--bg2))",
            border: `1px solid ${p.status === "pendente" ? "rgba(245,197,24,0.3)" : aberto ? "var(--border2)" : "var(--border)"}`,
            borderRadius: "var(--radius)", marginBottom: 10, overflow: "hidden",
          }}>
            <div onClick={() => setExpandido(aberto ? null : p.id)} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ background: `${st.color}22`, color: st.color, borderRadius: 8, padding: "3px 8px", fontSize: "0.7rem", fontWeight: 700, flexShrink: 0, border: `1px solid ${st.color}44` }}>
                {st.icon} {st.label}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.nomeCliente}</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text2)" }}>
                  {formatarData(p.createdAt)} · {p.tipoEntrega === "entrega" ? "🛵 Delivery" : "🏠 Retirada"}
                  {!p.telefone && <span style={{ color: "var(--red)", marginLeft: 6 }}>⚠️ sem tel</span>}
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
                    <span>💳 {p.pagamento?.toUpperCase()}</span>
                    {p.telefone ? <span style={{ color: "var(--green)" }}>📱 {p.telefone}</span> : <span style={{ color: "var(--red)" }}>⚠️ Sem telefone</span>}
                  </div>
                  {p.tipoEntrega === "entrega" && p.endereco && <div style={{ marginTop: 6, color: "var(--text2)" }}>📍 {p.endereco}</div>}
                  {p.obs && <div style={{ marginTop: 6, color: "var(--text2)" }}>📝 {p.obs}</div>}
                  {p.motivoCancelamento && (
                    <div style={{ marginTop: 6, color: "var(--red)", fontWeight: 600 }}>❌ Cancelado: {p.motivoCancelamento}</div>
                  )}
                </div>

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
    </div>
  );
}

// ===== RELATÓRIOS =====
function TabRelatorios() {
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState("hoje");
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "pedidos"), orderBy("createdAt", "desc"), limit(500));
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
<title>Relatório — Açaí Puro Gosto</title>
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
    <h1>🫐 Açaí Puro Gosto</h1>
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

  <div class="footer">Açaí Puro Gosto · acaipurogosto.com.br · Relatório gerado automaticamente</div>
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
  const { produtos, salvarProduto, deletarProduto } = useStore();
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
                await setDoc(doc(db, "produtos", novoId), { ...dadosProduto, nome: p.nome + " (cópia)", ordemLista: (p.ordemLista || 0) + 0.5 });
                const gruposSnap = await getDocs(collection(db, `produtos/${p.id}/grupos_complementos`));
                for (const grupoDoc of gruposSnap.docs) {
                  const novoGrupoRef = await addDoc(collection(db, `produtos/${novoId}/grupos_complementos`), grupoDoc.data());
                  const itensSnap = await getDocs(collection(db, `produtos/${p.id}/grupos_complementos/${grupoDoc.id}/itens`));
                  for (const itemDoc of itensSnap.docs) {
                    await addDoc(collection(db, `produtos/${novoId}/grupos_complementos/${novoGrupoRef.id}/itens`), itemDoc.data());
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
      {editId && <TabComplementosAdmin produtoId={editId} produtoNome={form.nome} />}
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
<div className="section-label">🏆 Pontos de Ranking</div>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", padding: "14px", marginBottom: 16 }}>
        {[
          { key: "rankingPtsPedido", label: "🛒 Por pedido feito", placeholder: "10" },
          { key: "rankingPtsPorReal", label: "💰 Por R$1 gasto", placeholder: "1" },
          { key: "rankingPtsComentario", label: "💬 Por comentar", placeholder: "15" },
          { key: "rankingPtsCompartilhar", label: "🔗 Por compartilhar produto", placeholder: "10" },
          { key: "rankingPtsCurtirFeed", label: "❤️ Por curtir post", placeholder: "5" },
          { key: "rankingPtsCompartFeed", label: "↗️ Por compartilhar post", placeholder: "10" },
          { key: "rankingPtsPostarFoto", label: "📸 Por postar foto", placeholder: "20" },
        ].map(item => (
          <div key={item.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>{item.label}</span>
            <input type="number" min="0" className="form-input" style={{ width: 70, textAlign: "center" }} value={config[item.key] ?? item.placeholder} onChange={async e => { await salvarConfig({ [item.key]: parseInt(e.target.value) || 0 }); }} />
          </div>
        ))}
      </div>
      <div className="divider" />
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
        <div className="form-group"><label className="form-label">Nome</label><input className="form-input" value={config.premio3Nome || ""} onChange={e => salvarConfig({ premio3Nome: e.target.value })} placeholder="Ex: 10 Açaís grátis" /></div>
        <div className="form-group"><label className="form-label">Descrição</label><input className="form-input" value={config.premio3Desc || ""} onChange={e => salvarConfig({ premio3Desc: e.target.value })} placeholder="Ex: Válido por 30 dias" /></div>
        <div className="form-group"><label className="form-label">🖼️ Imagem</label><FotoUpload value={config.premio3Imagem || ""} onChange={v => salvarConfig({ premio3Imagem: v })} /></div>
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
        <button className="btn btn-gold btn-full" onClick={() => toast("✅ Prêmios salvos!")}>💾 Salvar prêmios</button>
<div className="form-group">
  <label className="form-label">📋 Regras da promoção</label>
  <textarea className="form-input" rows={6} value={config.premioRegras || ""} onChange={e => salvarConfig({ premioRegras: e.target.value })} placeholder="Ex: 1. Válido para clientes cadastrados&#10;2. Pontos acumulados no período&#10;3. Ganhador anunciado em 48h..." />
</div>
      </div>
      <div className="divider" />
      <div className="section-label">Recompensas ativas</div>
</div>
  );
}
// ===== AVALIAÇÕES PRIVADAS =====
function TabAvaliacoes() {
  const [avaliacoes, setAvaliacoes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [respModal, setRespModal] = useState(null); // { id, resposta }
  const toast = useToast();

  useEffect(() => {
    const q = query(collection(db, "avaliacoesPrivadas"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setAvaliacoes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, []);

  const responder = async () => {
    if (!respModal || !respModal.resposta.trim()) return;
    try {
      await updateDoc(doc(db, "avaliacoesPrivadas", respModal.id), {
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
        { k: "pixKey", label: "Chave PIX", ph: "86357425249" },
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
  const [categorias, setCategorias] = useState([]);
  useEffect(() => {
    const q = query(collection(db, "categorias"), orderBy("ordem", "asc"));
    const unsub = onSnapshot(q, snap => setCategorias(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return unsub;
  }, []);
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
  const { config } = useStore();
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
    const q = query(collection(db, "categorias"), orderBy("ordem", "asc"));
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
    await updateDoc(doc(db, "config", "loja"), dados);
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
        await updateDoc(doc(db, "categorias", editId), dados);
        toast("✅ Categoria atualizada!");
      } else {
        await setDoc(doc(db, "categorias", `cat_${Date.now()}`), {
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
    await updateDoc(doc(db, "categorias", cat.id), { ativa: !cat.ativa });
    toast(cat.ativa ? "Categoria ocultada." : "Categoria visível!");
  };

  const deletarCategoria = async (id) => {
    if (!window.confirm("Excluir esta categoria? Os produtos não serão excluídos.")) return;
    await deleteDoc(doc(db, "categorias", id));
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
      `🫐 *Olá, ${nome}!*\n\nSentimos sua falta! Faz ${dias} dias que você não pede no *Açaí Puro Gosto*. 😢\n\nNosso cardápio está fresquinho te esperando!\n\n👉 ${link}\n\nVolte logo! 🫐❤️`,
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
  const [entregadores, setEntregadores] = useState([]);
  const [pedidosEntrega, setPedidosEntrega] = useState([]);
  const [form, setForm] = useState({ nome: "", telefone: "" });
  const [salvando, setSalvando] = useState(false);
  const [atribuindo, setAtribuindo] = useState(null);

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
    <div class="nome">Açaí Puro Gosto</div>
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

function TabComplementosAdmin({ produtoId, produtoNome }) {
  const toast = useToast();
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
      query(collection(db, `produtos/${produtoId}/grupos_complementos`), orderBy("ordem", "asc")),
      snap => {
        const gs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        Promise.all(gs.map(async g => {
          const itensSnap = await getDocs(query(collection(db, `produtos/${produtoId}/grupos_complementos/${g.id}/itens`), orderBy("ordem", "asc")));
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
        await updateDoc(doc(db, `produtos/${produtoId}/grupos_complementos`, editandoGrupo), data);
        toast("✅ Grupo atualizado!");
      } else {
        await addDoc(collection(db, `produtos/${produtoId}/grupos_complementos`), data);
        toast("✅ Grupo criado!");
      }
      setFormGrupo({ nome: "", obrigatorio: true, min: 1, max: 1, precoBase: "" });
      setEditandoGrupo(null);
    } catch { toast("Erro.", "error"); }
    finally { setSalvando(false); }
  };

  const deletarGrupo = async (grupoId) => {
    if (!window.confirm("Remover grupo e todos os itens?")) return;
    await deleteDoc(doc(db, `produtos/${produtoId}/grupos_complementos`, grupoId));
    toast("Grupo removido.");
  };

  const duplicarGrupo = async (grupo) => {
    try {
      const novoRef = await addDoc(collection(db, `produtos/${produtoId}/grupos_complementos`), {
        nome: grupo.nome + " (cópia)", obrigatorio: grupo.obrigatorio,
        min: grupo.min, max: grupo.max, tipo: grupo.tipo || "radio", ordem: grupos.length + 1,
      });
      for (const item of grupo.itens || []) {
        await addDoc(collection(db, `produtos/${produtoId}/grupos_complementos/${novoRef.id}/itens`), {
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
      const itensRef = collection(db, `produtos/${produtoId}/grupos_complementos/${grupoId}/itens`);
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
    await deleteDoc(doc(db, `produtos/${produtoId}/grupos_complementos/${grupoId}/itens`, itemId));
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
              await updateDoc(doc(db, `produtos/${produtoId}/grupos_complementos`, fromId), { ordem: grupo.ordem });
              await updateDoc(doc(db, `produtos/${produtoId}/grupos_complementos`, grupo.id), { ordem: from.ordem });
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
                await addDoc(collection(db, `produtos/${produtoId}/grupos_complementos/${grupo.id}/itens`), {
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

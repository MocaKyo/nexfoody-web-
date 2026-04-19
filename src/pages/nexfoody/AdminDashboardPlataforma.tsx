// src/pages/nexfoody/AdminDashboardPlataforma.tsx
// Dashboard principal da plataforma — dados reais de pedidos
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, query, where, onSnapshot,
  orderBy, limit, Timestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from "recharts";

// ─── Tipos ───────────────────────────────────────────────────
interface Pedido {
  id: string;
  tenantId: string;
  lojaNome?: string;
  total: number;
  status: string;
  createdAt: { toDate: () => Date } | null;
}

interface LojaStats {
  tenantId: string;
  nome: string;
  ativo: boolean;
  categoria: string;
  pedidosHoje: number;
  pedidosMes: number;
  faturamentoMes: number;
  ticketMedio: number;
  ultimoPedido: Date | null;
  semVenda: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────
function inicioDia() {
  const d = new Date(); d.setHours(0,0,0,0); return d;
}
function inicioMes() {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d;
}
function inicioMesAnterior() {
  const d = new Date(); d.setMonth(d.getMonth()-1); d.setDate(1); d.setHours(0,0,0,0); return d;
}
function fimMesAnterior() {
  const d = new Date(); d.setDate(0); d.setHours(23,59,59,999); return d;
}
function fmt(v: number) { return `R$ ${v.toFixed(2).replace(".",",")}`; }
function pct(a: number, b: number) {
  if (!b) return null;
  const p = ((a - b) / b) * 100;
  return { val: Math.abs(p).toFixed(1), up: p >= 0 };
}
function diaSemana(d: Date) {
  return ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][d.getDay()];
}

// ─── Componentes de UI ───────────────────────────────────────
function StatCard({
  icon, titulo, valor, sub, variacao, cor, onClick,
}: {
  icon: string; titulo: string; valor: string | number;
  sub?: string; variacao?: { val: string; up: boolean } | null;
  cor: string; onClick?: () => void;
}) {
  return (
    <motion.div
      whileTap={{ scale: onClick ? 0.97 : 1 }}
      onClick={onClick}
      style={{
        background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 18, padding: "16px 14px", cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cor}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
          {icon}
        </div>
        {variacao && (
          <span style={{
            fontSize: "0.62rem", fontWeight: 800,
            color: variacao.up ? "#22c55e" : "#ef4444",
            background: variacao.up ? "rgba(34,197,94,.12)" : "rgba(239,68,68,.12)",
            padding: "3px 8px", borderRadius: 20,
          }}>
            {variacao.up ? "↑" : "↓"} {variacao.val}%
          </span>
        )}
      </div>
      <div style={{ fontWeight: 900, fontSize: "1.1rem", color: cor, lineHeight: 1.1, marginBottom: 3 }}>
        {valor}
      </div>
      <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {titulo}
      </div>
      {sub && <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.25)", marginTop: 3 }}>{sub}</div>}
    </motion.div>
  );
}

// ─── Tooltip customizado ──────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(15,7,32,.97)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.5)", marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: "0.82rem", fontWeight: 800, color: p.color }}>
          {p.name === "faturamento" ? fmt(p.value) : `${p.value} pedidos`}
        </div>
      ))}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────
export default function AdminDashboardPlataforma() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState<"hoje" | "7d" | "30d">("7d");
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [pedidosMesAnterior, setPedidosMesAnterior] = useState<Pedido[]>([]);
  const [lojas, setLojas] = useState<{ id: string; nome: string; ativo: boolean; categoria: string }[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [abaLojas, setAbaLojas] = useState<"ativas" | "semVenda" | "todas">("semVenda");

  // Carrega pedidos do período
  useEffect(() => {
    const inicio = periodo === "hoje" ? inicioDia() : periodo === "7d"
      ? new Date(Date.now() - 7*24*60*60*1000)
      : new Date(Date.now() - 30*24*60*60*1000);

    const q = query(
      collection(db, "pedidos"),
      where("createdAt", ">=", Timestamp.fromDate(inicio)),
      orderBy("createdAt", "desc"),
    );

    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pedido)));
      setCarregando(false);
    });

    return unsub;
  }, [periodo]);

  // Carrega pedidos do mês anterior (para comparação)
  useEffect(() => {
    const q = query(
      collection(db, "pedidos"),
      where("createdAt", ">=", Timestamp.fromDate(inicioMesAnterior())),
      where("createdAt", "<=", Timestamp.fromDate(fimMesAnterior())),
    );
    const unsub = onSnapshot(q, snap => {
      setPedidosMesAnterior(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pedido)));
    });
    return unsub;
  }, []);

  // Carrega lojas
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "lojas"), snap => {
      setLojas(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });
    return unsub;
  }, []);

  // ── Cálculos ──────────────────────────────────────────────
  const pedidosValidos = useMemo(() =>
    pedidos.filter(p => p.status !== "cancelado"), [pedidos]);

  const faturamento = useMemo(() =>
    pedidosValidos.reduce((a, p) => a + (p.total || 0), 0), [pedidosValidos]);

  const ticketMedio = useMemo(() =>
    pedidosValidos.length ? faturamento / pedidosValidos.length : 0, [faturamento, pedidosValidos]);

  const faturamentoMesAnterior = useMemo(() =>
    pedidosMesAnterior.filter(p => p.status !== "cancelado").reduce((a, p) => a + (p.total || 0), 0),
    [pedidosMesAnterior]);

  const variacaoFaturamento = periodo === "30d" ? pct(faturamento, faturamentoMesAnterior) : null;
  const variacaoPedidos = periodo === "30d" ? pct(pedidosValidos.length, pedidosMesAnterior.filter(p => p.status !== "cancelado").length) : null;

  // Stats por loja
  const statsLojas = useMemo<LojaStats[]>(() => {
    const hoje = inicioDia();
    const mesAtual = inicioMes();

    return lojas.map(loja => {
      const pedidosLoja = pedidosValidos.filter(p => p.tenantId === loja.id);
      const pedidosHoje = pedidos.filter(p => p.tenantId === loja.id && (p.createdAt?.toDate() ?? new Date(0)) >= hoje);
      const pedidosMes  = pedidos.filter(p => p.tenantId === loja.id && (p.createdAt?.toDate() ?? new Date(0)) >= mesAtual && p.status !== "cancelado");
      const faturamentoMes = pedidosMes.reduce((a, p) => a + (p.total || 0), 0);
      const datas = pedidosLoja.map(p => p.createdAt?.toDate()).filter(Boolean) as Date[];
      const ultimoPedido = datas.length ? new Date(Math.max(...datas.map(d => d.getTime()))) : null;

      return {
        tenantId: loja.id,
        nome: loja.nome,
        ativo: loja.ativo !== false,
        categoria: loja.categoria || "",
        pedidosHoje: pedidosHoje.length,
        pedidosMes: pedidosMes.length,
        faturamentoMes,
        ticketMedio: pedidosMes.length ? faturamentoMes / pedidosMes.length : 0,
        ultimoPedido,
        semVenda: pedidosHoje.length === 0 && loja.ativo !== false,
      };
    });
  }, [lojas, pedidos, pedidosValidos]);

  // Gráfico: pedidos e faturamento por dia
  const dadosGrafico = useMemo(() => {
    const dias = periodo === "hoje" ? 1 : periodo === "7d" ? 7 : 30;
    return Array.from({ length: dias }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (dias - 1 - i));
      d.setHours(0,0,0,0);
      const fim = new Date(d); fim.setHours(23,59,59,999);
      const doPeriodo = pedidosValidos.filter(p => {
        const dt = p.createdAt?.toDate();
        return dt && dt >= d && dt <= fim;
      });
      return {
        dia: dias === 1 ? `${d.getHours()}h` : dias <= 7 ? diaSemana(d) : `${d.getDate()}/${d.getMonth()+1}`,
        pedidos: doPeriodo.length,
        faturamento: doPeriodo.reduce((a, p) => a + (p.total || 0), 0),
      };
    });
  }, [pedidosValidos, periodo]);

  const lojasSemVenda = statsLojas.filter(l => l.semVenda && l.ativo);
  const lojasTop = [...statsLojas].sort((a, b) => b.faturamentoMes - a.faturamentoMes).slice(0, 5);
  const lojasFiltradas = abaLojas === "semVenda" ? lojasSemVenda
    : abaLojas === "ativas" ? statsLojas.filter(l => l.ativo && !l.semVenda)
    : statsLojas;

  const lojasAtivas = lojas.filter(l => l.ativo !== false).length;

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif", paddingBottom: 40 }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "48px 20px 24px", position: "relative" }}>
        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Plataforma NexFoody</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.6rem", color: "#fff" }}>📊 Dashboard</div>
        </div>

        {/* Seletor de período */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16 }}>
          {(["hoje","7d","30d"] as const).map(p => (
            <button key={p} onClick={() => setPeriodo(p)} style={{
              padding: "7px 16px", borderRadius: 20, border: "none", cursor: "pointer",
              fontFamily: "'Outfit',sans-serif", fontSize: "0.72rem", fontWeight: 700,
              background: periodo === p ? "rgba(245,197,24,.2)" : "rgba(255,255,255,.07)",
              color: periodo === p ? "#f5c518" : "rgba(255,255,255,.4)",
              transition: "all .2s",
            }}>
              {p === "hoje" ? "Hoje" : p === "7d" ? "7 dias" : "30 dias"}
            </button>
          ))}
        </div>
      </div>

      {/* ── ALERTA lojas sem venda ── */}
      {lojasSemVenda.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          onClick={() => setAbaLojas("semVenda")}
          style={{ margin: "12px 16px 0", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 14, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.1rem", animation: "pulse 2s infinite" }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#f59e0b" }}>
              {lojasSemVenda.length} loja{lojasSemVenda.length > 1 ? "s" : ""} sem venda hoje
            </div>
            <div style={{ fontSize: "0.65rem", color: "rgba(245,158,11,.6)", marginTop: 1 }}>Toque para ver quais</div>
          </div>
          <span style={{ color: "#f59e0b" }}>→</span>
        </motion.div>
      )}

      {/* ── CARDS DE STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "14px 16px 0" }}>
        {carregando ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px", height: 96 }} />
          ))
        ) : (
          <>
            <StatCard icon="💰" titulo="Faturamento" valor={fmt(faturamento)} cor="#f5c518"
              variacao={variacaoFaturamento}
              sub={variacaoFaturamento ? `vs mês anterior: ${fmt(faturamentoMesAnterior)}` : undefined} />
            <StatCard icon="📦" titulo="Pedidos" valor={pedidosValidos.length} cor="#a78bfa"
              variacao={variacaoPedidos} />
            <StatCard icon="🎯" titulo="Ticket médio" valor={fmt(ticketMedio)} cor="#22c55e" />
            <StatCard icon="🏪" titulo="Lojas ativas" valor={lojasAtivas}
              sub={`${lojas.length} cadastradas`} cor="#60a5fa"
              onClick={() => navigate("/admin/lojas")} />
            <StatCard icon="❌" titulo="Cancelados" valor={pedidos.filter(p => p.status === "cancelado").length}
              cor="#ef4444"
              sub={`${pedidos.length ? ((pedidos.filter(p => p.status === "cancelado").length / pedidos.length)*100).toFixed(1) : 0}% do total`} />
            <StatCard icon="⚠️" titulo="Sem venda hoje" valor={lojasSemVenda.length}
              cor="#f59e0b" onClick={() => setAbaLojas("semVenda")} />
          </>
        )}
      </div>

      {/* ── GRÁFICO ── */}
      {!carregando && dadosGrafico.length > 1 && (
        <div style={{ margin: "16px 16px 0", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,.35)" }}>
              Faturamento · {periodo === "hoje" ? "Hoje" : periodo === "7d" ? "Últimos 7 dias" : "Últimos 30 dias"}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={120}>
            <AreaChart data={dadosGrafico} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradFat" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f5c518" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f5c518" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "rgba(255,255,255,.3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,.3)" }} axisLine={false} tickLine={false} tickFormatter={v => `R$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="faturamento" name="faturamento" stroke="#f5c518" strokeWidth={2} fill="url(#gradFat)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>

          {/* Gráfico de pedidos */}
          <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,.35)", margin: "14px 0 10px" }}>
            Pedidos por dia
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={dadosGrafico} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="dia" tick={{ fontSize: 10, fill: "rgba(255,255,255,.3)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,.3)" }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="pedidos" name="pedidos" fill="#7c3aed" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── TOP LOJAS ── */}
      {!carregando && lojasTop.some(l => l.faturamentoMes > 0) && (
        <div style={{ margin: "16px 16px 0", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px" }}>
          <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,.35)", marginBottom: 12 }}>
            🏆 Top lojas · {periodo === "hoje" ? "Hoje" : periodo === "7d" ? "7 dias" : "30 dias"}
          </div>
          {lojasTop.filter(l => l.faturamentoMes > 0).map((loja, i) => {
            const max = lojasTop[0].faturamentoMes || 1;
            return (
              <div key={loja.tenantId} style={{ marginBottom: i < 4 ? 10 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: "0.75rem", color: i === 0 ? "#f5c518" : "rgba(255,255,255,.3)", fontWeight: 800 }}>#{i+1}</span>
                    <span style={{ fontSize: "0.82rem", color: "#fff", fontWeight: 600 }}>{loja.nome}</span>
                  </div>
                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#22c55e" }}>{fmt(loja.faturamentoMes)}</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(loja.faturamentoMes / max) * 100}%`, background: i === 0 ? "#f5c518" : "#7c3aed", borderRadius: 2, transition: "width 1s ease" }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── LISTA DE LOJAS ── */}
      <div style={{ margin: "16px 16px 0" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {([
            { id: "semVenda", label: `⚠️ Sem venda (${lojasSemVenda.length})` },
            { id: "ativas",   label: `🟢 Com venda` },
            { id: "todas",    label: `Todas (${statsLojas.length})` },
          ] as const).map(a => (
            <button key={a.id} onClick={() => setAbaLojas(a.id)} style={{
              padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", flexShrink: 0,
              fontFamily: "'Outfit',sans-serif", fontSize: "0.7rem", fontWeight: 700,
              background: abaLojas === a.id ? "rgba(245,197,24,.15)" : "rgba(255,255,255,.05)",
              color: abaLojas === a.id ? "#f5c518" : "rgba(255,255,255,.35)",
            }}>
              {a.label}
            </button>
          ))}
        </div>

        {lojasFiltradas.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,.25)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>✅</div>
            <div style={{ fontSize: "0.82rem" }}>
              {abaLojas === "semVenda" ? "Todas as lojas tiveram vendas hoje!" : "Nenhuma loja encontrada"}
            </div>
          </div>
        ) : lojasFiltradas.map(loja => {
          const diasSemVenda = loja.ultimoPedido
            ? Math.floor((Date.now() - loja.ultimoPedido.getTime()) / (1000*60*60*24))
            : null;

          return (
            <motion.div key={loja.tenantId} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{
                background: loja.semVenda ? "rgba(245,158,11,.05)" : "rgba(255,255,255,.03)",
                border: `1px solid ${loja.semVenda ? "rgba(245,158,11,.2)" : "rgba(255,255,255,.07)"}`,
                borderRadius: 16, padding: "14px", marginBottom: 8,
              }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#fff", marginBottom: 3 }}>{loja.nome}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)" }}>
                    {loja.categoria}
                    {diasSemVenda !== null && diasSemVenda > 0 && (
                      <span style={{ color: "#f59e0b", marginLeft: 6 }}>· sem venda há {diasSemVenda}d</span>
                    )}
                    {diasSemVenda === 0 && <span style={{ color: "#22c55e", marginLeft: 6 }}>· vendeu hoje</span>}
                    {diasSemVenda === null && <span style={{ color: "rgba(255,255,255,.25)", marginLeft: 6 }}>· sem histórico</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#22c55e" }}>{fmt(loja.faturamentoMes)}</div>
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.25)" }}>{loja.pedidosMes} pedidos</div>
                </div>
              </div>

              {/* Mini métricas */}
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[
                  { label: "Hoje", val: loja.pedidosHoje, cor: loja.pedidosHoje > 0 ? "#22c55e" : "#f59e0b" },
                  { label: "Mês", val: loja.pedidosMes, cor: "#60a5fa" },
                  { label: "Ticket", val: loja.ticketMedio > 0 ? `R$${loja.ticketMedio.toFixed(0)}` : "—", cor: "#a78bfa" },
                ].map((m, i) => (
                  <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.04)", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                    <div style={{ fontWeight: 800, fontSize: "0.82rem", color: m.cor }}>{m.val}</div>
                    <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,.25)", marginTop: 1 }}>{m.label}</div>
                  </div>
                ))}
              </div>

              {/* Ações rápidas */}
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => navigate(`/loja/${loja.tenantId}`)}
                  style={{ flex: 1, padding: "7px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,.6)", cursor: "pointer" }}>
                  Ver loja
                </button>
                <button onClick={() => navigate("/admin/lojas")}
                  style={{ flex: 1, padding: "7px", background: "rgba(167,139,250,.1)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 10, fontSize: "0.65rem", fontWeight: 700, color: "#a78bfa", cursor: "pointer" }}>
                  Gerenciar
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

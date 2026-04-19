// src/pages/nexfoody/AdminLojasAnalytics.tsx
// Analytics de crescimento das lojas na plataforma
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

interface Loja {
  id: string;
  nome: string;
  slug: string;
  categoria?: string;
  cidade?: string;
  estado?: string;
  ativo: boolean;
  createdAt?: { toDate: () => Date } | null;
}

const CORES = ["#a78bfa", "#22c55e", "#60a5fa", "#f59e0b", "#f472b6", "#34d399", "#fb923c", "#818cf8"];

function fmtDia(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function fmtMes(d: Date) {
  return d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function StatCard({ icon, label, value, sub, cor }: { icon: string; label: string; value: string | number; sub?: string; cor: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ flex: 1, minWidth: 0, background: "rgba(255,255,255,.03)", border: `1px solid ${cor}30`, borderRadius: 16, padding: "14px 12px" }}
    >
      <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>{icon}</div>
      <div style={{ fontWeight: 900, fontSize: "1.5rem", color: cor, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: "0.62rem", color: cor, marginTop: 3, opacity: 0.7 }}>{sub}</div>}
    </motion.div>
  );
}

export default function AdminLojasAnalytics() {
  const navigate = useNavigate();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [periodo, setPeriodo] = useState<"30d" | "90d" | "12m">("30d");

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "lojas"), snap => {
      setLojas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
      setCarregando(false);
    });
    return unsub;
  }, []);

  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);

  const inicioPeriodo = useMemo(() => {
    const d = new Date();
    if (periodo === "30d") d.setDate(d.getDate() - 29);
    else if (periodo === "90d") d.setDate(d.getDate() - 89);
    else d.setMonth(d.getMonth() - 11);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [periodo]);

  // Stats gerais
  const stats = useMemo(() => {
    const inicioDia = new Date(); inicioDia.setHours(0, 0, 0, 0);
    const inicioSemana = new Date(); inicioSemana.setDate(inicioSemana.getDate() - 6); inicioSemana.setHours(0, 0, 0, 0);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);

    const total = lojas.length;
    const ativas = lojas.filter(l => l.ativo !== false).length;
    const suspensas = lojas.filter(l => l.ativo === false).length;
    const hoje_ = lojas.filter(l => l.createdAt && l.createdAt.toDate() >= inicioDia).length;
    const semana = lojas.filter(l => l.createdAt && l.createdAt.toDate() >= inicioSemana).length;
    const mes = lojas.filter(l => l.createdAt && l.createdAt.toDate() >= inicioMes).length;

    return { total, ativas, suspensas, hoje: hoje_, semana, mes };
  }, [lojas]);

  // Gráfico de crescimento acumulado
  const crescimentoData = useMemo(() => {
    if (periodo === "12m") {
      // Agrupa por mês
      const meses: Record<string, { cadastradas: number; ativas: number }> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1); d.setMonth(d.getMonth() - i); d.setHours(0, 0, 0, 0);
        const key = fmtMes(d);
        meses[key] = { cadastradas: 0, ativas: 0 };
      }
      lojas.forEach(l => {
        if (!l.createdAt) return;
        const d = l.createdAt.toDate();
        const key = fmtMes(d);
        if (meses[key] !== undefined) {
          meses[key].cadastradas++;
          if (l.ativo !== false) meses[key].ativas++;
        }
      });
      // Acumula
      let acc = 0; let accAtivas = 0;
      return Object.entries(meses).map(([label, v]) => {
        acc += v.cadastradas; accAtivas += v.ativas;
        return { label, novas: v.cadastradas, total: acc };
      });
    } else {
      // Agrupa por dia
      const dias = periodo === "30d" ? 30 : 90;
      const map: Record<string, number> = {};
      for (let i = dias - 1; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
        map[fmtDia(d)] = 0;
      }
      lojas.forEach(l => {
        if (!l.createdAt) return;
        const d = l.createdAt.toDate();
        if (d >= inicioPeriodo) {
          const key = fmtDia(d);
          if (map[key] !== undefined) map[key]++;
        }
      });
      // Acumula a partir do total antes do período
      const totalAntes = lojas.filter(l => l.createdAt && l.createdAt.toDate() < inicioPeriodo).length;
      let acc = totalAntes;
      return Object.entries(map).map(([label, novas]) => {
        acc += novas;
        return { label, novas, total: acc };
      });
    }
  }, [lojas, periodo, inicioPeriodo]);

  // Lojas por categoria
  const porCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    lojas.forEach(l => {
      const cat = l.categoria || "Outros";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [lojas]);

  // Lojas por estado
  const porEstado = useMemo(() => {
    const map: Record<string, number> = {};
    lojas.forEach(l => {
      const uf = l.estado || "N/D";
      map[uf] = (map[uf] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [lojas]);

  // Lojas por cidade (top 10)
  const porCidade = useMemo(() => {
    const map: Record<string, number> = {};
    lojas.forEach(l => {
      if (!l.cidade) return;
      const key = `${l.cidade}${l.estado ? ` / ${l.estado}` : ""}`;
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, value]) => ({ name, value }));
  }, [lojas]);

  // Novas lojas por dia (barras) — últimos 14 dias
  const novasPorDia = useMemo(() => {
    const dias = 14;
    const map: Record<string, number> = {};
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      map[fmtDia(d)] = 0;
    }
    const inicio14 = new Date(); inicio14.setDate(inicio14.getDate() - dias + 1); inicio14.setHours(0, 0, 0, 0);
    lojas.forEach(l => {
      if (!l.createdAt) return;
      const d = l.createdAt.toDate();
      if (d >= inicio14) {
        const key = fmtDia(d);
        if (map[key] !== undefined) map[key]++;
      }
    });
    return Object.entries(map).map(([label, novas]) => ({ label, novas }));
  }, [lojas]);

  // Últimas lojas cadastradas
  const ultimasLojas = useMemo(() => {
    return [...lojas]
      .filter(l => l.createdAt)
      .sort((a, b) => (b.createdAt!.toDate().getTime()) - (a.createdAt!.toDate().getTime()))
      .slice(0, 8);
  }, [lojas]);

  const tooltipStyle = {
    contentStyle: { background: "#1a0a36", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, fontSize: "0.75rem", color: "#fff" },
    labelStyle: { color: "rgba(255,255,255,.5)" },
  };

  if (carregando) {
    return (
      <div style={{ minHeight: "100vh", background: "#080412", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.85rem" }}>Carregando dados...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif", paddingBottom: 48 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>

      {/* HEADER */}
      <div style={{
        background: "linear-gradient(135deg,#1a0a36 0%,#0f0720 50%,#07030f 100%)",
        padding: "48px 20px 28px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(167,139,250,.12) 0%, transparent 60%)" }} />
        <div style={{ position: "relative" }}>
          <button onClick={() => navigate("/admin")} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "6px 12px", color: "rgba(255,255,255,.5)", fontSize: "0.72rem", cursor: "pointer", marginBottom: 16 }}>
            ← Voltar ao Admin
          </button>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.5rem", color: "#fff" }}>📈 Crescimento das Lojas</div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.35)", marginTop: 4 }}>Análise de cadastros e status da plataforma</div>
            </div>
            {/* Seletor de período */}
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,.05)", borderRadius: 10, padding: 4 }}>
              {(["30d", "90d", "12m"] as const).map(p => (
                <button key={p} onClick={() => setPeriodo(p)} style={{
                  padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700,
                  background: periodo === p ? "#a78bfa" : "transparent",
                  color: periodo === p ? "#fff" : "rgba(255,255,255,.4)",
                }}>
                  {p === "30d" ? "30d" : p === "90d" ? "90d" : "12m"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* STAT CARDS */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          <StatCard icon="🏪" label="Total cadastradas" value={stats.total} cor="#a78bfa" />
          <StatCard icon="✅" label="Ativas" value={stats.ativas} sub={`${Math.round(stats.ativas / (stats.total || 1) * 100)}% do total`} cor="#22c55e" />
          <StatCard icon="🚫" label="Suspensas" value={stats.suspensas} cor="#ef4444" />
          <StatCard icon="🆕" label="Hoje" value={stats.hoje} cor="#f59e0b" />
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
          <StatCard icon="📅" label="Esta semana" value={stats.semana} cor="#60a5fa" />
          <StatCard icon="📆" label="Este mês" value={stats.mes} cor="#34d399" />
          <StatCard icon="📊" label="Taxa ativação" value={`${Math.round(stats.ativas / (stats.total || 1) * 100)}%`} cor="#f472b6" />
          <StatCard icon="💤" label="Inativas" value={stats.suspensas} sub="Podem ser reativadas" cor="#6b7280" />
        </div>

        {/* GRÁFICO — CRESCIMENTO ACUMULADO */}
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "18px 16px" }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 4 }}>Total acumulado de lojas</div>
          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginBottom: 16 }}>
            {periodo === "12m" ? "Crescimento mês a mês" : `Últimos ${periodo === "30d" ? "30" : "90"} dias`}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={crescimentoData}>
              <defs>
                <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }} tickLine={false} axisLine={false}
                interval={periodo === "30d" ? 6 : periodo === "90d" ? 14 : 1} />
              <YAxis tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip {...tooltipStyle} formatter={(v) => [Number(v), "Total lojas"]} />
              <Area type="monotone" dataKey="total" stroke="#a78bfa" strokeWidth={2} fill="url(#gTotal)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* GRÁFICO — NOVAS LOJAS POR DIA (últimos 14 dias) */}
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "18px 16px" }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 4 }}>Novas lojas por dia</div>
          <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginBottom: 16 }}>Últimos 14 dias</div>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={novasPorDia} barSize={14}>
              <XAxis dataKey="label" tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }} tickLine={false} axisLine={false} interval={2} />
              <YAxis tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }} tickLine={false} axisLine={false} width={20} allowDecimals={false} />
              <Tooltip {...tooltipStyle} formatter={(v) => [Number(v), "Novas lojas"]} />
              <Bar dataKey="novas" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* GRÁFICO — POR CATEGORIA */}
        {porCategoria.length > 0 && (
          <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "18px 16px" }}>
            <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 4 }}>Lojas por categoria</div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginBottom: 16 }}>Distribuição por tipo de culinária</div>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <ResponsiveContainer width="50%" height={160}>
                <PieChart>
                  <Pie data={porCategoria} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={35}>
                    {porCategoria.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                  </Pie>
                  <Tooltip {...tooltipStyle} formatter={(v) => [Number(v), "lojas"]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, paddingTop: 8 }}>
                {porCategoria.map((cat, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: CORES[i % CORES.length], flexShrink: 0 }} />
                    <span style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.6)", flex: 1 }}>{cat.name}</span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: CORES[i % CORES.length] }}>{cat.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GRÁFICO — POR ESTADO */}
        {porEstado.length > 0 && (
          <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "18px 16px" }}>
            <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 4 }}>Lojas por estado</div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginBottom: 16 }}>Onde a plataforma está crescendo no Brasil</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {porEstado.map((uf, i) => {
                const max = porEstado[0].value;
                const pct = Math.round((uf.value / max) * 100);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 32, fontSize: "0.72rem", fontWeight: 700, color: CORES[i % CORES.length], flexShrink: 0 }}>{uf.name}</div>
                    <div style={{ flex: 1, height: 8, background: "rgba(255,255,255,.06)", borderRadius: 4, overflow: "hidden" }}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, delay: i * 0.05 }}
                        style={{ height: "100%", background: CORES[i % CORES.length], borderRadius: 4 }}
                      />
                    </div>
                    <div style={{ width: 24, fontSize: "0.78rem", fontWeight: 900, color: CORES[i % CORES.length], textAlign: "right", flexShrink: 0 }}>{uf.value}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* GRÁFICO — POR CIDADE */}
        {porCidade.length > 0 && (
          <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "18px 16px" }}>
            <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 4 }}>Top cidades</div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginBottom: 16 }}>Cidades com mais lojas cadastradas</div>
            <ResponsiveContainer width="100%" height={Math.max(160, porCidade.length * 32)}>
              <BarChart data={porCidade} layout="vertical" barSize={12}>
                <XAxis type="number" tick={{ fill: "rgba(255,255,255,.3)", fontSize: 9 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fill: "rgba(255,255,255,.5)", fontSize: 9 }} tickLine={false} axisLine={false} width={100} />
                <Tooltip {...tooltipStyle} formatter={(v) => [Number(v), "lojas"]} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {porCidade.map((_, i) => <Cell key={i} fill={CORES[i % CORES.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Aviso quando não há dados de localização */}
        {porEstado.length === 0 && porCidade.length === 0 && (
          <div style={{ background: "rgba(245,158,11,.06)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 18, padding: "20px 16px", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>📍</div>
            <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#f59e0b", marginBottom: 4 }}>Dados de localização ainda não disponíveis</div>
            <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.35)" }}>
              Os campos de cidade e estado foram adicionados ao cadastro de lojistas.<br />
              Os próximos cadastros já vão aparecer aqui.
            </div>
          </div>
        )}

        {/* ÚLTIMAS LOJAS CADASTRADAS */}
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "18px 16px" }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 12 }}>Últimas lojas cadastradas</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ultimasLojas.length === 0 && (
              <div style={{ color: "rgba(255,255,255,.3)", fontSize: "0.75rem", textAlign: "center", padding: 16 }}>Nenhuma loja ainda</div>
            )}
            {ultimasLojas.map((loja, i) => (
              <motion.div key={loja.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 12 }}
              >
                <div style={{ width: 36, height: 36, borderRadius: 10, background: loja.ativo !== false ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
                  🏪
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loja.nome}</div>
                  <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.35)" }}>
                    {loja.categoria || "Sem categoria"} · /{loja.slug}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.3)" }}>
                    {loja.createdAt ? loja.createdAt.toDate().toLocaleDateString("pt-BR") : "—"}
                  </div>
                  <div style={{
                    marginTop: 2, display: "inline-block", padding: "2px 7px", borderRadius: 20, fontSize: "0.55rem", fontWeight: 700,
                    background: loja.ativo !== false ? "rgba(34,197,94,.15)" : "rgba(239,68,68,.15)",
                    color: loja.ativo !== false ? "#22c55e" : "#ef4444",
                  }}>
                    {loja.ativo !== false ? "Ativa" : "Suspensa"}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <button
            onClick={() => navigate("/admin/lojas")}
            style={{ width: "100%", marginTop: 12, padding: "11px", background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 12, color: "#a78bfa", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}
          >
            Gerenciar todas as lojas →
          </button>
        </div>

      </div>
    </div>
  );
}

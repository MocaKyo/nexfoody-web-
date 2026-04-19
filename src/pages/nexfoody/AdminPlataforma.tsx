// src/pages/nexfoody/AdminPlataforma.tsx
// Hub principal — dois painéis separados: Plataforma e Embaixadores
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion } from "framer-motion";

export default function AdminPlataforma() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalLojas: 0,
    lojasAtivas: 0,
    lojasSuspensas: 0,
    totalUsuarios: 0,
    saquesPendentes: 0,
    valorPendente: 0,
    convitesCadastrados: 0,
    totalEmbaixadores: 0,
  });

  useEffect(() => {
    let loaded = 0;
    const tryDone = () => { loaded++; };

    const unsubLojas = onSnapshot(collection(db, "lojas"), snap => {
      const docs = snap.docs.map(d => d.data());
      setStats(p => ({
        ...p,
        totalLojas: docs.length,
        lojasAtivas: docs.filter(d => d.ativo !== false).length,
        lojasSuspensas: docs.filter(d => d.ativo === false).length,
      }));
      tryDone();
    });

    const unsubUsuarios = onSnapshot(collection(db, "users"), snap => {
      setStats(p => ({ ...p, totalUsuarios: snap.size }));
      tryDone();
    });

    const unsubSaques = onSnapshot(
      query(collection(db, "saques"), where("status", "==", "pendente")),
      snap => {
        const total = snap.docs.reduce((a, d) => a + (d.data().valor || 0), 0);
        setStats(p => ({ ...p, saquesPendentes: snap.size, valorPendente: total }));
        tryDone();
      }
    );

    const unsubConvites = onSnapshot(collection(db, "convites"), snap => {
      const docs = snap.docs.map(d => d.data());
      setStats(p => ({
        ...p,
        convitesCadastrados: docs.filter(d => d.status === "cadastrado").length,
        totalEmbaixadores: new Set(docs.map(d => d.embaixadorId)).size,
      }));
      tryDone();
    });

    return () => { unsubLojas(); unsubUsuarios(); unsubSaques(); unsubConvites(); };
  }, []);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>

      {/* ── HEADER ── */}
      <div style={{
        background: "linear-gradient(135deg,#1a0a36 0%,#0f0720 50%,#07030f 100%)",
        padding: "52px 20px 32px", position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle at 20% 50%, rgba(124,58,237,.15) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(245,197,24,.08) 0%, transparent 50%)" }} />
        <div style={{ position: "relative", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(245,197,24,.1)", border: "1px solid rgba(245,197,24,.2)", borderRadius: 20, padding: "4px 12px", marginBottom: 12 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "pulse 2s infinite" }} />
            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#f5c518", textTransform: "uppercase", letterSpacing: "0.1em" }}>Administração</span>
          </div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.8rem", color: "#fff", lineHeight: 1.1 }}>
            🛡️ NexFoody Admin
          </div>
          <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.35)", marginTop: 6 }}>
            Selecione a área que deseja gerenciar
          </div>
        </div>

        {/* Alertas */}
        {stats.saquesPendentes > 0 && (
          <motion.div
            animate={{ scale: [1, 1.02, 1] }} transition={{ repeat: Infinity, duration: 2.5 }}
            onClick={() => navigate("/admin/saques")}
            style={{ position: "relative", marginTop: 16, background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.35)", borderRadius: 14, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#f59e0b" }}>
                {stats.saquesPendentes} saque{stats.saquesPendentes > 1 ? "s" : ""} aguardando pagamento PIX
              </div>
              <div style={{ fontSize: "0.68rem", color: "rgba(245,158,11,.6)", marginTop: 1 }}>{fmt(stats.valorPendente)} a pagar · Toque para resolver</div>
            </div>
            <span style={{ color: "#f59e0b" }}>→</span>
          </motion.div>
        )}
        {stats.convitesCadastrados > 0 && (
          <div
            onClick={() => navigate("/admin/convites")}
            style={{ marginTop: 8, background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.25)", borderRadius: 14, padding: "11px 14px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>🏪</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "0.82rem", color: "#60a5fa" }}>
                {stats.convitesCadastrados} loja{stats.convitesCadastrados > 1 ? "s" : ""} aguardando confirmação do 1º pedido
              </div>
              <div style={{ fontSize: "0.68rem", color: "rgba(96,165,250,.5)", marginTop: 1 }}>Confirme para creditar R$10 ao embaixador</div>
            </div>
            <span style={{ color: "#60a5fa" }}>→</span>
          </div>
        )}
      </div>

      {/* ── DOIS PAINÉIS ── */}
      <div style={{ padding: "24px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* PAINEL 1 — GESTÃO DA PLATAFORMA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          style={{ background: "linear-gradient(135deg, rgba(167,139,250,.08) 0%, rgba(139,92,246,.04) 100%)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 20, overflow: "hidden" }}
        >
          {/* Cabeçalho do painel */}
          <div style={{ padding: "18px 18px 12px", borderBottom: "1px solid rgba(167,139,250,.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(167,139,250,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>🏪</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>Gestão da Plataforma</div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>Lojas, pedidos e usuários</div>
              </div>
            </div>

            {/* Mini stats */}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {[
                { label: "Lojas", val: stats.totalLojas, cor: "#a78bfa" },
                { label: "Ativas", val: stats.lojasAtivas, cor: "#22c55e" },
                { label: "Suspensas", val: stats.lojasSuspensas, cor: "#ef4444" },
                { label: "Usuários", val: stats.totalUsuarios, cor: "#60a5fa" },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: "1rem", color: s.cor }}>{s.val}</div>
                  <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div style={{ padding: "12px 18px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: "📊", label: "Dashboard de pedidos", sub: "Faturamento, gráficos, ranking de lojas", rota: "/admin/dashboard", cor: "#a78bfa" },
              { icon: "📈", label: "Crescimento das lojas", sub: "Cadastros, ativas, categorias, gráficos", rota: "/admin/lojas/analytics", cor: "#a78bfa" },
              { icon: "🏪", label: "Gerenciar lojas", sub: "Pausar, suspender, excluir", rota: "/admin/lojas", cor: "#a78bfa" },
              { icon: "👤", label: "Gerenciar usuários", sub: "Ver, buscar, bloquear, tornar admin", rota: "/admin/usuarios", cor: "#60a5fa" },
              { icon: "📋", label: "Planos & Preços", sub: "Editar valores e limites dos planos", rota: "/admin/planos", cor: "#a78bfa" },
              { icon: "📢", label: "Broadcast", sub: "Enviar mensagem para lojas", rota: "/admin/broadcast", cor: "#60a5fa" },
              { icon: "📚", label: "Instruções para lojistas", sub: "Guia de uso · editar seções e suporte", rota: "/admin/instrucoes", cor: "#f5c518" },
            ].map((a, i) => (
              <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => navigate(a.rota)}
                style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "13px 14px", cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: "1.2rem" }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#fff" }}>{a.label}</div>
                  <div style={{ fontSize: "0.63rem", color: "rgba(255,255,255,.33)", marginTop: 1 }}>{a.sub}</div>
                </div>
                <span style={{ color: a.cor, fontSize: "0.9rem" }}>→</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* PAINEL 2 — PROGRAMA EMBAIXADORES */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,.08) 0%, rgba(16,185,129,.04) 100%)", border: "1px solid rgba(34,197,94,.2)", borderRadius: 20, overflow: "hidden" }}
        >
          {/* Cabeçalho do painel */}
          <div style={{ padding: "18px 18px 12px", borderBottom: "1px solid rgba(34,197,94,.1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(34,197,94,.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>💰</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "1rem", color: "#fff" }}>Programa Embaixadores</div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>Convites, saques PIX e ranking</div>
              </div>
            </div>

            {/* Mini stats */}
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {[
                { label: "Embaixadores", val: stats.totalEmbaixadores, cor: "#22c55e" },
                { label: "Aguard. pedido", val: stats.convitesCadastrados, cor: "#60a5fa" },
                { label: "Saques pend.", val: stats.saquesPendentes, cor: stats.saquesPendentes > 0 ? "#f59e0b" : "#6b7280" },
                { label: "A pagar", val: fmt(stats.valorPendente), cor: stats.valorPendente > 0 ? "#f59e0b" : "#6b7280" },
              ].map((s, i) => (
                <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
                  <div style={{ fontWeight: 900, fontSize: typeof s.val === "string" ? "0.68rem" : "1rem", color: s.cor, lineHeight: 1.2 }}>{s.val}</div>
                  <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações */}
          <div style={{ padding: "12px 18px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { icon: "📊", label: "Dashboard embaixadores", sub: "Funil de convites e estatísticas", rota: "/admin/embaixadores-hub", cor: "#22c55e", badge: 0 },
              { icon: "📨", label: "Convites", sub: "Avançar status · creditar carteira", rota: "/admin/convites", cor: "#22c55e", badge: stats.convitesCadastrados },
              { icon: "💸", label: "Saques PIX", sub: "Aprovar pagamentos pendentes", rota: "/admin/saques", cor: "#f59e0b", badge: stats.saquesPendentes },
              { icon: "👥", label: "Embaixadores", sub: "Lista completa e ranking", rota: "/admin/embaixadores", cor: "#22c55e", badge: 0 },
            ].map((a, i) => (
              <motion.button key={i} whileTap={{ scale: 0.98 }} onClick={() => navigate(a.rota)}
                style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "13px 14px", cursor: "pointer", textAlign: "left", position: "relative" }}>
                {a.badge > 0 && (
                  <div style={{ position: "absolute", top: 8, right: 8, background: "#f59e0b", color: "#000", borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", fontWeight: 900 }}>
                    {a.badge}
                  </div>
                )}
                <span style={{ fontSize: "1.2rem" }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#fff" }}>{a.label}</div>
                  <div style={{ fontSize: "0.63rem", color: "rgba(255,255,255,.33)", marginTop: 1 }}>{a.sub}</div>
                </div>
                <span style={{ color: a.cor, fontSize: "0.9rem" }}>→</span>
              </motion.button>
            ))}
          </div>
        </motion.div>

      </div>
    </div>
  );
}

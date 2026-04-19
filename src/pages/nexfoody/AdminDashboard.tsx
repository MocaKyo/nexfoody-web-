// src/pages/nexfoody/AdminDashboard.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, query, onSnapshot, where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion } from "framer-motion";

export default function AdminDashboard() {
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    saquesPendentes: 0,
    valorPendente: 0,
    totalEmbaixadores: 0,
    convitesEnviados: 0,
    convitesCadastrados: 0,
    convitesAtivos: 0,
    totalSacado: 0,
  });
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let loaded = 0;
    const done = () => { loaded++; if (loaded >= 3) setCarregando(false); };

    // Saques pendentes
    const unsubSaques = onSnapshot(
      query(collection(db, "saques"), where("status", "==", "pendente")),
      snap => {
        const total = snap.docs.reduce((a, d) => a + (d.data().valor || 0), 0);
        setStats(p => ({ ...p, saquesPendentes: snap.size, valorPendente: total }));
        done();
      }
    );

    // Convites
    const unsubConvites = onSnapshot(collection(db, "convites"), snap => {
      const docs = snap.docs.map(d => d.data());
      setStats(p => ({
        ...p,
        convitesEnviados:    docs.filter(d => d.status === "enviado").length,
        convitesCadastrados: docs.filter(d => d.status === "cadastrado").length,
        convitesAtivos:      docs.filter(d => d.status === "ativo").length,
        totalEmbaixadores:   new Set(docs.map(d => d.embaixadorId)).size,
      }));
      done();
    });

    // Total sacado (processado)
    const unsubPago = onSnapshot(
      query(collection(db, "saques"), where("status", "==", "processado")),
      snap => {
        const total = snap.docs.reduce((a, d) => a + (d.data().valor || 0), 0);
        setStats(p => ({ ...p, totalSacado: total }));
        done();
      }
    );

    return () => { unsubSaques(); unsubConvites(); unsubPago(); };
  }, []);

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const CARDS = [
    {
      icon: "💸", titulo: "Saques pendentes", val: stats.saquesPendentes > 0 ? `${stats.saquesPendentes} · ${fmt(stats.valorPendente)}` : "Nenhum",
      cor: stats.saquesPendentes > 0 ? "#f59e0b" : "#22c55e",
      bg: stats.saquesPendentes > 0 ? "rgba(245,158,11,.12)" : "rgba(34,197,94,.08)",
      border: stats.saquesPendentes > 0 ? "rgba(245,158,11,.3)" : "rgba(34,197,94,.2)",
      rota: "/admin/saques",
      badge: stats.saquesPendentes > 0 ? stats.saquesPendentes : null,
    },
    {
      icon: "📨", titulo: "Convites aguardando", val: `${stats.convitesCadastrados} aguardando 1º pedido`,
      cor: "#60a5fa", bg: "rgba(96,165,250,.08)", border: "rgba(96,165,250,.2)",
      rota: "/admin/convites",
      badge: stats.convitesCadastrados > 0 ? stats.convitesCadastrados : null,
    },
    {
      icon: "👥", titulo: "Embaixadores", val: `${stats.totalEmbaixadores} ativos`,
      cor: "#a78bfa", bg: "rgba(167,139,250,.08)", border: "rgba(167,139,250,.2)",
      rota: "/admin/embaixadores",
      badge: null,
    },
    {
      icon: "✅", titulo: "Total pago via PIX", val: fmt(stats.totalSacado),
      cor: "#22c55e", bg: "rgba(34,197,94,.08)", border: "rgba(34,197,94,.2)",
      rota: "/admin/saques",
      badge: null,
    },
  ];

  const FUNIL = [
    { label: "Enviados", val: stats.convitesEnviados,    cor: "#9ca3af", emoji: "📤" },
    { label: "Cadastrados", val: stats.convitesCadastrados, cor: "#60a5fa", emoji: "🏪" },
    { label: "Ativos", val: stats.convitesAtivos,      cor: "#22c55e", emoji: "🟢" },
  ];
  const totalConvites = stats.convitesEnviados + stats.convitesCadastrados + stats.convitesAtivos || 1;

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "48px 20px 28px", position: "relative" }}>
        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Painel Admin</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.6rem", color: "#fff" }}>🛡️ Dashboard</div>
          {stats.saquesPendentes > 0 && (
            <motion.div
              animate={{ scale: [1, 1.04, 1] }} transition={{ repeat: Infinity, duration: 2 }}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.35)", borderRadius: 20, padding: "5px 14px", fontSize: "0.72rem", fontWeight: 800, color: "#f59e0b" }}>
              ⚠️ {stats.saquesPendentes} saque{stats.saquesPendentes > 1 ? "s" : ""} aguardando pagamento
            </motion.div>
          )}
        </div>
      </div>

      {/* ── CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "20px 16px 0" }}>
        {carregando
          ? Array(4).fill(0).map((_, i) => (
            <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "20px 16px", height: 88 }} />
          ))
          : CARDS.map((c, i) => (
            <motion.button
              key={i}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate(c.rota)}
              style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 18, padding: "16px", cursor: "pointer", textAlign: "left", position: "relative" }}
            >
              {c.badge !== null && (
                <div style={{ position: "absolute", top: 10, right: 10, background: c.cor, color: "#000", borderRadius: "50%", width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", fontWeight: 900 }}>
                  {c.badge}
                </div>
              )}
              <div style={{ fontSize: "1.4rem", marginBottom: 6 }}>{c.icon}</div>
              <div style={{ fontWeight: 900, fontSize: "0.95rem", color: c.cor, marginBottom: 2 }}>{c.val}</div>
              <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.35)", textTransform: "uppercase", letterSpacing: "0.06em" }}>{c.titulo}</div>
            </motion.button>
          ))
        }
      </div>

      {/* ── FUNIL DE CONVITES ── */}
      <div style={{ margin: "16px 16px 0", background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px" }}>
        <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,.35)", marginBottom: 14 }}>Funil de convites</div>
        {FUNIL.map((f, i) => (
          <div key={i} style={{ marginBottom: i < 2 ? 10 : 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.6)" }}>{f.emoji} {f.label}</span>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: f.cor }}>{f.val}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,.06)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(f.val / totalConvites) * 100}%`, background: f.cor, borderRadius: 3, transition: "width 1s ease" }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── AÇÕES RÁPIDAS ── */}
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,.35)", marginBottom: 10 }}>Ações rápidas</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { icon: "💸", label: "Gerenciar saques PIX", sub: `${stats.saquesPendentes} pendente${stats.saquesPendentes !== 1 ? "s" : ""}`, cor: "#f5c518", rota: "/admin/saques" },
            { icon: "📨", label: "Gerenciar convites", sub: `Avançar status e liberar créditos`, cor: "#60a5fa", rota: "/admin/convites" },
            { icon: "👥", label: "Ver embaixadores", sub: `${stats.totalEmbaixadores} cadastrado${stats.totalEmbaixadores !== 1 ? "s" : ""}`, cor: "#a78bfa", rota: "/admin/embaixadores" },
          ].map((a, i) => (
            <button key={i} onClick={() => navigate(a.rota)}
              style={{ display: "flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "14px 16px", cursor: "pointer", textAlign: "left" }}>
              <span style={{ fontSize: "1.4rem" }}>{a.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#fff" }}>{a.label}</div>
                <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.35)", marginTop: 1 }}>{a.sub}</div>
              </div>
              <span style={{ color: a.cor, fontSize: "1rem" }}>→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

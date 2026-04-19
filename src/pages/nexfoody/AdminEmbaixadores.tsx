// src/pages/nexfoody/AdminEmbaixadores.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, onSnapshot, getDocs, query, where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface Embaixador {
  uid: string;
  nome: string;
  email: string;
  inviteCode: string;
  totalConvites: number;
  convitesCadastrados: number;
  convitesAtivos: number;
  totalGanho: number;
  saldoDisponivel: number;
  totalSacado: number;
  lojasAtivas: number;
  nivel: string;
  nivelCor: string;
  nivelIcon: string;
}

const NIVEIS = [
  { nome: "Explorador",  min: 0,  max: 4,  cor: "#94a3b8", icon: "🌱" },
  { nome: "Conector",    min: 5,  max: 14, cor: "#60a5fa", icon: "🔗" },
  { nome: "Embaixador",  min: 15, max: 999, cor: "#f5c518", icon: "👑" },
];

function getNivel(lojasAtivas: number) {
  return NIVEIS.find(n => lojasAtivas >= n.min && lojasAtivas <= n.max) || NIVEIS[0];
}

export default function AdminEmbaixadores() {
  const navigate = useNavigate();
  const [embaixadores, setEmbaixadores] = useState<Embaixador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [ordenar, setOrdenar] = useState<"ganho" | "ativos" | "convites">("ganho");
  const [selecionado, setSelecionado] = useState<Embaixador | null>(null);

  useEffect(() => {
    // Escuta convites em tempo real e agrega por embaixador
    const unsubConvites = onSnapshot(collection(db, "convites"), async snap => {
      const conviteDocs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));

      // Agrupa por embaixadorId
      const porEmbaixador: Record<string, { nome: string; convites: any[] }> = {};
      conviteDocs.forEach((c: any) => {
        if (!porEmbaixador[c.embaixadorId]) {
          porEmbaixador[c.embaixadorId] = { nome: c.embaixadorNome, convites: [] };
        }
        porEmbaixador[c.embaixadorId].convites.push(c);
      });

      // Busca carteiras em paralelo
      const ids = Object.keys(porEmbaixador);
      if (ids.length === 0) { setEmbaixadores([]); setCarregando(false); return; }

      const carteirasSnap = await getDocs(
        query(collection(db, "carteiras"), where("__name__", "in", ids.slice(0, 30)))
      );
      const carteiras: Record<string, any> = {};
      carteirasSnap.docs.forEach(d => { carteiras[d.id] = d.data(); });

      // Monta lista
      const lista: Embaixador[] = ids.map(uid => {
        const grupo = porEmbaixador[uid];
        const carteira = carteiras[uid] || {};
        const lojasAtivas = carteira.lojasAtivas || 0;
        const nivel = getNivel(lojasAtivas);
        return {
          uid,
          nome: grupo.nome,
          email: "",
          inviteCode: grupo.convites[0]?.embaixadorId ? `NEX${uid.substring(0, 6).toUpperCase()}` : "—",
          totalConvites: grupo.convites.length,
          convitesCadastrados: grupo.convites.filter((c: any) => c.status === "cadastrado").length,
          convitesAtivos: grupo.convites.filter((c: any) => c.status === "ativo").length,
          totalGanho: carteira.totalGanho || 0,
          saldoDisponivel: carteira.saldoDisponivel || 0,
          totalSacado: carteira.totalSacado || 0,
          lojasAtivas,
          nivel: nivel.nome,
          nivelCor: nivel.cor,
          nivelIcon: nivel.icon,
        };
      });

      // Ordena
      lista.sort((a, b) => {
        if (ordenar === "ganho")    return b.totalGanho - a.totalGanho;
        if (ordenar === "ativos")   return b.lojasAtivas - a.lojasAtivas;
        return b.totalConvites - a.totalConvites;
      });

      setEmbaixadores(lista);
      setCarregando(false);
    });

    return () => unsubConvites();
  }, [ordenar]);

  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const lista = busca.trim()
    ? embaixadores.filter(e => normalizar(e.nome).includes(normalizar(busca)) || normalizar(e.inviteCode).includes(normalizar(busca)))
    : embaixadores;

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  const totalGeral = embaixadores.reduce((a, e) => a + e.totalGanho, 0);
  const totalAtivos = embaixadores.filter(e => e.convitesAtivos > 0).length;

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "48px 20px 24px", position: "relative" }}>
        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Painel Admin</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.5rem", color: "#fff" }}>👥 Embaixadores</div>
        </div>
      </div>

      {/* ── STATS GERAIS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "16px 16px 0" }}>
        {[
          { label: "Total", val: embaixadores.length, cor: "#a78bfa", icon: "👥" },
          { label: "Com loja ativa", val: totalAtivos, cor: "#22c55e", icon: "🟢" },
          { label: "Total ganho", val: fmt(totalGeral), cor: "#f5c518", icon: "💰" },
        ].map((s, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: "1.1rem", marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontWeight: 900, fontSize: "0.9rem", color: s.cor }}>{s.val}</div>
            <div style={{ fontSize: "0.56rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── BUSCA + ORDENAÇÃO ── */}
      <div style={{ padding: "12px 16px 0" }}>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou código..."
          style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box", marginBottom: 8 }}
        />
        <div style={{ display: "flex", gap: 6 }}>
          {(["ganho","ativos","convites"] as const).map(o => (
            <button key={o} onClick={() => setOrdenar(o)} style={{
              padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer",
              fontFamily: "'Outfit',sans-serif", fontSize: "0.68rem", fontWeight: 700,
              background: ordenar === o ? "rgba(245,197,24,.15)" : "rgba(255,255,255,.05)",
              color: ordenar === o ? "#f5c518" : "rgba(255,255,255,.35)",
            }}>
              {o === "ganho" ? "💰 Mais ganhou" : o === "ativos" ? "🟢 Mais ativos" : "📨 Mais convites"}
            </button>
          ))}
        </div>
      </div>

      {/* ── LISTA ── */}
      <div style={{ padding: "12px 16px 0" }}>
        {carregando ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <div style={{ width: 32, height: 32, border: "3px solid rgba(167,139,250,.3)", borderTop: "3px solid #a78bfa", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          </div>
        ) : lista.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,.25)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>👥</div>
            <div style={{ fontSize: "0.85rem" }}>Nenhum embaixador encontrado</div>
          </div>
        ) : lista.map((e, idx) => (
          <motion.div key={e.uid} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            onClick={() => setSelecionado(selecionado?.uid === e.uid ? null : e)}
            style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "14px 16px", marginBottom: 8, cursor: "pointer" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {/* Avatar */}
              <div style={{ width: 40, height: 40, borderRadius: 14, background: `${e.nivelCor}20`, border: `1.5px solid ${e.nivelCor}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                {e.nivelIcon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#fff" }}>{e.nome}</span>
                  <span style={{ fontSize: "0.58rem", fontWeight: 800, color: e.nivelCor, background: `${e.nivelCor}18`, padding: "2px 7px", borderRadius: 10 }}>{e.nivel}</span>
                </div>
                <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginTop: 1 }}>
                  {e.inviteCode} · {e.totalConvites} convite{e.totalConvites !== 1 ? "s" : ""} · {e.convitesAtivos} ativo{e.convitesAtivos !== 1 ? "s" : ""}
                </div>
              </div>

              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#22c55e" }}>{fmt(e.totalGanho)}</div>
                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.25)" }}>ganho total</div>
              </div>
            </div>

            {/* Expandido */}
            <AnimatePresence>
              {selecionado?.uid === e.uid && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{ overflow: "hidden" }}>
                  <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", marginTop: 12, paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Disponível", val: fmt(e.saldoDisponivel), cor: "#f5c518" },
                      { label: "Já sacado",  val: fmt(e.totalSacado),    cor: "#60a5fa" },
                      { label: "Lojas ativas", val: e.lojasAtivas,       cor: e.nivelCor },
                    ].map((s, i) => (
                      <div key={i} style={{ background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                        <div style={{ fontWeight: 800, fontSize: "0.88rem", color: s.cor }}>{s.val}</div>
                        <div style={{ fontSize: "0.56rem", color: "rgba(255,255,255,.3)", marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
                    <button
                      onClick={e2 => { e2.stopPropagation(); navigate(`/admin/convites`); }}
                      style={{ flex: 1, padding: "9px", background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.2)", borderRadius: 10, fontSize: "0.72rem", fontWeight: 700, color: "#60a5fa", cursor: "pointer" }}>
                      Ver convites →
                    </button>
                    <button
                      onClick={e2 => { e2.stopPropagation(); navigate(`/admin/saques`); }}
                      style={{ flex: 1, padding: "9px", background: "rgba(245,197,24,.08)", border: "1px solid rgba(245,197,24,.18)", borderRadius: 10, fontSize: "0.72rem", fontWeight: 700, color: "#f5c518", cursor: "pointer" }}>
                      Ver saques →
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

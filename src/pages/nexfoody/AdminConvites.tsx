// src/pages/nexfoody/AdminConvites.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, setDoc, serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface Convite {
  id: string;
  embaixadorId: string;
  embaixadorNome: string;
  nomeLoja: string;
  lojaPlaceId: string;
  lojaSlug?: string;
  status: "enviado" | "cadastrado" | "ativo";
  creditoCadastro: number;
  creditoPrimeiroPedido: number;
  recorrenteAcumulado: number;
  createdAt: { toDate: () => Date } | null;
  cadastradoAt?: { toDate: () => Date } | null;
  ativoAt?: { toDate: () => Date } | null;
}

const STATUS_INFO = {
  enviado:    { label: "Aguardando cadastro", cor: "#9ca3af", bg: "rgba(156,163,175,.1)",  icon: "📤", prox: "cadastrado" as const },
  cadastrado: { label: "Aguardando 1º pedido", cor: "#60a5fa", bg: "rgba(96,165,250,.1)", icon: "🏪", prox: "ativo" as const },
  ativo:      { label: "Ativo — recorrente",   cor: "#22c55e", bg: "rgba(34,197,94,.1)",  icon: "🟢", prox: null },
};

const CREDITO_AVANCAR: Record<string, { campo: string; valor: number; label: string }> = {
  cadastrado: { campo: "creditoCadastro",       valor: 10, label: "R$ 10 — cadastro" },
  ativo:      { campo: "creditoPrimeiroPedido",  valor: 10, label: "R$ 10 — 1º pedido" },
};

export default function AdminConvites() {
  const navigate = useNavigate();
  const [convites, setConvites] = useState<Convite[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "enviado" | "cadastrado" | "ativo">("cadastrado");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [toastMsg, setToastMsg] = useState("");
  const [confirmModal, setConfirmModal] = useState<{ convite: Convite; novoStatus: "cadastrado" | "ativo" } | null>(null);

  useEffect(() => {
    const q = query(collection(db, "convites"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setConvites(snap.docs.map(d => ({ id: d.id, ...d.data() } as Convite)));
      setCarregando(false);
    });
    return unsub;
  }, []);

  const avancarStatus = async (convite: Convite, novoStatus: "cadastrado" | "ativo") => {
    setProcessando(convite.id);
    try {
      const credito = CREDITO_AVANCAR[novoStatus];
      const agora = serverTimestamp();

      // Atualiza convite
      await updateDoc(doc(db, "convites", convite.id), {
        status: novoStatus,
        [credito.campo]: credito.valor,
        ...(novoStatus === "cadastrado" ? { cadastradoAt: agora } : { ativoAt: agora }),
      });

      // Credita na carteira do embaixador
      await setDoc(doc(db, "carteiras", convite.embaixadorId), {
        saldoDisponivel: increment(credito.valor),
        totalGanho: increment(credito.valor),
        ...(novoStatus === "ativo" ? { lojasAtivas: increment(1) } : {}),
      }, { merge: true });

      toast(`✓ ${convite.nomeLoja} → ${novoStatus} · ${credito.label} creditado para ${convite.embaixadorNome}`);
    } catch (e) {
      toast("Erro ao avançar status. Tente novamente.");
    } finally {
      setProcessando(null);
      setConfirmModal(null);
    }
  };

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 5000);
  };

  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const lista = convites
    .filter(c => filtro === "todos" || c.status === filtro)
    .filter(c => !busca.trim() || normalizar(c.nomeLoja).includes(normalizar(busca)) || normalizar(c.embaixadorNome).includes(normalizar(busca)));

  const contadores = {
    enviado:    convites.filter(c => c.status === "enviado").length,
    cadastrado: convites.filter(c => c.status === "cadastrado").length,
    ativo:      convites.filter(c => c.status === "ativo").length,
  };

  const fmt = (v: number) => `R$ ${v.toFixed(0)}`;

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "48px 20px 24px", position: "relative" }}>
        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Painel Admin</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.5rem", color: "#fff" }}>📨 Convites</div>
          {contadores.cadastrado > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, background: "rgba(96,165,250,.15)", border: "1px solid rgba(96,165,250,.3)", borderRadius: 20, padding: "5px 14px", fontSize: "0.72rem", fontWeight: 800, color: "#60a5fa" }}>
              🏪 {contadores.cadastrado} loja{contadores.cadastrado > 1 ? "s" : ""} aguardando 1º pedido
            </div>
          )}
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "16px 16px 0" }}>
        {(["enviado","cadastrado","ativo"] as const).map(s => {
          const info = STATUS_INFO[s];
          return (
            <div key={s} style={{ background: info.bg, border: `1px solid ${info.cor}30`, borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
              <div style={{ fontSize: "1.2rem", marginBottom: 4 }}>{info.icon}</div>
              <div style={{ fontWeight: 900, fontSize: "1.1rem", color: info.cor }}>{contadores[s]}</div>
              <div style={{ fontSize: "0.56rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2, lineHeight: 1.3 }}>{info.label}</div>
            </div>
          );
        })}
      </div>

      {/* ── BUSCA ── */}
      <div style={{ padding: "12px 16px 0" }}>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por loja ou embaixador..."
          style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* ── FILTROS ── */}
      <div style={{ display: "flex", gap: 6, padding: "12px 16px 0", overflowX: "auto" }}>
        {(["cadastrado","enviado","ativo","todos"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer", flexShrink: 0,
            fontFamily: "'Outfit',sans-serif", fontSize: "0.72rem", fontWeight: 700,
            background: filtro === f ? "rgba(96,165,250,.15)" : "rgba(255,255,255,.05)",
            color: filtro === f ? "#60a5fa" : "rgba(255,255,255,.35)",
          }}>
            {f === "todos" ? `Todos (${convites.length})` : `${STATUS_INFO[f].icon} ${STATUS_INFO[f].label} (${contadores[f]})`}
          </button>
        ))}
      </div>

      {/* ── LISTA ── */}
      <div style={{ padding: "14px 16px 0" }}>
        {carregando ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <div style={{ width: 32, height: 32, border: "3px solid rgba(96,165,250,.3)", borderTop: "3px solid #60a5fa", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          </div>
        ) : lista.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,.25)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>📨</div>
            <div style={{ fontSize: "0.85rem" }}>Nenhum convite encontrado</div>
          </div>
        ) : lista.map(c => {
          const info = STATUS_INFO[c.status];
          const ganhoTotal = (c.creditoCadastro || 0) + (c.creditoPrimeiroPedido || 0) + (c.recorrenteAcumulado || 0);
          const proximoStatus = info.prox;
          return (
            <motion.div key={c.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: info.bg, border: `1px solid ${info.cor}25`, borderRadius: 18, padding: "16px", marginBottom: 10 }}>

              {/* Linha 1: loja + status */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff", marginBottom: 2 }}>{c.nomeLoja}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.4)" }}>
                    👤 {c.embaixadorNome}
                    {c.lojaSlug && <span style={{ marginLeft: 8, color: info.cor }}>· /{c.lojaSlug}</span>}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span style={{ fontSize: "0.62rem", fontWeight: 800, color: info.cor, background: `${info.cor}20`, padding: "3px 9px", borderRadius: 10 }}>
                    {info.icon} {info.label}
                  </span>
                  {ganhoTotal > 0 && (
                    <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#22c55e", marginTop: 4 }}>
                      {fmt(ganhoTotal)} creditado
                    </div>
                  )}
                </div>
              </div>

              {/* Etapas de crédito */}
              <div style={{ display: "flex", gap: 6, marginBottom: proximoStatus ? 12 : 0 }}>
                {[
                  { label: "Cadastro", val: c.creditoCadastro || 0, max: 10 },
                  { label: "1º pedido", val: c.creditoPrimeiroPedido || 0, max: 10 },
                  { label: "Recorrente", val: c.recorrenteAcumulado || 0, max: 50 },
                ].map((etapa, i) => (
                  <div key={i} style={{ flex: 1, background: "rgba(255,255,255,.05)", borderRadius: 8, padding: "6px 8px" }}>
                    <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,.3)", marginBottom: 3 }}>{etapa.label}</div>
                    <div style={{ height: 3, borderRadius: 2, background: "rgba(255,255,255,.08)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(etapa.val / etapa.max) * 100}%`, background: etapa.val > 0 ? "#22c55e" : "transparent", borderRadius: 2 }} />
                    </div>
                    <div style={{ fontSize: "0.65rem", fontWeight: 700, color: etapa.val > 0 ? "#22c55e" : "rgba(255,255,255,.2)", marginTop: 2 }}>
                      {fmt(etapa.val)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Datas */}
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.2)", marginBottom: proximoStatus ? 12 : 0 }}>
                Convidado em {c.createdAt?.toDate().toLocaleDateString("pt-BR")}
                {c.cadastradoAt && ` · Cadastrado em ${c.cadastradoAt.toDate().toLocaleDateString("pt-BR")}`}
                {c.ativoAt && ` · Ativo em ${c.ativoAt.toDate().toLocaleDateString("pt-BR")}`}
              </div>

              {/* Ação: avançar status */}
              {proximoStatus && (
                <button
                  onClick={() => setConfirmModal({ convite: c, novoStatus: proximoStatus })}
                  disabled={processando === c.id}
                  style={{
                    width: "100%", padding: "11px", border: "none", borderRadius: 12, cursor: "pointer",
                    fontWeight: 800, fontSize: "0.82rem", color: "#fff",
                    background: proximoStatus === "cadastrado"
                      ? "linear-gradient(135deg,#3b82f6,#1d4ed8)"
                      : "linear-gradient(135deg,#22c55e,#16a34a)",
                    boxShadow: proximoStatus === "ativo"
                      ? "0 4px 16px rgba(34,197,94,.3)"
                      : "0 4px 16px rgba(59,130,246,.3)",
                    opacity: processando === c.id ? 0.6 : 1,
                  }}
                >
                  {processando === c.id ? "Processando..." : proximoStatus === "cadastrado"
                    ? "🏪 Confirmar cadastro · +R$ 10"
                    : "✅ Confirmar 1º pedido · +R$ 10"}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── MODAL CONFIRMAR ── */}
      <AnimatePresence>
        {confirmModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 100 }} />
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101, background: "#0f0720", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,.1)", padding: "20px 20px 40px" }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,.2)" }} />
              </div>
              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.15rem", color: "#fff", marginBottom: 6 }}>
                {confirmModal.novoStatus === "cadastrado" ? "🏪 Confirmar cadastro da loja" : "✅ Confirmar 1º pedido realizado"}
              </div>
              <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.5)", marginBottom: 20, lineHeight: 1.6 }}>
                Loja: <strong style={{ color: "#fff" }}>{confirmModal.convite.nomeLoja}</strong><br />
                Embaixador: <strong style={{ color: "#fff" }}>{confirmModal.convite.embaixadorNome}</strong><br />
                Crédito: <strong style={{ color: "#22c55e" }}>{CREDITO_AVANCAR[confirmModal.novoStatus].label}</strong> creditado automaticamente na carteira
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmModal(null)}
                  style={{ flex: 1, padding: "13px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, fontWeight: 700, fontSize: "0.88rem", color: "rgba(255,255,255,.5)", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button
                  onClick={() => avancarStatus(confirmModal.convite, confirmModal.novoStatus)}
                  style={{ flex: 2, padding: "13px", background: confirmModal.novoStatus === "ativo" ? "linear-gradient(135deg,#22c55e,#16a34a)" : "linear-gradient(135deg,#3b82f6,#1d4ed8)", border: "none", borderRadius: 14, fontWeight: 800, fontSize: "0.9rem", color: "#fff", cursor: "pointer" }}>
                  Confirmar e creditar
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── TOAST ── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, left: 16, right: 16, zIndex: 200, background: "rgba(15,7,32,.96)", border: "1px solid rgba(34,197,94,.3)", borderRadius: 14, padding: "12px 18px", fontSize: "0.78rem", fontWeight: 700, color: "#fff", backdropFilter: "blur(12px)", lineHeight: 1.5 }}>
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

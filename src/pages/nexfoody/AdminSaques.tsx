// src/pages/nexfoody/AdminSaques.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, serverTimestamp, where,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface Saque {
  id: string;
  userId: string;
  nomeUsuario: string;
  valor: number;
  pixKey: string;
  pixTipo: string;
  status: "pendente" | "processado" | "cancelado";
  createdAt: { toDate: () => Date } | null;
  processadoAt?: { toDate: () => Date } | null;
  obs?: string;
}

const STATUS_COR = {
  pendente:   { cor: "#f59e0b", bg: "rgba(245,158,11,.12)",  label: "Pendente" },
  processado: { cor: "#22c55e", bg: "rgba(34,197,94,.12)",   label: "Pago" },
  cancelado:  { cor: "#ef4444", bg: "rgba(239,68,68,.12)",   label: "Cancelado" },
};

export default function AdminSaques() {
  const navigate = useNavigate();
  const [saques, setSaques] = useState<Saque[]>([]);
  const [filtro, setFiltro] = useState<"todos" | "pendente" | "processado" | "cancelado">("pendente");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState<string | null>(null);
  const [modalObs, setModalObs] = useState<{ id: string; acao: "processado" | "cancelado" } | null>(null);
  const [obs, setObs] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  useEffect(() => {
    const q = query(collection(db, "saques"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, snap => {
      setSaques(snap.docs.map(d => ({ id: d.id, ...d.data() } as Saque)));
      setCarregando(false);
    });
    return unsub;
  }, []);

  const atualizarStatus = async (id: string, status: "processado" | "cancelado", observacao = "") => {
    setProcessando(id);
    try {
      await updateDoc(doc(db, "saques", id), {
        status,
        obs: observacao || null,
        processadoAt: serverTimestamp(),
      });

      // Se cancelado, devolve saldo ao usuário
      if (status === "cancelado") {
        const saque = saques.find(s => s.id === id);
        if (saque) {
          const { doc: firestoreDoc, setDoc: firestoreSetDoc } = await import("firebase/firestore");
          const { increment } = await import("firebase/firestore");
          await updateDoc(firestoreDoc(db, "carteiras", saque.userId), {
            saldoDisponivel: increment(saque.valor),
            totalSacado: increment(-saque.valor),
          });
        }
      }

      toast(status === "processado" ? "✓ Saque marcado como pago!" : "Saque cancelado e saldo devolvido");
    } catch (e) {
      toast("Erro ao atualizar. Tente novamente.");
    } finally {
      setProcessando(null);
      setModalObs(null);
      setObs("");
    }
  };

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 3500);
  };

  const listaFiltrada = filtro === "todos" ? saques : saques.filter(s => s.status === filtro);

  const totalPendente = saques.filter(s => s.status === "pendente").reduce((a, s) => a + s.valor, 0);
  const totalPago     = saques.filter(s => s.status === "processado").reduce((a, s) => a + s.valor, 0);
  const qtdPendente   = saques.filter(s => s.status === "pendente").length;

  const fmt = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit',sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── HEADER ──────────────────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "48px 20px 24px", position: "relative" }}>
        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.65rem", textTransform: "uppercase", letterSpacing: "0.12em", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Painel Admin</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.5rem", color: "#fff", marginBottom: 4 }}>💸 Saques PIX</div>
          {qtdPendente > 0 && (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,.15)", border: "1px solid rgba(245,158,11,.3)", borderRadius: 20, padding: "4px 12px", fontSize: "0.72rem", fontWeight: 700, color: "#f59e0b" }}>
              ⚠️ {qtdPendente} saque{qtdPendente > 1 ? "s" : ""} aguardando · {fmt(totalPendente)}
            </div>
          )}
        </div>
      </div>

      {/* ── STATS ───────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, padding: "16px 16px 0" }}>
        {[
          { label: "A pagar",    val: fmt(totalPendente), cor: "#f59e0b", icon: "⏳" },
          { label: "Já pago",    val: fmt(totalPago),     cor: "#22c55e", icon: "✅" },
          { label: "Total reqs", val: `${saques.length}`, cor: "#a78bfa", icon: "📋" },
        ].map((s, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "12px 10px", textAlign: "center" }}>
            <div style={{ fontSize: "1.1rem", marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontWeight: 900, fontSize: "0.95rem", color: s.cor }}>{s.val}</div>
            <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── FILTROS ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 6, padding: "14px 16px 0" }}>
        {(["pendente", "processado", "cancelado", "todos"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "7px 14px", borderRadius: 20, border: "none", cursor: "pointer",
            fontFamily: "'Outfit',sans-serif", fontSize: "0.72rem", fontWeight: 700,
            background: filtro === f ? "rgba(245,197,24,.15)" : "rgba(255,255,255,.05)",
            color: filtro === f ? "#f5c518" : "rgba(255,255,255,.35)",
            transition: "all .15s",
          }}>
            {f === "todos" ? "Todos" : STATUS_COR[f].label}
            {f !== "todos" && (
              <span style={{ marginLeft: 5, opacity: 0.6 }}>
                ({saques.filter(s => s.status === f).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── LISTA ───────────────────────────────────────────── */}
      <div style={{ padding: "14px 16px 0" }}>
        {carregando ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <div style={{ width: 32, height: 32, border: "3px solid rgba(245,197,24,.3)", borderTop: "3px solid #f5c518", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "rgba(255,255,255,.25)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>💸</div>
            <div style={{ fontSize: "0.85rem" }}>Nenhum saque {filtro !== "todos" ? `"${STATUS_COR[filtro as keyof typeof STATUS_COR]?.label.toLowerCase()}"` : ""}</div>
          </div>
        ) : listaFiltrada.map(s => {
          const info = STATUS_COR[s.status];
          const isPendente = s.status === "pendente";
          return (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              style={{ background: isPendente ? "rgba(245,158,11,.06)" : "rgba(255,255,255,.03)", border: `1px solid ${isPendente ? "rgba(245,158,11,.2)" : "rgba(255,255,255,.07)"}`, borderRadius: 18, padding: "16px", marginBottom: 10 }}
            >
              {/* Linha 1: nome + valor */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>{s.nomeUsuario}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.35)", marginTop: 2 }}>
                    {s.createdAt?.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.3rem", color: isPendente ? "#f5c518" : info.cor }}>
                    {fmt(s.valor)}
                  </div>
                  <span style={{ fontSize: "0.62rem", fontWeight: 800, color: info.cor, background: info.bg, padding: "2px 8px", borderRadius: 10 }}>
                    {info.label}
                  </span>
                </div>
              </div>

              {/* PIX info */}
              <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 10, padding: "10px 12px", marginBottom: isPendente ? 12 : 0 }}>
                <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Chave PIX · {s.pixTipo}</div>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, color: "#fff", wordBreak: "break-all" }}>{s.pixKey}</div>
                {/* Botão copiar chave */}
                <button
                  onClick={() => { navigator.clipboard.writeText(s.pixKey); toast("Chave PIX copiada!"); }}
                  style={{ marginTop: 8, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 8, padding: "5px 12px", fontSize: "0.65rem", fontWeight: 700, color: "rgba(255,255,255,.5)", cursor: "pointer" }}
                >
                  Copiar chave
                </button>
              </div>

              {/* Obs (se tiver) */}
              {s.obs && (
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.35)", marginTop: 8, fontStyle: "italic" }}>
                  Obs: {s.obs}
                </div>
              )}

              {/* Ações (só pendente) */}
              {isPendente && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setModalObs({ id: s.id, acao: "processado" })}
                    disabled={processando === s.id}
                    style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg,#22c55e,#16a34a)", border: "none", borderRadius: 12, fontWeight: 800, fontSize: "0.82rem", color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(34,197,94,.3)", opacity: processando === s.id ? 0.6 : 1 }}
                  >
                    {processando === s.id ? "..." : "✓ Marcar como pago"}
                  </button>
                  <button
                    onClick={() => setModalObs({ id: s.id, acao: "cancelado" })}
                    disabled={processando === s.id}
                    style={{ padding: "11px 16px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 12, fontWeight: 700, fontSize: "0.82rem", color: "#ef4444", cursor: "pointer" }}
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Data processamento */}
              {s.processadoAt && (
                <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.2)", marginTop: 8 }}>
                  {s.status === "processado" ? "Pago em" : "Cancelado em"} {s.processadoAt.toDate().toLocaleDateString("pt-BR")}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* ── MODAL CONFIRMAÇÃO ────────────────────────────────── */}
      <AnimatePresence>
        {modalObs && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setModalObs(null); setObs(""); }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 100 }} />
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101, background: "#0f0720", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,.1)", padding: "20px 20px 40px" }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,.2)" }} />
              </div>

              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.1rem", color: "#fff", marginBottom: 4 }}>
                {modalObs.acao === "processado" ? "✓ Confirmar pagamento" : "Cancelar saque"}
              </div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.4)", marginBottom: 18 }}>
                {modalObs.acao === "processado"
                  ? "Confirme após transferir o PIX para o usuário."
                  : "O saldo será devolvido automaticamente para o usuário."}
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>Observação (opcional)</div>
                <input
                  value={obs}
                  onChange={e => setObs(e.target.value)}
                  placeholder={modalObs.acao === "processado" ? "Ex: PIX enviado às 14h" : "Ex: Chave PIX inválida"}
                  style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setModalObs(null); setObs(""); }}
                  style={{ flex: 1, padding: "13px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, fontWeight: 700, fontSize: "0.88rem", color: "rgba(255,255,255,.5)", cursor: "pointer" }}>
                  Voltar
                </button>
                <button
                  onClick={() => atualizarStatus(modalObs.id, modalObs.acao, obs)}
                  style={{ flex: 2, padding: "13px", background: modalObs.acao === "processado" ? "linear-gradient(135deg,#22c55e,#16a34a)" : "rgba(239,68,68,.15)", border: modalObs.acao === "cancelado" ? "1px solid rgba(239,68,68,.3)" : "none", borderRadius: 14, fontWeight: 800, fontSize: "0.9rem", color: modalObs.acao === "processado" ? "#fff" : "#ef4444", cursor: "pointer" }}>
                  {modalObs.acao === "processado" ? "Confirmar pagamento" : "Cancelar saque"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── TOAST ────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(15,7,32,.95)", border: "1px solid rgba(245,197,24,.3)", borderRadius: 14, padding: "12px 20px", fontSize: "0.82rem", fontWeight: 700, color: "#fff", zIndex: 200, whiteSpace: "nowrap", backdropFilter: "blur(12px)" }}>
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

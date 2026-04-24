// src/pages/nexfoody/AdminUsuarios.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, onSnapshot, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: "cliente" | "lojista" | "admin" | string;
  lojistaOf?: string;
  inviteCode?: string;
  pontos?: number;
  rankingPts?: number;
  bloqueado?: boolean;
  createdAt?: { toDate: () => Date } | null;
}

const ROLE_CFG = {
  admin:   { label: "Admin",   cor: "#f5c518", bg: "rgba(245,197,24,.12)",  icon: "🛡️" },
  lojista: { label: "Lojista", cor: "#a78bfa", bg: "rgba(167,139,250,.12)", icon: "🏪" },
  cliente: { label: "Cliente", cor: "#60a5fa", bg: "rgba(96,165,250,.12)",  icon: "👤" },
};

function getRoleCfg(role: string) {
  return ROLE_CFG[role as keyof typeof ROLE_CFG] || ROLE_CFG.cliente;
}

function avatarBg(nome: string) {
  return ["#7c3aed","#2563eb","#16a34a","#dc2626","#d97706","#db2777"][(nome?.charCodeAt(0)||0) % 6];
}

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtroRole, setFiltroRole] = useState<"todos" | "cliente" | "lojista" | "admin">("todos");
  const [processando, setProcessando] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [selecionado, setSelecionado] = useState<Usuario | null>(null);
  const [modalAcao, setModalAcao] = useState<{ user: Usuario; acao: "bloquear" | "desbloquear" | "tornarAdmin" | "removerAdmin" } | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Usuario));
      lista.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
      setUsuarios(lista);
      setCarregando(false);
    });
    return unsub;
  }, []);

  const executarAcao = async (user: Usuario, acao: string) => {
    setProcessando(user.id);
    try {
      if (acao === "bloquear") {
        await updateDoc(doc(db, "users", user.id), { bloqueado: true, bloqueadoEm: serverTimestamp() });
        toast(`🚫 ${user.nome} bloqueado`);
      } else if (acao === "desbloquear") {
        await updateDoc(doc(db, "users", user.id), { bloqueado: false });
        toast(`✅ ${user.nome} desbloqueado`);
      } else if (acao === "tornarAdmin") {
        await updateDoc(doc(db, "users", user.id), { role: "admin" });
        toast(`🛡️ ${user.nome} agora é admin`);
      } else if (acao === "removerAdmin") {
        await updateDoc(doc(db, "users", user.id), { role: "cliente" });
        toast(`👤 ${user.nome} voltou para cliente`);
      }
    } catch {
      toast("Erro ao executar ação.");
    } finally {
      setProcessando(null);
      setModalAcao(null);
    }
  };

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3500); };
  const normalizar = (s: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const lista = usuarios
    .filter(u => filtroRole === "todos" || u.role === filtroRole)
    .filter(u => !busca.trim() || normalizar(u.nome).includes(normalizar(busca)) || normalizar(u.email).includes(normalizar(busca)));

  const contadores = {
    total:   usuarios.length,
    clientes: usuarios.filter(u => u.role === "cliente").length,
    lojistas: usuarios.filter(u => u.role === "lojista").length,
    admins:   usuarios.filter(u => u.role === "admin").length,
    bloqueados: usuarios.filter(u => u.bloqueado).length,
  };

  const ACOES_CFG = {
    bloquear:     { label: "Bloquear usuário",  cor: "#ef4444", desc: "O usuário não conseguirá mais fazer login." },
    desbloquear:  { label: "Desbloquear",        cor: "#22c55e", desc: "O usuário poderá fazer login normalmente." },
    tornarAdmin:  { label: "Tornar Admin",        cor: "#f5c518", desc: "Este usuário terá acesso total ao painel admin." },
    removerAdmin: { label: "Remover admin",       cor: "#f59e0b", desc: "O usuário voltará a ter acesso de cliente." },
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit',sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "48px 20px 24px", position: "relative" }}>
        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Painel Admin</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.5rem", color: "#fff" }}>👤 Usuários</div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, padding: "14px 16px 0" }}>
        {[
          { label: "Total", val: contadores.total,     cor: "#fff" },
          { label: "Clientes", val: contadores.clientes,  cor: "#60a5fa" },
          { label: "Lojistas", val: contadores.lojistas,  cor: "#a78bfa" },
          { label: "Admins",   val: contadores.admins,    cor: "#f5c518" },
          { label: "Bloqueados", val: contadores.bloqueados, cor: "#ef4444" },
        ].map((s, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "8px 4px", textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: "0.95rem", color: s.cor }}>{s.val}</div>
            <div style={{ fontSize: "0.48rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── BUSCA ── */}
      <div style={{ padding: "12px 16px 0" }}>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou e-mail..."
          style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* ── FILTROS ── */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", overflowX: "auto" }}>
        {(["todos","cliente","lojista","admin"] as const).map(f => (
          <button key={f} onClick={() => setFiltroRole(f)} style={{
            padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", flexShrink: 0,
            fontFamily: "'Outfit',sans-serif", fontSize: "0.7rem", fontWeight: 700,
            background: filtroRole === f ? "rgba(96,165,250,.15)" : "rgba(255,255,255,.05)",
            color: filtroRole === f ? "#60a5fa" : "rgba(255,255,255,.35)",
          }}>
            {f === "todos" ? `Todos (${usuarios.length})` : `${getRoleCfg(f).icon} ${getRoleCfg(f).label}s`}
          </button>
        ))}
      </div>

      {/* ── LISTA ── */}
      <div style={{ padding: "12px 16px 0" }}>
        {carregando ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <div style={{ width: 32, height: 32, border: "3px solid rgba(96,165,250,.3)", borderTop: "3px solid #60a5fa", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          </div>
        ) : lista.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,.25)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>👤</div>
            <div style={{ fontSize: "0.85rem" }}>Nenhum usuário encontrado</div>
          </div>
        ) : lista.map(u => {
          const roleCfg = getRoleCfg(u.role);
          const expanded = selecionado?.id === u.id;

          return (
            <motion.div key={u.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: u.bloqueado ? "rgba(239,68,68,.05)" : "rgba(255,255,255,.03)", border: `1px solid ${u.bloqueado ? "rgba(239,68,68,.2)" : "rgba(255,255,255,.07)"}`, borderRadius: 18, padding: "14px 16px", marginBottom: 8 }}>

              {/* Linha principal */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                onClick={() => setSelecionado(expanded ? null : u)}>
                {/* Avatar */}
                <div style={{ width: 38, height: 38, borderRadius: 12, background: avatarBg(u.nome), display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                  {(u.nome || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: "0.88rem", color: u.bloqueado ? "#ef4444" : "#fff" }}>{u.nome || "—"}</span>
                    <span style={{ fontSize: "0.58rem", fontWeight: 800, color: roleCfg.cor, background: roleCfg.bg, padding: "2px 7px", borderRadius: 10 }}>{roleCfg.icon} {roleCfg.label}</span>
                    {u.bloqueado && <span style={{ fontSize: "0.58rem", fontWeight: 800, color: "#ef4444", background: "rgba(239,68,68,.1)", padding: "2px 7px", borderRadius: 10 }}>🚫 Bloqueado</span>}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {u.email || "—"}
                    {u.lojistaOf && ` · Loja: /${u.lojistaOf}`}
                  </div>
                </div>
                <span style={{ color: "rgba(255,255,255,.25)", fontSize: "0.8rem" }}>{expanded ? "▲" : "▼"}</span>
              </div>

              {/* Expandido */}
              <AnimatePresence>
                {expanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: "hidden" }}>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,.07)", marginTop: 12, paddingTop: 12 }}>
                      {/* Detalhes */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
                        {[
                          { label: "Pontos", val: u.pontos || 0, cor: "#f5c518" },
                          { label: "Ranking Pts", val: u.rankingPts || 0, cor: "#a78bfa" },
                          { label: "Código", val: u.inviteCode || "—", cor: "#22c55e" },
                        ].map((s, i) => (
                          <div key={i} style={{ background: "rgba(255,255,255,.04)", borderRadius: 10, padding: "8px 6px", textAlign: "center" }}>
                            <div style={{ fontWeight: 800, fontSize: "0.78rem", color: s.cor }}>{s.val}</div>
                            <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,.3)", marginTop: 2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Ações */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {u.bloqueado
                          ? <button onClick={() => setModalAcao({ user: u, acao: "desbloquear" })}
                              style={{ padding: "7px 12px", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "#22c55e", cursor: "pointer" }}>
                              ✅ Desbloquear
                            </button>
                          : <button onClick={() => setModalAcao({ user: u, acao: "bloquear" })}
                              style={{ padding: "7px 12px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "#ef4444", cursor: "pointer" }}>
                              🚫 Bloquear
                            </button>
                        }
                        {u.role !== "admin"
                          ? <button onClick={() => setModalAcao({ user: u, acao: "tornarAdmin" })}
                              style={{ padding: "7px 12px", background: "rgba(245,197,24,.08)", border: "1px solid rgba(245,197,24,.2)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "#f5c518", cursor: "pointer" }}>
                              🛡️ Tornar Admin
                            </button>
                          : <button onClick={() => setModalAcao({ user: u, acao: "removerAdmin" })}
                              style={{ padding: "7px 12px", background: "rgba(245,158,11,.08)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "#f59e0b", cursor: "pointer" }}>
                              👤 Remover Admin
                            </button>
                        }
                        {u.lojistaOf && (
                          <button onClick={() => navigate(`/loja/${u.lojistaOf}`)}
                            style={{ padding: "7px 12px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,.6)", cursor: "pointer" }}>
                            Ver loja →
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* ── MODAL CONFIRMAR ── */}
      <AnimatePresence>
        {modalAcao && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalAcao(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 100 }} />
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101, background: "#0f0720", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,.1)", padding: "20px 20px 40px" }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,.2)" }} />
              </div>
              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.1rem", color: "#fff", marginBottom: 4 }}>
                {ACOES_CFG[modalAcao.acao].label}
              </div>
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,.5)", marginBottom: 6 }}>
                Usuário: <strong style={{ color: "#fff" }}>{modalAcao.user.nome}</strong>
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.35)", marginBottom: 22, lineHeight: 1.6 }}>
                {ACOES_CFG[modalAcao.acao].desc}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setModalAcao(null)}
                  style={{ flex: 1, padding: "13px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, fontWeight: 700, color: "rgba(255,255,255,.5)", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button
                  onClick={() => executarAcao(modalAcao.user, modalAcao.acao)}
                  disabled={processando === modalAcao.user.id}
                  style={{ flex: 2, padding: "13px", border: "none", borderRadius: 14, fontWeight: 800, fontSize: "0.9rem", color: "#fff", cursor: "pointer",
                    background: ["desbloquear","reativar","tornarAdmin"].includes(modalAcao.acao) ? "linear-gradient(135deg,#22c55e,#16a34a)" : ["bloquear"].includes(modalAcao.acao) ? "linear-gradient(135deg,#ef4444,#b91c1c)" : "linear-gradient(135deg,#f59e0b,#d97706)",
                    opacity: processando === modalAcao.user.id ? 0.6 : 1,
                  }}>
                  {processando === modalAcao.user.id ? "Processando..." : "Confirmar"}
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
            style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(15,7,32,.96)", border: "1px solid rgba(96,165,250,.3)", borderRadius: 14, padding: "12px 20px", fontSize: "0.82rem", fontWeight: 700, color: "#fff", zIndex: 200, whiteSpace: "nowrap", backdropFilter: "blur(12px)" }}>
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

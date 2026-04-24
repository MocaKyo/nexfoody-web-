// src/pages/nexfoody/AdminBroadcast.tsx
// Envio de mensagens para lojas — por filtro ou para todas
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface Loja { id: string; nome: string; slug: string; categoria?: string; cidade?: string; estado?: string; ativo: boolean; ownerId?: string; }

const TIPOS = [
  { id: "info",    label: "Informativo", icon: "ℹ️", cor: "#60a5fa" },
  { id: "alerta",  label: "Alerta",      icon: "⚠️", cor: "#f59e0b" },
  { id: "promo",   label: "Promoção",    icon: "🎉", cor: "#22c55e" },
  { id: "cobranca",label: "Cobrança",    icon: "💳", cor: "#ef4444" },
];

export default function AdminBroadcast() {
  const navigate = useNavigate();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Filtros de destinatários
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "ativas" | "suspensas">("todas");

  // Mensagem
  const [tipo, setTipo] = useState("info");
  const [titulo, setTitulo] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [historico, setHistorico] = useState<any[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "lojas"), snap => {
      setLojas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Loja)));
      setCarregando(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "broadcasts"), snap => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a: any, b: any) => (b.criadoEm?.toMillis?.() || 0) - (a.criadoEm?.toMillis?.() || 0))
        .slice(0, 20);
      setHistorico(lista);
    });
    return unsub;
  }, []);

  const estados = ["todos", ...Array.from(new Set(lojas.map(l => l.estado).filter(Boolean)))].sort();

  const destinatarios = lojas.filter(l => {
    if (filtroStatus === "ativas" && l.ativo === false) return false;
    if (filtroStatus === "suspensas" && l.ativo !== false) return false;
    if (filtroEstado !== "todos" && l.estado !== filtroEstado) return false;
    return true;
  });

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3500); };

  const enviar = async () => {
    if (!titulo.trim()) { toast("Informe o título da mensagem"); return; }
    if (!mensagem.trim()) { toast("Escreva a mensagem"); return; }
    if (destinatarios.length === 0) { toast("Nenhuma loja encontrada com esses filtros"); return; }

    setEnviando(true);
    try {
      const tipoObj = TIPOS.find(t => t.id === tipo)!;

      // Grava o broadcast
      await addDoc(collection(db, "broadcasts"), {
        tipo,
        tipoLabel: tipoObj.label,
        tipoIcon: tipoObj.icon,
        titulo: titulo.trim(),
        mensagem: mensagem.trim(),
        destinatariosFiltro: { estado: filtroEstado, status: filtroStatus },
        totalDestinatarios: destinatarios.length,
        slugs: destinatarios.map(l => l.slug),
        criadoEm: serverTimestamp(),
        lida: {},
      });

      // Cria notificação para cada loja
      for (const loja of destinatarios) {
        await addDoc(collection(db, `tenants/${loja.slug}/notificacoes`), {
          tipo,
          tipoIcon: tipoObj.icon,
          titulo: titulo.trim(),
          mensagem: mensagem.trim(),
          lida: false,
          criadoEm: serverTimestamp(),
          origem: "plataforma",
        });
      }

      toast(`✅ Mensagem enviada para ${destinatarios.length} loja${destinatarios.length > 1 ? "s" : ""}`);
      setTitulo("");
      setMensagem("");
    } catch (e) {
      toast("Erro ao enviar mensagem");
      console.error(e);
    } finally {
      setEnviando(false);
    }
  };

  const tipoAtual = TIPOS.find(t => t.id === tipo)!;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit',sans-serif", paddingBottom: 48 }}>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "48px 20px 24px" }}>
        <button onClick={() => navigate("/admin")} style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, padding: "6px 12px", color: "rgba(255,255,255,.5)", fontSize: "0.72rem", cursor: "pointer", marginBottom: 16 }}>
          ← Voltar ao Admin
        </button>
        <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.5rem", color: "#fff" }}>📢 Broadcast</div>
        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.35)", marginTop: 4 }}>
          Envie mensagens para lojas por filtro ou para todas de uma vez
        </div>
      </div>

      <div style={{ padding: "20px 16px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* FILTRO DE DESTINATÁRIOS */}
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px" }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 12 }}>👥 Destinatários</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            {(["todas","ativas","suspensas"] as const).map(s => (
              <button key={s} onClick={() => setFiltroStatus(s)}
                style={{ flex: 1, padding: "8px 6px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700,
                  background: filtroStatus === s ? "rgba(167,139,250,.2)" : "rgba(255,255,255,.05)",
                  color: filtroStatus === s ? "#a78bfa" : "rgba(255,255,255,.35)" }}>
                {s === "todas" ? "Todas" : s === "ativas" ? "🟢 Ativas" : "🚫 Suspensas"}
              </button>
            ))}
          </div>

          <div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Filtrar por estado</div>
            <select value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}
              style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.82rem", outline: "none", cursor: "pointer" }}>
              {estados.map(uf => <option key={uf} value={uf} style={{ background: "#0f0720" }}>{uf === "todos" ? "Todos os estados" : uf}</option>)}
            </select>
          </div>

          <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.5)" }}>Lojas selecionadas</span>
            <span style={{ fontWeight: 900, fontSize: "1rem", color: "#a78bfa" }}>{carregando ? "..." : destinatarios.length}</span>
          </div>
        </div>

        {/* TIPO DE MENSAGEM */}
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px" }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 12 }}>📋 Tipo de mensagem</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {TIPOS.map(t => (
              <button key={t.id} onClick={() => setTipo(t.id)}
                style={{ padding: "10px 12px", borderRadius: 12, border: `1px solid ${tipo === t.id ? t.cor + "60" : "rgba(255,255,255,.07)"}`, background: tipo === t.id ? `${t.cor}15` : "rgba(255,255,255,.03)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.1rem" }}>{t.icon}</span>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: tipo === t.id ? t.cor : "rgba(255,255,255,.45)" }}>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* COMPOSIÇÃO */}
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px" }}>
          <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 12 }}>✍️ Mensagem</div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", marginBottom: 5 }}>Título</div>
            <input value={titulo} onChange={e => setTitulo(e.target.value)}
              placeholder="Ex: Atualização de preços"
              style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
          </div>

          <div>
            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.35)", marginBottom: 5 }}>Mensagem</div>
            <textarea value={mensagem} onChange={e => setMensagem(e.target.value)}
              placeholder="Escreva aqui o conteúdo completo..."
              rows={4}
              style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", resize: "none", boxSizing: "border-box" }} />
          </div>

          {/* Preview */}
          {(titulo || mensagem) && (
            <div style={{ marginTop: 12, padding: "12px 14px", background: `${tipoAtual.cor}10`, border: `1px solid ${tipoAtual.cor}30`, borderRadius: 14 }}>
              <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Preview</div>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <span style={{ fontSize: "1.2rem" }}>{tipoAtual.icon}</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff" }}>{titulo || "Título..."}</div>
                  <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.5)", marginTop: 3, lineHeight: 1.5 }}>{mensagem || "Mensagem..."}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTÃO ENVIAR */}
        <button onClick={enviar} disabled={enviando || destinatarios.length === 0}
          style={{ padding: "16px", background: destinatarios.length === 0 ? "rgba(255,255,255,.05)" : `linear-gradient(135deg, ${tipoAtual.cor}, ${tipoAtual.cor}cc)`, border: "none", borderRadius: 16, fontWeight: 800, fontSize: "0.95rem", color: destinatarios.length === 0 ? "rgba(255,255,255,.2)" : "#fff", cursor: destinatarios.length === 0 ? "default" : "pointer", opacity: enviando ? 0.7 : 1 }}>
          {enviando ? "Enviando..." : `📢 Enviar para ${destinatarios.length} loja${destinatarios.length !== 1 ? "s" : ""}`}
        </button>

        {/* HISTÓRICO */}
        {historico.length > 0 && (
          <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 18, padding: "16px" }}>
            <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fff", marginBottom: 12 }}>📜 Histórico de envios</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {historico.map((b: any) => {
                const t = TIPOS.find(x => x.id === b.tipo) || TIPOS[0];
                return (
                  <div key={b.id} style={{ padding: "10px 12px", background: `${t.cor}08`, border: `1px solid ${t.cor}20`, borderRadius: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: "0.9rem" }}>{t.icon}</span>
                      <span style={{ fontWeight: 700, fontSize: "0.82rem", color: "#fff", flex: 1 }}>{b.titulo}</span>
                      <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.3)" }}>
                        {b.criadoEm?.toDate?.().toLocaleDateString("pt-BR") || "—"}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.4)", marginBottom: 4 }}>{b.mensagem}</div>
                    <div style={{ fontSize: "0.6rem", color: t.cor }}>
                      Enviado para {b.totalDestinatarios} loja{b.totalDestinatarios !== 1 ? "s" : ""} · {b.destinatariosFiltro?.estado !== "todos" ? b.destinatariosFiltro?.estado : "todos os estados"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* TOAST */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(15,7,32,.96)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 14, padding: "12px 20px", fontSize: "0.82rem", fontWeight: 700, color: "#fff", zIndex: 200, whiteSpace: "nowrap" }}>
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

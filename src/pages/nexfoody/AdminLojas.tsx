// src/pages/nexfoody/AdminLojas.tsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, onSnapshot, doc, updateDoc, deleteDoc,
  setDoc, serverTimestamp, getDoc,
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface Loja {
  id: string;
  nome: string;
  slug: string;
  categoria: string;
  cidade?: string;
  estado?: string;
  ativo: boolean;
  ownerId?: string;
  placeId?: string;
  refBy?: string;
  createdAt?: { toDate: () => Date } | null;
  pausaManual?: boolean;
  mensagemPausa?: string;
}

const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];
const CATEGORIAS = ["açaí","sorvetes","hamburguer","pizza","lanches","sucos","japonesa","brasileira","árabe","mexicana","italiana","outro"];

const CATEGORIAS_EMOJI: Record<string, string> = {
  "açaí": "🍧", "pizza": "🍕", "burger": "🍔", "lanche": "🥗", "sorvete": "🍦",
  "japonesa": "🍣", "brasileira": "🍖", "árabe": "🥙", "mexicana": "🌮", "italiana": "🍝",
};

function catEmoji(cat: string) {
  const k = Object.keys(CATEGORIAS_EMOJI).find(c => (cat||"").toLowerCase().includes(c));
  return k ? CATEGORIAS_EMOJI[k] : "🏪";
}

export default function AdminLojas() {
  const navigate = useNavigate();
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todas" | "ativas" | "pausadas" | "suspensas">("todas");
  const [processando, setProcessando] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [modalConfirm, setModalConfirm] = useState<{
    loja: Loja;
    acao: "pausar" | "retomar" | "suspender" | "reativar" | "excluir";
  } | null>(null);
  const [msgPausa, setMsgPausa] = useState("");
  const [configsCarregadas, setConfigsCarregadas] = useState<Record<string, { pausaManual: boolean; mensagemPausa: string; whatsapp: string; email: string; verificada: boolean }>>({});
  const [modalEditar, setModalEditar] = useState<Loja | null>(null);
  const [editNome, setEditNome] = useState("");
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [processandoBulk, setProcessandoBulk] = useState(false);
  const [editCidade, setEditCidade] = useState("");
  const [editEstado, setEditEstado] = useState("SP");
  const [editCategoria, setEditCategoria] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "lojas"), snap => {
      const lista = snap.docs.map(d => ({ id: d.id, ...d.data() } as Loja));
      lista.sort((a, b) => a.nome.localeCompare(b.nome));
      setLojas(lista);
      setCarregando(false);

      // Carrega configs de pausa em paralelo
      lista.forEach(async loja => {
        if (configsCarregadas[loja.slug]) return;
        try {
          const cfgSnap = await getDoc(doc(db, `tenants/${loja.slug}/config/loja`));
          if (cfgSnap.exists()) {
            const cfg = cfgSnap.data();
            setConfigsCarregadas(prev => ({
              ...prev,
              [loja.slug]: {
                pausaManual: cfg.pausaManual || false,
                mensagemPausa: cfg.mensagemPausa || "",
                whatsapp: cfg.whatsapp || "",
                email: cfg.email || "",
                verificada: cfg.verificada || false,
              },
            }));
          }
        } catch { /* silencioso */ }
      });
    });
    return unsub;
  }, []);

  const executarAcao = async (loja: Loja, acao: string, msg = "") => {
    setProcessando(loja.id);
    try {
      if (acao === "pausar") {
        await setDoc(doc(db, `tenants/${loja.slug}/config/loja`), {
          pausaManual: true,
          mensagemPausa: msg || "Loja temporariamente pausada pela administração NexFoody.",
        }, { merge: true });
        setConfigsCarregadas(prev => ({ ...prev, [loja.slug]: { ...prev[loja.slug], pausaManual: true, mensagemPausa: msg, whatsapp: prev[loja.slug]?.whatsapp || "", email: prev[loja.slug]?.email || "" } }));
        toast(`⏸️ ${loja.nome} pausada`);
      } else if (acao === "retomar") {
        await setDoc(doc(db, `tenants/${loja.slug}/config/loja`), {
          pausaManual: false,
        }, { merge: true });
        setConfigsCarregadas(prev => ({ ...prev, [loja.slug]: { ...prev[loja.slug], pausaManual: false, mensagemPausa: "", whatsapp: prev[loja.slug]?.whatsapp || "", email: prev[loja.slug]?.email || "" } }));
        toast(`✅ ${loja.nome} reaberta`);
      } else if (acao === "suspender") {
        await updateDoc(doc(db, "lojas", loja.slug), {
          ativo: false,
          suspensaEm: serverTimestamp(),
          motivoSuspensao: msg || "Suspensa pela administração",
        });
        // Também pausa
        await setDoc(doc(db, `tenants/${loja.slug}/config/loja`), {
          pausaManual: true,
          mensagemPausa: "Esta loja está temporariamente suspensa.",
        }, { merge: true });
        toast(`🚫 ${loja.nome} suspensa`);
      } else if (acao === "reativar") {
        await updateDoc(doc(db, "lojas", loja.slug), { ativo: true });
        await setDoc(doc(db, `tenants/${loja.slug}/config/loja`), {
          pausaManual: false,
        }, { merge: true });
        toast(`✅ ${loja.nome} reativada`);
      } else if (acao === "excluir") {
        // Suspende em vez de deletar (preserva histórico)
        await updateDoc(doc(db, "lojas", loja.slug), {
          ativo: false,
          excluida: true,
          excluidaEm: serverTimestamp(),
        });
        await setDoc(doc(db, `tenants/${loja.slug}/config/loja`), {
          pausaManual: true,
          cardapioAtivo: false,
          mensagemPausa: "Esta loja não está mais disponível.",
        }, { merge: true });
        toast(`🗑️ ${loja.nome} removida da plataforma`);
      }
    } catch (e) {
      toast("Erro ao executar ação. Tente novamente.");
    } finally {
      setProcessando(null);
      setModalConfirm(null);
      setMsgPausa("");
    }
  };

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  const abrirEditar = (loja: Loja) => {
    setModalEditar(loja);
    setEditNome(loja.nome);
    setEditCidade(loja.cidade || "");
    setEditEstado(loja.estado || "SP");
    setEditCategoria(loja.categoria || "outro");
  };

  const salvarEdicao = async () => {
    if (!modalEditar) return;
    if (!editNome.trim() || !editCidade.trim()) { toast("Preencha nome e cidade"); return; }
    setSalvando(true);
    try {
      await updateDoc(doc(db, "lojas", modalEditar.slug), {
        nome: editNome.trim(),
        cidade: editCidade.trim(),
        estado: editEstado,
        categoria: editCategoria,
      });
      // Atualiza também o tenant config com o nome da loja
      await setDoc(doc(db, `tenants/${modalEditar.slug}/config/loja`), {
        nomeLoja: editNome.trim(),
      }, { merge: true });
      toast(`✅ ${editNome} atualizada`);
      setModalEditar(null);
    } catch {
      toast("Erro ao salvar. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  const toggleSelecao = (slug: string) => {
    setSelecionadas(prev => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
  };

  const selecionarTodas = () => {
    if (selecionadas.size === listaFiltradaBase.length) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(listaFiltradaBase.map(l => l.slug)));
    }
  };

  const executarBulk = async (acao: "suspender" | "reativar" | "pausar" | "retomar") => {
    if (selecionadas.size === 0) return;
    setProcessandoBulk(true);
    const slugs = Array.from(selecionadas);
    try {
      for (const slug of slugs) {
        if (acao === "suspender") {
          await updateDoc(doc(db, "lojas", slug), { ativo: false, suspensaEm: serverTimestamp() });
          await setDoc(doc(db, `tenants/${slug}/config/loja`), { pausaManual: true, mensagemPausa: "Loja suspensa." }, { merge: true });
        } else if (acao === "reativar") {
          await updateDoc(doc(db, "lojas", slug), { ativo: true });
          await setDoc(doc(db, `tenants/${slug}/config/loja`), { pausaManual: false }, { merge: true });
        } else if (acao === "pausar") {
          await setDoc(doc(db, `tenants/${slug}/config/loja`), { pausaManual: true, mensagemPausa: "Loja temporariamente pausada." }, { merge: true });
        } else if (acao === "retomar") {
          await setDoc(doc(db, `tenants/${slug}/config/loja`), { pausaManual: false }, { merge: true });
        }
      }
      toast(`✅ ${slugs.length} loja${slugs.length > 1 ? "s" : ""} ${acao === "suspender" ? "suspensas" : acao === "reativar" ? "reativadas" : acao === "pausar" ? "pausadas" : "reabertas"}`);
      setSelecionadas(new Set());
      setModoSelecao(false);
    } catch {
      toast("Erro ao processar. Tente novamente.");
    } finally {
      setProcessandoBulk(false);
    }
  };

  const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const listaFiltradaBase = lojas
    .filter(l => {
      if (filtro === "ativas")    return l.ativo !== false && !configsCarregadas[l.slug]?.pausaManual;
      if (filtro === "pausadas")  return l.ativo !== false && configsCarregadas[l.slug]?.pausaManual;
      if (filtro === "suspensas") return l.ativo === false;
      return true;
    })
    .filter(l => !busca.trim() || normalizar(l.nome).includes(normalizar(busca)) || normalizar(l.slug).includes(normalizar(busca)));

  const listaFiltrada = listaFiltradaBase;

  const qtdAtivas    = lojas.filter(l => l.ativo !== false && !configsCarregadas[l.slug]?.pausaManual).length;
  const qtdPausadas  = lojas.filter(l => l.ativo !== false && configsCarregadas[l.slug]?.pausaManual).length;
  const qtdSuspensas = lojas.filter(l => l.ativo === false).length;

  const ACOES_CFG = {
    pausar:    { label: "Pausar loja",         cor: "#f59e0b", confirmLabel: "Pausar",    desc: "Os clientes verão a mensagem de pausa, mas a loja permanece cadastrada." },
    retomar:   { label: "Reabrir loja",        cor: "#22c55e", confirmLabel: "Reabrir",   desc: "A loja voltará a aparecer normalmente para os clientes." },
    suspender: { label: "Suspender loja",      cor: "#ef4444", confirmLabel: "Suspender", desc: "A loja ficará invisível na plataforma. O lojista não será notificado automaticamente." },
    reativar:  { label: "Reativar loja",       cor: "#22c55e", confirmLabel: "Reativar",  desc: "A loja voltará a ser visível na plataforma." },
    excluir:   { label: "Remover da plataforma", cor: "#ef4444", confirmLabel: "Remover",  desc: "A loja será removida definitivamente. Esta ação não pode ser desfeita facilmente." },
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit',sans-serif", paddingBottom: 40 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* ── HEADER ── */}
      <div style={{ background: "linear-gradient(135deg,#1a0a36,#0f0720)", padding: "48px 20px 24px", position: "relative" }}>
        <button onClick={() => navigate(-1)} style={{ position: "absolute", top: 16, left: 16, background: "rgba(255,255,255,.08)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "rgba(255,255,255,.6)", cursor: "pointer", fontSize: "1rem", display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <button
          onClick={() => { setModoSelecao(p => !p); setSelecionadas(new Set()); }}
          style={{ position: "absolute", top: 16, right: 16, background: modoSelecao ? "rgba(167,139,250,.2)" : "rgba(255,255,255,.08)", border: `1px solid ${modoSelecao ? "rgba(167,139,250,.4)" : "rgba(255,255,255,.15)"}`, borderRadius: 10, padding: "6px 12px", color: modoSelecao ? "#a78bfa" : "rgba(255,255,255,.5)", cursor: "pointer", fontSize: "0.7rem", fontWeight: 700 }}>
          {modoSelecao ? "✕ Cancelar" : "☑️ Selecionar"}
        </button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.14em", color: "rgba(255,255,255,.35)", marginBottom: 6 }}>Painel Admin</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.5rem", color: "#fff" }}>🏪 Lojas</div>
        </div>
      </div>

      {/* ── STATS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6, padding: "14px 16px 0" }}>
        {[
          { label: "Total", val: lojas.length, cor: "#a78bfa" },
          { label: "Ativas", val: qtdAtivas, cor: "#22c55e" },
          { label: "Pausadas", val: qtdPausadas, cor: "#f59e0b" },
          { label: "Suspensas", val: qtdSuspensas, cor: "#ef4444" },
        ].map((s, i) => (
          <div key={i} style={{ background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "10px 6px", textAlign: "center" }}>
            <div style={{ fontWeight: 900, fontSize: "1rem", color: s.cor }}>{s.val}</div>
            <div style={{ fontSize: "0.52rem", color: "rgba(255,255,255,.3)", textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── BUSCA ── */}
      <div style={{ padding: "12px 16px 0" }}>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por nome ou slug..."
          style={{ width: "100%", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, padding: "10px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      {/* ── FILTROS ── */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px 0", overflowX: "auto" }}>
        {(["todas","ativas","pausadas","suspensas"] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: "6px 12px", borderRadius: 20, border: "none", cursor: "pointer", flexShrink: 0,
            fontFamily: "'Outfit',sans-serif", fontSize: "0.7rem", fontWeight: 700,
            background: filtro === f ? "rgba(167,139,250,.15)" : "rgba(255,255,255,.05)",
            color: filtro === f ? "#a78bfa" : "rgba(255,255,255,.35)",
          }}>
            {f === "todas" ? `Todas (${lojas.length})` : f === "ativas" ? `🟢 Ativas (${qtdAtivas})` : f === "pausadas" ? `⏸️ Pausadas (${qtdPausadas})` : `🚫 Suspensas (${qtdSuspensas})`}
          </button>
        ))}
      </div>

      {/* ── BARRA BULK ── */}
      <AnimatePresence>
        {modoSelecao && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            style={{ margin: "10px 16px 0", background: "rgba(167,139,250,.08)", border: "1px solid rgba(167,139,250,.2)", borderRadius: 16, padding: "12px 14px" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <button onClick={selecionarTodas} style={{ background: "none", border: "none", fontSize: "0.72rem", fontWeight: 700, color: "#a78bfa", cursor: "pointer", padding: 0 }}>
                {selecionadas.size === listaFiltradaBase.length && listaFiltradaBase.length > 0 ? "Desmarcar todas" : `Selecionar todas (${listaFiltradaBase.length})`}
              </button>
              <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.4)" }}>
                {selecionadas.size} selecionada{selecionadas.size !== 1 ? "s" : ""}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { label: "▶️ Reativar", acao: "reativar" as const, cor: "#22c55e" },
                { label: "⏸️ Pausar",   acao: "pausar"   as const, cor: "#f59e0b" },
                { label: "▶ Retomar",  acao: "retomar"  as const, cor: "#60a5fa" },
                { label: "🚫 Suspender", acao: "suspender" as const, cor: "#ef4444" },
              ].map(b => (
                <button key={b.acao}
                  onClick={() => { if (selecionadas.size > 0 && !processandoBulk) executarBulk(b.acao); }}
                  disabled={selecionadas.size === 0 || processandoBulk}
                  style={{ padding: "7px 12px", background: `${b.cor}15`, border: `1px solid ${b.cor}35`, borderRadius: 10, fontSize: "0.7rem", fontWeight: 700, color: selecionadas.size === 0 ? "rgba(255,255,255,.2)" : b.cor, cursor: selecionadas.size === 0 ? "default" : "pointer" }}>
                  {processandoBulk ? "..." : b.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LISTA ── */}
      <div style={{ padding: "12px 16px 0" }}>
        {carregando ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
            <div style={{ width: 32, height: 32, border: "3px solid rgba(167,139,250,.3)", borderTop: "3px solid #a78bfa", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          </div>
        ) : listaFiltrada.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,.25)" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: 10 }}>🏪</div>
            <div style={{ fontSize: "0.85rem" }}>Nenhuma loja encontrada</div>
          </div>
        ) : listaFiltrada.map(loja => {
          const cfg = configsCarregadas[loja.slug];
          const suspensa = loja.ativo === false;
          const pausada  = !suspensa && cfg?.pausaManual;
          const aberta   = !suspensa && !pausada;

          const statusCor   = suspensa ? "#ef4444" : pausada ? "#f59e0b" : "#22c55e";
          const statusLabel = suspensa ? "Suspensa" : pausada ? "Pausada" : "Aberta";
          const statusIcon  = suspensa ? "🚫" : pausada ? "⏸️" : "🟢";

          return (
            <motion.div key={loja.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ background: suspensa ? "rgba(239,68,68,.05)" : "rgba(255,255,255,.03)", border: `1px solid ${suspensa ? "rgba(239,68,68,.2)" : "rgba(255,255,255,.07)"}`, borderRadius: 18, padding: "14px 16px", marginBottom: 8 }}>

              {/* Info principal */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
                {modoSelecao && (
                  <button onClick={() => toggleSelecao(loja.slug)}
                    style={{ width: 24, height: 24, borderRadius: 6, border: `2px solid ${selecionadas.has(loja.slug) ? "#a78bfa" : "rgba(255,255,255,.2)"}`, background: selecionadas.has(loja.slug) ? "#a78bfa" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, marginTop: 9 }}>
                    {selecionadas.has(loja.slug) && <span style={{ color: "#fff", fontSize: "0.7rem", fontWeight: 900 }}>✓</span>}
                  </button>
                )}
                <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(255,255,255,.06)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>
                  {catEmoji(loja.categoria)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff", marginBottom: 2 }}>{loja.nome}</div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.35)" }}>
                    /{loja.slug} · {loja.categoria}
                    {loja.createdAt && ` · ${loja.createdAt.toDate().toLocaleDateString("pt-BR")}`}
                  </div>
                  <div style={{ fontSize: "0.68rem", marginTop: 2 }}>
                    {loja.cidade && loja.estado
                      ? <span style={{ color: "#60a5fa" }}>📍 {loja.cidade} / {loja.estado}</span>
                      : <span style={{ color: "#f59e0b" }}>⚠️ Cidade/estado não informados</span>
                    }
                  </div>
                  {cfg?.mensagemPausa && pausada && (
                    <div style={{ fontSize: "0.65rem", color: "#f59e0b", marginTop: 3, fontStyle: "italic" }}>"{cfg.mensagemPausa}"</div>
                  )}
                </div>
                <span style={{ fontSize: "0.65rem", fontWeight: 800, color: statusCor, background: `${statusCor}18`, padding: "3px 9px", borderRadius: 10, flexShrink: 0 }}>
                  {statusIcon} {statusLabel}
                </span>
              </div>

              {/* Contato rápido */}
              {cfg?.whatsapp && (
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <a
                    href={`https://wa.me/${cfg.whatsapp.replace(/\D/g, "")}`}
                    target="_blank" rel="noopener noreferrer"
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", background: "rgba(37,211,102,.12)", border: "1px solid rgba(37,211,102,.25)", borderRadius: 10, fontSize: "0.72rem", fontWeight: 700, color: "#25d366", textDecoration: "none" }}>
                    💬 WhatsApp
                  </a>
                  <a
                    href={`tel:${cfg.whatsapp.replace(/\D/g, "")}`}
                    style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px", background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.22)", borderRadius: 10, fontSize: "0.72rem", fontWeight: 700, color: "#60a5fa", textDecoration: "none" }}>
                    📞 Ligar
                  </a>
                  <button
                    onClick={() => { navigator.clipboard.writeText(cfg.whatsapp); toast(`📋 ${cfg.whatsapp} copiado`); }}
                    style={{ padding: "8px 10px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, fontSize: "0.72rem", color: "rgba(255,255,255,.4)", cursor: "pointer" }}
                    title="Copiar número">
                    📋
                  </button>
                </div>
              )}

              {/* Ações */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {/* Ver loja */}
                <button
                  onClick={() => navigate(`/loja/${loja.slug}`)}
                  style={{ padding: "7px 12px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "rgba(255,255,255,.6)", cursor: "pointer" }}>
                  Ver →
                </button>

                {/* Editar */}
                <button
                  onClick={() => abrirEditar(loja)}
                  style={{ padding: "7px 12px", background: "rgba(96,165,250,.1)", border: "1px solid rgba(96,165,250,.25)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "#60a5fa", cursor: "pointer" }}>
                  ✏️ Editar
                </button>

                {/* Pausar / Retomar */}
                {!suspensa && (
                  aberta
                    ? <button onClick={() => { setModalConfirm({ loja, acao: "pausar" }); setMsgPausa(""); }}
                        style={{ padding: "7px 12px", background: "rgba(245,158,11,.1)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "#f59e0b", cursor: "pointer" }}>
                        ⏸️ Pausar
                      </button>
                    : <button onClick={() => setModalConfirm({ loja, acao: "retomar" })}
                        style={{ padding: "7px 12px", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "#22c55e", cursor: "pointer" }}>
                        ▶️ Reabrir
                      </button>
                )}

                {/* Suspender / Reativar */}
                {!suspensa
                  ? <button onClick={() => { setModalConfirm({ loja, acao: "suspender" }); setMsgPausa(""); }}
                      style={{ padding: "7px 12px", background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.2)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "#ef4444", cursor: "pointer" }}>
                      🚫 Suspender
                    </button>
                  : <button onClick={() => setModalConfirm({ loja, acao: "reativar" })}
                      style={{ padding: "7px 12px", background: "rgba(34,197,94,.1)", border: "1px solid rgba(34,197,94,.25)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "#22c55e", cursor: "pointer" }}>
                      ✅ Reativar
                    </button>
                }

                {/* Verificar */}
                <button
                  onClick={async () => {
                    const atual = configsCarregadas[loja.slug]?.verificada || false;
                    await setDoc(doc(db, `tenants/${loja.slug}/config/loja`), { verificada: !atual }, { merge: true });
                    setConfigsCarregadas(prev => ({ ...prev, [loja.slug]: { ...prev[loja.slug], verificada: !atual } }));
                    toast(`${!atual ? "✅ Loja verificada" : "Verificação removida"}`);
                  }}
                  style={{ padding: "7px 12px", background: cfg?.verificada ? "linear-gradient(135deg,#1d9bf0,#1a8cd8)" : "rgba(255,255,255,.06)", border: `1px solid ${cfg?.verificada ? "#1d9bf0" : "rgba(255,255,255,.12)"}`, borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: cfg?.verificada ? "#fff" : "rgba(255,255,255,.4)", cursor: "pointer", boxShadow: cfg?.verificada ? "0 2px 8px rgba(29,155,240,.35)" : "none" }}>
                  {cfg?.verificada ? "✓ Verificada" : "Verificar"}
                </button>

                {/* Excluir */}
                <button onClick={() => setModalConfirm({ loja, acao: "excluir" })}
                  style={{ padding: "7px 12px", background: "rgba(239,68,68,.06)", border: "1px solid rgba(239,68,68,.15)", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, color: "rgba(239,68,68,.7)", cursor: "pointer" }}>
                  🗑️ Excluir
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── MODAL CONFIRMAR AÇÃO ── */}
      <AnimatePresence>
        {modalConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalConfirm(null)}
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
                {ACOES_CFG[modalConfirm.acao].label}
              </div>
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,.5)", marginBottom: 4 }}>
                Loja: <strong style={{ color: "#fff" }}>{modalConfirm.loja.nome}</strong>
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.35)", marginBottom: 18, lineHeight: 1.6 }}>
                {ACOES_CFG[modalConfirm.acao].desc}
              </div>

              {/* Campo de motivo para pausar/suspender/excluir */}
              {["pausar","suspender","excluir"].includes(modalConfirm.acao) && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", marginBottom: 6 }}>
                    {modalConfirm.acao === "pausar" ? "Mensagem para o cliente (opcional)" : "Motivo interno (opcional)"}
                  </div>
                  <input
                    value={msgPausa}
                    onChange={e => setMsgPausa(e.target.value)}
                    placeholder={modalConfirm.acao === "pausar" ? "Ex: Voltamos em breve! 🍓" : "Ex: Violação dos termos de uso"}
                    style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setModalConfirm(null)}
                  style={{ flex: 1, padding: "13px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, fontWeight: 700, fontSize: "0.88rem", color: "rgba(255,255,255,.5)", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button
                  onClick={() => executarAcao(modalConfirm.loja, modalConfirm.acao, msgPausa)}
                  disabled={processando === modalConfirm.loja.id}
                  style={{
                    flex: 2, padding: "13px", border: "none", borderRadius: 14,
                    fontWeight: 800, fontSize: "0.9rem", cursor: "pointer",
                    background: ["retomar","reativar"].includes(modalConfirm.acao)
                      ? "linear-gradient(135deg,#22c55e,#16a34a)"
                      : modalConfirm.acao === "pausar"
                        ? "linear-gradient(135deg,#f59e0b,#d97706)"
                        : "linear-gradient(135deg,#ef4444,#b91c1c)",
                    color: "#fff",
                    opacity: processando === modalConfirm.loja.id ? 0.6 : 1,
                  }}
                >
                  {processando === modalConfirm.loja.id ? "Processando..." : ACOES_CFG[modalConfirm.acao].confirmLabel}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── MODAL EDITAR ── */}
      <AnimatePresence>
        {modalEditar && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setModalEditar(null)}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 100 }} />
            <motion.div
              initial={{ y: "100%", opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 101, background: "#0f0720", borderRadius: "24px 24px 0 0", border: "1px solid rgba(255,255,255,.1)", padding: "20px 20px 40px" }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,.2)" }} />
              </div>
              <div style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.1rem", color: "#fff", marginBottom: 18 }}>
                ✏️ Editar loja
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.4)", marginBottom: 5 }}>Nome da loja</div>
                  <input value={editNome} onChange={e => setEditNome(e.target.value)}
                    style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", boxSizing: "border-box" }} />
                </div>

                <div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.4)", marginBottom: 5 }}>Categoria</div>
                  <select value={editCategoria} onChange={e => setEditCategoria(e.target.value)}
                    style={{ width: "100%", background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", cursor: "pointer" }}>
                    {CATEGORIAS.map(c => <option key={c} value={c} style={{ background: "#0f0720" }}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>

                <div>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.4)", marginBottom: 5 }}>📍 Localização <span style={{ color: "#ef4444" }}>*</span></div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={editCidade} onChange={e => setEditCidade(e.target.value)} placeholder="Cidade"
                      style={{ flex: 1, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "11px 14px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none" }} />
                    <select value={editEstado} onChange={e => setEditEstado(e.target.value)}
                      style={{ width: 80, background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.15)", borderRadius: 12, padding: "11px 10px", color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", outline: "none", cursor: "pointer", flexShrink: 0 }}>
                      {UFS.map(uf => <option key={uf} value={uf} style={{ background: "#0f0720" }}>{uf}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setModalEditar(null)}
                  style={{ flex: 1, padding: "13px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 14, fontWeight: 700, fontSize: "0.88rem", color: "rgba(255,255,255,.5)", cursor: "pointer" }}>
                  Cancelar
                </button>
                <button onClick={salvarEdicao} disabled={salvando}
                  style={{ flex: 2, padding: "13px", border: "none", borderRadius: 14, fontWeight: 800, fontSize: "0.9rem", cursor: "pointer", background: "linear-gradient(135deg,#60a5fa,#3b82f6)", color: "#fff", opacity: salvando ? 0.6 : 1 }}>
                  {salvando ? "Salvando..." : "Salvar alterações"}
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
            style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "rgba(15,7,32,.96)", border: "1px solid rgba(167,139,250,.3)", borderRadius: 14, padding: "12px 20px", fontSize: "0.82rem", fontWeight: 700, color: "#fff", zIndex: 200, whiteSpace: "nowrap", backdropFilter: "blur(12px)" }}>
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

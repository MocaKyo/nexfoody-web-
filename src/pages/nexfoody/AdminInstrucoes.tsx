// src/pages/nexfoody/AdminInstrucoes.tsx
// Editor de instruções para novos lojistas
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { motion, AnimatePresence } from "framer-motion";

interface Secao {
  id: string;
  icon: string;
  titulo: string;
  conteudo: string;
}

interface Suporte {
  whatsapp: string;
  email: string;
  mensagem: string;
}

const SECOES_DEFAULT: Secao[] = [
  { id: "config",    icon: "⚙️", titulo: "Configurações básicas",      conteudo: "" },
  { id: "categorias",icon: "🏷️", titulo: "Criando categorias",          conteudo: "" },
  { id: "produtos",  icon: "🛍️", titulo: "Adicionando seus itens",      conteudo: "" },
  { id: "delivery",  icon: "🚚", titulo: "Configurando o delivery",      conteudo: "" },
  { id: "ia",        icon: "🤖", titulo: "Ativando a IA no atendimento", conteudo: "" },
  { id: "feed",      icon: "📱", titulo: "Aparecendo no feed",           conteudo: "" },
  { id: "pedidos",   icon: "🛒", titulo: "Gerenciando pedidos",          conteudo: "" },
];

export default function AdminInstrucoes() {
  const navigate = useNavigate();
  const [titulo, setTitulo] = useState("Como montar sua loja");
  const [subtitulo, setSubtitulo] = useState("Guia completo do zero ao primeiro pedido");
  const [secoes, setSecoes] = useState<Secao[]>(SECOES_DEFAULT);
  const [suporte, setSuporte] = useState<Suporte>({ whatsapp: "", email: "", mensagem: "Ficou com dúvida? Nossa equipe está aqui para ajudar. Entre em contato e te respondemos rapidinho! 🚀" });
  const [secaoAtiva, setSecaoAtiva] = useState<string | null>("config");
  const [salvando, setSalvando] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, "plataforma", "instrucoes")).then(d => {
      if (d.exists()) {
        const data = d.data();
        if (data.titulo) setTitulo(data.titulo);
        if (data.subtitulo) setSubtitulo(data.subtitulo);
        if (data.secoes?.length) setSecoes(data.secoes);
        if (data.suporte) setSuporte({ whatsapp: data.suporte.whatsapp || "", email: data.suporte.email || "", mensagem: data.suporte.mensagem || "" });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const updateSecao = (id: string, field: keyof Secao, value: string) => {
    setSecoes(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const addSecao = () => {
    const id = `sec_${Date.now()}`;
    setSecoes(prev => [...prev, { id, icon: "📌", titulo: "Nova seção", conteudo: "" }]);
    setSecaoAtiva(id);
  };

  const removeSecao = (id: string) => {
    setSecoes(prev => prev.filter(s => s.id !== id));
    if (secaoAtiva === id) setSecaoAtiva(null);
  };

  const moveSecao = (id: string, dir: -1 | 1) => {
    setSecoes(prev => {
      const idx = prev.findIndex(s => s.id === id);
      const novo = [...prev];
      const [item] = novo.splice(idx, 1);
      novo.splice(idx + dir, 0, item);
      return novo;
    });
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await setDoc(doc(db, "plataforma", "instrucoes"), {
        titulo, subtitulo, secoes, suporte,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (e) { console.error(e); }
    finally { setSalvando(false); }
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#07030f", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid rgba(124,58,237,.3)", borderTop: "3px solid #7c3aed", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#07030f,#0f0520)", paddingBottom: 80, fontFamily: "'Outfit',sans-serif" }}>

      {/* ── HEADER ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(7,3,15,.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,.07)", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/admin")} style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,.07)", border: "none", cursor: "pointer", color: "#fff", fontSize: "1rem" }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>Instruções para lojistas</div>
          <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,.35)" }}>Conteúdo editável • Visível para novos cadastros</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={() => window.open("/instrucoes", "_blank")} style={{ background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 10, padding: "8px 12px", color: "rgba(255,255,255,.6)", fontFamily: "'Outfit',sans-serif", fontWeight: 600, fontSize: "0.75rem", cursor: "pointer" }}>
            👁 Preview
          </button>
          <button onClick={salvar} disabled={salvando}
            style={{ background: salvando ? "rgba(124,58,237,.4)" : savedOk ? "rgba(34,197,94,.3)" : "linear-gradient(135deg,#7c3aed,#6d28d9)", border: savedOk ? "1px solid rgba(34,197,94,.5)" : "none", borderRadius: 10, padding: "8px 16px", color: savedOk ? "#4ade80" : "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "0.82rem", cursor: salvando ? "default" : "pointer" }}>
            {salvando ? "⏳ Salvando..." : savedOk ? "✅ Salvo!" : "Salvar"}
          </button>
        </div>
      </div>

      <div style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* ── TÍTULO E SUBTÍTULO ── */}
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "16px" }}>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>Cabeçalho da página</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.45)", display: "block", marginBottom: 4 }}>Título principal</label>
              <input value={titulo} onChange={e => setTitulo(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.9rem", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.45)", display: "block", marginBottom: 4 }}>Subtítulo</label>
              <input value={subtitulo} onChange={e => setSubtitulo(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", boxSizing: "border-box" }} />
            </div>
          </div>
        </div>

        {/* ── SEÇÕES ── */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>
              Seções ({secoes.length})
            </div>
            <button onClick={addSecao}
              style={{ display: "flex", alignItems: "center", gap: 5, background: "rgba(124,58,237,.2)", border: "1px solid rgba(124,58,237,.4)", borderRadius: 8, padding: "5px 12px", color: "#a78bfa", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.75rem", cursor: "pointer" }}>
              + Nova seção
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {secoes.map((s, i) => (
              <div key={s.id} style={{ background: secaoAtiva === s.id ? "rgba(124,58,237,.1)" : "rgba(255,255,255,.03)", border: `1px solid ${secaoAtiva === s.id ? "rgba(124,58,237,.4)" : "rgba(255,255,255,.07)"}`, borderRadius: 14, overflow: "hidden" }}>

                {/* Cabeçalho da seção */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                  <input value={s.icon} onChange={e => updateSecao(s.id, "icon", e.target.value)}
                    style={{ width: 38, height: 38, textAlign: "center", fontSize: "1.2rem", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 8, color: "#fff", fontFamily: "serif", cursor: "text" }} />
                  <input value={s.titulo} onChange={e => updateSecao(s.id, "titulo", e.target.value)}
                    onClick={() => setSecaoAtiva(s.id)}
                    style={{ flex: 1, padding: "8px 10px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 8, color: "#fff", fontFamily: "'Outfit',sans-serif", fontWeight: 700, fontSize: "0.85rem" }} />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => i > 0 && moveSecao(s.id, -1)} disabled={i === 0}
                      style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,.05)", border: "none", cursor: i > 0 ? "pointer" : "default", color: i > 0 ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.15)", fontSize: "0.8rem" }}>↑</button>
                    <button onClick={() => i < secoes.length - 1 && moveSecao(s.id, 1)} disabled={i === secoes.length - 1}
                      style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(255,255,255,.05)", border: "none", cursor: i < secoes.length - 1 ? "pointer" : "default", color: i < secoes.length - 1 ? "rgba(255,255,255,.5)" : "rgba(255,255,255,.15)", fontSize: "0.8rem" }}>↓</button>
                    <button onClick={() => setSecaoAtiva(secaoAtiva === s.id ? null : s.id)}
                      style={{ width: 28, height: 28, borderRadius: 6, background: secaoAtiva === s.id ? "rgba(124,58,237,.25)" : "rgba(255,255,255,.05)", border: "none", cursor: "pointer", color: secaoAtiva === s.id ? "#a78bfa" : "rgba(255,255,255,.5)", fontSize: "0.85rem" }}>✏️</button>
                    <button onClick={() => removeSecao(s.id)}
                      style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(239,68,68,.1)", border: "none", cursor: "pointer", color: "#f87171", fontSize: "0.8rem" }}>✕</button>
                  </div>
                </div>

                {/* Textarea de conteúdo */}
                <AnimatePresence>
                  {secaoAtiva === s.id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: "hidden" }}>
                      <div style={{ padding: "0 12px 12px" }}>
                        <label style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", display: "block", marginBottom: 5 }}>
                          Conteúdo (separe parágrafos com Enter)
                        </label>
                        <textarea value={s.conteudo} onChange={e => updateSecao(s.id, "conteudo", e.target.value)} rows={8}
                          placeholder="Explique aqui como funciona esta etapa..."
                          style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "rgba(255,255,255,.8)", fontFamily: "'Outfit',sans-serif", fontSize: "0.83rem", resize: "vertical", lineHeight: 1.6, boxSizing: "border-box" }} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>

        {/* ── SUPORTE ── */}
        <div style={{ background: "linear-gradient(135deg,rgba(34,197,94,.07),rgba(16,185,129,.03))", border: "1px solid rgba(34,197,94,.18)", borderRadius: 16, padding: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <span style={{ fontSize: "1.2rem" }}>💬</span>
            <div style={{ fontSize: "0.7rem", color: "rgba(34,197,94,.7)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".06em" }}>Contato de suporte</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.45)", display: "block", marginBottom: 4 }}>Mensagem de introdução</label>
              <textarea value={suporte.mensagem} onChange={e => setSuporte(p => ({ ...p, mensagem: e.target.value }))} rows={3}
                style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "rgba(255,255,255,.8)", fontFamily: "'Outfit',sans-serif", fontSize: "0.83rem", resize: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.45)", display: "block", marginBottom: 4 }}>WhatsApp (somente números)</label>
              <input value={suporte.whatsapp} onChange={e => setSuporte(p => ({ ...p, whatsapp: e.target.value }))}
                placeholder="ex: 98991234567"
                style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.45)", display: "block", marginBottom: 4 }}>E-mail de suporte</label>
              <input value={suporte.email} onChange={e => setSuporte(p => ({ ...p, email: e.target.value }))}
                placeholder="ex: suporte@nexfoody.com"
                style={{ width: "100%", padding: "10px 12px", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#fff", fontFamily: "'Outfit',sans-serif", fontSize: "0.85rem", boxSizing: "border-box" }} />
            </div>
          </div>
        </div>

        {/* ── BOTÃO SALVAR FIXO ── */}
        <button onClick={salvar} disabled={salvando}
          style={{ width: "100%", padding: "16px", background: salvando ? "rgba(124,58,237,.4)" : savedOk ? "rgba(34,197,94,.25)" : "linear-gradient(135deg,#7c3aed,#6d28d9)", border: savedOk ? "1px solid rgba(34,197,94,.5)" : "none", borderRadius: 14, fontFamily: "'Outfit',sans-serif", fontWeight: 900, fontSize: "1rem", color: savedOk ? "#4ade80" : "#fff", cursor: salvando ? "default" : "pointer", boxShadow: "0 8px 24px rgba(124,58,237,.2)" }}>
          {salvando ? "⏳ Salvando..." : savedOk ? "✅ Instruções salvas!" : "💾 Salvar instruções"}
        </button>

      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

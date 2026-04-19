import React, { useState, useEffect } from "react";
import { collection, doc, getDoc, getDocs, onSnapshot, query, orderBy, setDoc, updateDoc, where, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Cupons() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cupons, setCupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [seguindo, setSeguindo] = useState(false);
  const [coletados, setColetados] = useState({}); // { cupomId: true }
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const unsubCupons = onSnapshot(query(collection(db, "cupons"), where("ativo", "==", true), orderBy("createdAt", "desc")), snap => {
      const ativos = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => {
        if (!c.dataExpiracao) return true;
        const exp = c.dataExpiracao?.toDate ? c.dataExpiracao.toDate() : new Date(c.dataExpiracao);
        return exp > new Date();
      });
      setCupons(ativos);
      setLoading(false);
    });
    return unsubCupons;
  }, []);

  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "seguidoresLoja", user.uid)).then(d => setSeguindo(d.exists()));
    // Verificar quais cupons o usuário já coletou
    getDocs(query(collection(db, "cuponsColetados"), where("userId", "==", user.uid))).then(snap => {
      const map = {};
      snap.docs.forEach(d => { map[d.data().cupomId] = true; });
      setColetados(map);
    });
  }, [user]);

  const coletarCupom = async (cupom) => {
    if (!user) { navigate("/login"); return; }
    if (!seguindo) {
      setToast({ msg: "❤️ Siga a loja primeiro para pegar cupons!", tipo: "warn" });
      return;
    }
    if (coletados[cupom.id]) {
      setToast({ msg: "Você já tem este cupom!", tipo: "info" });
      return;
    }
    try {
      await setDoc(doc(db, "cuponsColetados", `${cupom.id}_${user.uid}`), {
        cupomId: cupom.id,
        userId: user.uid,
        userNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        coletadoEm: serverTimestamp(),
      });
      await updateDoc(doc(db, "cupons", cupom.id), {
        usosTotal: (cupom.usosTotal || 0) + 1,
        usadoPor: [...(cupom.usadoPor || []), user.uid],
      });
      setColetados(p => ({ ...p, [cupom.id]: true }));
      setToast({ msg: `🎉 Cupom ${cupom.codigo} é seu!`, tipo: "success" });
    } catch (e) {
      console.error(e);
      setToast({ msg: "Erro ao coletar cupom.", tipo: "error" });
    }
  };

  const descricaoCupom = (c) => {
    if (c.tipo === "porcentagem") return `${c.valor}% OFF`;
    if (c.tipo === "fixo") return `R$ ${c.valor.toFixed(2).replace(".", ",")} OFF`;
    if (c.tipo === "frete") return "Frete Grátis";
    return "";
  };

  const expiraEm = (c) => {
    if (!c.dataExpiracao) return null;
    const exp = c.dataExpiracao?.toDate ? c.dataExpiracao.toDate() : new Date(c.dataExpiracao);
    const diff = exp - new Date();
    const dias = Math.ceil(diff / 86400000);
    if (dias <= 0) return "Expirado";
    if (dias === 1) return "Expira amanhã";
    if (dias <= 7) return `Expira em ${dias} dias`;
    return `Expira ${exp.toLocaleDateString("pt-BR")}`;
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(15,5,24,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--gold)" }}>
          🎟️ Cupons da Loja
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* Toast simples */}
      {toast && (
        <div onClick={() => setToast(null)} style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", zIndex: 999, background: toast.tipo === "success" ? "var(--green)" : toast.tipo === "error" ? "var(--red)" : "var(--purple2)", color: "#fff", borderRadius: 10, padding: "8px 16px", fontSize: "0.8rem", fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,0.4)", cursor: "pointer", maxWidth: "90vw", textAlign: "center" }}>
          {toast.msg}
        </div>
      )}

      {/* Banner seguir */}
      {!seguindo && (
        <div style={{ margin: "12px 16px", padding: "12px 14px", background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(236,72,153,0.05))", border: "1px solid rgba(236,72,153,0.3)", borderRadius: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: "1.3rem" }}>❤️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--text)" }}>Siga a loja para pegar cupons</div>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>Acesse o Feed e clique em ❤️ Seguir</div>
          </div>
          <button onClick={() => navigate("/feed")} style={{ background: "linear-gradient(135deg, #ec4899, #be185d)", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer" }}>
            Seguir
          </button>
        </div>
      )}

      {/* Cupons */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px" }}>
        {loading && <div style={{ textAlign: "center", padding: 40, color: "var(--text3)" }}>Carregando...</div>}

        {!loading && cupons.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🎟️</div>
            <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text2)" }}>Nenhum cupom disponível</div>
            <div style={{ fontSize: "0.8rem", color: "var(--text3)", marginTop: 6 }}>Fique de olho no Feed para novos cupons!</div>
          </div>
        )}

        {cupons.map(c => {
          const jaColetou = !!coletados[c.id];
          const expirado = expiraEm(c) === "Expirado";
          return (
            <div key={c.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 16px", marginBottom: 10, position: "relative", overflow: "hidden" }}>
              {/* Linha colorida no topo */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: jaColetou ? "var(--green)" : "linear-gradient(90deg, #f5c518, #ec4899)" }} />

              <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                {/* Emojis / Ícone */}
                <div style={{ fontSize: "2.2rem", flexShrink: 0 }}>
                  {c.tipo === "frete" ? "🚚" : c.tipo === "fixo" ? "💰" : "🔥"}
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                    <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 900, color: jaColetou ? "var(--green)" : "var(--gold)" }}>
                      {descricaoCupom(c)}
                    </span>
                    {jaColetou && <span style={{ fontSize: "0.65rem", background: "rgba(22,163,74,0.15)", color: "var(--green)", border: "1px solid rgba(22,163,74,0.3)", borderRadius: 20, padding: "1px 6px", fontWeight: 700 }}>Coletado</span>}
                  </div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)", fontFamily: "monospace", letterSpacing: 1 }}>{c.codigo}</div>
                  {c.valorMinimo && <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 2 }}>Mínimo: R$ {Number(c.valorMinimo).toFixed(2).replace(".", ",")}</div>}
                  {expirado ? (
                    <div style={{ fontSize: "0.65rem", color: "var(--red)", marginTop: 2, fontWeight: 700 }}>Expirado</div>
                  ) : expiraEm(c) && (
                    <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 2 }}>{expiraEm(c)}</div>
                  )}
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>{c.usosTotal || 0} pessoas já pegaram</div>
                </div>

                {/* Botão */}
                <button
                  onClick={() => coletarCupom(c)}
                  disabled={jaColetou || expirado}
                  style={{
                    background: jaColetou ? "rgba(22,163,74,0.1)" : "linear-gradient(135deg, #16a34a, #15803d)",
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 14px",
                    cursor: jaColetou || expirado ? "not-allowed" : "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    boxShadow: jaColetou || expirado ? "none" : "0 2px 8px rgba(22,163,74,0.35)",
                    opacity: jaColetou || expirado ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  <span style={{ fontSize: "1rem" }}>{jaColetou ? "✓" : "➕"}</span>
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, color: jaColetou ? "var(--green)" : "#fff" }}>
                    {jaColetou ? "Pego!" : "Pegar"}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

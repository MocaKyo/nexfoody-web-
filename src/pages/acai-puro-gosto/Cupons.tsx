import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTenant } from "../../contexts/TenantContext";
import { collection, query, where, orderBy, onSnapshot, doc, setDoc, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Cupom } from "../../types/tenant";

export default function Cupons() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [loading, setLoading] = useState(true);
  const [coletados, setColetados] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState<{ text: string; tipo: string } | null>(null);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, `tenants/${tenantId}/cupons`),
      where("ativo", "==", true),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      const ativos = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Cupom))
        .filter(c => {
          if (!c.dataExpiracao) return true;
          const exp = typeof c.dataExpiracao === "string" ? new Date(c.dataExpiracao) : c.dataExpiracao.toDate();
          return exp > new Date();
        });
      setCupons(ativos);
      setLoading(false);
    });
    return unsub;
  }, [tenantId]);

  useEffect(() => {
    if (!user?.uid) return;
    getDocs(query(collection(db, "cuponsColetados"), where("userId", "==", user.uid))).then(snap => {
      const map: Record<string, boolean> = {};
      snap.docs.forEach(d => { map[d.data().cupomId] = true; });
      setColetados(map);
    });
  }, [user?.uid]);

  const coletarCupom = async (cupom: { id: string; desconto: string | number; codigo: string; ativo: boolean }) => {
    if (!user) { alert("Faça login para coletar cupons!"); return; }
    if (coletados[cupom.id]) {
      setMsg({ text: "Você já tem este cupom!", tipo: "info" });
      return;
    }
    try {
      await setDoc(doc(db, "cuponsColetados", `${cupom.id}_${user.uid}`), {
        cupomId: cupom.id,
        userId: user.uid,
        userNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        desconto: cupom.desconto,
        codigo: cupom.codigo,
        createdAt: new Date(),
        tenantId,
      });
      setColetados(prev => ({ ...prev, [cupom.id]: true }));
      setMsg({ text: `🎉 Cupom ${cupom.codigo} coletado!`, tipo: "success" });
    } catch {
      setMsg({ text: "Erro ao coletar cupom.", tipo: "error" });
    }
    setTimeout(() => setMsg(null), 3000);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="display-title" style={{ fontSize: "1.4rem", marginBottom: 16 }}>
        <span style={{ color: "var(--gold)" }}>🎟️</span> Cupons
      </h1>

      {msg && (
        <div style={{
          padding: "10px 14px",
          background: msg.tipo === "success" ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
          border: `1px solid ${msg.tipo === "success" ? "var(--green)" : "var(--red)"}`,
          borderRadius: "var(--radius-sm)",
          color: msg.tipo === "success" ? "var(--green)" : "var(--red)",
          fontSize: "0.82rem",
          fontWeight: 600,
          marginBottom: 14,
        }}>
          {msg.text}
        </div>
      )}

      {cupons.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎟️</div>
          <div style={{ fontSize: "0.85rem" }}>Nenhum cupom disponível</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {cupons.map(cupom => (
            <div key={cupom.id} style={{
              background: "linear-gradient(135deg, var(--bg3) 0%, var(--bg2) 100%)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
              <div style={{
                width: 48, height: 48,
                background: "linear-gradient(135deg, #16a34a, #15803d)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                flexShrink: 0,
              }}>
                🎟️
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", marginBottom: 2 }}>
                  {cupom.nome || cupom.codigo}
                </div>
                <div style={{ fontSize: "0.78rem", color: "var(--green)", fontWeight: 700 }}>
                  {typeof cupom.desconto === "number" ? `${cupom.desconto}% OFF` : cupom.desconto}
                </div>
              </div>
              <button
                onClick={() => coletarCupom(cupom)}
                disabled={!!coletados[cupom.id]}
                style={{
                  padding: "6px 14px",
                  borderRadius: 20,
                  border: "none",
                  background: coletados[cupom.id] ? "var(--bg3)" : "linear-gradient(135deg, #16a34a, #15803d)",
                  color: "#fff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  cursor: coletados[cupom.id] ? "default" : "pointer",
                  opacity: coletados[cupom.id] ? 0.6 : 1,
                }}
              >
                {coletados[cupom.id] ? "Usado" : "Pegar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useTenant } from "../../contexts/TenantContext";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Pedido } from "../../types/tenant";

const STATUS_INFO: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pendente:   { label: "Pendente",        color: "var(--gold)",    bg: "rgba(245,197,24,0.1)",  icon: "⏳" },
  confirmado: { label: "Confirmado",      color: "#60a5fa",        bg: "rgba(96,165,250,0.1)",  icon: "✅" },
  preparo:    { label: "Em preparo",      color: "var(--purple2)", bg: "rgba(138,92,246,0.1)",  icon: "🫐" },
  pronto:     { label: "Pronto",          color: "var(--green)",   bg: "rgba(34,197,94,0.1)",   icon: "🎉" },
  entrega:    { label: "Saiu p/ entrega", color: "#f97316",      bg: "rgba(249,115,22,0.1)",  icon: "🛵" },
  entregue:   { label: "Entregue",        color: "var(--green)",   bg: "rgba(34,197,94,0.1)",   icon: "✅" },
  cancelado:  { label: "Cancelado",       color: "var(--red)",    bg: "rgba(239,68,68,0.1)",   icon: "❌" },
};

function formatDate(ts: unknown) {
  if (!ts || typeof (ts as { toDate?: () => Date }).toDate !== "function") return "";
  const d = (ts as { toDate: () => Date }).toDate();
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function formatPreco(v: unknown) {
  return Number(v || 0).toFixed(2).replace(".", ",");
}

export default function Historico() {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !tenantId) return;
    const q = query(
      collection(db, `tenants/${tenantId}/pedidos`),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setPedidos(snap.docs.map(d => ({ id: d.id, ...d.data() } as Pedido)));
      setLoading(false);
    });
    return unsub;
  }, [user?.uid, tenantId]);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen"><div className="spinner" /></div>
      </div>
    );
  }

  if (pedidos.length === 0) {
    return (
      <div className="page">
        <h1 className="display-title" style={{ fontSize: "1.4rem", marginBottom: 16 }}>Histórico</h1>
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: "0.85rem" }}>Nenhum pedido ainda</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="display-title" style={{ fontSize: "1.4rem", marginBottom: 16 }}>Histórico</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {pedidos.map(pedido => {
          const status = STATUS_INFO[pedido.status] || STATUS_INFO.pendente;
          return (
            <div
              key={pedido.id}
              style={{
                background: "linear-gradient(135deg, var(--bg3) 0%, var(--bg2) 100%)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 14px",
                borderBottom: "1px solid var(--border)",
                background: status.bg,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "1rem" }}>{status.icon}</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 700, color: status.color }}>
                    {status.label}
                  </span>
                </div>
                <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
                  {formatDate(pedido.createdAt)}
                </span>
              </div>

              <div style={{ padding: "10px 14px" }}>
                {pedido.items?.map((item, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: "0.82rem", color: "var(--text2)" }}>
                      {item.qty}x {item.produtoNome}
                    </span>
                    <span style={{ fontSize: "0.82rem", color: "var(--text)" }}>
                      R$ {formatPreco(item.precoTotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div style={{
                padding: "8px 14px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>Total</span>
                <span style={{ fontWeight: 800, color: "var(--gold)", fontFamily: "'Fraunces', serif" }}>
                  R$ {formatPreco(pedido.total)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

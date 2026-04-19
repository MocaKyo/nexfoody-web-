import { useState, useEffect } from "react";
import { useTenant } from "../../contexts/TenantContext";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";
import type { Sorteio } from "../../types/tenant";

function formatDate(ts: unknown) {
  if (!ts || typeof (ts as { toDate?: () => Date }).toDate !== "function") return "";
  return (ts as { toDate: () => Date }).toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

export default function PremiosGanhadores() {
  const { tenantId } = useTenant();
  const [sorteios, setSorteios] = useState<Sorteio[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(
      collection(db, `tenants/${tenantId}/sorteios`),
      orderBy("dataSorteio", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, snap => {
      setSorteios(snap.docs.map(d => ({ id: d.id, ...d.data() } as Sorteio)));
      setLoading(false);
    });
    return unsub;
  }, [tenantId]);

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
        🎁 Prêmios e Sorteios
      </h1>

      {sorteios.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎁</div>
          <div style={{ fontSize: "0.85rem" }}>Nenhum sorteio disponível</div>
          <div style={{ fontSize: "0.75rem", marginTop: 4 }}>Fique de olho nas promoções!</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sorteios.map(sorteio => {
            const temWinner = !!sorteio.winnerId;
            return (
              <div key={sorteio.id} style={{
                background: "linear-gradient(135deg, var(--bg3) 0%, var(--bg2) 100%)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                overflow: "hidden",
              }}>
                {sorteio.foto && (
                  <img src={sorteio.foto} alt={sorteio.nome} style={{ width: "100%", height: 130, objectFit: "cover" }} />
                )}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--gold)", marginBottom: 4, fontFamily: "'Fraunces', serif" }}>
                    {sorteio.premio}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginBottom: 8, lineHeight: 1.4 }}>
                    {sorteio.descricao}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
                      📅 {formatDate(sorteio.dataSorteio)}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>
                      👥 {sorteio.participantesCount || 0} participantes
                    </span>
                  </div>
                  {temWinner && (
                    <div style={{
                      marginTop: 10, padding: "8px 12px",
                      background: "rgba(34,197,94,0.08)",
                      border: "1px solid rgba(34,197,94,0.2)",
                      borderRadius: "var(--radius-sm)",
                      display: "flex", alignItems: "center", gap: 8,
                    }}>
                      <span style={{ fontSize: "1rem" }}>🏆</span>
                      <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--green)" }}>
                        Vencedor: {sorteio.winnerNome}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

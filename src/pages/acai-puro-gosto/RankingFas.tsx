import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface RankingEntry {
  id: string;
  rankingPts: number;
  pontos?: number;
  nome: string;
  foto?: string;
  posicao: number;
}

const MEDALS = ["🥇", "🥈", "🥉"];

function formatPts(pts: number) {
  return pts.toLocaleString("pt-BR");
}

export default function RankingFas() {
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "ranking"),
      orderBy("rankingPts", "desc"),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      const entries = snap.docs.map((d, i) => ({ id: d.id, posicao: i + 1, ...d.data() } as RankingEntry));
      setRanking(entries);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="loading-screen"><div className="spinner" /></div>
      </div>
    );
  }

  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3);

  return (
    <div className="page">
      <h1 className="display-title" style={{ fontSize: "1.4rem", marginBottom: 16 }}>
        🏆 Ranking de Fãs
      </h1>

      {ranking.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>🏆</div>
          <div style={{ fontSize: "0.85rem" }}>Nenhum ranking ainda</div>
          <div style={{ fontSize: "0.75rem", marginTop: 4 }}>Faça pedidos para pontuar!</div>
        </div>
      ) : (
        <>
          {/* Top 3 */}
          {top3.length > 0 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              {top3.map((entry, idx) => {
                const posicoes = [1, 0, 2]; // segundo é o primeiro (center/maior)
                const actualPos = posicoes[idx];
                return (
                  <div key={entry.id} style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 8px",
                    flex: actualPos === 0 ? 1.3 : 1,
                  }}>
                    <div style={{ fontSize: actualPos === 0 ? "2rem" : "1.5rem" }}>
                      {MEDALS[actualPos] || `#${actualPos + 1}`}
                    </div>
                    <div style={{
                      width: actualPos === 0 ? 56 : 44,
                      height: actualPos === 0 ? 56 : 44,
                      borderRadius: "50%",
                      background: "var(--surface)",
                      border: `2px solid ${actualPos === 0 ? "var(--gold)" : "var(--border)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: actualPos === 0 ? "1.4rem" : "1.1rem",
                      overflow: "hidden",
                    }}>
                      {entry.foto ? (
                        <img src={entry.foto} alt={entry.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        entry.nome?.[0]?.toUpperCase() || "?"
                      )}
                    </div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)", textAlign: "center", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {entry.nome}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: actualPos === 0 ? "var(--gold)" : "var(--text3)", fontWeight: actualPos === 0 ? 700 : 400 }}>
                      {formatPts(entry.rankingPts)} pts
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Resto do ranking */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {resto.map(entry => (
              <div key={entry.id} style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 14px",
              }}>
                <div style={{ width: 28, textAlign: "center", fontSize: "0.82rem", fontWeight: 700, color: "var(--text3)" }}>
                  #{entry.posicao}
                </div>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: "var(--surface)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.9rem", flexShrink: 0, overflow: "hidden",
                }}>
                  {entry.foto ? (
                    <img src={entry.foto} alt={entry.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    entry.nome?.[0]?.toUpperCase() || "?"
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>{entry.nome}</div>
                </div>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--gold)" }}>
                  {formatPts(entry.rankingPts)} pts
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

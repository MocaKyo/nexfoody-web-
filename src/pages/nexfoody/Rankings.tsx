// src/pages/nexfoody/Rankings.tsx
// Ranking de lojas — lojas ordenadas pela soma dos pontos dos seus fãs
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, getDocs, getDoc, doc, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import type { LojaMeta } from "../../types/tenant";

interface StoreRanking {
  tenantId: string;
  nome: string;
  slug: string;
  logo?: string | null;
  capa?: string | null;
  categoria: string;
  totalFanPts: number;
  seguidores: number;
  topFans: { nome: string; foto?: string | null; pts: number; pos: number }[];
  userPos?: number;
  userPts?: number;
}

const MEDALHAS = ["👑", "🥈", "🥉"];

export default function Rankings() {
  const navigate = useNavigate();
  const { user, userData } = useAuth();
  const [rankings, setRankings] = useState<StoreRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fansMap, setFansMap] = useState<Record<string, { nome: string; foto?: string | null; pts: number; pos: number }[]>>({});

  useEffect(() => {
    async function load() {
      // 1. Buscar lojas ativas
      const lojasSnap = await getDocs(query(collection(db, "lojas"), orderBy("nome")));
      const lojas = lojasSnap.docs.map(d => ({ tenantId: d.id, ...d.data() } as { tenantId: string; nome?: string; slug?: string; logoUrl?: string; logo?: string; capa?: string; categoria?: string }));

      // 2. Para cada loja, buscar fãs da subcoleção (fonte de verdade)
      // e calcular soma total de pts + top 10
      const map: Record<string, { nome: string; foto?: string | null; pts: number; pos: number }[]> = {};
      const storePts: Record<string, number> = {};
      const storeSeg: Record<string, number> = {};

      for (const loja of lojas) {
        const fansSnap = await getDocs(
          query(collection(db, `tenants/${loja.tenantId}/fans`), orderBy("pts", "desc"))
        );
        storeSeg[loja.tenantId] = fansSnap.size;
        storePts[loja.tenantId] = fansSnap.docs.reduce((acc, d) => acc + (d.data().pts || 0), 0);

        // Top 10 fãs com nome/foto resolvidos
        const top10 = await Promise.all(
          fansSnap.docs.slice(0, 10).map(async (d, i) => {
            const userSnap = await getDoc(doc(db, "users", d.id));
            const userData = userSnap.exists() ? userSnap.data() : null;
            return {
              nome: userData?.nome || userData?.displayName || "Cliente",
              foto: userData?.photoURL || null,
              pts: d.data().pts || 0,
              pos: i + 1,
            };
          })
        );
        map[loja.tenantId] = top10;
      }

      setFansMap(map);

      // 3. Montar lista de stores ordenadas
      const lista: StoreRanking[] = lojas.map(loja => {
        const lojaSlug = loja.slug || loja.tenantId;
        const fansDaLoja = map[loja.tenantId] || [];
        const myFanIdx = fansDaLoja.findIndex(f => f.nome === (userData?.nome || user?.displayName) && f.pos > 0);
        return {
          tenantId: loja.tenantId,
          nome: loja.nome || lojaSlug,
          slug: lojaSlug,
          logo: loja.logoUrl || loja.logo,
          capa: loja.capa,
          categoria: loja.categoria || "",
          totalFanPts: storePts[loja.tenantId] || 0,
          seguidores: storeSeg[loja.tenantId] || 0,
          topFans: fansDaLoja,
          userPos: myFanIdx >= 0 ? myFanIdx + 1 : undefined,
          userPts: myFanIdx >= 0 ? fansDaLoja[myFanIdx]?.pts : undefined,
        };
      });

      lista.sort((a, b) => b.totalFanPts - a.totalFanPts);
      setRankings(lista);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, [user, userData]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "rgba(255,255,255,.4)", fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem" }}>Carregando rankings...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif", color: "#fff" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,4,18,.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,.07)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "'Fraunces', serif", fontSize: "1.15rem", fontWeight: 900, color: "#f5c518" }}>🏆 Rankings das Lojas</div>
        <div style={{ width: 32 }} />
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 0 80px" }}>
        {/* Info */}
        <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", gap: 8, background: "rgba(245,197,24,.06)", borderBottom: "1px solid rgba(245,197,24,.1)" }}>
          <span style={{ fontSize: "0.75rem", color: "rgba(245,197,24,.7)" }}>🏪 Ranking baseado na soma dos pontos dos fãs de cada loja</span>
        </div>

        {/* Lista de lojas */}
        {rankings.map((loja, idx) => {
          const posLoja = idx + 1;
          const corLoja = posLoja === 1 ? "#f5c518" : posLoja === 2 ? "#9ca3af" : posLoja === 3 ? "#cd7f32" : "transparent";
          const medalLoja = posLoja <= 3 ? MEDALHAS[posLoja - 1] : `#${posLoja}`;

          return (
            <div key={loja.tenantId} style={{ margin: "0 12px 12px", background: "rgba(255,255,255,.04)", border: `1px solid ${posLoja <= 3 ? "rgba(245,197,24,.2)" : "rgba(255,255,255,.07)"}`, borderRadius: 20, overflow: "hidden" }}>
              {/* Header da loja */}
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
                {/* Posição da loja */}
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: posLoja <= 3 ? "1.4rem" : "1rem", fontWeight: 900, color: corLoja, minWidth: 40, textAlign: "center" }}>
                  {medalLoja}
                </div>
                {/* Logo / capa da loja */}
                <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(245,197,24,.1)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {loja.logo
                    ? <img src={loja.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <span style={{ fontSize: "1.4rem" }}>{loja.nome?.[0] || "🏪"}</span>
                  }
                </div>
                {/* Info da loja */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{loja.nome}</div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.4)", marginTop: 2 }}>{loja.seguidores} fãs · {loja.totalFanPts.toLocaleString()} pts</div>
                </div>
                {/* Posição do usuário logado na loja */}
                {loja.userPos && (
                  <div style={{ textAlign: "center", background: "rgba(124,58,237,.15)", border: "1px solid rgba(124,58,237,.3)", borderRadius: 12, padding: "4px 10px" }}>
                    <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.4)", fontWeight: 600 }}>Sua posição</div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 900, color: "#a855f7" }}>#{loja.userPos}</div>
                  </div>
                )}
                <div onClick={() => navigate(`/rankings/${loja.slug}`)} style={{ background: "rgba(124,58,237,.12)", border: "1px solid rgba(124,58,237,.3)", borderRadius: 12, padding: "6px 12px", fontSize: "0.7rem", fontWeight: 700, color: "#a855f7", cursor: "pointer", flexShrink: 0 }}>🏆 Ranking</div>
                <div onClick={() => navigate(`/loja/${loja.slug}`)} style={{ background: "rgba(245,197,24,.1)", border: "1px solid rgba(245,197,24,.3)", borderRadius: 12, padding: "6px 12px", fontSize: "0.7rem", fontWeight: 700, color: "#f5c518", cursor: "pointer", flexShrink: 0 }}>Ver loja →</div>
              </div>

              {/* Top 3 fãs da loja */}
              {loja.topFans.length === 0 ? (
                <div style={{ padding: "16px", textAlign: "center", color: "rgba(255,255,255,.25)", fontSize: "0.8rem" }}>Nenhum fã ainda. Seja o primeiro!</div>
              ) : (
                <div>
                  {loja.topFans.slice(0, 3).map((fan, i) => {
                    const isMe = fan.nome === (userData?.nome || user?.displayName);
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 16px",
                        background: isMe ? "rgba(124,58,237,.08)" : "transparent",
                        borderTop: "1px solid rgba(255,255,255,.04)",
                      }}>
                        <div style={{ fontWeight: 900, fontSize: "0.8rem", color: i === 0 ? "#f5c518" : i === 1 ? "#9ca3af" : i === 2 ? "#cd7f32" : "rgba(255,255,255,.3)", minWidth: 24 }}>
                          {i === 0 ? "👑" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${fan.pos}`}
                        </div>
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,.08)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>
                          {fan.foto
                            ? <img src={fan.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : (fan.nome?.[0] || "?")
                          }
                        </div>
                        <div style={{ flex: 1, fontSize: "0.82rem", fontWeight: isMe ? 800 : 600, color: isMe ? "#a855f7" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {isMe ? "Você 🎉" : fan.nome}
                        </div>
                        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "0.88rem", fontWeight: 900, color: isMe ? "#a855f7" : "#f5c518" }}>
                          {fan.pts.toLocaleString()} pts
                        </div>
                      </div>
                    );
                  })}
                  {loja.topFans.length > 3 && (
                    <div style={{ padding: "8px 16px", fontSize: "0.7rem", color: "rgba(255,255,255,.25)", textAlign: "center", borderTop: "1px solid rgba(255,255,255,.03)" }}>
                      +{loja.topFans.length - 3} fãs no ranking →
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

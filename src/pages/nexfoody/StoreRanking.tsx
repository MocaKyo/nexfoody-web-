// src/pages/nexfoody/StoreRanking.tsx
// Ranking de fãs de uma loja específica — lê diretamente da subcoleção fans
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { collection, query, getDocs, doc, getDoc, orderBy } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import CountdownWidget from "../../components/CountdownWidget";
import PrizesCard from "../../components/PrizesCard";

interface Fan {
  uid: string;
  nome: string;
  foto?: string | null;
  pts: number;
  pos: number;
  isMe: boolean;
}

interface StoreInfo {
  nome: string;
  logo?: string | null;
  slug: string;
}

export default function StoreRanking() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [fans, setFans] = useState<Fan[]>([]);
  const [store, setStore] = useState<StoreInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      setLoading(true);
      // Info da loja
      let storeNome = slug;
      let storeLogo: string | null = null;
      try {
        const cfgSnap = await getDoc(doc(db, `tenants/${slug}/config/loja`));
        if (cfgSnap.exists()) {
          const d = cfgSnap.data();
          storeNome = d.nomeLoja || d.nome || slug;
          storeLogo = d.logoUrl || d.logoFeed || null;
        }
      } catch {}

      // Ler diretamente da subcoleção fans — fonte de verdade do addFanPoints
      const fansSnap = await getDocs(
        query(collection(db, `tenants/${slug}/fans`), orderBy("pts", "desc"))
      );

      // Buscar nome/foto de cada fã na coleção users
      const fanDocs = fansSnap.docs;
      const fansComUser: Fan[] = await Promise.all(
        fanDocs.map(async (d, i) => {
          const data = d.data();
          const userSnap = await getDoc(doc(db, "users", d.id));
          const userData = userSnap.exists() ? userSnap.data() : null;
          return {
            uid: d.id,
            nome: userData?.nome || userData?.displayName || "Cliente",
            foto: userData?.photoURL || null,
            pts: data.pts || 0,
            pos: i + 1,
            isMe: d.id === user?.uid,
          };
        })
      );

      setFans(fansComUser);
      setStore({ nome: storeNome || slug || "Loja", logo: storeLogo, slug: slug || "" });
      setLoading(false);
    }
    load();
  }, [slug, user]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Outfit', sans-serif" }}>
        <div style={{ color: "rgba(255,255,255,.4)", fontSize: "0.9rem" }}>Carregando ranking...</div>
      </div>
    );
  }

  const myFan = fans.find(f => f.isMe);
  const top3 = fans.slice(0, 3);
  const rest = fans.slice(3);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif", color: "#fff" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(8,4,18,.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,.07)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.5)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          {store?.logo && <img src={store.logo} alt="" style={{ width: 28, height: 28, borderRadius: 8, objectFit: "cover" }} />}
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 900, color: "#f5c518" }}>🏆 {store?.nome}</div>
        </div>
        <button onClick={() => navigate(`/loja/${slug}`)} style={{ background: "none", border: "none", color: "rgba(255,255,255,.4)", cursor: "pointer", fontSize: "0.8rem", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>Ver loja</button>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 0 80px" }}>
        {/* Info */}
        <div style={{ padding: "14px 16px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,.05)" }}>
          <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.35)", marginBottom: 4 }}>Ranking de fãs desta loja</div>
          <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,.5)" }}>Total: <span style={{ color: "#f5c518", fontWeight: 800 }}>{fans.length}</span> fãs · <span style={{ color: "#f5c518", fontWeight: 800 }}>{fans.reduce((s, f) => s + f.pts, 0).toLocaleString()}</span> pts somados</div>
        </div>

        {/* Countdown */}
        {slug && <CountdownWidget slug={slug} />}

        {/* Prêmios */}
        {slug && <PrizesCard slug={slug} />}

        {/* Minha posição */}
        {myFan && (
          <div style={{ margin: "12px 16px", background: "rgba(124,58,237,.12)", border: "1px solid rgba(124,58,237,.35)", borderRadius: 16, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.6rem", fontWeight: 900, color: "#a855f7", minWidth: 36 }}>#{myFan.pos}</div>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(124,58,237,.2)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", flexShrink: 0 }}>
              {myFan.foto
                ? <img src={myFan.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : (myFan.nome?.[0] || "?")
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "0.9rem", color: "#a855f7" }}>Você 🎉</div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.5)" }}>Sua posição no ranking</div>
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 900, color: "#a855f7" }}>
              {myFan.pts.toLocaleString()} pts
            </div>
          </div>
        )}

        {/* Top 3 — destaque */}
        {top3.length > 0 && (
          <div style={{ padding: "16px 16px 8px" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,.3)", marginBottom: 12, textAlign: "center" }}>🏆 Top Fãs</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
              {/* 2º lugar */}
              {top3[1] && (
                <div style={{ flex: 1, background: "rgba(156,163,175,.08)", border: "1px solid rgba(156,163,175,.2)", borderRadius: "16px 16px 0 0", padding: "12px 12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.6rem", marginBottom: 6 }}>🥈</div>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(156,163,175,.15)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", fontSize: "0.9rem" }}>
                    {top3[1].foto ? <img src={top3[1].foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (top3[1].nome?.[0] || "?")}
                  </div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top3[1].nome}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.4)", marginTop: 2 }}>{top3[1].pts.toLocaleString()} pts</div>
                </div>
              )}
              {/* 1º lugar */}
              {top3[0] && (
                <div style={{ flex: 1.3, background: "rgba(245,197,24,.1)", border: "1px solid rgba(245,197,24,.3)", borderRadius: "20px 20px 0 0", padding: "16px 12px 20px", textAlign: "center" }}>
                  <div style={{ fontSize: "2rem", marginBottom: 6 }}>👑</div>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(245,197,24,.15)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px", fontSize: "1.1rem", border: "2px solid rgba(245,197,24,.4)" }}>
                    {top3[0].foto ? <img src={top3[0].foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (top3[0].nome?.[0] || "?")}
                  </div>
                  <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "#f5c518", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top3[0].nome}</div>
                  <div style={{ fontSize: "0.72rem", color: "#f5c518", fontWeight: 700, marginTop: 2 }}>{top3[0].pts.toLocaleString()} pts</div>
                </div>
              )}
              {/* 3º lugar */}
              {top3[2] && (
                <div style={{ flex: 1, background: "rgba(205,127,50,.08)", border: "1px solid rgba(205,127,50,.2)", borderRadius: "16px 16px 0 0", padding: "12px 12px 16px", textAlign: "center" }}>
                  <div style={{ fontSize: "1.6rem", marginBottom: 6 }}>🥉</div>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "rgba(205,127,50,.15)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px", fontSize: "0.9rem" }}>
                    {top3[2].foto ? <img src={top3[2].foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (top3[2].nome?.[0] || "?")}
                  </div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "#cd7f32", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{top3[2].nome}</div>
                  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.4)", marginTop: 2 }}>{top3[2].pts.toLocaleString()} pts</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Lista completa */}
        {rest.length > 0 && (
          <div style={{ padding: "8px 16px 0" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "rgba(255,255,255,.2)", marginBottom: 8, textAlign: "center" }}>Demais fãs</div>
            {rest.map(fan => (
              <div key={fan.uid} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px",
                background: fan.isMe ? "rgba(124,58,237,.06)" : "transparent",
                borderBottom: "1px solid rgba(255,255,255,.04)",
              }}>
                <div style={{ fontWeight: 900, fontSize: "0.8rem", color: fan.isMe ? "#a855f7" : "rgba(255,255,255,.25)", minWidth: 28 }}>
                  #{fan.pos}
                </div>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,.06)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0 }}>
                  {fan.foto ? <img src={fan.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (fan.nome?.[0] || "?")}
                </div>
                <div style={{ flex: 1, fontSize: "0.82rem", fontWeight: fan.isMe ? 800 : 600, color: fan.isMe ? "#a855f7" : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fan.isMe ? "Você 🎉" : fan.nome}
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "0.88rem", fontWeight: 900, color: fan.isMe ? "#a855f7" : "#f5c518" }}>
                  {fan.pts.toLocaleString()} pts
                </div>
              </div>
            ))}
          </div>
        )}

        {fans.length === 0 && (
          <div style={{ padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: 12 }}>🏆</div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, marginBottom: 8 }}>Nenhum fã ainda</div>
            <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,.4)" }}>Seja o primeiro a seguir esta loja e entre no ranking!</div>
          </div>
        )}
      </div>
    </div>
  );
}

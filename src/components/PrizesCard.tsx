// src/components/PrizesCard.tsx
// Card de prêmios do ranking — exibe os prêmios configurados em tenants/{slug}/config/loja
import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Prize {
  nome: string;
  desc: string;
  imagem: string;
  color: string;
  medal: string;
  pos: number;
}

interface PrizesCardProps {
  slug: string;
  compact?: boolean;
}

const PREFIJOS = ["premio", "premio2", "premio3", "premio4", "premio5"];
const MEDALS = ["🥇", "🥈", "🥉", "🎖️", "🎖️"];
const COLORS = ["#f5c518", "#9ca3af", "#cd7f32", "#a78bfa", "#a78bfa"];
const LABELS = ["1º Lugar", "2º Lugar", "3º Lugar", "4º Lugar", "5º Lugar"];

export default function PrizesCard({ slug, compact = false }: PrizesCardProps) {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    async function load() {
      try {
        const snap = await getDoc(doc(db, `tenants/${slug}/config/loja`));
        if (cancelled) return;
        if (!snap.exists()) { setLoading(false); return; }
        const cfg = snap.data();
        const lista: Prize[] = PREFIJOS.map((p, i) => ({
          nome: cfg[p + "Nome"] || "",
          desc: cfg[p + "Desc"] || "",
          imagem: cfg[p + "Imagem"] || "",
          color: COLORS[i],
          medal: MEDALS[i],
          pos: i + 1,
        })).filter(pr => pr.nome);
        setPrizes(lista);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [slug]);

  if (loading) return null;
  if (prizes.length === 0) return null;

  if (compact) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "rgba(245,197,24,.6)", marginBottom: 8, textAlign: "center" }}>🏆 Prêmios</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {prizes.map(pr => (
            <div key={pr.pos} style={{ display: "flex", alignItems: "center", gap: 8, background: `${pr.color}10`, border: `1px solid ${pr.color}25`, borderRadius: 10, padding: "6px 10px" }}>
              <span style={{ fontSize: "1rem" }}>{pr.medal}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.7rem", fontWeight: 800, color: pr.color, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.nome}</div>
                {pr.desc && <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,.35)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pr.desc}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "rgba(245,197,24,.6)", marginBottom: 12, textAlign: "center" }}>🏆 Prêmios do Ranking</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {prizes.map(pr => (
          <div key={pr.pos} style={{ display: "flex", alignItems: "center", gap: 12, background: `${pr.color}08`, border: `1px solid ${pr.color}25`, borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ fontSize: "1.8rem", filter: `drop-shadow(0 0 6px ${pr.color}60)` }}>{pr.medal}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 800, color: pr.color }}>{pr.nome}</div>
              {pr.desc && <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.45)", marginTop: 2 }}>{pr.desc}</div>}
            </div>
            {pr.imagem && (
              <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", flexShrink: 0, border: `2px solid ${pr.color}40` }}>
                <img src={pr.imagem} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

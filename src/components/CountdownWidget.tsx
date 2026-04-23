// src/components/CountdownWidget.tsx
// Countdown regresivo para encerramento do ranking de fãs — ler de tenants/{slug}/config/loja
import React, { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

interface CountdownData {
  dias: number;
  horas: number;
  mins: number;
  segs: number;
  urgente: boolean;
  encerrado: boolean;
  diff: number;
}

interface CountdownWidgetProps {
  slug: string;
  compact?: boolean; // true = versão menor para colunas
}

function calcCountdown(fim: Date | null, agora: number): CountdownData | null {
  if (!fim) return null;
  const diff = Math.max(0, fim.getTime() - agora);
  if (diff === 0) return { dias: 0, horas: 0, mins: 0, segs: 0, urgente: false, encerrado: true, diff: 0 };
  const dias = Math.floor(diff / 86400000);
  const horas = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const segs = Math.floor((diff % 60000) / 1000);
  return { dias, horas, mins, segs, urgente: dias === 0 && horas < 3, encerrado: false, diff };
}

export default function CountdownWidget({ slug, compact = false }: CountdownWidgetProps) {
  const [cd, setCd] = useState<CountdownData | null>(null);
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
        const fimStr = cfg.premioFim;
        const horaStr = cfg.premioHoraFim || "23:59";
        if (!fimStr) { setLoading(false); return; }
        const fim = new Date(`${fimStr}T${horaStr}:00`);
        if (isNaN(fim.getTime())) { setLoading(false); return; }

        const tick = () => {
          const agora = Date.now();
          setCd(calcCountdown(fim, agora));
          setLoading(false);
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    const cleanup = load();
    return () => {
      cancelled = true;
      cleanup.then?.(fn => fn?.());
    };
  }, [slug]);

  if (loading) {
    return compact ? null : (
      <div style={{ height: compact ? 0 : 80, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 24, height: 24, borderRadius: "50%", border: "2px solid rgba(245,197,24,.2)", borderTopColor: "rgba(245,197,24,.6)", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  if (!cd) return null;
  if (cd.encerrado) {
    return (
      <div style={{
        background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.3)",
        borderRadius: compact ? 12 : 20, padding: compact ? "8px 12px" : "14px 16px",
        textAlign: "center", marginBottom: compact ? 8 : 12,
      }}>
        <div style={{ fontSize: compact ? "0.7rem" : "0.8rem", fontWeight: 800, color: "#ef4444" }}>🏆 Ranking Encerrado!</div>
        <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.4)", marginTop: 2 }}>Resultados em breve</div>
      </div>
    );
  }

  if (compact) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        background: "rgba(245,197,24,.06)", border: "1px solid rgba(245,197,24,.2)",
        borderRadius: 12, padding: "6px 10px", marginBottom: 8,
        animation: cd.urgente ? "urgentPulse 1s ease-in-out infinite" : "none",
      }}>
        <span style={{ fontSize: "0.7rem" }}>{cd.urgente ? "🔥" : "⏳"}</span>
        <span style={{ fontSize: "0.65rem", fontWeight: 800, color: cd.urgente ? "#ef4444" : "rgba(245,197,24,.7)" }}>
          {cd.dias > 0 ? `${cd.dias}d ` : ""}{String(cd.horas).padStart(2, "0")}:{String(cd.mins).padStart(2, "0")}:{String(cd.segs).padStart(2, "0")}
        </span>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes neonPulse { 0%,100%{box-shadow:0 0 12px rgba(245,197,24,.4),0 0 30px rgba(245,197,24,.2)} 50%{box-shadow:0 0 24px rgba(245,197,24,.8),0 0 60px rgba(245,197,24,.4)} }
        @keyframes urgentPulse { 0%,100%{box-shadow:0 0 16px rgba(239,68,68,.5)} 50%{box-shadow:0 0 40px rgba(239,68,68,.9)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
      <div style={{
        background: "linear-gradient(135deg, #0f0518, #1a0536)",
        border: `1px solid ${cd.urgente ? "rgba(239,68,68,.5)" : "rgba(245,197,24,.35)"}`,
        borderRadius: 20, padding: "20px 16px", marginBottom: 16,
        textAlign: "center",
        boxShadow: cd.urgente ? "0 0 40px rgba(239,68,68,.2)" : "0 0 40px rgba(245,197,24,.1)",
      }}>
        <div style={{ fontSize: "0.6rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 3, color: cd.urgente ? "#ef4444" : "rgba(245,197,24,.7)", marginBottom: 14 }}>
          {cd.urgente ? "🔥 ÚLTIMAS HORAS!" : "⏳ ENCERRAMENTO DO RANKING"}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 6, alignItems: "flex-start", marginBottom: 12 }}>
          {cd.dias > 0 && (
            <>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2rem", fontWeight: 900, lineHeight: 1, background: "rgba(0,0,0,.5)", border: `2px solid ${cd.urgente ? "rgba(239,68,68,.6)" : "rgba(245,197,24,.5)"}`, borderRadius: 10, padding: "8px 12px", animation: cd.urgente ? "urgentPulse 1.5s ease-in-out infinite" : "neonPulse 2s ease-in-out infinite", minWidth: 56 }}>{String(cd.dias).padStart(2, "0")}</div>
                <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: 2, color: cd.urgente ? "#ef4444" : "rgba(245,197,24,.6)", marginTop: 4 }}>DIAS</div>
              </div>
              <div style={{ fontSize: "2rem", color: cd.urgente ? "rgba(239,68,68,.5)" : "rgba(245,197,24,.4)", paddingTop: 6 }}>:</div>
            </>
          )}
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2rem", fontWeight: 900, lineHeight: 1, background: "rgba(0,0,0,.5)", border: `2px solid ${cd.urgente ? "rgba(239,68,68,.6)" : "rgba(245,197,24,.5)"}`, borderRadius: 10, padding: "8px 12px", animation: cd.urgente ? "urgentPulse 1.5s ease-in-out infinite" : "neonPulse 2s ease-in-out infinite", minWidth: 56 }}>{String(cd.horas).padStart(2, "0")}</div>
            <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: 2, color: cd.urgente ? "#ef4444" : "rgba(245,197,24,.6)", marginTop: 4 }}>HORAS</div>
          </div>
          <div style={{ fontSize: "2rem", color: cd.urgente ? "rgba(239,68,68,.5)" : "rgba(245,197,24,.4)", paddingTop: 6 }}>:</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2rem", fontWeight: 900, lineHeight: 1, background: "rgba(0,0,0,.5)", border: `2px solid ${cd.urgente ? "rgba(239,68,68,.6)" : "rgba(245,197,24,.5)"}`, borderRadius: 10, padding: "8px 12px", animation: cd.urgente ? "urgentPulse 1.5s ease-in-out infinite" : "neonPulse 2s ease-in-out infinite", minWidth: 56 }}>{String(cd.mins).padStart(2, "0")}</div>
            <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: 2, color: cd.urgente ? "#ef4444" : "rgba(245,197,24,.6)", marginTop: 4 }}>MIN</div>
          </div>
          <div style={{ fontSize: "2rem", color: cd.urgente ? "rgba(239,68,68,.5)" : "rgba(245,197,24,.4)", paddingTop: 6 }}>:</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2rem", fontWeight: 900, lineHeight: 1, background: "rgba(0,0,0,.5)", border: `2px solid ${cd.urgente ? "rgba(239,68,68,.6)" : "rgba(245,197,24,.5)"}`, borderRadius: 10, padding: "8px 12px", animation: cd.urgente ? "urgentPulse 1s ease-in-out infinite" : "neonPulse 1.5s ease-in-out infinite", minWidth: 56 }}>{String(cd.segs).padStart(2, "0")}</div>
            <div style={{ fontSize: "0.55rem", fontWeight: 700, letterSpacing: 2, color: cd.urgente ? "#ef4444" : "rgba(245,197,24,.6)", marginTop: 4 }}>SEG</div>
          </div>
        </div>

        <div style={{ fontSize: "0.72rem", color: cd.urgente ? "#fca5a5" : "rgba(255,255,255,.4)" }}>
          {cd.urgente ? "🔥 Corra! Últimas horas para garantir o prêmio!" : `🏆 Ranking encerra em ${cd.dias > 0 ? `${cd.dias}d ` : ""}${cd.horas}h ${cd.mins}min — lidere e ganhe!`}
        </div>
      </div>
    </>
  );
}

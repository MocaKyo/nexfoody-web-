// src/pages/PremiosGanhadores.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot, orderBy, query, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";

function CountdownNeon({ config }) {
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!config.premioFim) return null;
  const fimStr = `${config.premioFim}T${config.premioHoraFim || "23:59"}:00`;
  const fim = new Date(fimStr);
  const diff = Math.max(0, fim - agora);
  const dias = Math.floor(diff / 86400000);
  const horas = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  const urgente = dias === 0 && horas < 3;
  const cor = urgente ? "#ef4444" : "#a78bfa";
  const corGlow = urgente ? "rgba(239,68,68,0.6)" : "rgba(167,139,250,0.6)";
  const encerrado = diff === 0;

  return (
    <div style={{ padding: "20px 16px", textAlign: "center" }}>
      <style>{`
        @keyframes neonGlow { 0%,100%{box-shadow:0 0 8px ${corGlow},0 0 20px ${corGlow}} 50%{box-shadow:0 0 20px ${corGlow},0 0 50px ${corGlow}} }
        @keyframes urgentBlink { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>
      <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 3, color: cor, marginBottom: 14, animation: urgente ? "urgentBlink 1s infinite" : "none" }}>
        {encerrado ? "🏁 ENCERRADO!" : urgente ? "🔥 ÚLTIMAS HORAS!" : "⏳ Encerramento da rodada"}
      </div>
      {!encerrado && (
        <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "flex-start" }}>
          {[
            ...(dias > 0 ? [{ val: dias, label: "DIAS" }] : []),
            { val: horas, label: "HRS" },
            { val: mins, label: "MIN" },
            { val: secs, label: "SEG" },
          ].map((item, i, arr) => (
            <React.Fragment key={item.label}>
              <div style={{ textAlign: "center" }}>
                <div style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: "2rem", fontWeight: 900,
                  color: cor, lineHeight: 1,
                  background: "rgba(0,0,0,0.4)",
                  border: `1px solid ${cor}`,
                  borderRadius: 10, padding: "8px 12px",
                  minWidth: 58,
                  animation: "neonGlow 2s ease-in-out infinite",
                  letterSpacing: 2,
                }}>
                  {String(item.val).padStart(2, "0")}
                </div>
                <div style={{ fontSize: "0.52rem", color: "var(--text3)", marginTop: 5, fontWeight: 700, letterSpacing: 2 }}>{item.label}</div>
              </div>
              {i < arr.length - 1 && (
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.5rem", color: cor, opacity: 0.5, paddingTop: 6, fontWeight: 900 }}>:</div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
      {config.premioFim && (
        <div style={{ marginTop: 10, fontSize: "0.68rem", color: "var(--text3)" }}>
          Até {new Date(`${config.premioFim}T${config.premioHoraFim || "23:59"}:00`).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </div>
  );
}

export default function PremiosGanhadores() {
  const { user } = useAuth();
  const { config } = useStore();
  const navigate = useNavigate();
  const [ganhadores, setGanhadores] = useState([]);
  const [aceitouRegras, setAceitouRegras] = useState(false);
  const [jaParticipando, setJaParticipando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "ganhadores"), orderBy("criadoEm", "desc")),
      snap => setGanhadores(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    if (user) {
      const saved = localStorage.getItem(`participando_${user.uid}`);
      if (saved) setJaParticipando(true);
    }
    return unsub;
  }, [user]);

  const confirmarParticipacao = async () => {
    if (!user) { navigate("/login"); return; }
    if (!aceitouRegras) return;
    setSalvando(true);
    try {
      await setDoc(doc(db, "participantesRanking", user.uid), {
        userId: user.uid,
        nome: user.displayName || user.email?.split("@")[0] || "Cliente",
        foto: user.photoURL || null,
        aceitouRegras: true,
        criadoEm: serverTimestamp(),
      });
      localStorage.setItem(`participando_${user.uid}`, "1");
      setJaParticipando(true);
    } catch (e) { console.error(e); }
    finally { setSalvando(false); }
  };

  const premios = [
    { pos: 1, emoji: "🥇", cor: "#f5c518", nome: config.premioNome, desc: config.premioDesc, img: config.premioImagem, desconto: config.premioDesconto },
    { pos: 2, emoji: "🥈", cor: "#9ca3af", nome: config.premio2Nome, desc: config.premio2Desc, img: config.premio2Imagem },
    { pos: 3, emoji: "🥉", cor: "#cd7f32", nome: config.premio3Nome, desc: config.premio3Desc, img: config.premio3Imagem },
  ].filter(p => p.nome);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif", paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(15,5,24,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--gold)" }}>🏆 Prêmios & Ganhadores</div>
        <div style={{ width: 24 }} />
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto" }}>

        {/* Contador neon */}
        <div style={{ background: "linear-gradient(135deg, #0f0518, #1a0536)", borderBottom: "1px solid var(--border)" }}>
          <CountdownNeon config={config} />
        </div>

        {/* Cards de prêmios */}
        {premios.length > 0 && (
          <div style={{ padding: "16px 14px 0" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "var(--text3)", marginBottom: 12, textAlign: "center" }}>🎁 Prêmios desta rodada</div>
            <div style={{ display: "flex", gap: 8 }}>
              {premios.map(p => (
                <div key={p.pos} style={{ flex: 1, background: "var(--bg2)", border: `1px solid ${p.pos === 1 ? "rgba(245,197,24,0.4)" : "var(--border)"}`, borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {p.img
                    ? <img src={p.img} alt={p.nome} style={{ width: "100%", height: 90, objectFit: "cover" }} />
                    : <div style={{ height: 90, background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>{p.emoji}</div>
                  }
                  <div style={{ padding: "8px 10px", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <span style={{ fontSize: "1rem" }}>{p.emoji}</span>
                      <span style={{ fontSize: "0.6rem", fontWeight: 800, color: p.cor, textTransform: "uppercase" }}>{p.pos}º lugar</span>
                    </div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{p.nome}</div>
                    {p.desc && <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 3 }}>{p.desc}</div>}
                    {p.desconto > 0 && <div style={{ marginTop: 4, fontSize: "0.6rem", color: "var(--gold)", fontWeight: 700 }}>+{p.desconto}% OFF</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Regras */}
        {config.premioRegras && (
          <div style={{ padding: "16px 14px 0" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "var(--text3)", marginBottom: 12, textAlign: "center" }}>📋 Regras da promoção</div>
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {config.premioRegras}
            </div>
          </div>
        )}

        {/* Confirmar participação — ANTES do ranking */}
        <div style={{ padding: "16px 14px 0" }}>
          {jaParticipando ? (
            <div style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 12, padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "rgba(34,197,94,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", flexShrink: 0 }}>✅</div>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--green)", fontSize: "0.95rem" }}>Você está participando!</div>
                  <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginTop: 2 }}>Continue fazendo pedidos para subir no ranking 🚀</div>
                </div>
              </div>
              {/* Opção excluir do ranking */}
              <div
                onClick={async () => {
                  if (!window.confirm("Tem certeza? Seu nome será removido do ranking.")) return;
                  try {
                    await deleteDoc(doc(db, "participantesRanking", user.uid));
                    localStorage.removeItem(`participando_${user.uid}`);
                    setJaParticipando(false);
                    setAceitouRegras(false);
                  } catch (e) { console.error(e); }
                }}
                style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 0", borderTop: "1px solid rgba(34,197,94,0.2)", marginTop: 4 }}
              >
                <div style={{ width: 16, height: 16, borderRadius: 3, border: "1px solid rgba(239,68,68,0.4)", background: "transparent", flexShrink: 0 }} />
                <div style={{ fontSize: "0.75rem", color: "var(--red)", lineHeight: 1.4 }}>
                  Excluir meu nome do ranking
                </div>
              </div>
            </div>
          ) : (
            <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px" }}>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", marginBottom: 4 }}>🏆 Quero participar!</div>
              <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 14 }}>Confirme sua participação e concorra aos prêmios</div>
              <div
                onClick={() => setAceitouRegras(a => !a)}
                style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 16 }}
              >
                <div style={{ width: 20, height: 20, borderRadius: 4, border: `2px solid ${aceitouRegras ? "var(--green)" : "var(--border)"}`, background: aceitouRegras ? "var(--green)" : "transparent", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s" }}>
                  {aceitouRegras && <span style={{ color: "#fff", fontSize: "0.75rem", fontWeight: 900 }}>✓</span>}
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.5 }}>
                  Confirmo que li e aceito todas as regras desta promoção
                </div>
              </div>
              <button
                onClick={confirmarParticipacao}
                disabled={!aceitouRegras || salvando}
                style={{ width: "100%", padding: "14px", background: aceitouRegras ? "linear-gradient(135deg, var(--purple2), var(--purple))" : "var(--bg3)", border: "none", borderRadius: 12, color: aceitouRegras ? "#fff" : "var(--text3)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: aceitouRegras ? "pointer" : "not-allowed", transition: "all 0.2s", boxShadow: aceitouRegras ? "0 4px 20px rgba(90,45,145,0.45)" : "none" }}>
                {salvando ? "Salvando..." : "🏆 Confirmar participação"}
              </button>
            </div>
          )}
        </div>

        {/* Botão ver ranking — mesmo tamanho */}
        <div style={{ padding: "12px 14px 0" }}>
          <button onClick={() => navigate("/ranking")} style={{ width: "100%", padding: "14px", background: "linear-gradient(135deg, rgba(245,197,24,0.15), rgba(230,168,23,0.05))", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 12, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            📊 Ver ranking atual
          </button>
        </div>

        {/* Ganhadores anteriores */}
        {ganhadores.length > 0 && (
          <div style={{ padding: "16px 14px 0" }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "var(--text3)", marginBottom: 12, textAlign: "center" }}>🎖️ Ganhadores anteriores</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {ganhadores.map(g => (
                <div key={g.id} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", overflow: "hidden", background: "var(--surface)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", border: "2px solid var(--gold)" }}>
                    {g.foto ? <img src={g.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : g.nome?.[0]?.toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{g.nome}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--gold)", marginTop: 2 }}>{g.premio}</div>
                    {g.periodo && <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 1 }}>{g.periodo}</div>}
                  </div>
                  <span style={{ fontSize: "1.5rem" }}>{g.posicao === 1 ? "👑" : g.posicao === 2 ? "🥈" : "🥉"}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

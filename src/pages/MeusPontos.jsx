// src/pages/MeusPontos.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useToast } from "../components/Toast";

export default function MeusPontos() {
  const { user, userData } = useAuth();
  const { recompensas, config } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [historico, setHistorico] = useState([]);
  const [resgatando, setResgatando] = useState(null);

  const pontos = userData?.pontos || 0;
  const rankingPts = userData?.rankingPts || 0;
  const cashback = userData?.cashback || 0;
  const modo = config.modoFidelidade || "pontos";

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "pedidos"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, snap => {
      setHistorico(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.pontosGanhos > 0).slice(0, 10));
    });
    return unsub;
  }, [user]);

  const handleResgatar = async (recompensa) => {
    if (pontos < recompensa.pontos) {
      toast("Pontos insuficientes.", "error"); return;
    }
    setResgatando(recompensa.id);
    try {
      await addDoc(collection(db, "resgates"), {
        userId: user.uid,
        nomeCliente: userData?.nome,
        recompensaId: recompensa.id,
        recompensaNome: recompensa.nome,
        pontosUsados: recompensa.pontos,
        status: "pendente",
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, "users", user.uid), {
        pontos: increment(-recompensa.pontos),
      });
      toast(`🎁 ${recompensa.nome} resgatado! Mostre para o atendente.`);
    } catch {
      toast("Erro ao resgatar.", "error");
    } finally { setResgatando(null); }
  };

  // Próxima recompensa alcançável
  const proximaRecompensa = recompensas
    .filter(r => r.pontos > pontos)
    .sort((a, b) => a.pontos - b.pontos)[0];

  const progressoPct = proximaRecompensa
    ? Math.min(100, (pontos / proximaRecompensa.pontos) * 100)
    : 100;

  // Recompensas disponíveis
  const disponiveis = recompensas.filter(r => r.pontos <= pontos);
  const indisponiveis = recompensas.filter(r => r.pontos > pontos);

  return (
    <div className="page">
      <h2 className="display-title mb-4">Meus <span>Pontos</span> e Cashback</h2>

      {/* Cards de saldo — lado a lado ou empilhados */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>

        {/* CARD PONTOS */}
        {(modo === "pontos" || modo === "ambos" || modo === undefined) && (
          <div style={{
            flex: 1, background: "var(--bg2)",
            borderRadius: "var(--radius)", padding: "20px 16px",
            position: "relative", overflow: "hidden",
            border: "1px solid rgba(245,197,24,0.25)",
          }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(245,197,24,0.06)" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>⭐ Pontos</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: pontos > 9999 ? "1.4rem" : pontos > 999 ? "1.8rem" : "2.2rem", fontWeight: 900, color: "var(--gold)", lineHeight: 1 }}>{pontos}</div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                vale R$ {(pontos * (config.valorPonto || 0.1)).toFixed(2).replace(".",",")} em desconto
              </div>
            </div>
          </div>
        )}

        {/* CARD CASHBACK */}
        {(modo === "cashback" || modo === "ambos") && (
          <div style={{
            flex: 1, background: "var(--bg2)",
            borderRadius: "var(--radius)", padding: "20px 16px",
            position: "relative", overflow: "hidden",
            border: "1px solid rgba(96,165,250,0.25)",
          }}>
            <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(96,165,250,0.06)" }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6 }}>💰 Cashback</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, color: "#60a5fa", lineHeight: 1,
                fontSize: cashback >= 100 ? "1.6rem" : cashback >= 10 ? "2rem" : "2.8rem"
              }}>
                {cashback > 0 ? `R$${cashback.toFixed(2).replace(".",",")}` : "R$0,00"}
              </div>
              <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                {cashback > 0 ? "disponível para usar" : `ganhe ${config.cashbackPercent || 5}% por pedido`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* CARD RANKING PTS */}
<div style={{
  background: "var(--bg2)",
  borderRadius: "var(--radius)", padding: "20px 16px", marginBottom: 16,
  border: "1px solid rgba(138,92,246,0.3)", position: "relative", overflow: "hidden"
}}>
  <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(138,92,246,0.08)" }} />
  <div style={{ position: "relative", zIndex: 1 }}>
  <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
  <span>🏆 Pontos de Ranking</span>
  <button onClick={() => navigate("/ranking")} style={{ background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 20, padding: "5px 14px", color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.7rem", cursor: "pointer", boxShadow: "0 2px 10px rgba(138,92,246,0.4)", display: "flex", alignItems: "center", gap: 5, textTransform: "none", letterSpacing: 0 }}>
    🏆 Ver ranking
  </button>
</div>
<div style={{ fontFamily: "'Fraunces', serif", fontSize: rankingPts > 9999 ? "1.4rem" : rankingPts > 999 ? "1.8rem" : "2.2rem", fontWeight: 900, color: "var(--purple2)", lineHeight: 1 }}>{rankingPts.toLocaleString()}</div>
<div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.4)", marginTop: 4 }}>não valem desconto — sobem seu ranking 🚀</div>
</div>
    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
      {[
        { label: "+10 pts", desc: "por pedido" },
        { label: "+1 pt", desc: "por R$1 gasto" },
        { label: "+20 pts", desc: "postar foto" },
        { label: "+15 pts", desc: "comentar" },
        { label: "+5 pts", desc: "curtida recebida" },
        { label: "+10 pts", desc: "compartilhar" },
      ].map((item, i) => (
        <div key={i} style={{ background: "rgba(138,92,246,0.15)", border: "1px solid rgba(138,92,246,0.25)", borderRadius: 8, padding: "3px 8px", fontSize: "0.65rem" }}>
          <span style={{ color: "var(--purple2)", fontWeight: 700 }}>{item.label}</span>
          <span style={{ color: "var(--text3)", marginLeft: 4 }}>{item.desc}</span>
        </div>
      ))}
    </div>
  </div>

            {/* Barra de progresso para próxima recompensa */}
      {proximaRecompensa && (
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", padding: "16px 18px", marginBottom: 20,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>
                🎯 Próxima recompensa
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text2)", marginTop: 2 }}>
                {proximaRecompensa.emoji} {proximaRecompensa.nome}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 700 }}>
                {pontos}/{proximaRecompensa.pontos}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>pontos</div>
            </div>
          </div>

          {/* Barra de progresso */}
          <div style={{ height: 10, background: "var(--bg3)", borderRadius: 50, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progressoPct}%`,
              background: "linear-gradient(90deg, var(--purple2), var(--gold))",
              borderRadius: 50,
              transition: "width 1s ease",
              boxShadow: "0 0 8px rgba(245,197,24,0.4)",
            }} />
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: "0.72rem", color: "var(--text3)" }}>
            <span>{Math.round(progressoPct)}% concluído</span>
            <span>Faltam {proximaRecompensa.pontos - pontos} pts</span>
          </div>

          {/* Motivação */}
          <div style={{
            marginTop: 12, background: "rgba(124,77,189,0.1)",
            borderRadius: "var(--radius-sm)", padding: "8px 12px",
            fontSize: "0.78rem", color: "var(--purple2)", fontWeight: 600,
          }}>
            💡 A cada R$10 em compras você ganha 1 ponto. Faltam ~{proximaRecompensa.pontos - pontos} pedidos!
          </div>
        </div>
      )}

      {/* Recompensas disponíveis */}
      {disponiveis.length > 0 && (
        <>
          <div className="section-label" style={{ color: "var(--green)" }}>🎁 Disponíveis para resgatar</div>
          {disponiveis.map(r => (
            <div key={r.id} style={{
              background: "linear-gradient(135deg, rgba(34,197,94,0.08), var(--bg2))",
              border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: "var(--radius)", padding: "14px 16px",
              marginBottom: 10, display: "flex", alignItems: "center", gap: 14,
            }}>
              <div style={{
                width: 50, height: 50, borderRadius: 14,
                background: "rgba(34,197,94,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.6rem", flexShrink: 0,
              }}>
                {r.emoji}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{r.nome}</div>
                {r.desc && <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginTop: 2 }}>{r.desc}</div>}
                <div style={{ fontSize: "0.72rem", color: "var(--green)", marginTop: 4, fontWeight: 600 }}>
                  {r.pontos} pontos
                </div>
              </div>
              <button
                onClick={() => handleResgatar(r)}
                disabled={resgatando === r.id}
                style={{
                  background: "linear-gradient(135deg, var(--green), #15803d)",
                  border: "none", borderRadius: 10,
                  color: "#fff", fontWeight: 700, fontSize: "0.8rem",
                  padding: "10px 16px", cursor: "pointer",
                  fontFamily: "'Outfit', sans-serif",
                  flexShrink: 0, transition: "all 0.2s",
                  boxShadow: "0 4px 12px rgba(34,197,94,0.3)",
                }}
              >
                {resgatando === r.id ? "..." : "Resgatar"}
              </button>
            </div>
          ))}
        </>
      )}

      {/* Recompensas ainda não disponíveis */}
      {indisponiveis.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 8 }}>🔒 Desbloqueie com mais pontos</div>
          {indisponiveis.map(r => {
            const pct = Math.min(100, (pontos / r.pontos) * 100);
            return (
              <div key={r.id} style={{
                background: "var(--bg2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", padding: "14px 16px",
                marginBottom: 10, opacity: 0.75,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: "var(--bg3)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.4rem", flexShrink: 0, filter: "grayscale(0.5)",
                  }}>
                    {r.emoji}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{r.nome}</div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>
                      {pontos}/{r.pontos} pts · faltam {r.pontos - pontos} pts
                    </div>
                  </div>
                  <div style={{
                    background: "var(--bg3)", borderRadius: 8, padding: "6px 12px",
                    fontSize: "0.72rem", color: "var(--text3)", fontWeight: 600, flexShrink: 0,
                  }}>
                    🔒 {r.pontos} pts
                  </div>
                </div>
                <div style={{ height: 6, background: "var(--bg3)", borderRadius: 50, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${pct}%`,
                    background: "linear-gradient(90deg, var(--purple2), var(--purple))",
                    borderRadius: 50, transition: "width 1s ease",
                  }} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {recompensas.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text2)" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🎁</div>
          <p>Nenhuma recompensa cadastrada ainda.</p>
        </div>
      )}

      {/* Histórico de pontos */}
      {historico.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 8 }}>📋 Histórico de pontos</div>
          {historico.map(p => (
            <div key={p.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 0", borderBottom: "1px solid var(--border)",
              fontSize: "0.82rem",
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>Pedido realizado</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>
                  {p.createdAt?.toDate ? p.createdAt.toDate().toLocaleDateString("pt-BR") : "—"}
                  {" · "}R$ {p.total?.toFixed(2).replace(".", ",")}
                </div>
              </div>
              <div style={{ fontFamily: "'Fraunces', serif", color: "var(--green)", fontWeight: 700, fontSize: "1rem" }}>
                +{p.pontosGanhos} pts
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

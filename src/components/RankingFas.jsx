// src/components/RankingFas.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";

const BADGES_REGRAS = [
  { id: "ouro",    emoji: "👑", label: "Ouro",   posMin: 1, posMax: 1 },
  { id: "prata",   emoji: "🥈", label: "Prata",  posMin: 2, posMax: 3 },
  { id: "bronze",  emoji: "🥉", label: "Bronze", posMin: 4, posMax: 10 },
];

export function getBadges(posicao, pontos) {
  return BADGES_REGRAS.filter(b => {
    if (b.posMin !== undefined) return posicao >= b.posMin && posicao <= b.posMax;
    return false;
  });
}

export default function RankingFas({ compact = false }) {
  const { user } = useAuth();
  const { config } = useStore();
  const navigate = useNavigate();
  const [ranking, setRanking] = useState([]);
  const [minhaPos, setMinhaPos] = useState(null);
  const [loading, setLoading] = useState(true);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "users"), orderBy("rankingPts", "desc"), limit(compact ? 3 : 10)),
      snap => {
        const lista = snap.docs
          .map((d, i) => ({ id: d.id, posicao: i + 1, ...d.data() }))
          .filter(u => u.perfilOculto !== true);
        setRanking(lista);
        if (user) {
          const pos = lista.findIndex(u => u.id === user.uid);
          setMinhaPos(pos >= 0 ? pos + 1 : null);
        }
        setLoading(false);
      }
    );
    return unsub;
  }, [user, compact]);

  const getCountdown = () => {
    if (!config.premioFim) return null;
    const fim = new Date(`${config.premioFim}T${config.premioHoraFim || "23:59"}:00`);
    const diff = Math.max(0, fim - agora);
    if (diff === 0) return { label: "Encerrado!", urgente: false };
    const dias = Math.floor(diff / 86400000);
    const horas = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    return { dias, horas, mins, diff, urgente: dias === 0 && horas < 3 };
  };

  const medalha = (pos) => pos === 1 ? "👑" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `#${pos}`;
  const corPos = (pos) => pos === 1 ? "var(--gold)" : pos === 2 ? "#9ca3af" : pos === 3 ? "#cd7f32" : "var(--text3)";

  if (loading || ranking.length === 0) return null;

  // ── VERSÃO COMPACTA ──────────────────────────────────────────
  if (compact) {
    const cd = getCountdown();
    return (
      <div style={{ margin: "0 14px 14px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "12px 14px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>🏆 Ranking de Fãs</div>
          <button onClick={() => navigate("/ranking")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.72rem", color: "var(--purple2)", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>Ver todos →</button>
        </div>
        {/* Top 3 */}
        {ranking.slice(0, 3).map(u => (
          <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 14px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: "1rem", fontWeight: 900, color: corPos(u.posicao), minWidth: 28, textAlign: "center" }}>{medalha(u.posicao)}</span>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--surface)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", border: `1px solid ${corPos(u.posicao)}` }}>
              {u.photoURL ? <img src={u.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : u.displayName?.[0]?.toUpperCase() || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0, cursor: u.id !== user?.uid ? "pointer" : "default" }} onClick={() => u.id !== user?.uid && navigate(`/perfil/${u.id}`)}>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {u.id === user?.uid ? "Você 🎉" : (u.displayName || u.nome || "Cliente")}
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                {getBadges(u.posicao, u.rankingPts || 0).slice(0, 2).map(b => (
                  <span key={b.id} title={b.label} style={{ fontSize: "0.75rem" }}>{b.emoji}</span>
                ))}
              </div>
            </div>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "0.88rem", fontWeight: 900, color: "var(--gold)" }}>
              {Math.floor(u.rankingPts || 0).toLocaleString()} pts
            </div>
          </div>
        ))}
        {/* Minha posição se fora do top 3 */}
        {minhaPos && minhaPos > 3 && (
          <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", background: "rgba(138,92,246,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--purple2)", minWidth: 28, textAlign: "center" }}>#{minhaPos}</span>
            <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>Sua posição atual</div>
            <div style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--gold)", fontWeight: 700 }}>
              {(ranking.find(u => u.id === user?.uid)?.rankingPts || 0).toLocaleString()} pts
            </div>
          </div>
        )}
        {/* Prêmio compacto */}
        {config.premioNome && cd && (
          <div onClick={() => navigate("/premios")} style={{ padding: "10px 14px", borderTop: "1px solid rgba(245,197,24,0.2)", background: "rgba(245,197,24,0.05)", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1.2rem" }}>🎁</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--gold)" }}>{config.premioNome}</div>
              <div style={{ fontSize: "0.6rem", color: cd.urgente ? "#ef4444" : "var(--text3)", marginTop: 2 }}>
                {cd.label || (cd.dias > 0 ? `⏳ ${cd.dias}d ${cd.horas}h ${cd.mins}min` : `⏳ ${cd.horas}h ${cd.mins}min`)}
              </div>
            </div>
            <span style={{ fontSize: "0.7rem", color: "var(--purple2)", fontWeight: 600 }}>Ver →</span>
          </div>
        )}
      </div>
    );
  }

  // ── VERSÃO COMPLETA ──────────────────────────────────────────
  const cd = getCountdown();
  const premios = [
    { pos: 1, emoji: "🥇", cor: "#f5c518", bg: "rgba(245,197,24,0.12)", borda: "rgba(245,197,24,0.5)", nome: config.premioNome,  desc: config.premioDesc,  img: config.premioImagem,  desconto: config.premioDesconto },
    { pos: 2, emoji: "🥈", cor: "#9ca3af", bg: "rgba(156,163,175,0.08)", borda: "rgba(156,163,175,0.3)", nome: config.premio2Nome, desc: config.premio2Desc, img: config.premio2Imagem },
    { pos: 3, emoji: "🥉", cor: "#cd7f32", bg: "rgba(205,127,50,0.08)", borda: "rgba(205,127,50,0.3)", nome: config.premio3Nome, desc: config.premio3Desc, img: config.premio3Imagem },
    { pos: 4, emoji: "🎖️", cor: "#a78bfa", bg: "rgba(167,139,250,0.08)", borda: "rgba(167,139,250,0.3)", nome: config.premio4Nome, desc: config.premio4Desc, img: config.premio4Imagem, consolacao: true },
    { pos: 5, emoji: "🎖️", cor: "#a78bfa", bg: "rgba(167,139,250,0.06)", borda: "rgba(167,139,250,0.2)", nome: config.premio5Nome, desc: config.premio5Desc, img: config.premio5Imagem, consolacao: true },
  ].filter(p => p.nome);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(15,5,24,0.95)", backdropFilter: "blur(20px)", borderBottom: "1px solid var(--border)", padding: "0 16px", height: 56, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>←</button>
        <div style={{ flex: 1, textAlign: "center", fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 700, color: "var(--gold)" }}>🏆 Ranking de Fãs</div>
        <button onClick={() => navigate("/premios")} style={{ background: "none", border: "none", color: "var(--purple2)", cursor: "pointer", fontSize: "0.75rem", fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>🎁 Prêmios</button>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px 0 80px" }}>

        {/* Carrossel de prêmios — até 5 lugares */}
        {premios.length > 0 && (
          <div style={{ padding: "0 0 16px" }}>
            <div style={{ fontSize: "0.65rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: "var(--text3)", marginBottom: 10, textAlign: "center" }}>🎁 Prêmios desta rodada</div>
            <div style={{ display: "flex", gap: 10, overflowX: "auto", padding: "0 14px", scrollbarWidth: "none" }}>
              {premios.map(p => (
                <div key={p.pos} style={{ flexShrink: 0, width: premios.length <= 3 ? `calc((100% - ${(premios.length-1)*10}px) / ${premios.length})` : 140, background: `linear-gradient(135deg, ${p.bg}, rgba(15,5,24,0.9))`, border: `1px solid ${p.borda}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ position: "relative" }}>
                    {p.img
                      ? <img src={p.img} alt="" style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }} />
                      : <div style={{ height: 120, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>{p.emoji}</div>
                    }
                    {/* Badge posição — pequeno, canto superior esquerdo */}
                    <div style={{ position: "absolute", top: 6, left: 6, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)", borderRadius: 20, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: "0.75rem" }}>{p.emoji}</span>
                      <span style={{ fontSize: "0.58rem", fontWeight: 800, color: p.cor, textTransform: "uppercase" }}>{p.pos}º</span>
                    </div>
                  </div>
                  <div style={{ padding: "8px 10px 10px" }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#fff", lineHeight: 1.3 }}>{p.nome}</div>
                    {p.desc && <div style={{ fontSize: "0.6rem", color: "var(--text3)", marginTop: 2, lineHeight: 1.3 }}>{p.desc}</div>}
                    {p.desconto > 0 && <div style={{ fontSize: "0.6rem", color: "var(--gold)", fontWeight: 700, marginTop: 3 }}>+{p.desconto}% OFF</div>}
                    {p.consolacao && <div style={{ fontSize: "0.58rem", color: "var(--purple2)", fontWeight: 600, marginTop: 3 }}>🎖️ Consolação</div>}
                  </div>
                </div>
              ))}
            </div>
            {premios.length > 3 && (
              <div style={{ textAlign: "center", fontSize: "0.62rem", color: "var(--text3)", marginTop: 6 }}>← Deslize para ver todos os prêmios →</div>
            )}
          </div>
        )}

        {/* Contador neon */}
        {cd && config.premioFim && (
          <div style={{ margin: "0 14px 16px", background: "linear-gradient(135deg, #0f0518, #1a0536)", border: `1px solid ${cd.urgente ? "rgba(239,68,68,0.4)" : "rgba(138,92,246,0.4)"}`, borderRadius: 16, padding: "16px" }}>
            <style>{`@keyframes neonPulse{0%,100%{box-shadow:0 0 8px rgba(167,139,250,0.6),0 0 20px rgba(167,139,250,0.3)}50%{box-shadow:0 0 20px rgba(167,139,250,0.9),0 0 50px rgba(167,139,250,0.5)}}@keyframes urgentPulse{0%,100%{box-shadow:0 0 8px rgba(239,68,68,0.6)}50%{box-shadow:0 0 20px rgba(239,68,68,0.9)}}`}</style>
            <div style={{ textAlign: "center", fontSize: "0.62rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, color: cd.urgente ? "#ef4444" : "var(--purple2)", marginBottom: 12 }}>
              {cd.urgente ? "🔥 ÚLTIMAS HORAS!" : "⏳ Encerramento da rodada"}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", alignItems: "flex-start" }}>
              {[
                ...(cd.dias > 0 ? [{ val: cd.dias, label: "DIAS" }] : []),
                { val: cd.horas, label: "HRS" },
                { val: cd.mins, label: "MIN" },
              ].map((item, i, arr) => (
                <React.Fragment key={item.label}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "2rem", fontWeight: 900, color: cd.urgente ? "#ef4444" : "var(--purple2)", lineHeight: 1, background: "rgba(0,0,0,0.4)", border: `1px solid ${cd.urgente ? "rgba(239,68,68,0.5)" : "rgba(167,139,250,0.5)"}`, borderRadius: 10, padding: "6px 12px", minWidth: 54, animation: `${cd.urgente ? "urgentPulse" : "neonPulse"} 2s ease-in-out infinite`, letterSpacing: 2 }}>
                      {String(item.val).padStart(2, "0")}
                    </div>
                    <div style={{ fontSize: "0.52rem", color: "var(--text3)", marginTop: 5, fontWeight: 700, letterSpacing: 2 }}>{item.label}</div>
                  </div>
                  {i < arr.length - 1 && <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.5rem", color: cd.urgente ? "rgba(239,68,68,0.4)" : "rgba(167,139,250,0.4)", paddingTop: 6, fontWeight: 900 }}>:</div>}
                </React.Fragment>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 10, fontSize: "0.72rem", color: cd.urgente ? "#fca5a5" : "var(--text2)" }}>
              {cd.urgente ? "🔥 Corra! Ainda dá tempo de liderar!" : "👑 Lidere o ranking e garanta seu prêmio!"}
            </div>
          </div>
        )}

        {/* Top 3 destaque */}
        <div style={{ padding: "0 14px 8px", display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 12 }}>
          {ranking[1] && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid #9ca3af", overflow: "hidden", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                {ranking[1].photoURL ? <img src={ranking[1].photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ranking[1].displayName?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ fontSize: "1.4rem" }}>🥈</div>
              <div style={{ fontSize: "0.68rem", fontWeight: 600, textAlign: "center", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ranking[1].displayName || "Cliente"}</div>
            </div>
          )}
          {ranking[0] && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <div style={{ width: 72, height: 72, borderRadius: "50%", border: "3px solid var(--gold)", overflow: "hidden", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", boxShadow: "0 0 20px rgba(245,197,24,0.4)" }}>
                {ranking[0].photoURL ? <img src={ranking[0].photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ranking[0].displayName?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ fontSize: "1.8rem" }}>👑</div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, textAlign: "center", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--gold)" }}>{ranking[0].id === user?.uid ? "Você! 🎉" : (ranking[0].displayName || "Cliente")}</div>
            </div>
          )}
          {ranking[2] && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid #cd7f32", overflow: "hidden", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                {ranking[2].photoURL ? <img src={ranking[2].photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : ranking[2].displayName?.[0]?.toUpperCase() || "?"}
              </div>
              <div style={{ fontSize: "1.4rem" }}>🥉</div>
              <div style={{ fontSize: "0.68rem", fontWeight: 600, textAlign: "center", maxWidth: 70, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ranking[2].displayName || "Cliente"}</div>
            </div>
          )}
        </div>

        {/* Lista completa */}
        <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, margin: "0 14px", overflow: "hidden" }}>
          {ranking.map((u, i) => {
            const badges = getBadges(u.posicao, u.rankingPts || 0);
            const isMe = u.id === user?.uid;
            return (
              <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < ranking.length - 1 ? "1px solid var(--border)" : "none", background: isMe ? "rgba(138,92,246,0.06)" : "transparent", boxShadow: isMe ? "inset 0 0 0 1.5px rgba(138,92,246,0.4)" : "none" }}>
                <span style={{ fontSize: "1rem", fontWeight: 900, color: corPos(u.posicao), minWidth: 32, textAlign: "center" }}>{medalha(u.posicao)}</span>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--surface)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", border: `2px solid ${isMe ? "var(--purple2)" : corPos(u.posicao)}` }}>
                  {u.photoURL ? <img src={u.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : u.displayName?.[0]?.toUpperCase() || "?"}
                </div>
                <div style={{ flex: 1, minWidth: 0, cursor: !isMe ? "pointer" : "default" }} onClick={() => !isMe && navigate(`/perfil/${u.id}`)}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isMe ? "Você 🎉" : (u.displayName || u.nome || "Cliente")}
                  </div>
                  <div style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}>
                    {badges.map(b => (
                      <span key={b.id} style={{ fontSize: "0.7rem", background: "var(--bg3)", borderRadius: 6, padding: "1px 5px" }}>{b.emoji} <span style={{ fontSize: "0.58rem", color: "var(--text3)" }}>{b.label}</span></span>
                    ))}
                  </div>
                </div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "0.95rem", fontWeight: 900, color: "var(--gold)", flexShrink: 0 }}>
                  {Math.floor(u.rankingPts || 0).toLocaleString()} pts
                </div>
              </div>
            );
          })}
        </div>

        {/* Minha posição se fora do top 10 */}
        {minhaPos && minhaPos > 10 && (
          <div style={{ margin: "12px 14px 0", background: "rgba(138,92,246,0.08)", border: "1px solid rgba(138,92,246,0.25)", borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 900, color: "var(--purple2)" }}>#{minhaPos}</span>
            <div style={{ fontSize: "0.82rem", color: "var(--text2)" }}>Sua posição atual</div>
            <div style={{ marginLeft: "auto", fontSize: "0.88rem", color: "var(--gold)", fontWeight: 700 }}>
              {(ranking.find(u => u.id === user?.uid)?.rankingPts || 0).toLocaleString()} pts
            </div>
          </div>
        )}

        {/* Barra de progresso para o 1º lugar */}
        {user && ranking.length > 0 && (() => {
          const eu = ranking.find(u => u.id === user.uid);
          const top1 = ranking[0];
          if (!eu || eu.id === top1.id) return null;
          const meusPts = Math.floor(eu.rankingPts || 0);
          const top1Pts = Math.floor(top1.rankingPts || 0);
          const faltam = Math.max(0, top1Pts - meusPts + 1);
          const pct = Math.min(99, Math.round((meusPts / Math.max(top1Pts, 1)) * 100));
          return (
            <div style={{ margin: "12px 14px 0", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700 }}>🎯 Sua missão</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{pct}% do líder</div>
              </div>
              <div style={{ height: 8, background: "var(--bg3)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, var(--purple2), var(--gold))", borderRadius: 4, transition: "width 1s ease", boxShadow: "0 0 8px rgba(245,197,24,0.4)" }} />
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--purple2)", fontWeight: 600 }}>
                Faltam <span style={{ color: "var(--gold)", fontWeight: 900 }}>{faltam.toLocaleString()} pts</span> para garantir o 1º lugar 🏆
              </div>
            </div>
          );
        })()}

        {/* Rodapé — como ganhar pontos + botões */}
        <div style={{ margin: "12px 14px 0", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "14px" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.5, color: "var(--text3)", marginBottom: 10 }}>🎁 Como ganhar pontos de ranking</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
            {[
              { emoji: "🛒", label: "+10pts", desc: "por pedido" },
              { emoji: "💰", label: "+1pt", desc: "por R$1 gasto" },
              { emoji: "💬", label: "+15pts", desc: "comentar" },
              { emoji: "🔗", label: "+10pts", desc: "compartilhar" },
              { emoji: "❤️", label: "+5pts", desc: "curtir post" },
              { emoji: "📸", label: "+20pts", desc: "postar foto" },
            ].map((item, i) => (
              <div key={i} style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 8, padding: "4px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: "0.85rem" }}>{item.emoji}</span>
                <span style={{ fontSize: "0.65rem", color: "var(--purple2)", fontWeight: 700 }}>{item.label}</span>
                <span style={{ fontSize: "0.62rem", color: "var(--text3)" }}>{item.desc}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={() => navigate("/")} style={{ flex: 1, padding: "11px", background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 10, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", boxShadow: "0 4px 14px rgba(90,45,145,0.4)" }}>
              🚀 Subir no ranking!
            </button>
            <button onClick={() => navigate("/premios")} style={{ flex: 1, padding: "11px", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.3)", borderRadius: 10, color: "var(--gold)", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
              🎁 Ver prêmios
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

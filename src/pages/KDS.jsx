// src/pages/KDS.js
import React, { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, onSnapshot, updateDoc, doc, where, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useParams } from "react-router-dom";

const STATUS_KDS = {
  pendente:   { label: "NOVO",       cor: "#f5c518", bg: "rgba(245,197,24,0.15)",  icon: "🆕", ordem: 0 },
  confirmado: { label: "CONFIRMADO", cor: "#60a5fa", bg: "rgba(96,165,250,0.15)",  icon: "✅", ordem: 1 },
  preparo:    { label: "EM PREPARO", cor: "#a78bfa", bg: "rgba(167,139,250,0.15)", icon: "👨‍🍳", ordem: 2 },
  pronto:     { label: "PRONTO",     cor: "#22c55e", bg: "rgba(34,197,94,0.15)",   icon: "🎉", ordem: 3 },
};

function tocarSom(tipo) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (tipo === "novo") {
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq; osc.type = "sine";
        const t = ctx.currentTime + i * 0.15;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        osc.start(t); osc.stop(t + 0.31);
      });
    }
  } catch {}
}

function formatarTempo(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function tempoDecorrido(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const min = Math.floor((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min === 1) return "1 min";
  return `${min} min`;
}

export default function KDS() {
  const { slug } = useParams();
  const [pedidos, setPedidos] = useState([]);
  const [ativado, setAtivado] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const pedidosAnteriores = useRef(null);
  const [tempo, setTempo] = useState(Date.now());
  const [nomeLoja, setNomeLoja] = useState("");
  const [logoLoja, setLogoLoja] = useState("");

  useEffect(() => {
    if (!slug) return;
    getDoc(doc(db, "lojas", slug)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        const tenantId = data.tenantId || slug;
        getDoc(doc(db, `tenants/${tenantId}/config/loja`)).then(cfg => {
          if (cfg.exists()) {
            setNomeLoja(cfg.data().nomeLoja || "");
            setLogoLoja(cfg.data().logoUrl || "");
          }
        });
      }
    });
  }, [slug]);

  // Atualizar tempo a cada 30s para mostrar tempo decorrido
  useEffect(() => {
    const t = setInterval(() => setTempo(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "pedidos"),
      where("status", "in", ["pendente", "confirmado", "preparo", "pronto"]),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, snap => {
      const novos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (pedidosAnteriores.current !== null) {
        const idsAnteriores = new Set(pedidosAnteriores.current.map(p => p.id));
        const chegaram = novos.filter(p => !idsAnteriores.has(p.id));
        if (chegaram.length > 0 && ativado) tocarSom("novo");
      }
      pedidosAnteriores.current = novos;
      setPedidos(novos);
    });
    return unsub;
  }, [ativado]);

  const atualizarStatus = async (pedidoId, novoStatus) => {
    await updateDoc(doc(db, "pedidos", pedidoId), { status: novoStatus });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  // Agrupar por status
  const porStatus = {
    pendente:   pedidos.filter(p => p.status === "pendente"),
    confirmado: pedidos.filter(p => p.status === "confirmado"),
    preparo:    pedidos.filter(p => p.status === "preparo"),
    pronto:     pedidos.filter(p => p.status === "pronto"),
  };

  const totalAtivos = pedidos.length;

  return (
    <div
      onClick={() => !ativado && setAtivado(true)}
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "'Outfit', sans-serif",
        display: "flex", flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{
        background: "rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {logoLoja
            ? <img src={logoLoja} alt="Logo" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
            : <span style={{ fontSize: "1.6rem" }}>🍳</span>
          }
          <div>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "#f5c518" }}>
              🍳 COZINHA — {nomeLoja || "Loja"}
            </div>
            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            background: totalAtivos > 0 ? "rgba(245,197,24,0.15)" : "rgba(34,197,94,0.1)",
            border: `1px solid ${totalAtivos > 0 ? "rgba(245,197,24,0.4)" : "rgba(34,197,94,0.3)"}`,
            borderRadius: 50, padding: "6px 14px",
            fontSize: "0.82rem", fontWeight: 700,
            color: totalAtivos > 0 ? "#f5c518" : "#22c55e",
          }}>
            {totalAtivos > 0 ? `${totalAtivos} pedido(s) ativo(s)` : "✅ Tudo em dia!"}
          </div>
          <button onClick={() => setAtivado(p => !p)} style={{
            background: ativado ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
            border: `1px solid ${ativado ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            borderRadius: 50, padding: "6px 14px", cursor: "pointer",
            color: ativado ? "#22c55e" : "#ef4444",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem", fontWeight: 600,
          }}>
            {ativado ? "🔔 Som ON" : "🔇 Som OFF"}
          </button>
          <button onClick={toggleFullscreen} style={{
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 50, padding: "6px 14px", cursor: "pointer",
            color: "rgba(255,255,255,0.6)",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.78rem",
          }}>
            {fullscreen ? "⊠ Sair" : "⊞ Tela cheia"}
          </button>
        </div>
      </div>

      {/* Grid de colunas por status */}
      <div style={{
        flex: 1, display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1, padding: 1,
        background: "rgba(255,255,255,0.04)",
      }}>
        {Object.entries(STATUS_KDS).map(([status, info]) => (
          <div key={status} style={{
            background: "#0d0d14",
            display: "flex", flexDirection: "column",
          }}>
            {/* Cabeçalho da coluna */}
            <div style={{
              padding: "12px 14px",
              background: info.bg,
              borderBottom: `2px solid ${info.cor}44`,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0, zIndex: 10,
            }}>
              <div style={{ fontWeight: 800, fontSize: "0.88rem", color: info.cor, letterSpacing: 1 }}>
                {info.icon} {info.label}
              </div>
              <div style={{
                background: info.cor, color: "#000",
                borderRadius: "50%", width: 24, height: 24,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 900, fontSize: "0.78rem",
              }}>
                {porStatus[status].length}
              </div>
            </div>

            {/* Pedidos da coluna */}
            <div style={{ flex: 1, overflowY: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
              {porStatus[status].length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "rgba(255,255,255,0.15)", fontSize: "0.78rem" }}>
                  Nenhum pedido
                </div>
              ) : (
                porStatus[status].map(p => {
                  const minutos = p.createdAt?.toDate
                    ? Math.floor((Date.now() - p.createdAt.toDate().getTime()) / 60000)
                    : 0;
                  const urgente = status === "preparo" && minutos > 15;

                  return (
                    <div key={p.id} style={{
                      background: urgente ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.04)",
                      border: `1px solid ${urgente ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                      borderRadius: 12, padding: 12, overflow: "hidden",
                      animation: status === "pendente" ? "pulseCard 2s infinite" : "none",
                    }}>
                      <style>{`@keyframes pulseCard { 0%,100%{border-color:rgba(245,197,24,0.2)} 50%{border-color:rgba(245,197,24,0.6)} }`}</style>

                      {/* Header do pedido */}
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>
                          {p.nomeCliente?.split(" ")[0] || "Cliente"}
                        </div>
                        <div style={{
                          fontSize: "0.7rem", fontWeight: 700,
                          color: urgente ? "#ef4444" : "rgba(255,255,255,0.4)",
                        }}>
                          ⏱ {tempoDecorrido(p.createdAt)}
                        </div>
                      </div>

                      {/* Tipo de entrega */}
                      <div style={{
                        fontSize: "0.7rem", marginBottom: 8,
                        color: p.tipoEntrega === "entrega" ? "#f97316" : "#60a5fa",
                        fontWeight: 600,
                      }}>
                        {p.tipoEntrega === "entrega" ? "🛵 Delivery" : "🏠 Retirada"}
                      </div>

                      {/* Itens */}
                      <div style={{ marginBottom: 10 }}>
                        {p.items?.map((item, i) => (
                          <div key={i} style={{
                            display: "flex", gap: 6, alignItems: "center",
                            padding: "4px 0",
                            borderBottom: i < p.items.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
                          }}>
                            <span style={{
                              background: info.cor, color: "#000",
                              borderRadius: 6, padding: "1px 7px",
                              fontWeight: 800, fontSize: "0.82rem", flexShrink: 0,
                            }}>{item.qty}x</span>
                            <span style={{ fontSize: "0.82rem", lineHeight: 1.3 }}>{item.nome}</span>
                          </div>
                        ))}
                      </div>

                      {/* Obs */}
                      {p.obs && (
                        <div style={{
                          background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.2)",
                          borderRadius: 6, padding: "4px 8px", fontSize: "0.72rem",
                          color: "#f5c518", marginBottom: 8,
                        }}>
                          📝 {p.obs}
                        </div>
                      )}

                      {/* Botões de ação */}
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {status === "pendente" && (
                          <button onClick={() => atualizarStatus(p.id, "preparo")} style={{
                            flex: 1, padding: "8px 0", border: "none", borderRadius: 8,
                            background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                            color: "#fff", fontWeight: 700, fontSize: "0.78rem",
                            cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                          }}>
                            👨‍🍳 Iniciar preparo
                          </button>
                        )}
                        {status === "confirmado" && (
                          <button onClick={() => atualizarStatus(p.id, "preparo")} style={{
                            flex: 1, padding: "8px 0", border: "none", borderRadius: 8,
                            background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
                            color: "#fff", fontWeight: 700, fontSize: "0.78rem",
                            cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                          }}>
                            👨‍🍳 Iniciar preparo
                          </button>
                        )}
                        {status === "preparo" && (
                          <button onClick={() => atualizarStatus(p.id, "pronto")} style={{
                            flex: 1, padding: "8px 0", border: "none", borderRadius: 8,
                            background: "linear-gradient(135deg, #22c55e, #15803d)",
                            color: "#fff", fontWeight: 700, fontSize: "0.78rem",
                            cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                          }}>
                            ✅ Marcar pronto
                          </button>
                        )}
                        {status === "pronto" && p.tipoEntrega === "entrega" && (
                          <button onClick={() => atualizarStatus(p.id, "entrega")} style={{
                            flex: 1, padding: "8px 0", border: "none", borderRadius: 8,
                            background: "linear-gradient(135deg, #f97316, #c2410c)",
                            color: "#fff", fontWeight: 700, fontSize: "0.78rem",
                            cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                          }}>
                            🛵 Saiu p/ entrega
                          </button>
                        )}
                        {status === "pronto" && p.tipoEntrega === "retirada" && (
                          <button onClick={() => atualizarStatus(p.id, "entregue")} style={{
                            flex: 1, padding: "8px 0", border: "none", borderRadius: 8,
                            background: "linear-gradient(135deg, #22c55e, #15803d)",
                            color: "#fff", fontWeight: 700, fontSize: "0.78rem",
                            cursor: "pointer", fontFamily: "'Outfit', sans-serif",
                          }}>
                            ✅ Entregue
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Ativar áudio overlay */}
      {!ativado && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.85)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
        }}>
          <div style={{ fontSize: "4rem" }}>🍳</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.8rem", color: "#f5c518", fontWeight: 900 }}>
            KDS — Cozinha
          </div>
          <p style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.95rem" }}>
            Toque para ativar o som e iniciar
          </p>
          <button onClick={() => setAtivado(true)} style={{
            background: "linear-gradient(135deg, #f5c518, #e6a817)",
            border: "none", borderRadius: 50, padding: "14px 40px",
            color: "#000", fontWeight: 800, fontSize: "1rem",
            cursor: "pointer", fontFamily: "'Outfit', sans-serif",
          }}>
            ▶ Iniciar KDS
          </button>
        </div>
      )}
    </div>
  );
}

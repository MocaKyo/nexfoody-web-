// src/pages/ChatPage.jsx
import React, { useState, useEffect, useRef, useCallback, Fragment } from "react";
import QRCode from "qrcode";

// Renderiza markdown simples: *negrito*, `code` e \n como quebra de linha
function RenderTexto({ texto }) {
  if (!texto) return null;
  // split por *bold*, `code` e https://... URLs
  const partes = texto.split(/(\*[^*]+\*|`[^`]+`|https?:\/\/[^\s]+)/g);
  const linhas = partes.map((parte, i) => {
    if (parte.startsWith("*") && parte.endsWith("*")) {
      return <strong key={i}>{parte.slice(1, -1)}</strong>;
    }
    if (parte.startsWith("`") && parte.endsWith("`")) {
      return <code key={i} style={{ background: "rgba(255,255,255,0.12)", borderRadius: 4, padding: "1px 5px", fontSize: "0.85em", fontFamily: "monospace", letterSpacing: 0.5 }}>{parte.slice(1, -1)}</code>;
    }
    if (/^https?:\/\//.test(parte)) {
      // Exibe URL encurtada para não poluir visualmente
      let label = parte.replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (label.length > 40) label = label.slice(0, 38) + "…";
      return (
        <a
          key={i}
          href={parte}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: "#a78bfa",
            textDecoration: "underline",
            wordBreak: "break-all",
            cursor: "pointer",
          }}
        >
          🔗 {label}
        </a>
      );
    }
    return parte.split("\n").map((linha, j, arr) => (
      <Fragment key={`${i}-${j}`}>{linha}{j < arr.length - 1 && <br />}</Fragment>
    ));
  });
  return <>{linhas}</>;
}

// Card bonito para mensagem de PIX
function PixCard({ msg, isMinhas }) {
  const [copiado, setCopiadoCola] = useState(false);
  const [copiadoChave, setCopiadoChave] = useState(false);
  const [qrUrl, setQrUrl] = useState(null);

  // Suporte ao novo formato (tipo:"pix") e ao legado (texto com regex)
  const copiaCola = msg.pixCopiaCola || "";
  const chave = msg.pixChave || msg.texto?.match(/Chave[:\s]+`?([^\n`]+)`?/i)?.[1]?.trim() || "";
  const nome  = msg.pixNome  || msg.texto?.match(/Nome[:\s]+([^\n]+)/i)?.[1]?.trim() || "";
  const valor = msg.pixValor != null
    ? `R$ ${Number(msg.pixValor).toFixed(2).replace(".", ",")}`
    : msg.texto?.match(/Valor[:\s]+\*?(R\$[^\n*]+)\*?/i)?.[1]?.trim() || "";
  const ref   = msg.pixRef || "";

  useEffect(() => {
    if (!copiaCola) return;
    QRCode.toDataURL(copiaCola, { width: 200, margin: 1, color: { dark: "#000", light: "#fff" } })
      .then(url => setQrUrl(url))
      .catch(() => {});
  }, [copiaCola]);

  const copiarCola = () => {
    navigator.clipboard.writeText(copiaCola).catch(() => {});
    setCopiadoCola(true); setTimeout(() => setCopiadoCola(false), 2500);
  };
  const copiarChave = () => {
    navigator.clipboard.writeText(chave).catch(() => {});
    setCopiadoChave(true); setTimeout(() => setCopiadoChave(false), 2500);
  };

  if (!chave && !copiaCola) return (
    <div style={{ padding: "10px 14px", fontSize: "0.9rem", color: isMinhas ? "white" : "var(--text)", lineHeight: 1.55 }}>
      <RenderTexto texto={msg.texto} />
    </div>
  );

  return (
    <div style={{ width: "100%", minWidth: 240, animation: "pix-glow 2.5s 0.3s ease-in-out 3" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #059669, #047857)", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: "1.4rem" }}>💳</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "white" }}>Pagamento via PIX</div>
          <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.75)" }}>Transferência instantânea</div>
        </div>
        {valor && <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 8, padding: "4px 10px", fontWeight: 800, fontSize: "0.95rem", color: "white" }}>{valor}</div>}
      </div>

      <div style={{ padding: "14px", background: isMinhas ? "rgba(0,0,0,0.25)" : "var(--bg3)", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* QR Code */}
        {qrUrl && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div style={{ background: "white", borderRadius: 12, padding: 10, display: "inline-block", boxShadow: "0 2px 12px rgba(0,0,0,0.15)" }}>
              <img src={qrUrl} alt="QR Code PIX" style={{ width: 160, height: 160, display: "block" }} />
            </div>
            <div style={{ fontSize: "0.65rem", color: "var(--text3)", textAlign: "center" }}>
              Abra o app do banco → PIX → Escanear QR Code
            </div>
          </div>
        )}

        {/* Copia e Cola */}
        {copiaCola && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "#34d399" }}>PIX Copia e Cola</span>
            <div style={{ display: "flex", gap: 6 }}>
              <code style={{ flex: 1, fontSize: "0.7rem", color: isMinhas ? "white" : "var(--text)", background: isMinhas ? "rgba(255,255,255,0.08)" : "var(--bg2)", padding: "6px 8px", borderRadius: 8, fontFamily: "monospace", wordBreak: "break-all", lineHeight: 1.4, maxHeight: 60, overflow: "hidden" }}>
                {copiaCola.substring(0, 60)}…
              </code>
              <button onClick={copiarCola} style={{ flexShrink: 0, alignSelf: "flex-start", background: copiado ? "#059669" : "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: 10, padding: "8px 12px", cursor: "pointer", fontSize: "0.72rem", fontWeight: 800, color: "white", fontFamily: "'Outfit', sans-serif", transition: "all 0.2s", whiteSpace: "nowrap", boxShadow: copiado ? "none" : "0 2px 8px rgba(16,185,129,0.4)" }}>
                {copiado ? "✓ Copiado!" : "📋 Copiar"}
              </button>
            </div>
          </div>
        )}

        {/* Chave manual */}
        {chave && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "rgba(52,211,153,0.7)" }}>Ou copie a chave manualmente</span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <code style={{ flex: 1, fontSize: "0.82rem", color: isMinhas ? "white" : "var(--text)", background: isMinhas ? "rgba(255,255,255,0.1)" : "var(--bg2)", padding: "5px 8px", borderRadius: 7, fontFamily: "monospace", wordBreak: "break-all" }}>{chave}</code>
              <button onClick={copiarChave} style={{ flexShrink: 0, background: copiadoChave ? "#059669" : "rgba(52,211,153,0.15)", border: `1px solid ${copiadoChave ? "#059669" : "rgba(52,211,153,0.4)"}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: "0.68rem", fontWeight: 700, color: copiadoChave ? "white" : "#34d399", fontFamily: "'Outfit', sans-serif", transition: "all 0.2s", whiteSpace: "nowrap" }}>
                {copiadoChave ? "✓" : "📋"}
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {nome && <div style={{ fontSize: "0.75rem", color: isMinhas ? "rgba(255,255,255,0.7)" : "var(--text2)" }}>👤 {nome}</div>}
          {ref  && <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>📝 Descrição: <strong>{ref}</strong></div>}
        </div>

        {msg.pixAutoConfirmar ? (
          <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 8, padding: "8px 10px", fontSize: "0.72rem", color: "#10b981", lineHeight: 1.5 }}>
            ✅ Seu pedido já está <strong>confirmado</strong>! Pague o PIX acima e aguarde o preparo. Não precisa enviar comprovante.
          </div>
        ) : (
          <div style={{ background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.25)", borderRadius: 8, padding: "7px 10px", fontSize: "0.72rem", color: "#f5c518", lineHeight: 1.5 }}>
            📸 Após pagar, envie o <strong>comprovante aqui no chat</strong> para confirmarmos seu pedido!
          </div>
        )}
      </div>
    </div>
  );
}

// Chips de sugestão rápida após mensagens do bot
function QuickReplies({ onSend, onAtendente }) {
  const sugestoes = [
    { label: "📋 Ver cardápio",     texto: "cardápio"                   },
    { label: "📦 Meu pedido",       texto: "cadê meu pedido?"           },
    { label: "⭐ Meus pontos",      texto: "quantos pontos tenho?"      },
    { label: "🎟️ Meus cupons",     texto: "tenho cupons disponíveis?"  },
    { label: "🎁 Recompensas",      texto: "quais recompensas posso resgatar?" },
    { label: "⏱ Tempo de entrega",  texto: "quanto tempo falta?"        },
    { label: "💳 Pagamento",        texto: "como pagar?"                },
    { label: "👤 Falar c/ atendente", texto: null },
  ];
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6, marginBottom: 4, paddingLeft: 38 }}>
      {sugestoes.map((s, i) => (
        <button key={s.label} onClick={() => s.texto ? onSend(s.texto) : onAtendente?.()} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "5px 12px", fontSize: "0.72rem", fontWeight: 600, color: "var(--text2)", cursor: "pointer", fontFamily: "'Outfit', sans-serif", transition: "all 0.15s", animation: `chip-in 0.2s ${i * 0.06}s both` }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--purple2)"; e.currentTarget.style.color = "var(--purple2)"; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text2)"; }}
        >{s.label}</button>
      ))}
    </div>
  );
}

// Home screen da loja — aparece quando não há mensagens ainda
function LojaHomeSreen({ onSend, onAtendente, lojaSlug, lojaNome, lojaFoto, navigate }) {
  const opcoes = [
    { emoji: "📋", label: "Ver cardápio",        cor: "#7c3aed", bg: "rgba(124,58,237,0.1)",  borda: "rgba(124,58,237,0.25)", acao: () => onSend("cardápio")                              },
    { emoji: "📦", label: "Meu pedido",           cor: "#f5c518", bg: "rgba(245,197,24,0.08)", borda: "rgba(245,197,24,0.25)", acao: () => onSend("cadê meu pedido?")                      },
    { emoji: "⭐", label: "Meus pontos",          cor: "#fb923c", bg: "rgba(251,146,60,0.08)", borda: "rgba(251,146,60,0.25)", acao: () => lojaSlug ? navigate(`/loja/${lojaSlug}/pontos`) : onSend("quantos pontos tenho?") },
    { emoji: "🎟️", label: "Meus cupons",         cor: "#06b6d4", bg: "rgba(6,182,212,0.08)",  borda: "rgba(6,182,212,0.25)",  acao: () => navigate("/cupons")                             },
    { emoji: "🎁", label: "Recompensas",          cor: "#ec4899", bg: "rgba(236,72,153,0.08)", borda: "rgba(236,72,153,0.25)", acao: () => onSend("quais recompensas posso resgatar?")     },
    { emoji: "📸", label: "Feed da loja",         cor: "#22c55e", bg: "rgba(34,197,94,0.08)",  borda: "rgba(34,197,94,0.25)",  acao: () => lojaSlug ? navigate(`/loja/${lojaSlug}/feed`) : onSend("novidades da loja") },
    { emoji: "⏱️", label: "Tempo de entrega",    cor: "#a78bfa", bg: "rgba(167,139,250,0.08)", borda: "rgba(167,139,250,0.25)", acao: () => onSend("quanto tempo falta?")                  },
    { emoji: "💳", label: "Formas de pagamento",  cor: "#34d399", bg: "rgba(52,211,153,0.08)", borda: "rgba(52,211,153,0.25)",  acao: () => onSend("como pagar?")                         },
    { emoji: "⭐", label: "Avaliar pedido",       cor: "#f59e0b", bg: "rgba(245,158,11,0.08)", borda: "rgba(245,158,11,0.25)", acao: () => onSend("quero avaliar meu pedido")              },
    { emoji: "👤", label: "Falar c/ atendente",  cor: "#60a5fa", bg: "rgba(96,165,250,0.08)",  borda: "rgba(96,165,250,0.25)", acao: () => onAtendente?.()                                 },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 16px 16px", overflowY: "auto" }}>
      {/* Avatar + nome da loja */}
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, rgba(124,58,237,0.2), rgba(245,197,24,0.1))", border: "2px solid rgba(138,92,246,0.3)", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10, flexShrink: 0 }}>
        {lojaFoto
          ? <img src={lojaFoto} alt={lojaNome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <span style={{ fontSize: "2rem" }}>🍧</span>
        }
      </div>
      <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)", marginBottom: 2 }}>{lojaNome || "Loja"}</div>
      <div style={{ fontSize: "0.7rem", color: "#a78bfa", marginBottom: 20, display: "flex", alignItems: "center", gap: 4 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", display: "inline-block" }} />
        🤖 Assistente virtual ativo 24/7
      </div>

      {/* Grid 2 colunas */}
      <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {opcoes.map((op, i) => (
          <button
            key={i}
            onClick={op.acao}
            style={{
              padding: "14px 10px",
              background: op.bg,
              border: `1px solid ${op.borda}`,
              borderRadius: 14,
              cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
              fontFamily: "'Outfit', sans-serif",
              transition: "transform 0.15s, box-shadow 0.15s",
              animation: `chip-in 0.2s ${i * 0.04}s both`,
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.03)"; e.currentTarget.style.boxShadow = `0 4px 16px ${op.borda}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <span style={{ fontSize: "1.5rem" }}>{op.emoji}</span>
            <span style={{ fontSize: "0.74rem", fontWeight: 700, color: op.cor, textAlign: "center", lineHeight: 1.3 }}>{op.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Cards de produtos do cardápio enviados pelo bot
function ProdutosCard({ msg, onAdicionar }) {
  const produtos = msg.produtos || [];
  const titulo = msg.texto || "Confira nossas opções:";
  const lojaSlug = msg.lojaSlug || null;
  const navigate = useNavigate();
  const scrollRef = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const [dragged, setDragged] = useState(false);
  const [atInicio, setAtInicio] = useState(true);
  const [atFim, setAtFim] = useState(false);

  const PASSO = 160; // pixels por clique de seta

  const atualizarSetas = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtInicio(el.scrollLeft <= 4);
    setAtFim(el.scrollLeft >= el.scrollWidth - el.clientWidth - 4);
  };

  const scrollPara = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * PASSO, behavior: "smooth" });
    setTimeout(atualizarSetas, 350);
  };

  const onMouseDown = (e) => {
    isDragging.current = true;
    startX.current = e.pageX;
    setDragged(false);
    scrollRef.current.style.cursor = "grabbing";
  };
  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const dx = e.pageX - startX.current;
    scrollRef.current.scrollLeft -= dx;
    startX.current = e.pageX;
    if (Math.abs(dx) > 2) setDragged(true);
  };
  const onMouseUp = () => {
    isDragging.current = false;
    if (scrollRef.current) scrollRef.current.style.cursor = "grab";
    atualizarSetas();
  };

  const temMais = produtos.length > 2;

  // Estilo compartilhado das setas
  const setaStyle = (visivel) => ({
    position: "absolute", top: "50%", transform: "translateY(-50%)",
    width: 28, height: 28, borderRadius: "50%",
    background: "rgba(124,58,237,0.85)", border: "none",
    color: "#fff", fontSize: "0.9rem", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2, boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    opacity: visivel ? 1 : 0, pointerEvents: visivel ? "auto" : "none",
    transition: "opacity 0.2s",
  });

  return (
    <div style={{ width: "100%", minWidth: 260, maxWidth: 380 }}>
      {/* Título */}
      <div style={{ padding: "10px 14px 6px", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: "1.1rem" }}>🍽️</span>
        <span style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text)" }}>{titulo}</span>
      </div>

      {/* Wrapper com setas posicionadas sobre o carrossel */}
      <div style={{ position: "relative" }}>
        {/* Seta esquerda */}
        {temMais && (
          <button onClick={() => scrollPara(-1)} style={{ ...setaStyle(!atInicio), left: 4 }}>‹</button>
        )}

        {/* Scroll horizontal de cards */}
        <div
          ref={scrollRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onScroll={atualizarSetas}
          style={{ display: "flex", gap: 10, overflowX: "auto", padding: "4px 14px 8px", scrollbarWidth: "none", cursor: "grab", userSelect: "none" }}
        >
          {produtos.map(prod => (
            <div key={prod.id} style={{ flexShrink: 0, width: 140, background: "var(--bg3)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--border)", display: "flex", flexDirection: "column" }}>
              {/* Foto ou emoji */}
              {prod.foto
                ? <img src={prod.foto} alt={prod.nome} style={{ width: "100%", height: 90, objectFit: "cover", display: "block", pointerEvents: "none" }} />
                : <div style={{ height: 90, background: "linear-gradient(135deg, var(--bg2), var(--bg3))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.4rem", pointerEvents: "none" }}>{prod.emoji || "🍽️"}</div>
              }
              {/* Info */}
              <div style={{ padding: "8px 10px 10px", display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: "0.8rem", color: "var(--text)", lineHeight: 1.2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{prod.nome}</div>
                {prod.desc && (
                  <div style={{ fontSize: "0.65rem", color: "var(--text3)", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{prod.desc}</div>
                )}
                <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--gold)", marginTop: "auto", paddingTop: 4 }}>
                  R$ {Number(prod.preco).toFixed(2).replace(".", ",")}
                </div>
                <button
                  onClick={() => !dragged && onAdicionar && onAdicionar(prod)}
                  style={{ width: "100%", marginTop: 6, padding: "7px 0", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 8, color: "white", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer" }}
                >
                  + Adicionar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Seta direita */}
        {temMais && (
          <button onClick={() => scrollPara(1)} style={{ ...setaStyle(!atFim), right: 4 }}>›</button>
        )}
      </div>

      {/* Link cardápio completo */}
      {lojaSlug && (
        <div style={{ padding: "2px 14px 12px" }}>
          <button
            onClick={() => navigate(`/loja/${lojaSlug}`)}
            style={{
              width: "100%", padding: "9px 0",
              background: "transparent",
              border: "1px solid rgba(124,58,237,0.35)",
              borderRadius: 10, color: "var(--purple2)",
              fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
          >
            <span>📋</span> Ver cardápio completo →
          </button>
        </div>
      )}
    </div>
  );
}

// Separador de data entre mensagens
function DateSeparator({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 8px", userSelect: "none" }}>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text3)", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "3px 10px", whiteSpace: "nowrap" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}

function formatDateLabel(ts) {
  if (!ts?.toDate) return null;
  const d = ts.toDate();
  const hoje = new Date();
  const ontem = new Date(hoje); ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: d.getFullYear() !== hoje.getFullYear() ? "numeric" : undefined });
}
import { useNavigate, useParams } from "react-router-dom";
import {
  collection, query, where, orderBy, onSnapshot, addDoc,
  updateDoc, doc, serverTimestamp, getDoc, setDoc, getDocs, limit, increment, Timestamp,
} from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

// ── Utilitários ───────────────────────────────────────────────
// Abre ou cria chat com uma LOJA
export async function abrirOuCriarChatLoja({ uid, userName, userFoto, lojaId, lojaNome, lojaLogo, lojaSlug, navigate }) {
  const lojaVirtualId = `loja_${lojaId}`;
  const chatId = [uid, lojaVirtualId].sort().join("__");
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) {
    await setDoc(chatRef, {
      tipo: "loja",
      participantes: [uid, lojaVirtualId],
      participantesInfo: {
        [uid]: { nome: userName, foto: userFoto || null },
        [lojaVirtualId]: { nome: lojaNome, foto: lojaLogo || null, isLoja: true, lojaSlug },
      },
      lojaId,
      lojaSlug,
      ultimaMensagem: null,
      naoLido: { [uid]: 0, [lojaVirtualId]: 0 },
      digitando: {},
      updatedAt: serverTimestamp(),
    });

    // Mensagem de boas-vindas do robô
    const boasVindas = `Olá, ${userName?.split(" ")[0] || ""}! 😊 Sou a *Rebeca*, assistente virtual do *${lojaNome}*!\n\nPosso te ajudar com tudo que você precisa:\n\n🛒 Fazer seu pedido\n📋 Mostrar o cardápio\n📦 Acompanhar seu pedido\n🛵 Localização do entregador em tempo real\n⏱ Tempo de entrega\n💳 Forma de pagamento\n\nTudo sobre o seu pedido, pode perguntar! Como posso te ajudar hoje?`;

    await addDoc(collection(db, "chats", chatId, "mensagens"), {
      autorId: lojaVirtualId,
      autorNome: `🤖 ${lojaNome}`,
      tipo: "texto",
      texto: boasVindas,
      criadoEm: serverTimestamp(),
      lida: false,
      replyTo: null,
      reacoes: {},
      isBot: true,
    });
  }
  navigate(`/chat/${chatId}`);
}
const TYPING_TIMEOUT = 2500;
// Reações idênticas ao WhatsApp
const REACOES = ["❤️", "👍", "😂", "😮", "😢", "🙏"];

function tempoRelativo(ts) {
  if (!ts?.toDate) return "";
  const diff = Math.floor((Date.now() - ts.toDate()) / 1000);
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return ts.toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function tempoHora(ts) {
  if (!ts?.toDate) return "";
  return ts.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── Bubble de mensagem ────────────────────────────────────────
const DELETE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 horas (como WhatsApp, mas trava após entrega)

function Mensagem({ msg, isMinhas, outroFoto, outroNome, onReply, onReaction, onDelete, onAdicionar, isFirstInGroup, isLastInGroup, pedidoEntregue }) {
  const [showPicker, setShowPicker] = useState(false);
  const timerRef = useRef(null);

  const startPress = () => {
    timerRef.current = setTimeout(() => setShowPicker(true), 480);
  };
  const endPress = () => clearTimeout(timerRef.current);

  const reacoesMapa = msg.reacoes
    ? Object.values(msg.reacoes).reduce((a, r) => { a[r] = (a[r] || 0) + 1; return a; }, {})
    : {};
  const temReacoes = Object.keys(reacoesMapa).length > 0;

  // Detecta card PIX
  const isPixMsg = !isMinhas && (msg.tipo === "pix" || (msg.tipo === "texto" && msg.texto?.includes("Pagamento via PIX") && msg.texto?.includes("Chave")));
  const isProdutosMsg = msg.tipo === "produtos";

  // Regra de exclusão: só dentro da janela de tempo E antes do pedido ser entregue
  const dentroDoTempo = msg.criadoEm?.toDate
    ? (Date.now() - msg.criadoEm.toDate().getTime()) < DELETE_WINDOW_MS
    : false;
  const podeDeletar = isMinhas && !msg.apagado && dentroDoTempo && !pedidoEntregue;

  // Bordas do bubble baseadas no grupo
  const borderRadius = isMinhas
    ? (isFirstInGroup && !isLastInGroup) ? "18px 18px 4px 18px"
    : (!isFirstInGroup && isLastInGroup) ? "18px 18px 4px 18px"
    : (!isFirstInGroup && !isLastInGroup) ? "18px 4px 4px 18px"
    : "18px 18px 4px 18px"
    : (isFirstInGroup && !isLastInGroup) ? "18px 18px 18px 4px"
    : (!isFirstInGroup && isLastInGroup) ? "4px 18px 18px 4px"
    : (!isFirstInGroup && !isLastInGroup) ? "4px 18px 18px 4px"
    : "18px 18px 18px 4px";

  const mb = temReacoes ? 28 : isLastInGroup ? 10 : 2;

  return (
    <div style={{
      display: "flex",
      flexDirection: isMinhas ? "row-reverse" : "row",
      alignItems: "flex-end",
      gap: 8,
      marginBottom: mb,
      position: "relative",
    }}>
      {/* Avatar — só para a última msg do grupo recebido */}
      {!isMinhas && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg3)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 700, marginBottom: temReacoes ? 20 : 0, visibility: isLastInGroup ? "visible" : "hidden" }}>
          {outroFoto
            ? <img src={outroFoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : outroNome?.[0]?.toUpperCase()
          }
        </div>
      )}

      <div style={{ maxWidth: "72%", display: "flex", flexDirection: "column", alignItems: isMinhas ? "flex-end" : "flex-start" }}>
        {/* Quote de reply */}
        {msg.replyTo && (
          <div style={{
            background: isMinhas ? "rgba(255,255,255,0.08)" : "var(--bg3)",
            borderLeft: `3px solid ${isMinhas ? "rgba(255,255,255,0.35)" : "var(--purple2)"}`,
            borderRadius: "8px 8px 0 0",
            padding: "5px 10px",
            fontSize: "0.7rem",
            color: isMinhas ? "rgba(255,255,255,0.65)" : "var(--text3)",
            marginBottom: -4,
            overflow: "hidden",
          }}>
            <div style={{ fontWeight: 700, color: isMinhas ? "rgba(255,255,255,0.85)" : "var(--purple2)", marginBottom: 1 }}>
              {msg.replyTo.autorNome}
            </div>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {msg.replyTo.texto || "📷 Mídia"}
            </div>
          </div>
        )}

        {/* Bubble principal */}
        <div
          onTouchStart={startPress} onTouchEnd={endPress}
          onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress}
          style={{
            background: isPixMsg
              ? (isMinhas ? "rgba(5,150,105,0.2)" : "var(--bg2)")
              : isProdutosMsg
                ? "var(--bg2)"
                : isMinhas
                  ? "linear-gradient(135deg, #7c3aed, #6d28d9)"
                  : "var(--bg2)",
            border: isPixMsg
              ? "1px solid rgba(52,211,153,0.35)"
              : isProdutosMsg
                ? "1px solid var(--border)"
                : isMinhas ? "none" : "1px solid var(--border)",
            borderRadius,
            overflow: "hidden",
            cursor: "default",
            userSelect: "none",
          }}
        >
          {/* Imagem */}
          {msg.tipo === "imagem" && (
            <img
              src={msg.midia} alt="" loading="lazy"
              onClick={() => window.open(msg.midia, "_blank")}
              style={{ width: "100%", maxWidth: 240, height: 190, objectFit: "cover", display: "block", cursor: "zoom-in", borderRadius: 14 }}
            />
          )}

          {/* Vídeo */}
          {msg.tipo === "video" && (
            <div style={{ position: "relative", maxWidth: 260, borderRadius: 14, overflow: "hidden" }}>
              <video
                src={msg.midia}
                controls
                playsInline
                preload="metadata"
                style={{ width: "100%", maxHeight: 320, display: "block", background: "#000" }}
              />
              {msg.isVerificacaoPedido && (
                <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.65)", borderRadius: 20, padding: "3px 10px", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#34d399", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {msg.tipoVerificacao === "loja" ? "📦 Conferência do pedido" : "📢 Contestação do cliente"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Card: post compartilhado */}
          {msg.tipo === "post" && msg.payload && (
            <div style={{ minWidth: 200 }}>
              {msg.payload.midia && (
                <img src={msg.payload.midia} alt="" style={{ width: "100%", height: 130, objectFit: "cover", display: "block" }} />
              )}
              <div style={{ padding: "8px 12px" }}>
                <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: isMinhas ? "rgba(255,255,255,0.5)" : "var(--text3)", marginBottom: 3 }}>
                  📌 Post de {msg.payload.autorNome}
                </div>
                {msg.payload.texto && (
                  <div style={{ fontSize: "0.78rem", color: isMinhas ? "white" : "var(--text)", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    {msg.payload.texto}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card: convite para loja */}
          {msg.tipo === "convite_loja" && msg.payload && (
            <div style={{ minWidth: 200 }}>
              {msg.payload.logo && (
                <img src={msg.payload.logo} alt="" style={{ width: "100%", height: 110, objectFit: "cover", display: "block" }} />
              )}
              {!msg.payload.logo && (
                <div style={{ height: 80, background: isMinhas ? "rgba(0,0,0,0.2)" : "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>🍴</div>
              )}
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{ fontSize: "0.58rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: isMinhas ? "rgba(245,197,24,0.8)" : "var(--gold)", marginBottom: 4 }}>
                  🍽️ Convite gastronômico
                </div>
                <div style={{ fontSize: "0.92rem", fontWeight: 800, color: isMinhas ? "white" : "var(--text)", marginBottom: 2 }}>
                  {msg.payload.nome}
                </div>
                {msg.payload.categoria && (
                  <div style={{ fontSize: "0.72rem", color: isMinhas ? "rgba(255,255,255,0.55)" : "var(--text3)", marginBottom: 10 }}>
                    {msg.payload.categoria}
                  </div>
                )}
                {!isMinhas && (
                  <button
                    onClick={() => window.location.href = `/loja/${msg.payload.slug}`}
                    style={{ width: "100%", padding: "8px", background: "linear-gradient(135deg, #f5c518, #e6a817)", border: "none", borderRadius: 10, color: "#1a0a36", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.78rem", cursor: "pointer" }}
                  >
                    🍴 Vamos lá!
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Card de produtos */}
          {!msg.apagado && msg.tipo === "produtos" && (
            <ProdutosCard msg={msg} onAdicionar={onAdicionar} />
          )}

          {/* Mensagem apagada */}
          {msg.apagado && (
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isMinhas ? "rgba(255,255,255,0.4)" : "var(--text3)"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              <span style={{ fontSize: "0.82rem", color: isMinhas ? "rgba(255,255,255,0.4)" : "var(--text3)", fontStyle: "italic" }}>Mensagem apagada</span>
            </div>
          )}

          {/* Texto */}
          {!msg.apagado && (msg.tipo === "texto" || !msg.tipo) && !isPixMsg && (
            <div style={{ padding: "10px 14px" }}>
              <div style={{ fontSize: "0.9rem", color: isMinhas ? "white" : "var(--text)", lineHeight: 1.55, wordBreak: "break-word" }}>
                <RenderTexto texto={msg.texto} />
              </div>
              <div style={{ fontSize: "0.6rem", color: isMinhas ? "rgba(255,255,255,0.45)" : "var(--text3)", textAlign: "right", marginTop: 4, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                {tempoHora(msg.criadoEm)}
                {isMinhas && (
                  <span style={{ color: msg.lida ? "#34d399" : "rgba(255,255,255,0.35)", fontSize: "0.7rem" }}>
                    {msg.lida ? "✓✓" : "✓"}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Card PIX */}
          {!msg.apagado && isPixMsg && (
            <div>
              <PixCard msg={msg} isMinhas={isMinhas} />
              <div style={{ padding: "0 14px 8px", display: "flex", justifyContent: "flex-end" }}>
                <span style={{ fontSize: "0.6rem", color: "var(--text3)" }}>{tempoHora(msg.criadoEm)}</span>
              </div>
            </div>
          )}

          {/* Hora em cards de mídia */}
          {msg.tipo !== "texto" && msg.tipo && (
            <div style={{ padding: "0 10px 6px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: "0.6rem", color: isMinhas ? "rgba(255,255,255,0.45)" : "var(--text3)" }}>{tempoHora(msg.criadoEm)}</span>
              {isMinhas && <span style={{ fontSize: "0.7rem", color: msg.lida ? "#34d399" : "rgba(255,255,255,0.35)" }}>{msg.lida ? "✓✓" : "✓"}</span>}
            </div>
          )}
        </div>

        {/* Reações existentes */}
        {temReacoes && (
          <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
            {Object.entries(reacoesMapa).map(([emoji, count]) => (
              <div key={emoji} onClick={() => onReaction(msg.id, emoji)}
                style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 20, padding: "2px 7px", fontSize: "0.7rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 3 }}>
                {emoji}{count > 1 && <span style={{ color: "var(--text3)", fontSize: "0.65rem" }}>{count}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Picker de reações (long press) */}
        {showPicker && (
          <>
            <div onClick={() => setShowPicker(false)} style={{ position: "fixed", inset: 0, zIndex: 199 }} />
            <div style={{
              position: "absolute",
              [isMinhas ? "right" : "left"]: 0,
              bottom: "calc(100% + 8px)",
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: 28,
              padding: "8px 12px",
              display: "flex",
              gap: 10,
              boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
              zIndex: 200,
              animation: "fadeUp 0.15s ease",
            }}>
              {REACOES.map(r => (
                <button key={r} onClick={() => { onReaction(msg.id, r); setShowPicker(false); }}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.5rem", padding: "2px", lineHeight: 1, transition: "transform 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.transform = "scale(1.35)"}
                  onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                >{r}</button>
              ))}
              <button onClick={() => { onReply(msg); setShowPicker(false); }}
                style={{ background: "var(--bg3)", border: "1px solid var(--border)", cursor: "pointer", padding: "4px 10px", borderRadius: 14, fontSize: "0.68rem", color: "var(--text2)", display: "flex", alignItems: "center", gap: 4 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                Reply
              </button>
              {msg.texto && (
                <button onClick={() => { navigator.clipboard.writeText(msg.texto).catch(()=>{}); setShowPicker(false); }}
                  style={{ background: "var(--bg3)", border: "1px solid var(--border)", cursor: "pointer", padding: "4px 10px", borderRadius: 14, fontSize: "0.68rem", color: "var(--text2)", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                  Copiar
                </button>
              )}
              {podeDeletar && (
                <button onClick={() => { onDelete(msg.id); setShowPicker(false); }}
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer", padding: "4px 10px", borderRadius: 14, fontSize: "0.68rem", color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  Apagar
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Stories bar (inbox) ───────────────────────────────────────
function StoriesBar({ stories, uid, onView }) {
  const navigate = useNavigate();
  if (!stories || stories.length === 0) return null;

  // Agrupa por lojaId
  const lojaMap = {};
  stories.forEach(s => {
    if (!lojaMap[s.lojaId]) lojaMap[s.lojaId] = { lojaId: s.lojaId, nome: s.lojaNome, foto: s.lojaFoto, stories: [] };
    lojaMap[s.lojaId].stories.push(s);
  });
  const grupos = Object.values(lojaMap);

  return (
    <div style={{ borderBottom: "1px solid var(--border)", padding: "12px 14px 10px", background: "var(--bg2)" }}>
      <div style={{ display: "flex", gap: 10, overflowX: "auto", scrollbarWidth: "none", paddingBottom: 2 }}>
        {grupos.map(g => {
          const hasNew = g.stories.some(s => !s.views?.[uid]);
          // Mostra o primeiro story não visto, ou o mais recente
          const preview = g.stories.find(s => !s.views?.[uid]) || g.stories[g.stories.length - 1];
          return (
            <div key={g.lojaId} onClick={() => onView(g)} style={{ flexShrink: 0, cursor: "pointer", width: 82 }}>
              {/* Thumbnail do conteúdo */}
              <div style={{
                width: 82, height: 118, borderRadius: 14, overflow: "hidden", position: "relative",
                boxShadow: hasNew ? "0 0 0 2.5px var(--bg2), 0 0 0 4.5px #7c3aed" : "0 0 0 1.5px var(--border)",
              }}>
                {/* Conteúdo do story como thumbnail */}
                {preview?.tipo === "imagem" && preview?.midia && (
                  <img src={preview.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {preview?.tipo === "video" && preview?.midia && (
                  <video src={preview.midia} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                )}
                {(!preview?.midia || preview?.tipo === "texto") && (
                  <div style={{ width: "100%", height: "100%", background: preview?.cor || "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: "8px 6px" }}>
                    <span style={{ fontSize: "0.6rem", color: "#fff", fontWeight: 700, textAlign: "center", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" }}>{preview?.texto}</span>
                  </div>
                )}
                {/* Overlay escuro suave na base */}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 36, background: "linear-gradient(to top, rgba(0,0,0,0.55), transparent)" }} />
                {/* Logo da loja no canto inferior esquerdo — vai para o feed da loja */}
                <div
                  onClick={e => { e.stopPropagation(); navigate(`/loja/${g.lojaId}/feed`); }}
                  style={{ position: "absolute", bottom: 6, left: 6, width: 24, height: 24, borderRadius: "50%", border: "2px solid #fff", overflow: "hidden", background: "var(--bg3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>
                  {g.foto
                    ? <img src={g.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : g.nome?.[0]?.toUpperCase()
                  }
                </div>
                {/* Indicador de não lido */}
                {hasNew && (
                  <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", border: "1.5px solid var(--bg2)" }} />
                )}
              </div>
              <span style={{ fontSize: "0.62rem", color: hasNew ? "var(--text)" : "var(--text3)", fontWeight: hasNew ? 700 : 400, maxWidth: 82, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", textAlign: "center", marginTop: 5 }}>{g.nome}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Story viewer fullscreen ───────────────────────────────────
function StoryViewer({ grupo, uid, chatId, onClose }) {
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const DURACAO = 5000; // ms por story

  const story = grupo.stories[idx];

  // Progresso e auto-avanço
  useEffect(() => {
    setProgress(0);
    const step = 100 / (DURACAO / 80);
    const t = setInterval(() => {
      setProgress(p => {
        if (p + step >= 100) {
          clearInterval(t);
          setTimeout(() => {
            if (idx < grupo.stories.length - 1) setIdx(i => i + 1);
            else onClose();
          }, 80);
          return 100;
        }
        return p + step;
      });
    }, 80);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  // Marca como visto
  useEffect(() => {
    if (!story || !uid) return;
    import("firebase/firestore").then(({ doc, updateDoc, serverTimestamp }) => {
      updateDoc(doc(db, "lojas", story.lojaId, "stories", story.id), {
        [`views.${uid}`]: serverTimestamp(),
      }).catch(() => {});
    });
  }, [story, uid]);

  if (!story) return null;

  const prev = () => { if (idx > 0) { setIdx(i => i - 1); setProgress(0); } };
  const next = () => { if (idx < grupo.stories.length - 1) { setIdx(i => i + 1); setProgress(0); } else onClose(); };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "#000", display: "flex", flexDirection: "column", touchAction: "none" }}>
      {/* Barras de progresso */}
      <div style={{ position: "absolute", top: 10, left: 12, right: 12, zIndex: 10, display: "flex", gap: 4 }}>
        {grupo.stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 2.5, background: "rgba(255,255,255,0.3)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", background: "white", borderRadius: 2, transition: "width 0.08s linear", width: i < idx ? "100%" : i === idx ? `${progress}%` : "0%" }} />
          </div>
        ))}
      </div>

      {/* Header da loja */}
      <div style={{ position: "absolute", top: 22, left: 12, right: 48, zIndex: 10, display: "flex", alignItems: "center", gap: 10, paddingTop: 8 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", overflow: "hidden", border: "2px solid rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.1)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {grupo.foto ? <img src={grupo.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ color: "white", fontSize: "1rem" }}>{grupo.nome?.[0]}</span>}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "white", textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{grupo.nome}</div>
          {story.criadoEm && <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.65)" }}>{tempoRelativo(story.criadoEm)}</div>}
        </div>
      </div>

      {/* Botão fechar */}
      <button onClick={onClose} style={{ position: "absolute", top: 30, right: 12, zIndex: 11, background: "none", border: "none", color: "white", fontSize: "1.6rem", cursor: "pointer", lineHeight: 1, padding: 4 }}>✕</button>

      {/* Conteúdo */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        {story.tipo === "imagem" && story.midia && (
          <img src={story.midia} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        )}
        {story.tipo === "video" && story.midia && (
          <video src={story.midia} autoPlay muted loop playsInline style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        )}
        {(story.tipo === "texto" || !story.midia) && (
          <div style={{ flex: 1, height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: story.cor || "linear-gradient(135deg, #7c3aed 0%, #ec4899 100%)" }}>
            <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "white", textAlign: "center", padding: "0 32px", textShadow: "0 2px 8px rgba(0,0,0,0.3)", lineHeight: 1.4 }}>{story.texto}</div>
          </div>
        )}

        {/* Overlay de legenda */}
        {story.midia && story.texto && (
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "32px 20px 20px", background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}>
            <div style={{ fontSize: "1rem", color: "white", fontWeight: 600, textShadow: "0 1px 4px rgba(0,0,0,0.5)" }}>{story.texto}</div>
          </div>
        )}

        {/* Zonas de toque: esquerda = anterior, direita = próximo */}
        <div style={{ position: "absolute", inset: 0, display: "flex", zIndex: 5 }}>
          <div style={{ flex: 1 }} onClick={prev} />
          <div style={{ flex: 1 }} onClick={next} />
        </div>
      </div>

      {/* CTA: ir ao chat */}
      {chatId && (
        <div style={{ padding: "12px 16px 28px", display: "flex", justifyContent: "center" }}>
          <button
            onClick={() => { window.location.href = `/chat/${chatId}`; onClose(); }}
            style={{ background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 28, padding: "12px 28px", color: "white", fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "0.9rem", cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.5)" }}
          >
            💬 Conversar com a loja
          </button>
        </div>
      )}
    </div>
  );
}

// ── Indicador "digitando..." ──────────────────────────────────
function TypingIndicator({ foto, nome }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, marginBottom: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", background: "var(--bg3)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.78rem", fontWeight: 700 }}>
        {foto ? <img src={foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : nome?.[0]?.toUpperCase()}
      </div>
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "18px 18px 18px 4px", padding: "12px 16px", display: "flex", gap: 5, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 7, height: 7, borderRadius: "50%", background: "var(--text3)",
            animation: `typing-bounce 1.3s ${i * 0.18}s ease-in-out infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

// ── Modal de atendente humano ──────────────────────────────────
function AtendenteModal({ chatId, lojaId, lojaNome, onClose, onEnviarMsg }) {
  const [etapa, setEtapa] = useState(1); // 1=problemas 2=canais
  const [problema, setProblema] = useState(null);
  const [lojaWhats, setLojaWhats] = useState(null);
  const [canaisAtendimento, setCanaisAtendimento] = useState("ambos");
  const [solicitando, setSolicitando] = useState(false);

  useEffect(() => {
    if (!lojaId) return;
    getDoc(doc(db, "lojas", lojaId)).then(s => {
      if (s.exists()) {
        setLojaWhats(s.data().whatsapp || null);
        // canal: "chat" | "whatsapp" | "ambos" (default ambos)
        const canal = s.data().canalAtendimento || "ambos";
        setCanaisAtendimento(canal);
      }
    }).catch(() => {});
  }, [lojaId]);

  const problemas = [
    { id: "prazo",      emoji: "⏱️", label: "Pedido ultrapassou o prazo",       resposta: "Lamentamos a demora! Nosso time já foi notificado. Em breve um atendente vai te atualizar aqui no chat. 🙏" },
    { id: "errado",     emoji: "❌", label: "Recebi produto diferente do pedido", resposta: "Que chato, nos desculpe! Por favor tire uma foto e envie aqui no chat para agilizarmos o estorno ou reenvio. 📸" },
    { id: "faltou",     emoji: "📦", label: "Faltou um item no pedido",           resposta: "Nos desculpe pelo erro! Envie o que faltou aqui e nossa equipe vai resolver rapidinho. Pode ser reenvio ou estorno. 💙" },
    { id: "cancelar",   emoji: "🚫", label: "Quero cancelar o pedido",            resposta: "Para cancelar, precisamos verificar o status do seu pedido. Um atendente vai confirmar se ainda é possível. ⏳" },
    { id: "cobranca",   emoji: "💳", label: "Cobrança incorreta",                 resposta: "Entendemos sua preocupação! Um atendente vai verificar os valores e fazer a correção necessária. 🔍" },
    { id: "qualidade",  emoji: "😕", label: "Produto veio frio / má qualidade",   resposta: "Pedimos desculpas pela experiência! Envie uma foto aqui e resolveremos. Sua satisfação é nossa prioridade. 🙏" },
    { id: "entregador", emoji: "🛵", label: "Problema com o entregador",          resposta: "Lamentamos! Sua reclamação será encaminhada ao responsável. Um atendente vai te contatar em breve. 📞" },
    { id: "outro",      emoji: "💬", label: "Outro problema",                     resposta: null },
  ];

  const solicitarAtendente = async () => {
    if (!chatId) return;
    setSolicitando(true);
    try {
      await Promise.all([
        updateDoc(doc(db, "chats", chatId), {
          precisaAtendente: true,
          atendenteSolicitadoEm: serverTimestamp(),
          motivoAtendente: problema?.label || "Não especificado",
        }),
        setDoc(doc(db, "lojas", lojaId, "alertasAtendimento", chatId), {
          chatId,
          motivoAtendente: problema?.label || "Não especificado",
          solicitadoEm: serverTimestamp(),
          resolvido: false,
        }),
      ]);
      onEnviarMsg(`🚨 *Preciso de atendimento humano*\nMotivo: ${problema?.label || "Não especificado"}`);
      onClose();
    } catch (e) { console.error(e); }
    finally { setSolicitando(false); }
  };

  const abrirWhatsApp = () => {
    const num = lojaWhats?.replace(/\D/g, "");
    if (!num) return;
    const msg = encodeURIComponent(`Olá! Preciso de ajuda com meu pedido${problema ? ` — ${problema.label}` : ""}.`);
    window.open(`https://wa.me/55${num}?text=${msg}`, "_blank");
    onClose();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", alignItems: "flex-end", background: "rgba(0,0,0,0.55)" }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ width: "100%", maxWidth: 480, margin: "0 auto", background: "var(--bg2)", borderRadius: "20px 20px 0 0", padding: "20px 16px 32px", maxHeight: "85vh", overflowY: "auto" }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border)", margin: "0 auto 16px" }} />

        {etapa === 1 && (
          <>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text)", marginBottom: 4 }}>Qual é o problema?</div>
            <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: 14 }}>Vamos tentar resolver rapidinho antes de chamar um atendente 😊</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {problemas.map(p => (
                <button key={p.id} onClick={() => { setProblema(p); if (p.resposta) setEtapa(2); else setEtapa(2); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", textAlign: "left", fontFamily: "'Outfit', sans-serif" }}>
                  <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>{p.emoji}</span>
                  <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>{p.label}</span>
                  <span style={{ marginLeft: "auto", color: "var(--text3)", fontSize: "0.9rem" }}>›</span>
                </button>
              ))}
            </div>
          </>
        )}

        {etapa === 2 && problema && (
          <>
            <button onClick={() => setEtapa(1)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "0.8rem", marginBottom: 12, padding: 0 }}>← Voltar</button>
            <div style={{ fontSize: "1.5rem", textAlign: "center", marginBottom: 8 }}>{problema.emoji}</div>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text)", textAlign: "center", marginBottom: 12 }}>{problema.label}</div>

            {/* Resposta automática do bot */}
            {problema.resposta && (
              <div style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", borderRadius: 14, padding: "12px 14px", fontSize: "0.82rem", color: "var(--text2)", lineHeight: 1.6, marginBottom: 20 }}>
                🤖 {problema.resposta}
              </div>
            )}

            <div style={{ fontWeight: 700, fontSize: "0.78rem", color: "var(--text3)", textAlign: "center", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Prefere falar com alguém?
            </div>

            {/* Botão: Chamar nesse chat */}
            {(canaisAtendimento === "chat" || canaisAtendimento === "ambos") && (
              <button onClick={solicitarAtendente} disabled={solicitando}
                style={{ width: "100%", padding: "13px", marginBottom: 10, background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: solicitando ? 0.7 : 1 }}>
                {solicitando ? "Solicitando…" : <><span>💬</span> Chamar nesse chat</>}
              </button>
            )}

            {/* Botão: Chamar no WhatsApp — sempre visível */}
            {(canaisAtendimento === "whatsapp" || canaisAtendimento === "ambos") && (
              <button
                onClick={lojaWhats ? abrirWhatsApp : undefined}
                style={{
                  width: "100%", padding: "13px",
                  background: lojaWhats ? "transparent" : "rgba(37,211,102,0.06)",
                  border: `2px solid ${lojaWhats ? "#25d366" : "rgba(37,211,102,0.3)"}`,
                  borderRadius: 12, color: lojaWhats ? "#25d366" : "rgba(37,211,102,0.5)",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem",
                  cursor: lojaWhats ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                <span>📱</span> Chamar no WhatsApp
                {!lojaWhats && <span style={{ fontSize: "0.65rem", fontWeight: 400, marginLeft: 4 }}>(em breve)</span>}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Chat individual ────────────────────────────────────────────
function ChatConversa({ chatId, onBack }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [chatData, setChatData] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [outroDigitando, setOutroDigitando] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [showConvite, setShowConvite] = useState(false);
  const [buscaLoja, setBuscaLoja] = useState("");
  const [sugestoesLojas, setSugestoesLojas] = useState([]);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [textoVoz, setTextoVoz] = useState(""); // transcrição parcial
  const [showAtendente, setShowAtendente] = useState(false);
  const reconhecimentoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const scrollAreaRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const typingTimerRef = useRef(null);

  const outroId = chatData?.participantes?.find(p => p !== user?.uid);
  const outroInfo = chatData?.participantesInfo?.[outroId] || {};

  // Envia mensagem rápida pré-definida (ex: botões no chat bloqueado)
  const enviarMsgRapida = async (texto) => {
    if (!user?.uid || !chatId) return;
    const nome = user.displayName || user.email?.split("@")[0] || "Cliente";
    try {
      await addDoc(collection(db, "chats", chatId, "mensagens"), {
        autorId: user.uid,
        autorNome: nome,
        autorFoto: user.photoURL || null,
        tipo: "texto",
        texto,
        criadoEm: serverTimestamp(),
        lida: false,
        replyTo: null,
        reacoes: {},
      });
      await updateDoc(doc(db, "chats", chatId), {
        ultimaMensagem: { texto, criadoEm: serverTimestamp(), autorId: user.uid },
        updatedAt: serverTimestamp(),
        ...(outroId ? { [`naoLido.${outroId}`]: increment(1) } : {}),
      });
    } catch (e) { console.error("enviarMsgRapida:", e); }
  };

  // Carregar chat metadata
  useEffect(() => {
    if (!chatId) return;
    return onSnapshot(doc(db, "chats", chatId), snap => {
      if (snap.exists()) setChatData({ id: snap.id, ...snap.data() });
    });
  }, [chatId]);

  // Carregar mensagens em real-time
  useEffect(() => {
    if (!chatId || !user?.uid) return;
    const q = query(collection(db, "chats", chatId, "mensagens"), orderBy("criadoEm", "asc"), limit(100));
    return onSnapshot(q, snap => {
      setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Marcar como lidas
      snap.docs
        .filter(d => d.data().autorId !== user.uid && !d.data().lida)
        .forEach(d => updateDoc(d.ref, { lida: true }).catch(() => {}));
      // Zerar badge de não-lido
      updateDoc(doc(db, "chats", chatId), { [`naoLido.${user.uid}`]: 0 }).catch(() => {});
    });
  }, [chatId, user?.uid]);

  // Indicador de digitação do outro
  useEffect(() => {
    if (!chatId || !outroId) return;
    return onSnapshot(doc(db, "chats", chatId), snap => {
      setOutroDigitando(!!(snap.data()?.digitando?.[outroId]));
    });
  }, [chatId, outroId]);

  // Scroll automático (só quando estiver perto do bottom)
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); return; }
    const distBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distBottom < 120) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, outroDigitando]);

  // Botão "scroll to bottom"
  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 200);
  };
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const temSpeechAPI = !isIOS && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const toggleMicrofone = () => {
    if (isIOS) {
      // iOS: foca o input para o teclado abrir com o mic nativo disponível
      inputRef.current?.focus();
      alert("No iPhone, toque no ícone de microfone 🎤 que aparece no teclado para ditar sua mensagem.");
      return;
    }
    if (!temSpeechAPI) {
      alert("Seu navegador não suporta reconhecimento de voz. Use o Chrome para Android.");
      return;
    }

    if (gravando) {
      reconhecimentoRef.current?.stop();
      setGravando(false);
      return;
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => { setGravando(true); setTextoVoz(""); };

    rec.onresult = (e) => {
      let parcial = "";
      let final = "";
      for (const r of e.results) {
        if (r.isFinal) final += r[0].transcript;
        else parcial += r[0].transcript;
      }
      setTextoVoz(parcial);
      if (final) {
        const novo = (texto + " " + final).trim();
        setTexto(novo);
        setTextoVoz("");
        inputRef.current?.focus();
      }
    };

    rec.onerror = () => { setGravando(false); setTextoVoz(""); };
    rec.onend = () => { setGravando(false); setTextoVoz(""); };

    reconhecimentoRef.current = rec;
    rec.start();
  };

  const notificarDigitando = (val) => {
    setTexto(val);
    if (!chatId || !user?.uid) return;
    updateDoc(doc(db, "chats", chatId), { [`digitando.${user.uid}`]: true }).catch(() => {});
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      updateDoc(doc(db, "chats", chatId), { [`digitando.${user.uid}`]: false }).catch(() => {});
    }, TYPING_TIMEOUT);
  };

  const enviar = async (tipo = "texto", extra = {}) => {
    const textoFinal = tipo === "texto" ? texto.trim() : "";
    if (tipo === "texto" && !textoFinal) return;
    if (!user?.uid || !chatId) return;

    setEnviando(true);
    const nome = user.displayName || user.email?.split("@")[0] || "Você";

    const msgData = {
      autorId: user.uid,
      autorNome: nome,
      autorFoto: user.photoURL || null,
      tipo,
      texto: textoFinal,
      ...extra,
      replyTo: replyTo ? { id: replyTo.id, texto: replyTo.texto || "", autorNome: replyTo.autorNome } : null,
      lida: false,
      criadoEm: serverTimestamp(),
    };

    const resumo =
      tipo === "texto" ? textoFinal
      : tipo === "imagem" ? "📷 Foto"
      : tipo === "video" ? "🎥 Vídeo"
      : tipo === "convite_loja" ? `🍽️ ${extra.payload?.nome || "Restaurante"}`
      : tipo === "post" ? `📌 Post de ${extra.payload?.autorNome || "alguém"}`
      : "📎 Anexo";

    try {
      await addDoc(collection(db, "chats", chatId, "mensagens"), msgData);
      await updateDoc(doc(db, "chats", chatId), {
        ultimaMensagem: { texto: resumo, criadoEm: serverTimestamp(), autorId: user.uid },
        updatedAt: serverTimestamp(),
        [`naoLido.${outroId}`]: increment(1),
        [`digitando.${user.uid}`]: false,
      });
      if (tipo === "texto") setTexto("");
      setReplyTo(null);
      clearTimeout(typingTimerRef.current);
    } catch (e) { console.error(e); }
    finally { setEnviando(false); }
  };

  const enviarMidia = async (file) => {
    if (!file || !chatId) return;
    const isVideo = file.type.startsWith("video/");
    setUploadProgress(0);
    const nome = `chat/${chatId}/${Date.now()}_${file.name.replace(/[^a-z0-9.]/gi, "_")}`;
    const sRef = storageRef(storage, nome);
    const task = uploadBytesResumable(sRef, file);
    task.on(
      "state_changed",
      s => setUploadProgress(Math.round(s.bytesTransferred / s.totalBytes * 100)),
      err => { console.error(err); setUploadProgress(null); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await enviar(isVideo ? "video" : "imagem", { midia: url });
        setUploadProgress(null);
      }
    );
  };

  const adicionarReacao = async (msgId, emoji) => {
    if (!user?.uid) return;
    await updateDoc(doc(db, "chats", chatId, "mensagens", msgId), {
      [`reacoes.${user.uid}`]: emoji,
    });
  };

  const apagarMensagem = async (msgId) => {
    if (!user?.uid) return;
    await updateDoc(doc(db, "chats", chatId, "mensagens", msgId), {
      apagado: true,
      texto: "",
    }).catch(() => {});
  };

  const buscarLojas = async (termo) => {
    setBuscaLoja(termo);
    if (termo.length < 2) { setSugestoesLojas([]); return; }
    try {
      const snap = await getDocs(query(collection(db, "lojas"),
        where("nomeMin", ">=", termo.toLowerCase()),
        where("nomeMin", "<=", termo.toLowerCase() + "\uf8ff"),
        limit(6)
      ));
      setSugestoesLojas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {}
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg)", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @keyframes typing-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes pix-glow {
          0%, 100% { box-shadow: 0 0 8px rgba(52,211,153,0.2); }
          50%       { box-shadow: 0 0 18px rgba(52,211,153,0.5); }
        }
        @keyframes chip-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      {/* ── Header ───────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: "10px 14px", background: "var(--bg2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", padding: "4px 8px 4px 0", fontSize: "1.2rem", lineHeight: 1 }}>←</button>
        <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, var(--purple2), #6d28d9)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: 800, color: "#fff", border: "2px solid rgba(138,92,246,0.35)" }}>
          {outroInfo.foto
            ? <img src={outroInfo.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : outroInfo.nome?.[0]?.toUpperCase()
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "0.92rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {outroInfo.nome || "Chat"}
          </div>
          {outroDigitando
            ? <div style={{ fontSize: "0.7rem", color: "var(--purple2)", display: "flex", alignItems: "center", gap: 5 }}>
                <span>digitando</span>
                {[0,1,2].map(i => <span key={i} style={{ width: 4, height: 4, borderRadius: "50%", background: "var(--purple2)", display: "inline-block", animation: `typing-bounce 1.3s ${i*0.18}s infinite` }} />)}
              </div>
            : outroInfo.isLoja
              ? <div style={{ fontSize: "0.68rem", color: "#a78bfa", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa", display: "inline-block", animation: "typing-bounce 2s ease-in-out infinite" }} />
                  🤖 Assistente virtual ativo 24/7
                </div>
              : <div style={{ fontSize: "0.7rem", color: "#34d399", display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
                  online
                </div>
          }
        </div>
        <button onClick={() => setShowConvite(true)} title="Sugerir restaurante" style={{ background: "none", border: "none", cursor: "pointer", padding: 6, color: "var(--text3)", fontSize: "1.3rem" }}>🍴</button>
      </div>

      {/* ── Chat bloqueado: aguardando confirmação ── */}
      {chatData?.bloqueado && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 20px", overflowY: "auto" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(245,197,24,0.12)", border: "1px solid rgba(245,197,24,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", marginBottom: 14 }}>
            🔒
          </div>
          <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text)", marginBottom: 6, textAlign: "center" }}>
            Aguardando confirmação
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--text3)", textAlign: "center", lineHeight: 1.7, marginBottom: 18, maxWidth: 260 }}>
            Seu pedido foi enviado à loja. Assim que confirmado, o chat será liberado para você conversar.
          </div>
          {chatData.pedidoInfo && (
            <div style={{ width: "100%", maxWidth: 320, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, padding: 16 }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)", marginBottom: 10 }}>
                🛒 Resumo do pedido #{chatData.pedidoInfo.numeroPedido}
              </div>
              {chatData.pedidoInfo.itens?.map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 5 }}>
                  <span style={{ color: "var(--text2)" }}>{item.qty}x {item.nome}</span>
                  <span style={{ fontWeight: 600 }}>R$ {((item.preco || 0) * item.qty).toFixed(2).replace(".", ",")}</span>
                </div>
              ))}
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 6, display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "0.92rem" }}>
                <span>Total</span>
                <span style={{ color: "var(--gold)" }}>R$ {(chatData.pedidoInfo.total || 0).toFixed(2).replace(".", ",")}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: "0.72rem", color: "var(--text3)" }}>
                {chatData.pedidoInfo.tipoEntrega === "entrega" ? `🛵 Delivery: ${chatData.pedidoInfo.endereco}` : chatData.pedidoInfo.tipoEntrega === "retirada" ? "🏠 Retirada no local" : `🪑 ${chatData.pedidoInfo.endereco}`}
              </div>
            </div>
          )}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8, fontSize: "0.72rem", color: "var(--text3)" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f5c518", animation: "pulse-dot 2s infinite" }} />
            Loja sendo notificada…
          </div>

          {/* Ações rápidas enquanto aguarda */}
          <div style={{ marginTop: 20, width: "100%", maxWidth: 320 }}>
            <div style={{ fontSize: "0.6rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)", textAlign: "center", marginBottom: 10 }}>
              Enquanto isso, você pode:
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => enviarMsgRapida("cardápio")}
                style={{
                  flex: 1, padding: "11px 8px",
                  background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)",
                  borderRadius: 12, cursor: "pointer", color: "var(--purple2)",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>📋</span>
                Ver cardápio
              </button>
              <button
                onClick={() => enviarMsgRapida("tempo de entrega")}
                style={{
                  flex: 1, padding: "11px 8px",
                  background: "rgba(245,197,24,0.08)", border: "1px solid rgba(245,197,24,0.25)",
                  borderRadius: 12, cursor: "pointer", color: "var(--gold)",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>⏱</span>
                Tempo est.
              </button>
              <button
                onClick={() => enviarMsgRapida("ajuda")}
                style={{
                  flex: 1, padding: "11px 8px",
                  background: "rgba(96,165,250,0.08)", border: "1px solid rgba(96,165,250,0.2)",
                  borderRadius: 12, cursor: "pointer", color: "#60a5fa",
                  fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.78rem",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontSize: "1.2rem" }}>❓</span>
                Ajuda
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mensagens ────────────────────────────── */}
      {!chatData?.bloqueado && (
        <div ref={scrollAreaRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: "16px 14px", display: "flex", flexDirection: "column", scrollbarWidth: "none", position: "relative" }}>
          {mensagens.length === 0 && (
            outroInfo.isLoja ? (
              <LojaHomeSreen
                onSend={enviarMsgRapida}
                onAtendente={() => setShowAtendente(true)}
                lojaSlug={chatData?.lojaSlug || outroInfo.lojaSlug}
                lojaNome={outroInfo.nome}
                lojaFoto={outroInfo.foto}
                navigate={navigate}
              />
            ) : (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text3)", paddingBottom: 40 }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, rgba(124,58,237,0.15), rgba(245,197,24,0.08))", border: "1px solid rgba(138,92,246,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", marginBottom: 4 }}>🍧</div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text2)" }}>Nova conversa!</div>
                <div style={{ fontSize: "0.78rem", textAlign: "center", lineHeight: 1.7, maxWidth: 220 }}>
                  Mande um oi, compartilhe um post<br />ou sugira um restaurante 🍴
                </div>
              </div>
            )
          )}

          {mensagens.map((msg, idx) => {
            const prev = mensagens[idx - 1];
            const next = mensagens[idx + 1];
            const isMinhas = msg.autorId === user?.uid;

            // Agrupamento: mesmo autor em sequência
            const isFirstInGroup = !prev || prev.autorId !== msg.autorId;
            const isLastInGroup  = !next || next.autorId !== msg.autorId;

            // Separador de data
            const msgDate = msg.criadoEm?.toDate?.();
            const prevDate = prev?.criadoEm?.toDate?.();
            const showDate = msgDate && (!prevDate || msgDate.toDateString() !== prevDate.toDateString());
            const dateLabel = showDate ? formatDateLabel(msg.criadoEm) : null;

            // Quick replies: só após a última msg do bot em sequência e se for loja
            const isBot = !isMinhas && msg.isBot;
            const showQuickReplies = isBot && isLastInGroup && idx === mensagens.length - 1;

            return (
              <Fragment key={msg.id}>
                {dateLabel && <DateSeparator label={dateLabel} />}
                <Mensagem
                  msg={msg}
                  isMinhas={isMinhas}
                  outroFoto={outroInfo.foto}
                  outroNome={outroInfo.nome}
                  onReply={setReplyTo}
                  onReaction={adicionarReacao}
                  onDelete={apagarMensagem}
                  onAdicionar={(prod) => {
                    setTexto(`Quero adicionar ${prod.nome}`);
                    setTimeout(() => document.getElementById("chat-input")?.focus(), 50);
                  }}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  pedidoEntregue={chatData?.pedidoInfo?.status === "entregue" || chatData?.pedidoInfo?.status === "cancelado"}
                />
                {showQuickReplies && <QuickReplies onSend={enviarMsgRapida} onAtendente={() => setShowAtendente(true)} />}
              </Fragment>
            );
          })}

          {outroDigitando && <TypingIndicator foto={outroInfo.foto} nome={outroInfo.nome} />}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* ── Botão scroll-to-bottom ───────────────── */}
      {showScrollBtn && !chatData?.bloqueado && (
        <button onClick={scrollToBottom} style={{
          position: "absolute", bottom: 80, right: 16, zIndex: 50,
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--bg2)", border: "1px solid var(--border)",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.1rem", color: "var(--text2)",
          transition: "all 0.2s",
        }}
          onMouseEnter={e => { e.currentTarget.style.background = "var(--purple2)"; e.currentTarget.style.color = "white"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "var(--bg2)"; e.currentTarget.style.color = "var(--text2)"; }}
        >↓</button>
      )}

      {/* ── Banner de reply ──────────────────────── */}
      {replyTo && (
        <div style={{ flexShrink: 0, padding: "8px 14px", background: "var(--bg2)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8, animation: "fadeUp 0.15s ease" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--purple2)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
          <div style={{ flex: 1, borderLeft: "3px solid var(--purple2)", paddingLeft: 8, overflow: "hidden" }}>
            <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--purple2)" }}>{replyTo.autorNome}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{replyTo.texto || "📷 Mídia"}</div>
          </div>
          <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", fontSize: "1.1rem", padding: 0 }}>✕</button>
        </div>
      )}

      {/* ── Progresso de upload ──────────────────── */}
      {uploadProgress !== null && (
        <div style={{ flexShrink: 0, padding: "6px 14px", background: "var(--bg2)", borderTop: "1px solid var(--border)" }}>
          <div style={{ height: 3, background: "var(--bg3)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${uploadProgress}%`, background: "linear-gradient(90deg, var(--purple2), var(--gold))", transition: "width 0.3s", borderRadius: 2 }} />
          </div>
          <div style={{ fontSize: "0.65rem", color: "var(--text3)", marginTop: 3 }}>Enviando mídia… {uploadProgress}%</div>
        </div>
      )}

      {/* ── Input ────────────────────────────────── */}
      {chatData?.bloqueado ? (
        <div style={{ flexShrink: 0, padding: "14px 16px", paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))", background: "var(--bg2)", borderTop: "1px solid var(--border)", textAlign: "center" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text3)" }}>🔒 Chat liberado após confirmação do pedido</div>
        </div>
      ) : (
      <div style={{ flexShrink: 0, padding: "10px 12px", paddingBottom: "max(14px, env(safe-area-inset-bottom, 14px))", background: "var(--bg2)", borderTop: "1px solid var(--border)", display: "flex", alignItems: "flex-end", gap: 8 }}>
        {/* Foto */}
        <button onClick={() => fileRef.current?.click()}
          title="Enviar foto"
          style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: 6, flexShrink: 0, borderRadius: 10, transition: "color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = "var(--purple2)"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </button>
        <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) enviarMidia(f); e.target.value = ""; }} />

        {/* Vídeo */}
        <button onClick={() => videoRef.current?.click()}
          title="Enviar vídeo"
          style={{ background: "none", border: "none", color: "var(--text3)", cursor: "pointer", padding: 6, flexShrink: 0, borderRadius: 10, transition: "color 0.15s" }}
          onMouseEnter={e => e.currentTarget.style.color = "#f97316"}
          onMouseLeave={e => e.currentTarget.style.color = "var(--text3)"}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/>
          </svg>
        </button>
        <input ref={videoRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) enviarMidia(f); e.target.value = ""; }} />

        {/* Textarea */}
        <div style={{ flex: 1, background: gravando ? "rgba(239,68,68,0.08)" : "var(--bg3)", border: `1px solid ${gravando ? "rgba(239,68,68,0.5)" : "var(--border)"}`, borderRadius: 22, padding: "9px 14px", display: "flex", alignItems: "flex-end", transition: "all 0.2s" }}
          onFocus={e => { if (!gravando) e.currentTarget.style.borderColor = "var(--purple2)"; }}
          onBlur={e => { if (!gravando) e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          <textarea
            ref={inputRef}
            id="chat-input"
            value={gravando && textoVoz ? textoVoz : texto}
            onChange={e => { if (!gravando) notificarDigitando(e.target.value); }}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enviar(); } }}
            placeholder={gravando ? "🎤 Ouvindo…" : "Mensagem…"}
            rows={1}
            readOnly={gravando}
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: gravando ? "var(--red, #ef4444)" : "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.9rem", resize: "none", maxHeight: 110, lineHeight: 1.45 }}
            onInput={e => { e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; }}
          />
          {gravando && (
            <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} />
            </div>
          )}
        </div>

        {/* Microfone (quando sem texto) ou Enviar (quando tem texto) */}
        {!texto.trim() && !gravando ? (
          <button
            onClick={toggleMicrofone}
            style={{ width: 42, height: 42, borderRadius: "50%", background: "var(--bg3)", border: "1px solid var(--border)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
              <line x1="8" y1="22" x2="16" y2="22"/>
            </svg>
          </button>
        ) : gravando ? (
          <button
            onClick={toggleMicrofone}
            style={{ width: 42, height: 42, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, animation: "pulse 1.2s infinite" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>
        ) : (
          <button
            onClick={() => enviar()}
            disabled={enviando}
            style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(135deg, var(--purple2), #6d28d9)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s", boxShadow: "0 4px 16px rgba(124,58,237,0.45)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        )}
      </div>
      )}

      {/* ── Modal: sugerir restaurante ───────────── */}
      {showConvite && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => { setShowConvite(false); setBuscaLoja(""); setSugestoesLojas([]); }} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)" }} />
          <div style={{ position: "relative", background: "var(--bg2)", borderRadius: "24px 24px 0 0", padding: "20px 16px 36px", animation: "slideUp 0.3s ease", maxHeight: "70vh", display: "flex", flexDirection: "column" }}>
            <div style={{ width: 40, height: 4, background: "var(--border)", borderRadius: 2, margin: "0 auto 18px" }} />
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.15rem", fontWeight: 900, marginBottom: 4 }}>Sugerir restaurante 🍴</div>
            <p style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 14 }}>Manda um convite para o amigo ir junto</p>
            <input
              value={buscaLoja}
              onChange={e => buscarLojas(e.target.value)}
              placeholder="🔍 Buscar pelo nome da loja…"
              autoFocus
              style={{ background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: 14, padding: "10px 14px", color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem", outline: "none", marginBottom: 8, width: "100%", boxSizing: "border-box" }}
            />
            <div style={{ overflowY: "auto", flex: 1 }}>
              {sugestoesLojas.map(l => (
                <div key={l.id} onClick={() => { enviar("convite_loja", { payload: { slug: l.slug || l.id, nome: l.nome, logo: l.logo || null, categoria: l.categoria || "" } }); setShowConvite(false); setBuscaLoja(""); setSugestoesLojas([]); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 4px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--bg3)", overflow: "hidden", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.3rem" }}>
                    {l.logo ? <img src={l.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "🏪"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{l.nome}</div>
                    {l.categoria && <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{l.categoria}</div>}
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "var(--purple2)", fontWeight: 700 }}>Enviar →</span>
                </div>
              ))}
              {buscaLoja.length >= 2 && sugestoesLojas.length === 0 && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text3)", fontSize: "0.82rem" }}>Nenhuma loja encontrada</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de atendente */}
      {showAtendente && (
        <AtendenteModal
          chatId={chatId}
          lojaId={chatData?.lojaId || outroId?.replace("loja_", "")}
          lojaNome={outroInfo.nome}
          onClose={() => setShowAtendente(false)}
          onEnviarMsg={enviarMsgRapida}
        />
      )}
    </div>
  );
}

// ── Helpers de online ────────────────────────────────────────
const ONLINE_MS = 5 * 60 * 1000;      // verde: ativo nos últimos 5 min
const RECENTE_MS = 60 * 60 * 1000;    // amarelo: ativo na última hora

function statusOnline(onlineAt) {
  if (!onlineAt?.toMillis) return "offline";
  const diff = Date.now() - onlineAt.toMillis();
  if (diff < ONLINE_MS) return "online";
  if (diff < RECENTE_MS) return "recente";
  return "offline";
}

const COR_STATUS = { online: "#34d399", recente: "#f5c518", offline: "var(--bg3)" };
const GLOW_STATUS = { online: "0 0 7px rgba(52,211,153,0.8)", recente: "0 0 7px rgba(245,197,24,0.6)", offline: "none" };

// ── Lista de conversas (inbox) ────────────────────────────────
export default function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatId: chatIdParam } = useParams();
  const [conversas, setConversas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatAtivo, setChatAtivo] = useState(chatIdParam || null);
  const [amigos, setAmigos] = useState([]);
  const [lojas, setLojas] = useState([]);
  const [lojasComPedido, setLojasComPedido] = useState(new Set());
  const [stories, setStories] = useState([]);
  const [storyGrupo, setStoryGrupo] = useState(null);

  useEffect(() => {
    if (chatIdParam) setChatAtivo(chatIdParam);
  }, [chatIdParam]);

  // Heartbeat — mantém o usuário como "online"
  useEffect(() => {
    if (!user?.uid) return;
    const ping = () => updateDoc(doc(db, "users", user.uid), { onlineAt: serverTimestamp() }).catch(() => {});
    ping();
    const interval = setInterval(ping, 60_000);
    return () => clearInterval(interval);
  }, [user?.uid]);

  // Conversas
  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const q = query(collection(db, "chats"), where("participantes", "array-contains", user.uid), limit(40));
    return onSnapshot(q, snap => {
      const lista = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));
      setConversas(lista);
      setLoading(false);
    });
  }, [user?.uid]);

  // Amigos (aceitos) com status online em tempo real
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "amizades"), where("participantes", "array-contains", user.uid), where("status", "==", "aceito"));
    return onSnapshot(q, async snap => {
      const ids = snap.docs.map(d => {
        const data = d.data();
        return data.de === user.uid ? data.para : data.de;
      });
      if (ids.length === 0) { setAmigos([]); return; }
      const perfis = await Promise.all(ids.map(async id => {
        try {
          const s = await getDoc(doc(db, "users", id));
          return s.exists() ? { id, ...s.data() } : null;
        } catch { return null; }
      }));
      setAmigos(
        perfis.filter(Boolean).sort((a, b) => {
          const order = { online: 0, recente: 1, offline: 2 };
          return order[statusOnline(a.onlineAt)] - order[statusOnline(b.onlineAt)];
        })
      );
    });
  }, [user?.uid]);

  // Stories das lojas que o usuário conversa (últimas 24h)
  useEffect(() => {
    if (!user?.uid || conversas.length === 0) return;
    // Pega IDs das lojas únicas das conversas
    const lojaIds = [...new Set(
      conversas
        .filter(c => c.lojaId)
        .map(c => c.lojaId)
        .slice(0, 10)
    )];
    if (lojaIds.length === 0) return;

    const agora = new Date();
    const limite = new Date(agora.getTime() - 24 * 60 * 60 * 1000);

    const unsubs = lojaIds.map(lojaId => {
      const q = query(
        collection(db, "lojas", lojaId, "stories"),
        where("criadoEm", ">=", Timestamp.fromDate(limite)),
        orderBy("criadoEm", "desc"),
        limit(10)
      );
      return onSnapshot(q, snap => {
        const novos = snap.docs.map(d => ({ id: d.id, lojaId, ...d.data() }));
        setStories(prev => {
          const outros = prev.filter(s => s.lojaId !== lojaId);
          return [...outros, ...novos];
        });
      });
    });
    return () => unsubs.forEach(u => u());
  }, [user?.uid, conversas]);

  // Lojas ABERTAS + quais o usuário já pediu
  useEffect(() => {
    // Só lojas com chat aberto aparecem
    getDocs(query(collection(db, "lojas"), where("chatAberto", "==", true), limit(20)))
      .then(snap => setLojas(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => {});

    if (!user?.uid) return;
    // Sem orderBy para evitar índice composto
    getDocs(query(collection(db, "pedidos"), where("userId", "==", user.uid), limit(30)))
      .then(snap => {
        const slugs = new Set(snap.docs.map(d => d.data().lojaSlug).filter(Boolean));
        setLojasComPedido(slugs);
      }).catch(() => {});
  }, [user?.uid]);

  const abrirConversa = (conv) => {
    updateDoc(doc(db, "chats", conv.id), { [`naoLido.${user.uid}`]: 0 }).catch(() => {});
    setChatAtivo(conv.id);
    navigate(`/chat/${conv.id}`, { replace: true });
  };

  const abrirChatAmigo = (amigo) => {
    abrirOuCriarChat({
      minhaUid: user.uid,
      meuNome: user.displayName || user.email?.split("@")[0] || "Você",
      minhaFoto: user.photoURL || null,
      outroUid: amigo.id,
      outroNome: amigo.nome || "Amigo",
      outroFoto: amigo.photoURL || null,
      navigate,
    });
  };

  const voltar = () => {
    setChatAtivo(null);
    navigate("/chat", { replace: true });
  };

  // ── Visão conversa ativa ──────────────────────
  if (chatAtivo) {
    return <ChatConversa chatId={chatAtivo} onBack={voltar} />;
  }

  // Lojas ordenadas: com pedido no topo
  const lojasOrdenadas = [...lojas].sort((a, b) => {
    const aT = lojasComPedido.has(a.slug || a.id) ? 0 : 1;
    const bT = lojasComPedido.has(b.slug || b.id) ? 0 : 1;
    return aT - bT;
  });

  // ── Inbox ─────────────────────────────────────
  return (
    <div style={{ minHeight: "100dvh", background: "var(--bg)", fontFamily: "'Outfit', sans-serif" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
        @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.7;transform:scale(1.25)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
      `}</style>

      {/* Header */}
      <div style={{ padding: "14px 16px 12px", background: "var(--bg2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 10 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", padding: 0, fontSize: "1.2rem", lineHeight: 1 }}>←</button>
        <h1 style={{ flex: 1, fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 900, margin: 0 }}>Mensagens</h1>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#34d399", boxShadow: "0 0 8px rgba(52,211,153,0.6)", animation: "pulse-dot 2s infinite" }} />
      </div>

      {/* ── Story Viewer ─────────────────────────── */}
      {storyGrupo && (
        <StoryViewer
          grupo={storyGrupo}
          uid={user?.uid}
          chatId={conversas.find(c => c.lojaId === storyGrupo.lojaId)?.id}
          onClose={() => setStoryGrupo(null)}
        />
      )}

      {!user ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text3)" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>💬</div>
          <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", marginBottom: 8 }}>Faça login para ver suas mensagens</div>
          <button onClick={() => navigate("/login")} style={{ background: "linear-gradient(135deg, var(--purple2), #6d28d9)", border: "none", borderRadius: 12, padding: "10px 24px", color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, cursor: "pointer" }}>Entrar</button>
        </div>
      ) : (
        <>
          {/* ── Stories Bar ──────────────────────── */}
          <StoriesBar stories={stories} uid={user?.uid} onView={setStoryGrupo} />

          {/* ── Row: Amigos ──────────────────────── */}
          {amigos.length > 0 && (
            <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 0 4px" }}>
              <div style={{ padding: "0 16px 10px", fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)" }}>
                Amigos
              </div>
              <div style={{ display: "flex", gap: 18, overflowX: "auto", padding: "0 16px 14px", scrollbarWidth: "none" }}>
                {amigos.map(amigo => {
                  const st = statusOnline(amigo.onlineAt);
                  return (
                    <div key={amigo.id} onClick={() => abrirChatAmigo(amigo)}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
                      <div style={{ position: "relative" }}>
                        <div style={{
                          width: 52, height: 52, borderRadius: "50%",
                          background: "linear-gradient(135deg, var(--purple2), #6d28d9)",
                          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: "1.2rem", fontWeight: 800, color: "#fff",
                          border: `2px solid ${st === "offline" ? "var(--border)" : COR_STATUS[st]}`,
                          transition: "border-color 0.3s",
                        }}>
                          {amigo.photoURL
                            ? <img src={amigo.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : amigo.nome?.[0]?.toUpperCase()
                          }
                        </div>
                        {/* Dot de status */}
                        <div style={{
                          position: "absolute", bottom: 1, right: 1,
                          width: 13, height: 13, borderRadius: "50%",
                          background: COR_STATUS[st],
                          border: "2px solid var(--bg)",
                          boxShadow: GLOW_STATUS[st],
                          animation: st === "online" ? "pulse-dot 2.5s infinite" : "none",
                        }} />
                      </div>
                      <div style={{ fontSize: "0.62rem", color: st === "offline" ? "var(--text3)" : "var(--text)", fontWeight: st === "offline" ? 400 : 700, maxWidth: 54, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center" }}>
                        {amigo.nome?.split(" ")[0]}
                      </div>
                      {st !== "offline" && (
                        <div style={{ fontSize: "0.55rem", color: COR_STATUS[st], fontWeight: 700, marginTop: -3 }}>
                          {st === "online" ? "online" : "recente"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Row: Lojas abertas ───────────────── */}
          {lojasOrdenadas.length > 0 && (
            <div style={{ borderBottom: "1px solid var(--border)", padding: "14px 0 4px" }}>
              <div style={{ padding: "0 16px 10px", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, color: "var(--text3)" }}>Lojas</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 20, padding: "2px 7px" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", display: "inline-block", animation: "pulse-dot 2s infinite" }} />
                  <span style={{ fontSize: "0.6rem", fontWeight: 700, color: "#34d399" }}>{lojasOrdenadas.length} abertas</span>
                </span>
              </div>
              <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "0 16px 14px", scrollbarWidth: "none" }}>
                {lojasOrdenadas.map(loja => {
                  const temPedido = lojasComPedido.has(loja.slug || loja.id);
                  return (
                    <div key={loja.id} onClick={() => user && abrirOuCriarChatLoja({ uid: user.uid, userName: user.displayName || user.email?.split("@")[0] || "Você", userFoto: user.photoURL || null, lojaId: loja.id, lojaNome: loja.nome, lojaLogo: loja.logo || null, lojaSlug: loja.slug || loja.id, navigate })}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: "pointer", flexShrink: 0 }}>
                      <div style={{ position: "relative" }}>
                        {/* Logo */}
                        <div style={{
                          width: 56, height: 56, borderRadius: 16,
                          background: "var(--bg3)", overflow: "hidden",
                          display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem",
                          border: temPedido ? "2px solid var(--gold)" : "1px solid var(--border)",
                          boxShadow: temPedido ? "0 0 12px rgba(245,197,24,0.3)" : "none",
                        }}>
                          {loja.logo
                            ? <img src={loja.logo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 14 }} />
                            : (loja.emoji || "🏪")
                          }
                        </div>
                        {/* Dot verde "aberto" */}
                        <div style={{
                          position: "absolute", bottom: -2, left: "50%", transform: "translateX(-50%)",
                          background: "#34d399", borderRadius: 10, padding: "1px 6px",
                          border: "1.5px solid var(--bg)",
                          display: "flex", alignItems: "center", gap: 3,
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff", display: "inline-block", animation: "pulse-dot 2s infinite" }} />
                          <span style={{ fontSize: "0.5rem", fontWeight: 800, color: "#fff", lineHeight: 1 }}>chat</span>
                        </div>
                        {/* Badge pedido anterior */}
                        {temPedido && (
                          <div style={{ position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: "50%", background: "linear-gradient(135deg, var(--gold), #d97706)", border: "2px solid var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.55rem" }}>
                            ⭐
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: "0.6rem", color: temPedido ? "var(--gold)" : "var(--text2)", fontWeight: temPedido ? 700 : 500, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "center", marginTop: 6 }}>
                        {loja.nome}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Conversas ────────────────────────── */}
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 48 }}><div className="spinner" /></div>
          ) : conversas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px 40px", color: "var(--text3)" }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: "linear-gradient(135deg, rgba(124,58,237,0.12), rgba(245,197,24,0.06))", border: "1px solid rgba(138,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", margin: "0 auto 14px" }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text)", marginBottom: 8 }}>Nenhuma conversa ainda</div>
              <div style={{ fontSize: "0.82rem", lineHeight: 1.8, color: "var(--text3)" }}>
                Toque num amigo acima ou acesse<br />o perfil de alguém para começar
              </div>
            </div>
          ) : (
            <div>
              {conversas.map(conv => {
                const outroId = conv.participantes?.find(p => p !== user?.uid);
                const outroInfo = conv.participantesInfo?.[outroId] || {};
                const naoLido = conv.naoLido?.[user?.uid] || 0;
                const ativo = naoLido > 0;
                const isLoja = outroInfo.isLoja || String(outroId).startsWith("loja_");
                // Status: lojas sempre "online" se aparecem na lista; amigos via onlineAt
                const amigoInfo = !isLoja ? amigos.find(a => a.id === outroId) : null;
                const st = isLoja ? "online" : (amigoInfo ? statusOnline(amigoInfo.onlineAt) : "offline");

                return (
                  <div key={conv.id} onClick={() => abrirConversa(conv)}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderBottom: "1px solid var(--border)", cursor: "pointer", background: ativo ? "rgba(138,92,246,0.04)" : "transparent", transition: "background 0.15s" }}
                    onMouseEnter={e => e.currentTarget.style.background = "var(--bg2)"}
                    onMouseLeave={e => e.currentTarget.style.background = ativo ? "rgba(138,92,246,0.04)" : "transparent"}
                  >
                    {/* Avatar */}
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      <div style={{
                        width: 50, height: 50,
                        borderRadius: isLoja ? 14 : "50%",
                        background: isLoja ? "linear-gradient(135deg, #1a0a36, #2d1b69)" : "linear-gradient(135deg, var(--purple2), #6d28d9)",
                        overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: isLoja ? "1.5rem" : "1.2rem", fontWeight: 800, color: "#fff",
                        border: ativo ? "2px solid var(--purple2)" : isLoja ? "1.5px solid rgba(245,197,24,0.3)" : "2px solid transparent",
                        boxShadow: isLoja ? "0 0 10px rgba(245,197,24,0.1)" : "none",
                      }}>
                        {outroInfo.foto
                          ? <img src={outroInfo.foto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : isLoja ? "🏪" : (outroInfo.nome?.[0]?.toUpperCase() || "?")
                        }
                      </div>
                      {/* Dot: verde pulsante para lojas, status para amigos */}
                      {isLoja ? (
                        <div style={{ position: "absolute", bottom: -3, left: "50%", transform: "translateX(-50%)", background: "#34d399", borderRadius: 8, padding: "1px 5px", border: "1.5px solid var(--bg)", display: "flex", alignItems: "center", gap: 2 }}>
                          <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#fff", display: "inline-block", animation: "pulse-dot 2s infinite" }} />
                          <span style={{ fontSize: "0.45rem", fontWeight: 800, color: "#fff" }}>chat</span>
                        </div>
                      ) : st !== "offline" ? (
                        <div style={{ position: "absolute", bottom: 1, right: 1, width: 12, height: 12, borderRadius: "50%", background: COR_STATUS[st], border: "2px solid var(--bg)", boxShadow: GLOW_STATUS[st] }} />
                      ) : null}
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontWeight: ativo ? 800 : 600, fontSize: "0.92rem" }}>{outroInfo.nome || (isLoja ? "Loja" : "Usuário")}</span>
                        {isLoja && (
                          <span style={{ fontSize: "0.55rem", fontWeight: 700, color: "#34d399", background: "rgba(52,211,153,0.12)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 6, padding: "1px 5px" }}>LOJA</span>
                        )}
                      </div>
                      <div style={{ fontSize: "0.78rem", color: ativo ? "var(--text)" : "var(--text3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: ativo ? 600 : 400 }}>
                        {conv.ultimaMensagem?.autorId === user?.uid ? <span style={{ color: "var(--text3)" }}>Você: </span> : ""}
                        {conv.ultimaMensagem?.texto || "Nova conversa"}
                      </div>
                    </div>

                    {/* Hora + badge */}
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
                      <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>{tempoRelativo(conv.updatedAt)}</div>
                      {ativo && (
                        <div style={{ minWidth: 20, height: 20, borderRadius: 10, background: "linear-gradient(135deg, var(--purple2), #6d28d9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.62rem", color: "#fff", fontWeight: 800, padding: "0 5px" }}>
                          {naoLido > 9 ? "9+" : naoLido}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Utilitário exportado: abrir ou criar chat ─────────────────
export async function abrirOuCriarChat({ minhaUid, meuNome, minhaFoto, outroUid, outroNome, outroFoto, navigate }) {
  const chatId = [minhaUid, outroUid].sort().join("_");
  const chatRef = doc(db, "chats", chatId);
  const snap = await getDoc(chatRef);
  if (!snap.exists()) {
    await setDoc(chatRef, {
      participantes: [minhaUid, outroUid],
      participantesInfo: {
        [minhaUid]: { nome: meuNome, foto: minhaFoto || null },
        [outroUid]: { nome: outroNome, foto: outroFoto || null },
      },
      ultimaMensagem: null,
      naoLido: { [minhaUid]: 0, [outroUid]: 0 },
      digitando: { [minhaUid]: false, [outroUid]: false },
      updatedAt: serverTimestamp(),
    });
  }
  navigate(`/chat/${chatId}`);
}

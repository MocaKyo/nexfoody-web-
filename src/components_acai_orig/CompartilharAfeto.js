// src/components/CompartilharAfeto.js
import React, { useState } from "react";

const DESTINATARIOS = [
  { id: "amor",   emoji: "❤️",  label: "Amor",        msg: "Amor, pedi nosso jantar! Já vem chegando 😍" },
  { id: "filho",  emoji: "🧸",  label: "Filho(a)",    msg: "Surpresa! Pedi seu lanche favorito 🎉" },
  { id: "amigo",  emoji: "🍕",  label: "Amigo(a)",    msg: "Ei! Pedi comida, vem comer comigo? 😄" },
  { id: "outro",  emoji: "🎁",  label: "Alguém",      msg: "" },
];

export default function CompartilharAfeto({ pedido, onClose }) {
  const [selecionado, setSelecionado] = useState(null);
  const [mensagem, setMensagem] = useState("");
  const [mostrarMensagem, setMostrarMensagem] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const handleSelect = (dest) => {
    setSelecionado(dest);
    setMensagem(dest.msg);
    setMostrarMensagem(true);
  };

  const gerarTextoWhatsApp = () => {
    const itens = pedido?.items?.map(i => `• ${i.qty}x ${i.nome}`).join("\n") || "";
    const total = pedido?.total ? `R$ ${pedido.total.toFixed(2).replace(".", ",")}` : "";
    
    let texto = mensagem ? `${mensagem}\n\n` : "";
    texto += `🛵 *Pedido a caminho!*\n`;
    if (itens) texto += `\n${itens}\n`;
    if (total) texto += `\n💰 Total: ${total}`;
    texto += `\n\n_Enviado com ❤️ pelo CardápioZap_`;
    return texto;
  };

  const compartilhar = () => {
    const texto = gerarTextoWhatsApp();
    if (navigator.share) {
      navigator.share({ title: "Olha o que pedi! 🛵", text: texto })
        .then(() => setEnviado(true))
        .catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
      setEnviado(true);
    }
  };

  if (enviado) return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.9)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "4rem", marginBottom: 16, animation: "heartBeat 0.6s ease" }}>❤️</div>
        <style>{`@keyframes heartBeat{0%{transform:scale(0)}50%{transform:scale(1.3)}100%{transform:scale(1)}}`}</style>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.5rem", color: "#fff", marginBottom: 8 }}>
          Compartilhado com afeto!
        </div>
        <div style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.5)", marginBottom: 28 }}>
          Que bom ter alguém especial para dividir esse momento 🥰
        </div>
        <button onClick={onClose} className="btn btn-gold" style={{ padding: "12px 32px" }}>
          Ver meu pedido
        </button>
      </div>
    </div>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.88)",
      display: "flex", alignItems: "flex-end",
    }}>
      <div style={{
        width: "100%", maxWidth: 520, margin: "0 auto",
        background: "var(--bg)",
        borderRadius: "24px 24px 0 0",
        padding: "24px 20px 40px",
        animation: "slideUp 0.3s ease",
      }}>
        <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>✨</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 700 }}>
            Pedido a Caminho!
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text2)", marginTop: 4 }}>
            Quer surpreender alguém especial? ❤️
          </div>
        </div>

        {/* Cards de destinatários */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {DESTINATARIOS.map(dest => (
            <div
              key={dest.id}
              onClick={() => handleSelect(dest)}
              style={{
                padding: "14px 12px",
                background: selecionado?.id === dest.id ? "rgba(245,197,24,0.12)" : "var(--bg2)",
                border: `2px solid ${selecionado?.id === dest.id ? "var(--gold)" : "var(--border)"}`,
                borderRadius: 14, cursor: "pointer",
                textAlign: "center", transition: "all 0.2s",
                transform: selecionado?.id === dest.id ? "scale(1.03)" : "scale(1)",
              }}
            >
              <div style={{ fontSize: "1.8rem", marginBottom: 4 }}>{dest.emoji}</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem" }}>{dest.label}</div>
            </div>
          ))}
        </div>

        {/* Campo de mensagem */}
        {mostrarMensagem && (
          <div style={{ marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
            <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
            <label style={{ fontSize: "0.78rem", color: "var(--text2)", marginBottom: 6, display: "block" }}>
              💌 Mensagem personalizada
            </label>
            <textarea
              value={mensagem}
              onChange={e => setMensagem(e.target.value)}
              rows={3}
              placeholder="Digite uma mensagem especial..."
              style={{
                width: "100%", padding: "12px 14px",
                background: "var(--bg2)", border: "1px solid var(--border)",
                borderRadius: 12, color: "var(--text)",
                fontFamily: "'Outfit', sans-serif", fontSize: "0.88rem",
                resize: "none", boxSizing: "border-box",
              }}
            />
          </div>
        )}

        {/* Resumo do pedido */}
        {pedido?.items?.length > 0 && (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 14px", marginBottom: 20 }}>
            <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Resumo do pedido</div>
            {pedido.items.slice(0, 3).map((item, i) => (
              <div key={i} style={{ fontSize: "0.8rem", color: "var(--text2)", display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                <span>{item.qty}x {item.nome}</span>
                <span style={{ color: "var(--gold)" }}>R$ {((item.precoTotal || item.preco) * item.qty).toFixed(2).replace(".",",")}</span>
              </div>
            ))}
            {pedido.items.length > 3 && (
              <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 4 }}>+{pedido.items.length - 3} item(s)</div>
            )}
            {pedido.total && (
              <div style={{ borderTop: "1px solid var(--border)", marginTop: 8, paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: "var(--gold)" }}>R$ {pedido.total.toFixed(2).replace(".",",")}</span>
              </div>
            )}
          </div>
        )}

        {/* Botões */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={compartilhar}
            disabled={!selecionado}
            style={{
              width: "100%", padding: "15px",
              background: selecionado ? "linear-gradient(135deg, #25d366, #128c7e)" : "var(--bg3)",
              border: "none", borderRadius: 14,
              color: selecionado ? "#fff" : "var(--text3)",
              fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1rem",
              cursor: selecionado ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              transition: "all 0.3s",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Compartilhar pelo WhatsApp 📲
          </button>
          <button
            onClick={onClose}
            style={{
              width: "100%", padding: "12px",
              background: "none", border: "1px solid var(--border)",
              borderRadius: 14, color: "var(--text2)",
              fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.88rem",
              cursor: "pointer",
            }}
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}

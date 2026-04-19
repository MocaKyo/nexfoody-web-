// src/components/PixPagamento.js
import React, { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";

// ============================================================
// Gerador de payload PIX (padrão Banco Central do Brasil)
// ============================================================
function gerarPayloadPix({ chave, nome, cidade, valor }) {
  const format = (id, value) => {
    const len = value.length.toString().padStart(2, "0");
    return `${id}${len}${value}`;
  };
  const merchantAccountInfo = format("00", "BR.GOV.BCB.PIX") + format("01", chave);
  const merchantAccount = format("26", merchantAccountInfo);
  const valorStr = parseFloat(valor).toFixed(2);
  const additionalData = format("05", "ACAIPUROGOSTO");
  const additional = format("62", additionalData);
  const nomeClean = nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25);
  const cidadeClean = cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15);
  let payload =
    format("00", "01") +
    merchantAccount +
    format("52", "0000") +
    format("53", "986") +
    format("54", valorStr) +
    format("58", "BR") +
    format("59", nomeClean) +
    format("60", cidadeClean) +
    additional +
    "6304";
  const crc = crc16(payload);
  return payload + crc;
}

function crc16(str) {
  let crc = 0xFFFF;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
    }
  }
  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, "0");
}

export default function PixPagamento({ valor, pixKey, nomeLoja = "Acai Puro Gosto", cidade = "Bacabal", whatsapp, msgWhatsApp }) {
  const [copiado, setCopiado] = useState(false);
  const [payload, setPayload] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!valor || !pixKey) return;
    try {
      // Formata chave telefone para +55XXXXXXXXXXX
const p = gerarPayloadPix({ chave: pixKey, nome: nomeLoja, cidade, valor: parseFloat(valor) });
      setPayload(p);
      // Gera QR Code como data URL
      QRCode.toDataURL(p, {
        width: 200,
        margin: 2,
        color: { dark: "#1e0a36", light: "#ffffff" },
        errorCorrectionLevel: "M",
      }).then(url => setQrUrl(url)).catch(console.error);
    } catch (e) {
      console.error("Erro ao gerar PIX:", e);
    }
  }, [valor, pixKey, nomeLoja, cidade]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const el = document.createElement("textarea");
      el.value = payload;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const abrirWhatsApp = () => {
    if (!whatsapp || !msgWhatsApp) return;
    const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(msgWhatsApp)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!payload) return (
    <div style={{ textAlign: "center", padding: 20, color: "var(--text2)" }}>
      ⏳ Gerando PIX...
    </div>
  );

  return (
    <div style={{
      background: "linear-gradient(135deg, var(--bg3), var(--bg2))",
      border: "1px solid rgba(245,197,24,0.3)",
      borderRadius: "var(--radius)", padding: 20, margin: "16px 0",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: "1.3rem" }}>📱</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>Pagamento via PIX</div>
          <div style={{ fontSize: "0.75rem", color: "var(--text2)" }}>Escaneie o QR Code ou copie o código</div>
        </div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 900, color: "var(--gold)" }}>
          R$ {parseFloat(valor).toFixed(2).replace(".", ",")}
        </div>
      </div>

      {/* QR Code */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
        <div style={{ background: "#fff", padding: 12, borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}>
          {qrUrl
            ? <img src={qrUrl} alt="QR Code PIX" width={200} height={200} style={{ display: "block", borderRadius: 8 }} />
            : <div style={{ width: 200, height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: "0.8rem" }}>Gerando QR Code...</div>
          }
        </div>
      </div>

      {/* Info recebedor */}
      <div style={{
        background: "var(--bg2)", borderRadius: "var(--radius-sm)",
        padding: "10px 14px", marginBottom: 12,
        display: "flex", justifyContent: "space-between", fontSize: "0.82rem",
      }}>
        <div>
          <div style={{ color: "var(--text3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 1 }}>Recebedor</div>
          <div style={{ fontWeight: 600 }}>{nomeLoja}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--text3)", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 1 }}>Valor</div>
          <div style={{ fontWeight: 700, color: "var(--gold)" }}>R$ {parseFloat(valor).toFixed(2).replace(".", ",")}</div>
        </div>
      </div>

      {/* Código copia e cola */}
      <div style={{
        background: "var(--bg)", border: "1px dashed rgba(245,197,24,0.3)",
        borderRadius: "var(--radius-sm)", padding: "10px 12px", marginBottom: 12,
        fontSize: "0.65rem", color: "var(--text3)",
        wordBreak: "break-all", fontFamily: "monospace", lineHeight: 1.5,
        maxHeight: 56, overflow: "hidden",
      }}>
        {payload}
      </div>

      {/* Botão copiar */}
      <button onClick={copiar} style={{
        width: "100%", padding: 13, border: "none", borderRadius: "var(--radius-sm)",
        background: copiado ? "linear-gradient(135deg, #22c55e, #15803d)" : "linear-gradient(135deg, #f5c518, #e8a020)",
        color: copiado ? "#fff" : "#0f0518",
        fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
        fontFamily: "'Outfit', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        transition: "all 0.3s", marginBottom: 10,
      }}>
        {copiado ? "✅ Código copiado!" : "📋 Copiar código PIX"}
      </button>

      {/* Botão WhatsApp */}
      {whatsapp && (
        <button onClick={abrirWhatsApp} style={{
          width: "100%", padding: 13, border: "none", borderRadius: "var(--radius-sm)",
          background: "linear-gradient(135deg, #25d366, #128c7e)",
          color: "#fff", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
          fontFamily: "'Outfit', sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        }}>
          💬 Enviar pedido no WhatsApp
        </button>
      )}

      <p style={{ textAlign: "center", fontSize: "0.72rem", color: "var(--text3)", marginTop: 10, lineHeight: 1.5 }}>
        Pague o PIX e clique no botão acima para confirmar no WhatsApp.
      </p>
    </div>
  );
}

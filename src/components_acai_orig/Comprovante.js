// src/components/Comprovante.js — Comprovante / Nota fiscal do pedido
import React, { useRef } from "react";
import { useStore } from "../contexts/StoreContext";

function formatarData(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtMoeda(v) {
  return typeof v === "number" ? v.toFixed(2).replace(".", ",") : "0,00";
}

export default function Comprovante({ pedido, onClose }) {
  const { config } = useStore();
  const printRef = useRef(null);

  if (!pedido) return null;

  const dataPedido = formatarData(pedido.createdAt);

  const handleImprimir = () => {
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Pedido #${pedido.numeroPedido}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Courier New', monospace; padding: 20px; color: #111; font-size: 13px; }
  .logo { text-align: center; font-size: 1.4rem; font-weight: bold; margin-bottom: 4px; }
  .sub { text-align: center; font-size: 0.75rem; color: #666; margin-bottom: 16px; }
  .divider { border-top: 1px dashed #ccc; margin: 10px 0; }
  .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .item { margin-bottom: 6px; }
  .item-nome { font-weight: bold; }
  .item-det { font-size: 0.8rem; color: #555; margin-left: 12px; }
  .total-row { font-size: 1.1rem; font-weight: bold; margin-top: 8px; }
  .footer { margin-top: 16px; font-size: 0.75rem; color: #888; text-align: center; }
  @media print { body { padding: 10px; } }
</style></head><body>
<div class="logo">${config.nomeLoja || "Açaí Puro Gosto"}</div>
<div class="sub">${config.endereco || ""} · ${config.horario || ""}</div>
<div class="divider"></div>
<div style="text-align:center;margin-bottom:12px;">
  <strong>COMPROVANTE DE PEDIDO</strong><br/>
  Pedido #${pedido.numeroPedido}<br/>
  ${dataPedido}
</div>
<div class="divider"></div>
<div><strong>CLIENTE:</strong> ${pedido.nomeCliente}</div>
${pedido.telefone ? `<div><strong>TEL:</strong> ${pedido.telefone}</div>` : ""}
<div class="divider"></div>
<div style="margin-bottom:8px;"><strong>ITENS:</strong></div>
${(pedido.items || []).map(item => `
<div class="item">
  <div class="item-nome">${item.qty}x ${item.nome}</div>
  ${(item.complementos || []).map(c => `<div class="item-det">+ ${c.nome}</div>`).join("")}
  ${item.obs ? `<div class="item-det">Obs: ${item.obs}</div>` : ""}
  <div style="text-align:right;">R$ ${fmtMoeda(item.precoTotal || item.preco * item.qty)}</div>
</div>`).join("")}
<div class="divider"></div>
${pedido.pontosUsados > 0 ? `<div class="row"><span>Desconto pontos:</span><span>-R$ ${fmtMoeda(pedido.pontosUsados)}</span></div>` : ""}
${pedido.descontoCupom > 0 ? `<div class="row"><span>Cupom ${pedido.cupom || ""}:</span><span>-R$ ${fmtMoeda(pedido.descontoCupom)}</span></div>` : ""}
<div class="total-row" style="text-align:right;">TOTAL: R$ ${fmtMoeda(pedido.total)}</div>
<div class="divider"></div>
<div><strong>PAGAMENTO:</strong> ${(pedido.pagamento || "").toUpperCase()}</div>
<div><strong>TIPO:</strong> ${pedido.tipoEntrega === "entrega" ? "Delivery" : "Retirada no local"}</div>
${pedido.endereco ? `<div><strong>ENDEREÇO:</strong> ${pedido.endereco}</div>` : ""}
${pedido.obs ? `<div><strong>OBS:</strong> ${pedido.obs}</div>` : ""}
${pedido.motivoCancelamento ? `<div style="color:red;"><strong>CANCELADO:</strong> ${pedido.motivoCancelamento}</div>` : ""}
<div class="divider"></div>
<div class="footer">
  ${config.whatsapp ? `WhatsApp: ${config.whatsapp} · ` : ""}
  ${config.instagram || ""}<br/>
  Obrigado pela preferência!
</div>
</body></html>`);
    win.document.close();
    win.print();
  };

  const handleCompartilhar = async () => {
    let texto = `🫐 *PEDIDO #${pedido.numeroPedido}*\n`;
    texto += `${config.nomeLoja || "Açaí Puro Gosto"}\n`;
    texto += `📅 ${dataPedido}\n\n`;
    texto += `👤 ${pedido.nomeCliente}\n`;
    texto += `💳 ${(pedido.pagamento || "").toUpperCase()} · TOTAL: R$ ${fmtMoeda(pedido.total)}\n\n`;
    texto += `📋 ITENS:\n`;
    (pedido.items || []).forEach(i => {
      texto += `• ${i.qty}x ${i.nome} = R$ ${fmtMoeda(i.precoTotal || i.preco * i.qty)}\n`;
    });
    if (pedido.endereco) texto += `\n📍 ${pedido.endereco}`;
    if (pedido.obs) texto += `\n📝 ${pedido.obs}`;
    if (navigator.share) {
      try { await navigator.share({ title: `Pedido #${pedido.numeroPedido}`, text }); } catch {}
    } else {
      await navigator.clipboard.writeText(texto);
      alert("Comprovante copiado!");
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "var(--bg)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        padding: "14px 16px", background: "var(--bg2)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button onClick={onClose} style={{
          background: "none", border: "none", color: "var(--text)",
          cursor: "pointer", fontSize: "1.2rem", padding: 4,
        }}>←</button>
        <div style={{ flex: 1, fontWeight: 700, fontSize: "0.95rem" }}>
          🧾 Comprovante
        </div>
        <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
          #{pedido.numeroPedido}
        </div>
      </div>

      {/* Conteúdo scrollável */}
      <div ref={printRef} style={{ flex: 1, overflowY: "auto", padding: 16 }}>
        <div style={{
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 20, maxWidth: 400, margin: "0 auto",
        }}>
          {/* Logo / Nome da loja */}
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 700, color: "var(--purple2)" }}>
              {config.nomeLoja || "Açaí Puro Gosto"}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>
              {config.endereco || ""} · {config.horario || ""}
            </div>
          </div>

          <div style={{ borderTop: "1px dashed var(--border)", borderBottom: "1px dashed var(--border)", padding: "12px 0", marginBottom: 14 }}>
            <div style={{ textAlign: "center", fontWeight: 700, fontSize: "0.85rem" }}>
              COMPROVANTE DE PEDIDO
            </div>
            <div style={{ textAlign: "center", fontSize: "0.75rem", color: "var(--text2)", marginTop: 4 }}>
              #{pedido.numeroPedido} · {dataPedido}
            </div>
          </div>

          {/* Cliente */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 2 }}>CLIENTE</div>
            <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{pedido.nomeCliente}</div>
            {pedido.telefone && <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>📱 {pedido.telefone}</div>}
          </div>

          <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 10, marginBottom: 12 }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 6 }}>ITENS</div>
            {(pedido.items || []).map((item, i) => (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.88rem" }}>
                  <span style={{ fontWeight: 600 }}>{item.qty}x {item.nome}</span>
                  <span style={{ fontWeight: 600 }}>R$ {fmtMoeda(item.precoTotal || item.preco * item.qty)}</span>
                </div>
                {(item.complementos || []).map((c, j) => (
                  <div key={j} style={{ fontSize: "0.78rem", color: "var(--text2)", marginLeft: 12 }}>+ {c.nome}</div>
                ))}
                {item.obs && <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginLeft: 12 }}>Obs: {item.obs}</div>}
              </div>
            ))}
          </div>

          {/* Totais */}
          <div style={{ borderTop: "1px dashed var(--border)", paddingTop: 10, marginBottom: 12 }}>
            {pedido.pontosUsados > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text2)" }}>
                <span>Desconto pontos</span><span>-R$ {fmtMoeda(pedido.pontosUsados)}</span>
              </div>
            )}
            {pedido.descontoCupom > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", color: "var(--text2)" }}>
                <span>Cupom {pedido.cupom}</span><span>-R$ {fmtMoeda(pedido.descontoCupom)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: "1rem", marginTop: 4 }}>
              <span>TOTAL</span>
              <span style={{ color: "var(--gold)", fontFamily: "'Fraunces', serif" }}>R$ {fmtMoeda(pedido.total)}</span>
            </div>
          </div>

          {/* Informações extras */}
          <div style={{ fontSize: "0.82rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text2)" }}>Pagamento</span>
              <span style={{ fontWeight: 600 }}>{(pedido.pagamento || "").toUpperCase()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ color: "var(--text2)" }}>Tipo</span>
              <span>{pedido.tipoEntrega === "entrega" ? "🛵 Delivery" : "🏠 Retirada"}</span>
            </div>
            {pedido.endereco && (
              <div style={{ marginTop: 6, color: "var(--text2)" }}>📍 {pedido.endereco}</div>
            )}
            {pedido.obs && (
              <div style={{ marginTop: 4, color: "var(--text2)" }}>📝 {pedido.obs}</div>
            )}
            {pedido.motivoCancelamento && (
              <div style={{ marginTop: 6, color: "var(--red)", fontWeight: 600 }}>
                ❌ Cancelado: {pedido.motivoCancelamento}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: "1px dashed var(--border)", marginTop: 14, paddingTop: 10, textAlign: "center" }}>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>
              {config.whatsapp ? `📱 ${config.whatsapp} · ` : ""} {config.instagram || ""}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>
              Obrigado pela preferência!
            </div>
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div style={{
        padding: "12px 16px", background: "var(--bg2)",
        borderTop: "1px solid var(--border)",
        display: "flex", gap: 10,
      }}>
        <button onClick={handleImprimir} style={{
          flex: 1, padding: "12px", background: "var(--bg3)",
          border: "1px solid var(--border)", borderRadius: 10,
          fontFamily: "'Outfit', sans-serif", fontWeight: 600,
          fontSize: "0.82rem", cursor: "pointer", color: "var(--text)",
        }}>
          🖨️ Imprimir
        </button>
        <button onClick={handleCompartilhar} style={{
          flex: 1, padding: "12px", background: "var(--purple2)",
          border: "none", borderRadius: 10, color: "#fff",
          fontFamily: "'Outfit', sans-serif", fontWeight: 700,
          fontSize: "0.82rem", cursor: "pointer",
        }}>
          📤 Compartilhar
        </button>
      </div>
    </div>
  );
}
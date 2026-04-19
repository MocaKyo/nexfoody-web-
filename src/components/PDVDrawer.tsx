import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, where } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Produto { id: string; nome: string; preco: number; emoji?: string; imagem?: string; }
interface ItemAvulso { nome: string; preco: number; }
interface Lancamento {
  id: string;
  tipo: "venda" | "retirada";
  total: number;
  pagamento?: string;
  descricao?: string;
  produtos?: { nome: string; preco: number; qty: number }[];
  createdAt: any;
}

export type CaixaAba = "venda" | "avulso" | "retirada" | "historico";

function fmt(v: number) { return "R$ " + v.toFixed(2).replace(".", ","); }

interface Props {
  tenantId: string;
  nomeLoja?: string;
  open: boolean;
  aba: CaixaAba;
  onClose: () => void;
  onChangeAba: (aba: CaixaAba) => void;
}

function fecharCaixa(lancamentos: Lancamento[], nomeLoja: string) {
  const agora = new Date();
  const dataStr = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  const horaStr = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const fmtR = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");

  const vendas   = lancamentos.filter(l => l.tipo !== "retirada");
  const retiradas = lancamentos.filter(l => l.tipo === "retirada");
  const entradas  = vendas.reduce((s, l) => s + (l.total || 0), 0);
  const saidas    = retiradas.reduce((s, l) => s + (l.total || 0), 0);
  const saldo     = entradas - saidas;

  // Pagamentos
  const pagMap: Record<string, number> = {};
  vendas.forEach(l => { const p = l.pagamento || "outros"; pagMap[p] = (pagMap[p] || 0) + (l.total || 0); });

  // Produtos consolidados
  const prodMap: Record<string, { nome: string; qty: number; total: number }> = {};
  vendas.forEach(l => {
    (l.produtos || []).forEach(p => {
      if (!prodMap[p.nome]) prodMap[p.nome] = { nome: p.nome, qty: 0, total: 0 };
      prodMap[p.nome].qty += p.qty || 1;
      prodMap[p.nome].total += (p.preco || 0) * (p.qty || 1);
    });
  });
  const topProd = Object.values(prodMap).sort((a, b) => b.qty - a.qty);

  const pagIcon: Record<string, string> = { dinheiro: "💵", pix: "📲", cartao: "💳" };

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Fechamento de Caixa — ${nomeLoja}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; max-width: 680px; margin: 0 auto; }
  .header { text-align: center; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #e2e8f0; }
  .logo { font-size: 2rem; margin-bottom: 6px; }
  .loja { font-size: 1.4rem; font-weight: 900; color: #0f172a; }
  .data { font-size: 0.85rem; color: #64748b; margin-top: 4px; }
  .titulo-secao { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: .1em; color: #94a3b8; margin: 24px 0 10px; }
  .saldo-box { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 8px; }
  .kpi { border-radius: 12px; padding: 14px 16px; }
  .kpi-label { font-size: 0.68rem; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 4px; }
  .kpi-valor { font-size: 1.4rem; font-weight: 900; line-height: 1; }
  .kpi-sub { font-size: 0.68rem; margin-top: 4px; opacity: .7; }
  .row { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 10px; margin-bottom: 6px; }
  .row-label { font-size: 0.85rem; font-weight: 600; }
  .row-sub { font-size: 0.72rem; color: #64748b; margin-top: 2px; }
  .row-valor { font-size: 0.95rem; font-weight: 800; }
  .linha-total { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #0f172a; border-radius: 12px; margin-top: 16px; }
  .linha-total span { font-size: 1rem; font-weight: 800; color: #fff; }
  .linha-total .valor-total { font-size: 1.3rem; font-weight: 900; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 0.65rem; text-transform: uppercase; letter-spacing: .06em; color: #94a3b8; padding: 8px 12px; text-align: left; border-bottom: 1px solid #e2e8f0; }
  td { padding: 10px 12px; font-size: 0.82rem; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .rodape { text-align: center; margin-top: 32px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 0.72rem; color: #94a3b8; }
  @media print { body { padding: 16px; } .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div class="logo">📒</div>
  <div class="loja">${nomeLoja}</div>
  <div class="data">Fechamento de Caixa · ${dataStr} · ${horaStr}</div>
</div>

<button class="no-print" onclick="window.print()" style="display:block;width:100%;padding:12px;background:#0f172a;color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;margin-bottom:24px">🖨️ Imprimir / Salvar PDF</button>

<div class="titulo-secao">Resumo do dia</div>
<div class="saldo-box">
  <div class="kpi" style="background:#f0fdf4;border:1.5px solid #bbf7d0">
    <div class="kpi-label" style="color:#166534">↑ Entradas</div>
    <div class="kpi-valor" style="color:#16a34a">${fmtR(entradas)}</div>
    <div class="kpi-sub" style="color:#166534">${vendas.length} venda${vendas.length !== 1 ? "s" : ""}</div>
  </div>
  <div class="kpi" style="background:#fef2f2;border:1.5px solid #fecaca">
    <div class="kpi-label" style="color:#991b1b">↓ Retiradas</div>
    <div class="kpi-valor" style="color:#ef4444">${fmtR(saidas)}</div>
    <div class="kpi-sub" style="color:#991b1b">${retiradas.length} retirada${retiradas.length !== 1 ? "s" : ""}</div>
  </div>
  <div class="kpi" style="background:${saldo >= 0 ? "#f0fdf4" : "#fef2f2"};border:1.5px solid ${saldo >= 0 ? "#bbf7d0" : "#fecaca"}">
    <div class="kpi-label" style="color:${saldo >= 0 ? "#166534" : "#991b1b"}">Saldo líquido</div>
    <div class="kpi-valor" style="color:${saldo >= 0 ? "#16a34a" : "#ef4444"}">${fmtR(saldo)}</div>
    <div class="kpi-sub" style="color:#64748b">caixa físico</div>
  </div>
</div>

${Object.keys(pagMap).length > 0 ? `
<div class="titulo-secao">Formas de pagamento</div>
${Object.entries(pagMap).map(([pag, val]) => `
<div class="row" style="background:#f8fafc;border:1px solid #e2e8f0">
  <div>
    <div class="row-label">${pagIcon[pag] || "💰"} ${pag.charAt(0).toUpperCase() + pag.slice(1)}</div>
  </div>
  <div class="row-valor" style="color:#0f172a">${fmtR(val as number)}</div>
</div>`).join("")}` : ""}

${retiradas.length > 0 ? `
<div class="titulo-secao">Retiradas de caixa</div>
${retiradas.map(r => `
<div class="row" style="background:#fef2f2;border:1px solid #fecaca">
  <div>
    <div class="row-label">💸 ${r.descricao || "Retirada de caixa"}</div>
    <div class="row-sub">${r.createdAt?.toDate ? r.createdAt.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : ""}</div>
  </div>
  <div class="row-valor" style="color:#ef4444">−${fmtR(r.total)}</div>
</div>`).join("")}` : ""}

${topProd.length > 0 ? `
<div class="titulo-secao">Produtos vendidos</div>
<table>
  <thead><tr><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>
    ${topProd.map(p => `<tr><td>${p.nome}</td><td style="text-align:center;color:#64748b">${p.qty}×</td><td style="text-align:right;font-weight:700;color:#0f172a">${fmtR(p.total)}</td></tr>`).join("")}
  </tbody>
</table>` : ""}

<div class="linha-total">
  <span>💰 Total de entradas</span>
  <span class="valor-total" style="color:#4ade80">${fmtR(entradas)}</span>
</div>

<div class="rodape">
  Gerado pelo NexFoody · Livro Caixa Flutuante<br/>
  ${nomeLoja} · ${agora.toLocaleDateString("pt-BR")} às ${horaStr}
</div>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (win) { win.document.write(html); win.document.close(); }
}

export default function PDVDrawer({ tenantId, nomeLoja = "Minha Loja", open, aba, onClose, onChangeAba }: Props) {
  const [produtos, setProdutos]   = useState<Produto[]>([]);
  const [qtd, setQtd]             = useState<Record<string, number>>({});
  const [pagamento, setPagamento] = useState<"dinheiro"|"pix"|"cartao">("dinheiro");
  const [registrando, setRegistrando] = useState(false);
  const [busca, setBusca]         = useState("");

  const [itensAvulsos, setItensAvulsos] = useState<ItemAvulso[]>([]);
  const [nomeAvulso, setNomeAvulso]     = useState("");
  const [valorAvulso, setValorAvulso]   = useState("");

  const [valorRetirada, setValorRetirada] = useState("");
  const [descRetirada, setDescRetirada]   = useState("");

  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);

  useEffect(() => {
    if (!tenantId) return;
    const q = query(collection(db, `tenants/${tenantId}/produtos`), orderBy("nome"));
    return onSnapshot(q, snap => {
      setProdutos(snap.docs.map(d => ({
        id: d.id, nome: d.data().nome || "Produto", preco: d.data().preco || 0,
        emoji: d.data().emoji || "", imagem: d.data().imagem || d.data().foto || "",
      })));
    });
  }, [tenantId]);

  useEffect(() => {
    if (!tenantId) return;
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const q = query(
      collection(db, `tenants/${tenantId}/vendas-balcao`),
      where("createdAt", ">=", Timestamp.fromDate(inicio)),
      orderBy("createdAt", "desc")
    );
    return onSnapshot(q, snap => {
      setLancamentos(snap.docs.map(d => ({ id: d.id, tipo: "venda", ...d.data() } as Lancamento)));
    });
  }, [tenantId]);

  const entradasHoje = lancamentos.filter(l => l.tipo !== "retirada").reduce((s, v) => s + (v.total || 0), 0);
  const saidasHoje   = lancamentos.filter(l => l.tipo === "retirada").reduce((s, v) => s + (v.total || 0), 0);
  const saldoHoje    = entradasHoje - saidasHoje;

  const totalProdutos  = Object.entries(qtd).reduce((sum, [id, q]) => { const p = produtos.find(x => x.id === id); return sum + (p ? p.preco * q : 0); }, 0);
  const itensNoCarrinho = Object.values(qtd).reduce((a, b) => a + b, 0);
  const totalAvulsos   = itensAvulsos.reduce((s, i) => s + i.preco, 0);

  const add = (id: string) => setQtd(p => ({ ...p, [id]: (p[id] || 0) + 1 }));
  const sub = (id: string) => setQtd(p => { const n = { ...p }; if ((n[id] || 0) <= 1) delete n[id]; else n[id]--; return n; });

  const adicionarAvulso = () => {
    const val = parseFloat(valorAvulso.replace(",", "."));
    if (!nomeAvulso.trim() || !val || val <= 0) return;
    setItensAvulsos(p => [...p, { nome: nomeAvulso.trim(), preco: val }]);
    setNomeAvulso(""); setValorAvulso("");
  };

  const registrarVenda = async (total: number, itens: { nome: string; preco: number; qty: number }[]) => {
    if (!tenantId || registrando || total <= 0) return;
    setRegistrando(true);
    try {
      await addDoc(collection(db, `tenants/${tenantId}/vendas-balcao`), {
        tipo: "venda", produtos: itens, total, pagamento, createdAt: serverTimestamp(),
      });
      setQtd({}); setItensAvulsos([]); setNomeAvulso(""); setValorAvulso(""); setPagamento("dinheiro"); onClose();
    } finally { setRegistrando(false); }
  };

  const compartilharWhatsApp = () => {
    const vendas = lancamentos.filter(l => l.tipo !== "retirada");
    const retiradas = lancamentos.filter(l => l.tipo === "retirada");
    const entradas = vendas.reduce((s, l) => s + (l.total || 0), 0);
    const saidas = retiradas.reduce((s, l) => s + (l.total || 0), 0);
    const fmtR = (v: number) => "R$ " + v.toFixed(2).replace(".", ",");
    const hoje = new Date().toLocaleDateString("pt-BR");
    const motivos = retiradas.length > 0 ? " — " + retiradas.map(r => r.descricao || "retirada").join(", ") : "";
    const texto = "📒 *FECHAMENTO DE CAIXA — " + nomeLoja + "*\n_" + hoje + "_\n\n"
      + "↑ Entradas: *" + fmtR(entradas) + "* (" + vendas.length + " vendas)\n"
      + "↓ Retiradas: *" + fmtR(saidas) + "*" + motivos + "\n"
      + "💰 Saldo líquido: *" + fmtR(entradas - saidas) + "*\n\n"
      + "_Gerado pelo NexFoody_";
    window.open("https://wa.me/?text=" + encodeURIComponent(texto), "_blank");
  };

  const registrarRetirada = async () => {
    const val = parseFloat(valorRetirada.replace(",", "."));
    if (!tenantId || registrando || !val || val <= 0) return;
    setRegistrando(true);
    try {
      await addDoc(collection(db, `tenants/${tenantId}/vendas-balcao`), {
        tipo: "retirada", total: val, descricao: descRetirada.trim() || "Retirada de caixa", createdAt: serverTimestamp(),
      });
      setValorRetirada(""); setDescRetirada(""); onClose();
    } finally { setRegistrando(false); }
  };

  const ABAS: { id: CaixaAba; label: string; cor: string; bg: string }[] = [
    { id: "venda",     label: "📦 Venda",     cor: "#fff",    bg: "#16a34a" },
    { id: "avulso",    label: "✏️ Avulso",    cor: "#0a0414", bg: "#f5c518" },
    { id: "retirada",  label: "💸 Retirada",  cor: "#fff",    bg: "#ef4444" },
    { id: "historico", label: "📋 Histórico", cor: "#fff",    bg: "#7c3aed" },
  ];

  const btnPagto = (val: "dinheiro"|"pix"|"cartao", icon: string, label: string) => (
    <button key={val} onClick={() => setPagamento(val)} style={{
      flex: 1, padding: "8px 4px",
      background: pagamento === val ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${pagamento === val ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 10, color: pagamento === val ? "#a78bfa" : "rgba(255,255,255,0.35)",
      fontSize: "0.68rem", fontWeight: 700, cursor: "pointer", fontFamily: "'Outfit', sans-serif",
    }}>
      <div style={{ fontSize: "1rem", marginBottom: 2 }}>{icon}</div>{label}
    </button>
  );

  if (!open) return null;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", flexDirection: "column" }}>
      <div onClick={onClose} style={{ flex: 1, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }} />

      <div style={{ background: "#0f0720", borderRadius: "24px 24px 0 0", maxHeight: "92dvh", display: "flex", flexDirection: "column", borderTop: "1px solid rgba(255,255,255,0.1)" }}>

        {/* Header */}
        <div style={{ padding: "18px 20px 0", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff" }}>📒 Livro Caixa</div>
              <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>↑ {fmt(entradasHoje)} · ↓ {fmt(saidasHoje)}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: saldoHoje >= 0 ? "#22c55e" : "#f87171" }}>
                  {saldoHoje >= 0 ? fmt(saldoHoje) : "−" + fmt(-saldoHoje)}
                </div>
                <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.3)" }}>saldo hoje</div>
              </div>
              <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.08)", border: "none", color: "#fff", cursor: "pointer", fontSize: "1rem" }}>✕</button>
            </div>
          </div>

          {/* Abas coloridas */}
          <div style={{ display: "flex", gap: 6, paddingBottom: 14 }}>
            {ABAS.map(t => (
              <button key={t.id} onClick={() => onChangeAba(t.id)} style={{
                flex: 1, padding: "9px 4px",
                background: aba === t.id ? t.bg : "rgba(255,255,255,0.06)",
                border: `1.5px solid ${aba === t.id ? t.bg : "rgba(255,255,255,0.08)"}`,
                borderRadius: 10, color: aba === t.id ? t.cor : "rgba(255,255,255,0.35)",
                fontSize: "0.6rem", fontWeight: 800, cursor: "pointer",
                fontFamily: "'Outfit', sans-serif", transition: "all 0.15s",
                whiteSpace: "nowrap",
                boxShadow: aba === t.id ? `0 2px 12px ${t.bg}66` : "none",
              }}>{t.label}</button>
            ))}
          </div>
        </div>

        {/* ── ABA VENDA ── */}
        {aba === "venda" && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", fontWeight: 700, flexShrink: 0 }}>Toque para adicionar</div>
                <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 20, padding: "5px 12px" }}>
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)" }}>🔍</span>
                  <input type="text" placeholder="Buscar..." value={busca} onChange={e => setBusca(e.target.value)}
                    style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: "0.78rem", fontFamily: "'Outfit', sans-serif" }} />
                  {busca && <button onClick={() => setBusca("")} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: "0.75rem", padding: 0 }}>✕</button>}
                </div>
              </div>
              {produtos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 0", color: "rgba(255,255,255,0.25)", fontSize: "0.8rem" }}>Nenhum produto no cardápio ainda</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase())).map(p => {
                    const q = qtd[p.id] || 0;
                    return (
                      <div key={p.id} style={{ background: q > 0 ? "rgba(34,197,94,0.1)" : "rgba(255,255,255,0.04)", border: `1.5px solid ${q > 0 ? "rgba(34,197,94,0.35)" : "rgba(255,255,255,0.08)"}`, borderRadius: 14, overflow: "hidden", transition: "all 0.15s" }}>
                        <button onClick={() => add(p.id)} style={{ width: "100%", padding: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left" }}>
                          {p.imagem ? (
                            <div style={{ width: "100%", height: 80, overflow: "hidden" }}><img src={p.imagem} alt={p.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} /></div>
                          ) : (
                            <div style={{ width: "100%", height: 60, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", background: "rgba(255,255,255,0.04)" }}>{p.emoji || "🏷️"}</div>
                          )}
                          <div style={{ padding: "8px 10px 10px" }}>
                            <div style={{ fontSize: "0.78rem", fontWeight: 700, color: q > 0 ? "#22c55e" : "#fff", lineHeight: 1.2, marginBottom: 3 }}>{p.nome}</div>
                            <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.4)" }}>{fmt(p.preco)}</div>
                          </div>
                        </button>
                        {q > 0 && (
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", borderTop: "1px solid rgba(34,197,94,0.2)", background: "rgba(34,197,94,0.06)" }}>
                            <button onClick={() => sub(p.id)} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                            <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "#22c55e" }}>{q}</span>
                            <button onClick={() => add(p.id)} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.4)", color: "#22c55e", fontSize: "1rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div style={{ padding: "12px 20px 28px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              {itensNoCarrinho > 0 && (
                <div style={{ marginBottom: 10, padding: "7px 12px", background: "rgba(34,197,94,0.07)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 10 }}>
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Itens</div>
                  <div style={{ fontSize: "0.73rem", color: "rgba(255,255,255,0.7)" }}>
                    {Object.entries(qtd).filter(([, q]) => q > 0).map(([id, q]) => { const p = produtos.find(x => x.id === id); return p ? `${q}× ${p.nome}` : null; }).filter(Boolean).join(" · ")}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {btnPagto("dinheiro", "💵", "Dinheiro")}{btnPagto("pix", "📲", "PIX")}{btnPagto("cartao", "💳", "Cartão")}
              </div>
              <button onClick={() => registrarVenda(totalProdutos, Object.entries(qtd).filter(([, q]) => q > 0).map(([id, q]) => { const p = produtos.find(x => x.id === id)!; return { nome: p.nome, preco: p.preco, qty: q }; }))}
                disabled={registrando || totalProdutos <= 0}
                style={{ width: "100%", padding: "15px", background: totalProdutos > 0 ? "linear-gradient(135deg, #22c55e, #16a34a)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 16, color: totalProdutos > 0 ? "#fff" : "rgba(255,255,255,0.25)", fontWeight: 800, fontSize: "1rem", cursor: totalProdutos > 0 ? "pointer" : "not-allowed", fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{registrando ? "Registrando..." : totalProdutos > 0 ? "✓ Registrar venda" : "Selecione produtos"}</span>
                {totalProdutos > 0 && <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.15rem" }}>{fmt(totalProdutos)}</span>}
              </button>
            </div>
          </>
        )}

        {/* ── ABA AVULSO ── */}
        {aba === "avulso" && (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              <div style={{ background: "rgba(245,197,24,0.06)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 14, padding: "14px 16px", marginBottom: 14 }}>
                <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(245,197,24,0.7)", fontWeight: 700, marginBottom: 12 }}>✏️ Item não cadastrado</div>
                <input type="text" placeholder="Nome do item (ex: Coca-Cola 2L)" value={nomeAvulso} onChange={e => setNomeAvulso(e.target.value)}
                  style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: "0.88rem", fontFamily: "'Outfit', sans-serif", outline: "none", marginBottom: 8, boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "10px 12px" }}>
                    <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem" }}>R$</span>
                    <input type="number" inputMode="decimal" placeholder="0,00" value={valorAvulso} onChange={e => setValorAvulso(e.target.value)} onKeyDown={e => e.key === "Enter" && adicionarAvulso()}
                      style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: "0.95rem", fontWeight: 700, fontFamily: "'Fraunces', serif" }} />
                  </div>
                  <button onClick={adicionarAvulso} style={{ padding: "10px 16px", background: "rgba(245,197,24,0.2)", border: "1px solid rgba(245,197,24,0.4)", borderRadius: 10, color: "#f5c518", fontWeight: 800, fontSize: "0.8rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif", whiteSpace: "nowrap" }}>+ Adicionar</button>
                </div>
              </div>
              {itensAvulsos.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.2)", fontSize: "0.8rem" }}>Nenhum item adicionado ainda</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {itensAvulsos.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", background: "rgba(245,197,24,0.06)", border: "1px solid rgba(245,197,24,0.15)", borderRadius: 12 }}>
                      <div>
                        <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#fff" }}>{item.nome}</div>
                        <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>1× {fmt(item.preco)}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 800, color: "#f5c518" }}>{fmt(item.preco)}</span>
                        <button onClick={() => setItensAvulsos(p => p.filter((_, j) => j !== i))} style={{ width: 24, height: 24, borderRadius: "50%", background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "12px 20px 28px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                {btnPagto("dinheiro", "💵", "Dinheiro")}{btnPagto("pix", "📲", "PIX")}{btnPagto("cartao", "💳", "Cartão")}
              </div>
              <button onClick={() => registrarVenda(totalAvulsos, itensAvulsos.map(i => ({ nome: i.nome, preco: i.preco, qty: 1 })))}
                disabled={registrando || totalAvulsos <= 0}
                style={{ width: "100%", padding: "15px", background: totalAvulsos > 0 ? "linear-gradient(135deg, #f5c518, #d97706)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 16, color: totalAvulsos > 0 ? "#0a0414" : "rgba(255,255,255,0.25)", fontWeight: 800, fontSize: "1rem", cursor: totalAvulsos > 0 ? "pointer" : "not-allowed", fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{registrando ? "Registrando..." : totalAvulsos > 0 ? "✓ Registrar itens avulsos" : "Adicione ao menos 1 item"}</span>
                {totalAvulsos > 0 && <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.15rem" }}>{fmt(totalAvulsos)}</span>}
              </button>
            </div>
          </>
        )}

        {/* ── ABA RETIRADA ── */}
        {aba === "retirada" && (
          <div style={{ flex: 1, padding: "24px 20px 32px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(239,68,68,0.6)", fontWeight: 700, marginBottom: 10 }}>💸 Valor retirado do caixa</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: "1rem" }}>R$</span>
                <input type="number" inputMode="decimal" placeholder="0,00" value={valorRetirada} onChange={e => setValorRetirada(e.target.value)} autoFocus
                  style={{ flex: 1, background: "none", border: "none", outline: "none", color: "#fff", fontSize: "1.6rem", fontWeight: 800, fontFamily: "'Fraunces', serif" }} />
              </div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(255,255,255,0.3)", fontWeight: 700, marginBottom: 10 }}>Motivo (opcional)</div>
              <input type="text" placeholder="Ex: Compra de Coca-Cola, troco, etc." value={descRetirada} onChange={e => setDescRetirada(e.target.value)}
                style={{ width: "100%", background: "none", border: "none", outline: "none", color: "#fff", fontSize: "0.9rem", fontFamily: "'Outfit', sans-serif", boxSizing: "border-box" }} />
            </div>
            <div style={{ marginTop: "auto" }}>
              <button onClick={registrarRetirada} disabled={registrando || !parseFloat(valorRetirada.replace(",", "."))}
                style={{ width: "100%", padding: "15px", background: parseFloat(valorRetirada.replace(",", ".")) > 0 ? "linear-gradient(135deg, #ef4444, #dc2626)" : "rgba(255,255,255,0.06)", border: "none", borderRadius: 16, color: parseFloat(valorRetirada.replace(",", ".")) > 0 ? "#fff" : "rgba(255,255,255,0.25)", fontWeight: 800, fontSize: "1rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span>{registrando ? "Registrando..." : "💸 Confirmar retirada"}</span>
                {parseFloat(valorRetirada.replace(",", ".")) > 0 && <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.15rem" }}>−{fmt(parseFloat(valorRetirada.replace(",", ".")))}</span>}
              </button>
            </div>
          </div>
        )}

        {/* ── ABA HISTÓRICO ── */}
        {aba === "historico" && (
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
            {lancamentos.length === 0 && (
              <div style={{ textAlign: "center", padding: "40px 0", color: "rgba(255,255,255,0.25)", fontSize: "0.85rem" }}>Nenhum lançamento hoje</div>
            )}
            {lancamentos.map(l => {
              const isRetirada = l.tipo === "retirada";
              return (
                <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 14px", background: isRetirada ? "rgba(239,68,68,0.06)" : "rgba(255,255,255,0.04)", border: `1px solid ${isRetirada ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: "0.78rem", color: isRetirada ? "#fca5a5" : "rgba(255,255,255,0.8)", fontWeight: 600, marginBottom: 3 }}>
                      {isRetirada ? `💸 ${l.descricao || "Retirada de caixa"}` : l.produtos?.map(p => `${p.qty}× ${p.nome}`).join(" · ") || "Venda avulsa"}
                    </div>
                    <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.3)" }}>
                      {isRetirada ? "retirada" : (l.pagamento === "dinheiro" ? "💵 dinheiro" : l.pagamento === "pix" ? "📲 pix" : "💳 cartão")}
                      {l.createdAt?.toDate ? ` · ${l.createdAt.toDate().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, fontSize: "0.9rem", color: isRetirada ? "#f87171" : "#22c55e", flexShrink: 0, marginLeft: 12 }}>
                    {isRetirada ? "−" : "+"}{fmt(l.total)}
                  </div>
                </div>
              );
            })}
            {lancamentos.length > 0 && (
              <>
              <div style={{ marginTop: 8, padding: "12px 14px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>↑ Entradas</span>
                  <span style={{ fontSize: "0.7rem", color: "#22c55e", fontWeight: 700 }}>{fmt(entradasHoje)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.35)" }}>↓ Retiradas</span>
                  <span style={{ fontSize: "0.7rem", color: "#f87171", fontWeight: 700 }}>−{fmt(saidasHoje)}</span>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 8, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#fff" }}>Saldo</span>
                  <span style={{ fontSize: "0.78rem", fontWeight: 900, color: saldoHoje >= 0 ? "#22c55e" : "#f87171" }}>
                    {saldoHoje >= 0 ? fmt(saldoHoje) : "−" + fmt(-saldoHoje)}
                  </span>
                </div>
              </div>

              {/* Botões de fechamento */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button
                  onClick={() => fecharCaixa(lancamentos, nomeLoja)}
                  style={{ flex: 1, padding: "12px", background: "linear-gradient(135deg, #7c3aed, #6d28d9)", border: "none", borderRadius: 12, color: "#fff", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, boxShadow: "0 3px 14px rgba(124,58,237,0.35)" }}>
                  📄 Fechar Caixa
                </button>
                <button
                  onClick={compartilharWhatsApp}
                  style={{ padding: "12px 16px", background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.35)", borderRadius: 12, color: "#25d366", fontWeight: 800, fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.544 5.872L0 24l6.304-1.524A11.946 11.946 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.937 0-3.748-.525-5.303-1.438l-.379-.225-3.742.904.944-3.648-.247-.387A9.937 9.937 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                </button>
              </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>,
    document.body
  );
}

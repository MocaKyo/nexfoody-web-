import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { doc, updateDoc, collection, addDoc, serverTimestamp, getDocs, query, where } from "firebase/firestore";
import { db } from "../../lib/firebase";
import QRCode from "qrcode";

const PLANOS = [
  {
    id: "basic",
    nome: "BASIC",
    cor: "#22c55e",
    badge: "🟢",
    preco: "9.90",
    duracao: "1 dia",
    dias: 1,
    idealPara: "Ideal para testar o sistema ou dias específicos (promoções, finais de semana)",
    recursos: [
      "✔ Loja visível na rede Nexfoody",
      "✔ Recebimento de pedidos",
      "✔ Organizador de pedidos (Kanban)",
      "✔ Chat com cliente (atendimento humano)",
    ],
  },
  {
    id: "pro",
    nome: "PRO",
    cor: "#3b82f6",
    badge: "🔵",
    preco: "49.90",
    duracao: "7 dias",
    dias: 7,
    idealPara: "Ideal para operação semanal com volume constante de pedidos",
    recursos: [
      "✔ Tudo do BASIC",
      "✔ Relatórios mais detalhados",
      "✔ Sugestões inteligentes de vendas",
      "✔ Comparativo de desempenho (dias anteriores)",
      "✔ Prioridade no ranking da rede",
    ],
  },
  {
    id: "max",
    nome: "MAX",
    cor: "#a855f7",
    badge: "🟣",
    preco: "149.90",
    duracao: "30 dias",
    dias: 30,
    idealPara: "Ideal para crescer e escalar dentro da rede Nexfoody",
    destaque: true,
    recursos: [
      "✔ Tudo do PRO",
      "✔ Relatórios avançados com IA",
      "✔ Análise completa da loja (vendas, clientes, comportamento)",
      "✔ Recomendações automáticas de crescimento",
      "✔ Destaque na rede (maior visibilidade)",
      "✔ Prioridade em novos clientes",
    ],
  },
];

//Addon IA Plus
const IA_PLUS = {
  id: "addon_ia",
  nome: "IA Plus",
  cor: "#f59e0b",
  badge: "🤖",
  precoPorAtendimento: 0.25,
  atendimentosMin: 50,
  atendimentosMax: 5000,
  idealPara: "Automatize atendimentos com IA avançada — reduza trabalho manual e não perca nenhum cliente",
  recursos: [
    "✔ A IA atende seus pedidos, não se cansa",
    "✔ Não falta nunca — 24h por dia",
    "✔ Sabe tudo sobre cada pedido",
    "✔ Resposta instantânea",
    "✔ Integração com chat da Nexfoody",
    "✔ Sem limite de conversas simultâneas",
  ],
};

const PIX_KEY = "1199984623356";
const NEXFOODY_NAME = "Nexfoody";
const NEXFOODY_CITY = "Sao Paulo";

function gerarPayloadPix({ chave, nome, cidade, valor, txid }) {
  const f = (id, v) => `${id}${String(v.length).toString().padStart(2, "0")}${v}`;
  const merchantAccountInfo = f("00", "BR.GOV.BCB.PIX") + f("01", chave);
  const ref = txid.replace(/[^a-zA-Z0-9]/g, "").substring(0, 25) || "NEXFOODY";
  const payload =
    f("00", "01") +
    f("26", merchantAccountInfo) +
    f("52", "0000") +
    f("53", "986") +
    f("54", parseFloat(valor).toFixed(2)) +
    f("58", "BR") +
    f("59", nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 25)) +
    f("60", cidade.normalize("NFD").replace(/[\u0300-\u036f]/g, "").substring(0, 15)) +
    f("62", f("05", ref)) +
    "6304";
  const crc = crc16ccitt(payload);
  return payload + crc;
}

function crc16ccitt(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function PixQRCode({ valor, descricao, onConfirmar, loading }) {
  const [copiado, setCopiado] = useState(false);
  const [payload, setPayload] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const txid = `NXF${Date.now()}`;

  useEffect(() => {
    if (!valor) return;
    try {
      const p = gerarPayloadPix({ chave: PIX_KEY, nome: NEXFOODY_NAME, cidade: NEXFOODY_CITY, valor, txid });
      setPayload(p);
      QRCode.toDataURL(p, {
        width: 220,
        margin: 2,
        color: { dark: "#1e0a36", light: "#ffffff" },
        errorCorrectionLevel: "M",
      }).then(url => setQrUrl(url)).catch(console.error);
    } catch (e) {
      console.error("Erro ao gerar PIX:", e);
    }
  }, [valor]);

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

  return (
    <div style={{
      background: "rgba(0,0,0,.95)",
      border: "1px solid rgba(245,197,24,.3)",
      borderRadius: 20,
      padding: "24px 20px",
      maxWidth: 360,
      width: "100%",
      textAlign: "center",
    }}>
      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#f5c518", marginBottom: 4 }}>
        {descricao}
      </div>
      <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.4)", marginBottom: 16 }}>
        Pagamento PIX
      </div>

      {qrUrl && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <div style={{ background: "#fff", padding: 12, borderRadius: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
            <img src={qrUrl} alt="QR Code PIX" width={200} height={200} style={{ display: "block", borderRadius: 8 }} />
          </div>
        </div>
      )}

      <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.6rem", fontWeight: 900, color: "#22c55e", marginBottom: 16 }}>
        R$ {parseFloat(valor).toFixed(2).replace(".", ",")}
      </div>

      <button onClick={copiar} style={{
        width: "100%", padding: 12, marginBottom: 10,
        background: copiado ? "#22c55e" : "rgba(245,197,24,.15)",
        border: `1px solid ${copiado ? "#22c55e" : "rgba(245,197,24,.4)"}`,
        borderRadius: 10, color: copiado ? "#fff" : "#f5c518",
        fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
        fontFamily: "'Outfit', sans-serif",
      }}>
        {copiado ? "✅ Código copiado!" : "📋 Copiar código PIX"}
      </button>

      <div style={{
        background: "rgba(255,255,255,.04)",
        border: "1px dashed rgba(255,255,255,.1)",
        borderRadius: 8, padding: "8px 10px", marginBottom: 16,
        fontSize: "0.55rem", color: "rgba(255,255,255,.3)",
        wordBreak: "break-all", fontFamily: "monospace",
        maxHeight: 48, overflow: "hidden",
      }}>
        {payload || "Gerando..."}
      </div>

      <button
        onClick={onConfirmar}
        disabled={loading}
        style={{
          width: "100%", padding: 14,
          background: loading ? "rgba(34,197,94,.3)" : "linear-gradient(135deg,#22c55e,#15803d)",
          border: "none", borderRadius: 10,
          color: "#fff", fontWeight: 800, fontSize: "0.9rem",
          cursor: loading ? "not-allowed" : "pointer",
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        {loading ? "⏳ Processando..." : "✅ Já fiz o pagamento"}
      </button>

      <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,.3)", marginTop: 10, lineHeight: 1.4 }}>
        Sua ativação é instantânea após confirmação
      </div>
    </div>
  );
}

function PlanoCard({ plano, onAtivar }) {
  return (
    <div
      style={{
        background: plano.destaque ? "rgba(168,85,247,.08)" : "rgba(255,255,255,.04)",
        border: `2px solid ${plano.destaque ? plano.cor : "rgba(255,255,255,.08)"}`,
        borderRadius: 20,
        padding: "28px 24px",
        position: "relative",
        overflow: "hidden",
        transform: plano.destaque ? "scale(1.02)" : "none",
      }}
    >
      {plano.destaque && (
        <div style={{
          position: "absolute", top: 14, right: -30,
          background: plano.cor, color: "#fff",
          fontSize: "0.6rem", fontWeight: 900,
          padding: "4px 40px",
          transform: "rotate(45deg)",
          letterSpacing: ".05em",
        }}>
          MAIS POPULAR
        </div>
      )}

      <div style={{
        display: "inline-block",
        background: `${plano.cor}20`,
        border: `1px solid ${plano.cor}50`,
        borderRadius: 20,
        padding: "4px 12px",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: "0.8rem" }}>{plano.badge}</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: plano.cor, marginLeft: 6 }}>{plano.nome}</span>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: "2.2rem", fontWeight: 900, color: plano.cor }}>R$ {plano.preco}</span>
      </div>
      <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,.4)", marginBottom: 16 }}>
        ⏱️ Crédito por <strong style={{ color: "#fff" }}>{plano.duracao}</strong>
      </div>

      <div style={{
        background: "rgba(255,255,255,.04)",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 16,
        fontSize: "0.75rem",
        color: "rgba(255,255,255,.5)",
        fontStyle: "italic",
      }}>
        {plano.idealPara}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
        {plano.recursos.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ color: plano.cor, fontSize: "0.9rem", marginTop: 1 }}>✓</span>
            <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,.7)" }}>{r}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => onAtivar(plano)}
        style={{
          width: "100%", padding: "14px",
          borderRadius: 12, border: "none",
          background: plano.cor,
          color: "#fff",
          fontSize: "0.9rem", fontWeight: 800,
          cursor: "pointer",
          transition: "all .2s",
        }}
      >
        🚀 Ativar {plano.nome}
      </button>
    </div>
  );
}

function IAPlusCard({ onAtivar }) {
  const [qtd, setQtd] = useState(100);
  const total = (qtd * IA_PLUS.precoPorAtendimento).toFixed(2);

  const preset = [
    { label: "50 pedidos", value: 50 },
    { label: "100 pedidos", value: 100 },
    { label: "200 pedidos", value: 200 },
    { label: "500 pedidos", value: 500 },
    { label: "1000 pedidos", value: 1000 },
    { label: "2000 pedidos", value: 2000 },
  ];

  return (
    <div
      style={{
        background: "rgba(245,158,11,.06)",
        border: "2px solid rgba(245,158,11,.35)",
        borderRadius: 20,
        padding: "28px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Badge IA Plus */}
      <div style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: "rgba(245,158,11,.15)",
        border: "1px solid rgba(245,158,11,.4)",
        borderRadius: 20,
        padding: "4px 12px",
        marginBottom: 12,
      }}>
        <span style={{ fontSize: "1rem" }}>🤖</span>
        <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#f59e0b" }}>IA Plus</span>
        <span style={{
          fontSize: "0.55rem", fontWeight: 700,
          background: "#f59e0b", color: "#000",
          padding: "2px 6px", borderRadius: 10,
        }}>
          ADDON
        </span>
      </div>

      {/* Preço por atendimento */}
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: "1.1rem", fontWeight: 700, color: "rgba(255,255,255,.5)" }}>R$ </span>
        <span style={{ fontSize: "2.5rem", fontWeight: 900, color: "#f59e0b" }}>0,25</span>
        <span style={{ fontSize: "1rem", fontWeight: 700, color: "rgba(255,255,255,.4)" }}>/ pedido</span>
      </div>

      {/* Seletor de quantidade */}
      <div style={{
        background: "rgba(255,255,255,.04)",
        borderRadius: 12,
        padding: "14px 16px",
        marginBottom: 16,
      }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "rgba(255,255,255,.5)", marginBottom: 10, textTransform: "uppercase", letterSpacing: ".05em" }}>
          Quantos pedidos você quer cobrir com IA?
        </div>

        {/* Presets */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {preset.map(p => (
            <button
              key={p.value}
              onClick={() => setQtd(p.value)}
              style={{
                padding: "5px 10px",
                borderRadius: 20,
                border: `1px solid ${qtd === p.value ? "#f59e0b" : "rgba(255,255,255,.15)"}`,
                background: qtd === p.value ? "rgba(245,158,11,.2)" : "rgba(255,255,255,.04)",
                color: qtd === p.value ? "#f59e0b" : "rgba(255,255,255,.5)",
                fontSize: "0.72rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Input custom */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.4)" }}>Ou informe:</span>
          <input
            type="number"
            min={IA_PLUS.atendimentosMin}
            max={IA_PLUS.atendimentosMax}
            value={qtd}
            onChange={e => setQtd(Math.max(IA_PLUS.atendimentosMin, Math.min(IA_PLUS.atendimentosMax, parseInt(e.target.value) || 0)))}
            style={{
              flex: 1,
              background: "rgba(255,255,255,.06)",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 8,
              padding: "8px 12px",
              color: "#fff",
              fontSize: "0.9rem",
              fontWeight: 700,
              outline: "none",
              fontFamily: "'Outfit', sans-serif",
            }}
          />
          <span style={{ fontSize: "0.78rem", color: "rgba(255,255,255,.4)" }}>pedidos</span>
        </div>
      </div>

      {/* Resumo do valor */}
      <div style={{
        background: "rgba(245,158,11,.1)",
        border: "1px solid rgba(245,158,11,.25)",
        borderRadius: 12,
        padding: "16px",
        marginBottom: 16,
        textAlign: "center",
      }}>
        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.5)", marginBottom: 4 }}>
          Total por pedido: <span style={{ color: "#f59e0b", fontWeight: 700 }}>R$ 0,25</span>
        </div>
        <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.5)", marginBottom: 8 }}>
          Pedidos cobertos: <strong style={{ color: "#fff" }}>{qtd.toLocaleString("pt-BR")}</strong>/mês
        </div>
        <div style={{ fontSize: "1.4rem", fontWeight: 900, color: "#f59e0b" }}>
          R$ {total}
          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "rgba(255,255,255,.4)", marginLeft: 4 }}>/mês</span>
        </div>
      </div>

      <div style={{
        background: "rgba(255,255,255,.04)",
        borderRadius: 10,
        padding: "10px 12px",
        marginBottom: 16,
        fontSize: "0.75rem",
        color: "rgba(255,255,255,.5)",
        fontStyle: "italic",
      }}>
        {IA_PLUS.idealPara}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {IA_PLUS.recursos.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            <span style={{ color: "#f59e0b", fontSize: "0.9rem", marginTop: 1 }}>✓</span>
            <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,.7)" }}>{r}</span>
          </div>
        ))}
      </div>

      <button
        onClick={() => onAtivar({ ...IA_PLUS, qtd, valorTotal: parseFloat(total) })}
        style={{
          width: "100%", padding: "14px",
          borderRadius: 12,
          border: "2px solid #f59e0b",
          background: "rgba(245,158,11,.15)",
          color: "#f59e0b",
          fontSize: "0.9rem", fontWeight: 800,
          cursor: "pointer",
          transition: "all .2s",
        }}
      >
        🤖 Ativar IA Plus — R$ {total}/mês ({qtd} pedidos)
      </button>
    </div>
  );
}

export default function PlanosPage() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [itemSelecionado, setItemSelecionado] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const ativar = (item) => {
    if (!userData?.uid) {
      navigate("/lojista/login");
      return;
    }
    setItemSelecionado(item);
  };

  const confirmarPagamento = async () => {
    if (!itemSelecionado || !userData?.uid) return;
    setLoading(true);
    try {
      const isAddon = itemSelecionado.id === "addon_ia";
      const expiraEm = new Date();
      expiraEm.setDate(expiraEm.getDate() + 30); // IA Plus é mensal

      // Busca loja do usuário
      const snap = await getDocs(query(collection(db, "lojas"), where("ownerId", "==", userData.uid)));

      if (!snap.empty) {
        const lojaRef = snap.docs[0].ref;

        if (isAddon) {
          // Ativa addon IA Plus com quantidade de pedidos
          await updateDoc(lojaRef, {
            addonIA: true,
            addonIAExpiraEm: expiraEm,
            limiteIAPedidos: itemSelecionado.qtd, // total de pedidos cobertos por mês
            pedidosIAContador: 0, // contador mensal
          });
        } else {
          // Ativa plano principal
          await updateDoc(lojaRef, {
            plano: itemSelecionado.id,
            planoExpiraEm: expiraEm,
            ativo: true,
          });
        }
      } else if (userData.lojaId) {
        const lojaRef = doc(db, "lojas", userData.lojaId);
        if (isAddon) {
          await updateDoc(lojaRef, {
            addonIA: true,
            addonIAExpiraEm: expiraEm,
            limiteIAPedidos: itemSelecionado.qtd,
            pedidosIAContador: 0,
          });
        } else {
          await updateDoc(lojaRef, {
            plano: itemSelecionado.id,
            planoExpiraEm: expiraEm,
            ativo: true,
          });
        }
      }

      // Salva histórico
      await addDoc(collection(db, "planosCompras"), {
        userId: userData.uid,
        tipo: isAddon ? "addon_ia" : itemSelecionado.id,
        valor: isAddon ? itemSelecionado.valorTotal : parseFloat(itemSelecionado.preco),
        qtdPedidos: isAddon ? itemSelecionado.qtd : null,
        criadoEm: serverTimestamp(),
        expiraEm,
        status: "ativo",
      });

      setSucesso(true);
    } catch (e) {
      console.error("Erro ao ativar:", e);
      alert("Erro ao ativar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#080412", fontFamily: "'Outfit', sans-serif" }}>

      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f0618 0%, #1a0530 100%)", borderBottom: "1px solid rgba(245,197,24,.15)", padding: "24px 16px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ fontSize: "2rem" }}>💳</span>
            <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.8rem", color: "#f5c518", margin: 0 }}>
              Planos Nexfoody
            </h1>
          </div>
          <p style={{ color: "rgba(255,255,255,.5)", fontSize: "0.9rem", margin: 0 }}>
            Sua loja aberta, visível e vendendo dentro da rede
          </p>
        </div>
      </div>

      {/* Diferencial Nexfoody */}
      <div style={{ maxWidth: 700, margin: "24px auto", padding: "0 16px" }}>
        <div style={{ background: "rgba(245,197,24,.08)", border: "1px solid rgba(245,197,24,.2)", borderRadius: 16, padding: "20px" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "#f5c518", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12, textAlign: "center" }}>
            🤖 Tecnologia Nexfoody (em todos os planos)
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <div style={{ fontSize: "1.1rem", marginBottom: 6 }}>💬</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff", marginBottom: 4 }}>Chat inteligente</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.5)" }}>Clientes conversam direto pelo app, sem precisar abrir WhatsApp</div>
            </div>
            <div>
              <div style={{ fontSize: "1.1rem", marginBottom: 6 }}>📊</div>
              <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#fff", marginBottom: 4 }}>Dashboard completo</div>
              <div style={{ fontSize: "0.75rem", color: "rgba(255,255,255,.5)" }}>Acompanhe vendas, pedidos e crescimento em tempo real</div>
            </div>
          </div>
        </div>
      </div>

      {/* Título Planos */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 12px" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(255,255,255,.4)", textTransform: "uppercase", letterSpacing: ".1em" }}>
            Escolha seu plano
          </span>
        </div>
      </div>

      {/* Cards de Planos */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20, marginBottom: 24 }}>
          {PLANOS.map(plano => (
            <PlanoCard key={plano.id} plano={plano} onAtivar={ativar} />
          ))}
        </div>
      </div>

      {/* Separador */}
      <div style={{ maxWidth: 600, margin: "16px auto", padding: "0 16px", display: "flex", alignItems: "center", gap: 16 }}>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.08)" }} />
        <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,.25)", fontWeight: 600, whiteSpace: "nowrap" }}>ADDON OPCIONAL</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.08)" }} />
      </div>

      {/* Título Addon IA Plus */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px 12px" }}>
        <div style={{ textAlign: "center" }}>
          <span style={{ fontSize: "0.72rem", fontWeight: 800, color: "rgba(245,158,11,.5)", textTransform: "uppercase", letterSpacing: ".1em" }}>
            Potencialize com IA
          </span>
        </div>
      </div>

      {/* Card IA Plus */}
      <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 16px 48px" }}>
        <IAPlusCard addonIA={userData?.addonIA} onAtivar={ativar} />
      </div>

      {/* Como funciona */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "0 16px 48px" }}>
        <div style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 16, padding: "24px" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,.5)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 16, textAlign: "center" }}>
            ⚡ Como funciona
          </div>
          {[
            { num: "1", text: "Escolha seu plano base (Basic, Pro ou Max)" },
            { num: "2", text: "Opcional: ative IA Plus — escolha quantos pedidos quer cobrir" },
            { num: "3", text: "Efetue o pagamento via Pix" },
            { num: "4", text: "Sua loja fica ativa na rede Nexfoody" },
            { num: "5", text: "IA Plus: a cada pedido, a IA atende automaticamente" },
          ].map((item, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "rgba(245,197,24,.15)",
                border: "1px solid rgba(245,197,24,.3)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.75rem", fontWeight: 900, color: "#f5c518", flexShrink: 0,
              }}>
                {item.num}
              </div>
              <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,.6)" }}>{item.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Resumo */}
      <div style={{ maxWidth: 500, margin: "0 auto", padding: "0 16px 48px", textAlign: "center" }}>
        <div style={{ fontSize: "0.75rem", fontWeight: 800, color: "rgba(255,255,255,.3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
          🚀 Resumo
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 24, flexWrap: "wrap" }}>
          <span style={{ fontSize: "0.82rem", color: "#22c55e" }}>BASIC R$ 9,90/dia</span>
          <span style={{ fontSize: "0.82rem", color: "#3b82f6" }}>PRO R$ 49,90/sem</span>
          <span style={{ fontSize: "0.82rem", color: "#a855f7" }}>MAX R$ 149,90/mês</span>
          <span style={{ fontSize: "0.82rem", color: "#f59e0b" }}>+ IA R$ 5,90/dia</span>
        </div>
      </div>

      {/* Modal PIX */}
      {itemSelecionado && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }}>
          {sucesso ? (
            <div style={{
              background: "rgba(0,0,0,.9)",
              border: "1px solid rgba(34,197,94,.4)",
              borderRadius: 20, padding: "40px 24px",
              maxWidth: 360, width: "100%", textAlign: "center",
            }}>
              <div style={{ fontSize: "4rem", marginBottom: 16 }}>🎉</div>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.5rem", fontWeight: 700, color: "#22c55e", marginBottom: 8 }}>
                {itemSelecionado.id === "addon_ia" ? "IA Plus ativado!" : "Plano ativado!"}
              </div>
              <div style={{ fontSize: "0.9rem", color: "rgba(255,255,255,.6)", marginBottom: 24 }}>
                {itemSelecionado.id === "addon_ia"
                  ? `IA Plus ativo por ${itemSelecionado.duracao} — até ${itemSelecionado.atendimentosPorDia} atendimentos/dia`
                  : `${itemSelecionado.nome} ativo por ${itemSelecionado.duracao}`
                }
              </div>
              <button
                onClick={() => navigate("/lojista/hub")}
                style={{
                  width: "100%", padding: 14, background: "#22c55e",
                  border: "none", borderRadius: 10, color: "#fff",
                  fontWeight: 800, fontSize: "0.9rem", cursor: "pointer",
                  fontFamily: "'Outfit', sans-serif",
                }}
              >
                Ir para meu Hub →
              </button>
            </div>
          ) : (
            <div style={{ width: "100%", maxWidth: 360 }}>
              <button
                onClick={() => { setItemSelecionado(null); }}
                style={{
                  position: "absolute", top: 20, right: 20,
                  background: "rgba(255,255,255,.1)", border: "none",
                  borderRadius: "50%", width: 36, height: 36,
                  color: "#fff", fontSize: "1.2rem", cursor: "pointer",
                }}
              >
                ✕
              </button>
              <PixQRCode
                valor={itemSelecionado.id === "addon_ia" ? itemSelecionado.valorTotal : itemSelecionado.preco}
                descricao={itemSelecionado.id === "addon_ia"
                  ? `🤖 IA Plus — ${itemSelecionado.qtd?.toLocaleString("pt-BR")} pedidos/mês`
                  : `🚀 ${itemSelecionado.nome} — ${itemSelecionado.duracao}`
                }
                onConfirmar={confirmarPagamento}
                loading={loading}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

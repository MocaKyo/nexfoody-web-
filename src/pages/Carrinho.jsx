// src/pages/Carrinho.js — Carrinho profissional completo
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../contexts/StoreContext";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../components/Toast";
import { doc, getDoc, updateDoc, setDoc, serverTimestamp, increment, collection, addDoc } from "firebase/firestore";
import PixPagamento from "../components/PixPagamento";
import ModalProduto from "../components/ModalProduto";
import CompartilharAfeto from "../components/CompartilharAfeto";
import EnderecoModal from "../components/EnderecoModal";
import Comprovante from "../components/Comprovante";
import { useSearchParams } from "react-router-dom";
import { db } from "../lib/firebase";

const LOGO_URL = "https://i.ibb.co/Z1R8Y83G/Whats-App-Image-2026-03-20-at-20-32-27.jpg";

// Animações globais
const globalStyle = `
  @keyframes fadeUp { from { opacity:1; transform:translateX(-50%) translateY(0); } to { opacity:0; transform:translateX(-50%) translateY(-16px); } }
  @keyframes heartPop { 0%{transform:scale(1)} 40%{transform:scale(1.5)} 70%{transform:scale(0.9)} 100%{transform:scale(1.05)} }
`;

// Componente de item — layout profissional
function CartItem({ item, onRemove, onQtyChange, onDuplicar, onEditar, isFav, onToggleFav }) {
  const startX = useRef(null);
  const [swipeX, setSwipeX] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const [favEffect, setFavEffect] = useState(false);

  const handleFav = () => {
    onToggleFav();
    if (!isFav) {
      setFavEffect(true);
      setTimeout(() => setFavEffect(false), 900);
    }
  };

  const onTouchStart = e => { startX.current = e.touches[0].clientX; setSwiping(true); };
  const onTouchMove = e => {
    if (!startX.current) return;
    const dx = e.touches[0].clientX - startX.current;
    if (dx < 0) setSwipeX(Math.max(dx, -100));
  };
  const onTouchEnd = () => {
    if (swipeX < -70) onRemove();
    else setSwipeX(0);
    setSwiping(false);
    startX.current = null;
  };

  const preco = item.precoTotal || item.preco;

  return (
    <div style={{ position: "relative", overflow: "hidden", borderRadius: 12, marginBottom: 12 }}>
      <style>{globalStyle}</style>
      {/* Fundo swipe-delete */}
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 90, background: "linear-gradient(135deg, #ef4444, #dc2626)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12 }}>
        <div style={{ textAlign: "center", color: "#fff" }}>
          <div style={{ fontSize: "1.3rem" }}>🗑️</div>
          <div style={{ fontSize: "0.6rem", fontWeight: 700 }}>Remover</div>
        </div>
      </div>

      {/* Card */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swiping ? "none" : "transform 0.3s ease",
          background: "var(--bg2)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "12px 12px",
          display: "flex", gap: 12,
        }}
      >
        {/* COLUNA 1: Foto 72x72 — clicável para reeditar */}
        <div
          onClick={onEditar}
          style={{ width: 72, height: 72, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "var(--bg3)", cursor: onEditar ? "pointer" : "default", position: "relative" }}
        >
          {item.foto
            ? <img src={item.foto} alt={item.nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>{item.emoji || "🫐"}</div>
          }
          {onEditar && (
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.opacity = 1}
              onMouseLeave={e => e.currentTarget.style.opacity = 0}
            >
              <span style={{ fontSize: "1.2rem" }}>✏️</span>
            </div>
          )}
        </div>

        {/* COLUNA 2: Info (flex: 1) */}
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          {/* Nome + Lixeira */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6, marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", lineHeight: 1.3, flex: 1 }}>{item.nome}</div>
            <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "1rem", padding: "2px 4px", flexShrink: 0, lineHeight: 1 }}>🗑️</button>
          </div>

          {/* Tags de complementos */}
          {item.complementos?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
              {item.complementos.map((c, ci) => (
                <span key={ci} style={{ fontSize: "0.62rem", background: "rgba(245,197,24,0.1)", border: "1px solid rgba(245,197,24,0.2)", borderRadius: 20, padding: "2px 6px", color: "var(--gold)", whiteSpace: "nowrap" }}>
                  {c.nome}{c.preco > 0 ? ` +R$${c.preco.toFixed(2).replace(".",",")}` : ""}
                </span>
              ))}
            </div>
          )}

          {/* Linha de preço + favorito + seletor */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            {/* Favoritar + Preço */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ position: "relative" }}>
                <button
                  onClick={handleFav}
                  style={{
                    background: isFav ? "rgba(239,68,68,0.12)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isFav ? "rgba(239,68,68,0.3)" : "var(--border)"}`,
                    borderRadius: 8, cursor: "pointer", width: 32, height: 32,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1rem", transition: "all 0.2s",
                    transform: favEffect ? "scale(1.4)" : isFav ? "scale(1.05)" : "scale(1)",
                  }}
                >❤️</button>
                {/* Efeito "Salvo!" */}
                {favEffect && (
                  <div style={{
                    position: "absolute", top: -28, left: "50%", transform: "translateX(-50%)",
                    background: "#ef4444", color: "#fff", fontSize: "0.6rem", fontWeight: 700,
                    borderRadius: 6, padding: "2px 6px", whiteSpace: "nowrap",
                    animation: "fadeUp 0.9s ease forwards", pointerEvents: "none",
                  }}>
                    ❤️ Salvo!
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", color: "var(--gold)", fontWeight: 900, fontSize: "1rem", lineHeight: 1 }}>
                  R$ {(preco * item.qty).toFixed(2).replace(".", ",")}
                </div>
                {item.qty > 1 && (
                  <div style={{ fontSize: "0.62rem", color: "var(--text3)", marginTop: 2 }}>
                    R$ {preco.toFixed(2).replace(".", ",")} cada
                  </div>
                )}
              </div>
            </div>

            {/* Seletor de quantidade */}
            <div style={{ display: "flex", alignItems: "center", background: "var(--bg3)", borderRadius: 50, border: "1px solid var(--border)" }}>
              <button
                onClick={() => item.qty <= 1 ? onRemove() : onQtyChange(-1)}
                style={{
                  width: 30, height: 30, border: "none", background: "none",
                  cursor: "pointer", fontWeight: 700, fontSize: "1.1rem",
                  color: item.qty <= 1 ? "rgba(239,68,68,0.5)" : "var(--text2)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >−</button>
              <span style={{ minWidth: 26, textAlign: "center", fontWeight: 700, fontSize: "0.88rem" }}>{item.qty}</span>
              <button
                onClick={() => onQtyChange(1)}
                style={{ width: 30, height: 30, border: "none", background: "none", cursor: "pointer", color: "var(--gold)", fontWeight: 700, fontSize: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center" }}
              >+</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal pós-pedido
function ModalPosPedido({ dados, favoritos, onClose, onSalvarEndereco, onSalvarTelefone, navigate, user }) {
  const [enderecoSalvo, setEnderecoSalvo] = useState(false);
  const [telefoneSalvo, setTelefoneSalvo] = useState(false);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1500, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "flex-end" }}>
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto", background: "var(--bg)", borderRadius: "20px 20px 0 0", padding: "28px 20px 44px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>🎉</div>
          <div style={{ fontFamily: "'Fraunces',serif", fontSize: "1.3rem", fontWeight: 700 }}>Pedido enviado!</div>
          <div style={{ fontSize: "0.82rem", color: "var(--text2)", marginTop: 4 }}>Quer agilizar seu próximo pedido?</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>

          {/* Salvar endereço */}
          {dados.rua && user && (
            <button
              onClick={async () => { await onSalvarEndereco(); setEnderecoSalvo(true); }}
              disabled={enderecoSalvo}
              style={{
                padding: "14px 16px",
                background: enderecoSalvo ? "rgba(34,197,94,0.1)" : "rgba(96,165,250,0.08)",
                border: `1px solid ${enderecoSalvo ? "rgba(34,197,94,0.3)" : "rgba(96,165,250,0.2)"}`,
                borderRadius: 14, cursor: enderecoSalvo ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 12, fontFamily: "'Outfit',sans-serif",
                textAlign: "left", width: "100%",
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>{enderecoSalvo ? "✅" : "📍"}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: enderecoSalvo ? "var(--green)" : "#60a5fa" }}>
                  {enderecoSalvo ? "Endereço salvo!" : "Salvar endereço de entrega"}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 2 }}>
                  {dados.rua}{dados.cidade ? ` - ${dados.cidade}` : ""}
                </div>
              </div>
            </button>
          )}

          {/* Salvar telefone */}
          {dados.telefone && user && (
            <button
              onClick={async () => { await onSalvarTelefone(); setTelefoneSalvo(true); }}
              disabled={telefoneSalvo}
              style={{
                padding: "14px 16px",
                background: telefoneSalvo ? "rgba(34,197,94,0.1)" : "rgba(34,197,94,0.06)",
                border: `1px solid ${telefoneSalvo ? "rgba(34,197,94,0.3)" : "rgba(34,197,94,0.15)"}`,
                borderRadius: 14, cursor: telefoneSalvo ? "default" : "pointer",
                display: "flex", alignItems: "center", gap: 12, fontFamily: "'Outfit',sans-serif",
                textAlign: "left", width: "100%",
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>{telefoneSalvo ? "✅" : "📞"}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: telefoneSalvo ? "var(--green)" : "var(--green)" }}>
                  {telefoneSalvo ? "Telefone salvo!" : "Salvar meu WhatsApp"}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 2 }}>{dados.telefone}</div>
              </div>
            </button>
          )}

          {/* Favoritos */}
          {favoritos.length > 0 && (
            <div style={{ padding: "12px 16px", background: "rgba(245,197,24,0.06)", border: "1px solid rgba(245,197,24,0.15)", borderRadius: 14, display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: "1.4rem" }}>❤️</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--gold)" }}>
                  {favoritos.length} item{favoritos.length > 1 ? "s" : ""} favorito{favoritos.length > 1 ? "s" : ""}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 2 }}>
                  Aparecem em destaque no próximo pedido
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => { onClose(); navigate("/historico"); }}
          style={{
            width: "100%", padding: "15px",
            background: "var(--loja-cor-primaria)",
            border: "none", borderRadius: 14, cursor: "pointer",
            color: "var(--loja-btn-texto, #fff)", fontFamily: "'Outfit',sans-serif", fontWeight: 800, fontSize: "0.95rem",
          }}
        >
          Ver meu pedido →
        </button>
      </div>
    </div>
  );
}

export default function Carrinho() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mesaId = searchParams.get("mesa");
  const toast = useToast();
  const { user, userData } = useAuth();
  const {
    config, produtos, cartItems, cartTotal, addToCart, clearCart,
    removeFromCart,
    finalizarPedido, removeFromExtras, updateExtraQty, pontos, tenantId,
  } = useStore();

  const items = Object.entries(cartItems).reduce((acc, [produtoId, qty]) => {
    const produto = produtos.find(p => p.id === produtoId);
    if (produto) acc.push({ ...produto, qty, itemId: produtoId });
    return acc;
  }, []);
  const total = cartTotal();

  // Form dados
  const [nome, setNome] = useState(userData?.nome || "");
  const [telefone, setTelefone] = useState(userData?.telefone || "");
  const [obs, setObs] = useState("");
  const [tipoEntrega, setTipoEntrega] = useState(mesaId ? "mesa" : "entrega");
  const [rua, setRua] = useState("");
  const [cidade, setCidade] = useState("");
  const [bairro, setBairro] = useState("");
  const [complemento, setComplemento] = useState("");
  const [referencia, setReferencia] = useState("");
  const [pagamento, setPagamento] = useState("pix");
  const [cupomCodigo, setCupomCodigo] = useState("");
  const [cupomAplicado, setCupomAplicado] = useState(null);
  const [usarPontos, setUsarPontos] = useState(false);
  const [usarCashback, setUsarCashback] = useState(false);
  const [afetoSelecionado, setAfetoSelecionado] = useState(null);
  const [mostrarModalEndereco, setMostrarModalEndereco] = useState(false);
  const [editandoItem, setEditandoItem] = useState(null);
  const [afetoMsg, setAfetoMsg] = useState("");
  const [afetoCompartilhado, setAfetoCompartilhado] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [coords, setCoords] = useState(null);
  const [confirmouItens, setConfirmouItens] = useState(false);
  const [pixData, setPixData] = useState(null);
  const [pedidoFinalizado, setPedidoFinalizado] = useState(null);
  const [mostrarPosPedido, setMostrarPosPedido] = useState(false);
  const [dadosPosPedido, setDadosPosPedido] = useState(null);
  const [chatPedidoSalvo, setChatPedidoSalvo] = useState(null); // { chatId, numPedido, whatsappNum, items, total }

  // Favoritos — persistidos no localStorage
  const [favoritos, setFavoritos] = useState(() => {
    try { return JSON.parse(localStorage.getItem("itensFavoritos") || "[]"); } catch { return []; }
  });

  const toggleFavorito = (item) => {
    const key = item.itemId || item.id;
    setFavoritos(prev => {
      const existe = prev.find(f => f.key === key);
      const novos = existe
        ? prev.filter(f => f.key !== key)
        : [...prev, {
            key,
            nome: item.nome,
            foto: item.foto,
            emoji: item.emoji,
            preco: item.precoTotal || item.preco,
            complementos: item.complementos || [],
            produtoId: item.produtoId || item.id,
          }];
      localStorage.setItem("itensFavoritos", JSON.stringify(novos));
      return novos;
    });
  };

  // Frete grátis
  const FRETE = Number(config.taxaEntrega) || 0;
  const FRETE_GRATIS_MIN = Number(config.freteGratisAcima) || 0;
  const freteGratis = FRETE_GRATIS_MIN > 0 && total >= FRETE_GRATIS_MIN;
  const faltaFrete = FRETE_GRATIS_MIN > 0 ? Math.max(0, FRETE_GRATIS_MIN - total) : 0;
  const progFrete = FRETE_GRATIS_MIN > 0 ? Math.min((total / FRETE_GRATIS_MIN) * 100, 100) : 0;

  // Descontos
  const descCupom = cupomAplicado ? (
    cupomAplicado.tipo === "percentual" ? total * cupomAplicado.valor / 100 :
    cupomAplicado.tipo === "fixo" ? cupomAplicado.valor :
    cupomAplicado.tipo === "frete" ? (freteGratis ? 0 : FRETE) : 0
  ) : 0;
  const maxPontos = Math.min(pontos / 10, total * 0.2);
  const descPontos = usarPontos ? maxPontos : 0;
  const cashbackDisp = userData?.cashback || 0;
  const cashbackMaxUso = config.cashbackMaxDesconto ? Math.min(cashbackDisp, total * config.cashbackMaxDesconto / 100) : cashbackDisp;
  const descCashback = usarCashback ? cashbackMaxUso : 0;
  const freteReal = tipoEntrega === "entrega" ? (freteGratis || (cupomAplicado?.tipo === "frete") ? 0 : FRETE) : 0;
  const totalFinal = Math.max(0, total + freteReal - descCupom - descPontos - descCashback);

  useEffect(() => {
    if (userData) {
      setNome(userData.nome || "");
      setTelefone(userData.telefone || "");
      if (userData.endereco) {
        setRua(userData.endereco.rua || "");
        setBairro(userData.endereco.bairro || "");
        setComplemento(userData.endereco.complemento || "");
        setReferencia(userData.endereco.referencia || "");
        setCidade(userData.endereco.cidade || "");
      }
    }
  }, [userData]);

  const aplicarCupom = async () => {
    if (!cupomCodigo.trim()) return;
    try {
      const snap = await getDoc(doc(db, "cupons", cupomCodigo.toUpperCase()));
      if (!snap.exists()) { toast("Cupom inválido.", "error"); return; }
      const cupom = snap.data();
      if (!cupom.ativo) { toast("Cupom expirado.", "error"); return; }
      if (cupom.validade && new Date(cupom.validade) < new Date()) { toast("Cupom expirado.", "error"); return; }
      if (cupom.minimo && total < cupom.minimo) { toast(`Pedido mínimo R$${cupom.minimo.toFixed(2).replace(".",",")} para este cupom.`, "error"); return; }
      setCupomAplicado({ ...cupom, codigo: cupomCodigo.toUpperCase() });
      toast(`✅ Cupom ${cupomCodigo.toUpperCase()} aplicado!`);
    } catch { toast("Erro ao verificar cupom.", "error"); }
  };

  const endereco = tipoEntrega === "entrega" ? [rua, bairro, complemento, cidade, referencia].filter(Boolean).join(", ") : "";

  const gerarNumeroPedido = () => {
    const base = parseInt(localStorage.getItem("ultimoPedido") || "1000");
    const novo = base + 1;
    localStorage.setItem("ultimoPedido", String(novo));
    return novo;
  };

  const montarMsgWhatsApp = (numeroPedido) => {
    const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const urlLoja = config.urlApp || "acaipurogosto.com.br";
    let msg = `🛒 *NOVO PEDIDO*\n`;
    msg += `🧾 *Pedido Nº: #${numeroPedido}*\n`;
    msg += `🌐 *Loja:*\nhttps://${urlLoja}\n\n`;
    msg += `👤 *Cliente:* ${nome}\n`;
    if (telefone) msg += `📞 *Telefone:* ${telefone}\n`;
    msg += `\n📦 *PEDIDO:*\n`;
    items.forEach(item => {
      const precoItem = (item.precoTotal || item.preco) * item.qty;
      msg += `• *${item.qty}x ${item.nome}* — R$${precoItem.toFixed(2).replace(".",",")}\n`;
      if (item.complementos?.length > 0) {
        item.complementos.forEach(c => {
          msg += `  • ${c.nome}${c.preco > 0 ? ` +R$${c.preco.toFixed(2).replace(".",",")}` : ""}\n`;
        });
      }
      if (item.obs) msg += `  📝 Obs: ${item.obs}\n`;
    });
    if (obs) msg += `📝 *Obs:* ${obs}\n`;
    msg += `\n☑️ *Confirmação do cliente:*\nConfirmou que conferiu todos os itens\n\n`;
    if (tipoEntrega === "entrega") {
      if (coords?.lat && coords?.lng) {
        msg += `🗺️ *Mapa:*\nhttps://www.google.com/maps?q=${coords.lat},${coords.lng}\n`;
      } else if (rua) {
        msg += `🗺️ *Mapa:*\nhttps://www.google.com/maps/search/${encodeURIComponent([rua, bairro, cidade].filter(Boolean).join(", "))}\n`;
      }
      msg += `📍 *Endereço:*\n${rua}${bairro ? `, ${bairro}` : ""}${cidade ? ` - ${cidade}` : ""}\n`;
      if (complemento) msg += `🏠 *Complemento:* ${complemento}\n`;
      if (referencia) msg += `📝 *Referência:*\n${referencia}\n`;
    } else if (tipoEntrega === "mesa") {
      msg += `🪑 *Mesa:* ${mesaId}\n`;
    } else {
      msg += `🏠 *Retirada no local*\n`;
    }
    msg += `\n💰 *Subtotal:* R$${total.toFixed(2).replace(".",",")}\n`;
    if (freteReal > 0) msg += `🚚 *Frete:* R$${freteReal.toFixed(2).replace(".",",")}\n`;
    if (descCupom > 0) msg += `🏷️ *Desconto (cupom ${cupomAplicado?.codigo}):* -R$${descCupom.toFixed(2).replace(".",",")}\n`;
    if (descPontos > 0) msg += `🎁 *Desconto (pontos):* -R$${descPontos.toFixed(2).replace(".",",")}\n`;
    if (descCashback > 0) msg += `💰 *Desconto (cashback):* -R$${descCashback.toFixed(2).replace(".",",")}\n`;
    msg += `💵 *TOTAL: R$${totalFinal.toFixed(2).replace(".",",")}*\n`;
    msg += `💳 *Pagamento:* ${pagamento === "pix" ? "PIX" : pagamento === "cartao_online" ? "Cartão Online" : pagamento === "dinheiro" ? "Dinheiro" : "Cartão na entrega"}\n`;
    msg += `🕒 *Horário:* ${hora}\n`;
    const modo = config.modoFidelidade || "pontos";
    if (modo !== "nenhum") {
      msg += `\n🎁 *Recompensas:*\n`;
      const pts = Math.floor(total * (config.pontosPorReal || 1));
      const cb = (total * (config.cashbackPercent || 5) / 100).toFixed(2).replace(".",",");
      if (modo === "pontos" || modo === "ambos") msg += `⭐ Pontos ganhos: ${pts}\n`;
      if (modo === "cashback" || modo === "ambos") msg += `💰 Cashback: R$${cb}\n`;
    }
    msg += `\n📲 Acompanhe seu pedido:\n${urlLoja}/historico\n`;
    msg += `Faça parte da nossa comunidade e veja\na sua posição no Ranking de fãs.\nIndique e ganhe pontos!`;
    return msg;
  };

  const handleFinalizar = async () => {
    if (!config.cardapioAtivo) { toast("⏸️ Loja fechada no momento.", "error"); return; }
    if (!confirmouItens) { toast("✅ Confirme que conferiu todos os itens antes de finalizar.", "error"); return; }
    if (!nome.trim()) { toast("Informe seu nome.", "error"); return; }
    if (!telefone.trim()) { toast("Informe seu WhatsApp.", "error"); return; }
    if (tipoEntrega === "entrega" && !rua.trim()) { toast("Informe o endereço de entrega.", "error"); return; }
    if (items.length === 0) { toast("Seu carrinho está vazio.", "error"); return; }
    if (config.pedidoMinimo && total < config.pedidoMinimo) {
      toast(`Pedido mínimo: R$${parseFloat(config.pedidoMinimo).toFixed(2).replace(".",",")}`, "error"); return;
    }
    if (tipoEntrega === "entrega" && bairro.trim()) {
      const bloqueados = config.bairrosNaoAtendidos || [];
      const bairroNorm = bairro.trim().toLowerCase();
      const bloqueado = bloqueados.some(b => b.toLowerCase() === bairroNorm);
      if (bloqueado) { toast(`❌ Não entregamos no bairro "${bairro}". Confira os bairros atendidos.`, "error"); return; }
    }
    setLoading(true);
    try {
      const resultado = await finalizarPedido({
        nome, telefone, obs, tipoEntrega, endereco,
        pagamento, cupom: cupomAplicado?.codigo || "",
        descontoCupom: descCupom, usarPontos: descPontos,
        usarCashback: descCashback, total: totalFinal, frete: freteReal,
      });
      const pts = resultado?.pontosGanhos ?? 0;
      const cb = resultado?.cashbackGerado ?? 0;
      const toastMsg = pts > 0 && cb > 0
        ? `✅ Pedido enviado! +${pts} pontos e +R$${cb.toFixed(2).replace(".",",")} cashback 🎉`
        : pts > 0 ? `✅ Pedido enviado! +${pts} pontos 🏆`
        : cb > 0 ? `✅ Pedido enviado! +R$${cb.toFixed(2).replace(".",",")} de cashback 💰`
        : `✅ Pedido enviado!`;
      toast(toastMsg, "success");

      const numPedido = resultado?.numeroPedido || gerarNumeroPedido();

      if (pagamento === "pix") {
        setPixData({ valor: totalFinal, msgWhatsApp: montarMsgWhatsApp(numPedido) });
      } else if (pagamento === "cartao_online") {
        // Stripe Checkout
        try {
          const response = await fetch("https://us-east1-acaipedidos-f53cc.cloudfunctions.net/criarSessaoStripe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: items.map(i => ({
                nome: i.nome,
                preco: Math.round((i.precoTotal || i.preco) * 100),
                qty: i.qty,
              })),
              numPedido,
              nomeCliente: nome,
              email: user?.email || "",
              telefone,
              tenantId: tenantId || config.slug || "",
            }),
          });
          const data = await response.json();
          if (data.url) {
            window.location.href = data.url;
          } else if (data.error) {
            toast("Erro com Stripe: " + data.error, "error");
          }
        } catch (e) {
          toast("Erro ao iniciar pagamento Stripe.", "error");
          console.error(e);
        }
      } else {
        const msg = montarMsgWhatsApp(numPedido);
        const tel = (config.whatsapp || "5599984623356").replace(/\D/g, "");
        window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, "_blank");
      }
    // Incrementar stats dos produtos pedidos
  // db e increment já importados no topo
try {
  const hoje = new Date();
  const semana = `${hoje.getFullYear()}-W${Math.ceil((hoje.getDate()) / 7)}`;
  for (const item of items) {
    const id = item.produtoId || item.id;
    if (!id) continue;
    await setDoc(doc(db, `produtos/${id}/stats`, "geral"), {
      pedidosTotal: increment(item.qty || 1),
      pedidosSemana: increment(item.qty || 1),
      semanaAtual: semana,
    }, { merge: true });
  }
} catch {}
      // Mostrar modal pós-pedido
      setDadosPosPedido({ nome, telefone, rua, bairro, cidade, complemento, referencia, coords });
      setMostrarPosPedido(true);
      setPedidoFinalizado({
        items, total: totalFinal,
        numeroPedido: resultado?.numeroPedido || numPedido,
        nomeCliente: nome, telefone, pagamento, tipoEntrega,
        endereco, obs, pontosUsados: descPontos, cupom: cupomAplicado?.codigo || "", descontoCupom: descCupom,
      });

    } catch (e) { toast("Erro ao finalizar.", "error"); console.error(e); }
    finally { setLoading(false); }
  };

  const handlePedirPeloChat = async () => {
    if (!user) { toast("Faça login para pedir pelo chat.", "error"); navigate("/login"); return; }
    if (!config.cardapioAtivo) { toast("⏸️ Loja fechada no momento.", "error"); return; }
    if (!confirmouItens) { toast("✅ Confirme que conferiu todos os itens antes de finalizar.", "error"); return; }
    if (!nome.trim()) { toast("Informe seu nome.", "error"); return; }
    if (tipoEntrega === "entrega" && !rua.trim()) { toast("Informe o endereço de entrega.", "error"); return; }
    if (items.length === 0) { toast("Seu carrinho está vazio.", "error"); return; }
    if (config.pedidoMinimo && total < config.pedidoMinimo) {
      toast(`Pedido mínimo: R$${parseFloat(config.pedidoMinimo).toFixed(2).replace(".",",")}`, "error"); return;
    }
    if (tipoEntrega === "entrega" && bairro.trim()) {
      const bloqueados = config.bairrosNaoAtendidos || [];
      const bairroNorm = bairro.trim().toLowerCase();
      const bloqueado = bloqueados.some(b => b.toLowerCase() === bairroNorm);
      if (bloqueado) { toast(`❌ Não entregamos no bairro "${bairro}". Confira os bairros atendidos.`, "error"); return; }
    }
    setLoadingChat(true);
    try {
      const resultado = await finalizarPedido({
        nome, telefone: telefone || "", obs, tipoEntrega, endereco,
        pagamento: "chat", cupom: cupomAplicado?.codigo || "",
        descontoCupom: descCupom, usarPontos: descPontos,
        usarCashback: descCashback, total: totalFinal, frete: freteReal,
      });

      const pedidoId = resultado?.pedidoId;
      const numPedido = resultado?.numeroPedido || gerarNumeroPedido();
      const lojaSlug = tenantId || config.slug || "";
      const lojaVirtualId = `loja_${lojaSlug}`;
      const chatId = [user.uid, lojaVirtualId].sort().join("__");

      const pedidoInfo = {
        numeroPedido: numPedido,
        itens: items.map(i => ({ qty: i.qty, nome: i.nome, preco: i.precoTotal || i.preco })),
        total: totalFinal,
        tipoEntrega,
        endereco: tipoEntrega === "entrega" ? endereco : tipoEntrega === "retirada" ? "Retirada no local" : `Mesa ${mesaId}`,
      };

      // Atualiza pedido com dados do chat
      if (pedidoId) {
        await updateDoc(doc(db, "pedidos", pedidoId), {
          canal: "chat",
          chatBloqueado: true,
          status: "aguardando_confirmacao",
          chatId,
        });
      }

      // Cria ou atualiza chat com bloqueio e info do pedido
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);
      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          tipo: "loja",
          participantes: [user.uid, lojaVirtualId],
          participantesInfo: {
            [user.uid]: { nome: user.displayName || nome, foto: user.photoURL || null },
            [lojaVirtualId]: { nome: config.nomeLoja || "Loja", foto: config.logoUrl || null, isLoja: true, lojaSlug },
          },
          lojaId: lojaSlug,
          lojaSlug,
          bloqueado: true,
          pedidoId: pedidoId || null,
          pedidoInfo,
          ultimaMensagem: { texto: `🛒 Novo pedido #${numPedido}`, criadoEm: serverTimestamp(), autorId: user.uid },
          naoLido: { [user.uid]: 0, [lojaVirtualId]: 1 },
          digitando: {},
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(chatRef, {
          bloqueado: true,
          pedidoId: pedidoId || null,
          pedidoInfo,
          ultimaMensagem: { texto: `🛒 Novo pedido #${numPedido}`, criadoEm: serverTimestamp(), autorId: user.uid },
          [`naoLido.${lojaVirtualId}`]: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      toast("✅ Pedido enviado! Aguardando confirmação da loja.", "success");
      const whatsappNum = (config.whatsapp || "5599984623356").replace(/\D/g, "");
      setChatPedidoSalvo({ chatId, numPedido, whatsappNum, items, total: totalFinal });
    } catch (e) { toast("Erro ao criar pedido pelo chat.", "error"); console.error(e); }
    finally { setLoadingChat(false); }
  };

  const salvarEndereco = async () => {
    if (!user) { toast("Faça login para salvar.", "error"); return; }
    try {
      await setDoc(doc(db, "users", user.uid), {
        endereco: { rua, bairro, cidade, complemento, referencia }
      }, { merge: true });
      toast("📍 Endereço salvo!");
    } catch (e) { console.error(e); toast("Erro ao salvar endereço.", "error"); }
  };

  const salvarTelefone = async () => {
    if (!user) { toast("Faça login para salvar.", "error"); return; }
    try {
      await setDoc(doc(db, "users", user.uid), { telefone }, { merge: true });
      toast("📞 Telefone salvo!");
    } catch (e) { console.error(e); toast("Erro ao salvar telefone.", "error"); }
  };

  if (items.length === 0 && !pixData && !mostrarPosPedido && !pedidoFinalizado) return (
    <div className="page" style={{ textAlign: "center", paddingTop: 60 }}>
      <div style={{ fontSize: "3rem", marginBottom: 16 }}>🛒</div>
      <h2 style={{ fontFamily: "'Fraunces', serif", marginBottom: 8 }}>Carrinho vazio</h2>
      <p style={{ color: "var(--text2)", marginBottom: 24 }}>Adicione produtos para continuar</p>
      <button className="btn btn-gold" onClick={() => navigate("/")}>Ver cardápio</button>
    </div>
  );

  if (pixData) return (
    <div className="page">
      <PixPagamento
        valor={pixData.valor}
        pixKey={config.pixKey}
        nomeLoja={config.nomeLoja || "Acai Puro Gosto"}
        cidade="Bacabal"
        whatsapp={config.whatsapp}
        msgWhatsApp={pixData.msgWhatsApp}
      />
    </div>
  );

  return (
    <div className="page" style={{ paddingBottom: 160 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 6 }}>
          ← Voltar
        </button>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", margin: 0 }}>Meu <span style={{ color: "var(--gold)" }}>Pedido</span></h2>
        <button onClick={() => { if (window.confirm("Limpar carrinho?")) clearCart(); }} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontSize: "0.82rem" }}>
          Limpar
        </button>
      </div>

      {/* Info da loja */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
        <img src={config.logoUrl || LOGO_URL} alt="Loja" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
        <div>
          <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>{config.nomeLoja || "Açaí Puro Gosto"}</div>
          {config.tempoEntrega && <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>🕐 {config.tempoEntrega}</div>}
        </div>
      </div>

      {/* Barra frete grátis */}
      {FRETE_GRATIS_MIN > 0 && (
        <div style={{ background: freteGratis ? "rgba(34,197,94,0.1)" : "var(--bg2)", border: `1px solid ${freteGratis ? "rgba(34,197,94,0.3)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: "10px 14px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.78rem", fontWeight: 600, color: freteGratis ? "var(--green)" : "var(--text2)" }}>
            <span>{freteGratis ? "🎉 Frete grátis desbloqueado!" : `🚚 Faltam R$${faltaFrete.toFixed(2).replace(".",",")} para frete grátis`}</span>
            <span>{Math.round(progFrete)}%</span>
          </div>
          <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progFrete}%`, background: freteGratis ? "linear-gradient(90deg, #22c55e, #15803d)" : "linear-gradient(90deg, var(--gold), #e6a817)", borderRadius: 3, transition: "width 0.5s" }} />
          </div>
        </div>
      )}

      {/* Tipo de entrega */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { id: "entrega", icon: "🛵", label: "Delivery" },
          { id: "retirada", icon: "🏠", label: "Retirada" },
          ...(mesaId ? [{ id: "mesa", icon: "🪑", label: `Mesa ${mesaId}` }] : []),
        ].map(t => (
          <button key={t.id} onClick={() => setTipoEntrega(t.id)} style={{
            flex: 1, padding: "12px", border: `2px solid ${tipoEntrega === t.id ? "var(--gold)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)", cursor: "pointer",
            background: tipoEntrega === t.id ? "rgba(245,197,24,0.1)" : "var(--bg2)",
            color: tipoEntrega === t.id ? "var(--gold)" : "var(--text2)",
            fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.88rem",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition: "all 0.2s",
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Itens */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>Itens ({items.length})</div>
          <button onClick={() => navigate("/")} style={{ fontSize: "0.78rem", color: "var(--purple2)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 600 }}>
            + Adicionar mais
          </button>
        </div>
        {items.map(item => {
          const key = item.itemId || item.id;
          const isFav = favoritos.some(f => f.key === key);
          return (
            <CartItem
              key={key}
              item={item}
              isFav={isFav}
              onToggleFav={() => toggleFavorito(item)}
              onRemove={() => removeFromCart(item.id)}
              onQtyChange={delta => addToCart(item.id, delta)}
              onDuplicar={() => addToCart(item.id, 1)}
              onEditar={() => {
                const produto = item.itemId
                  ? { id: item.produtoId, nome: item.nome, foto: item.foto, emoji: item.emoji, preco: item.preco, maxComplementos: item.maxComplementos }
                  : { id: item.id, nome: item.nome, foto: item.foto, emoji: item.emoji, preco: item.preco };
                setEditandoItem({ produto, itemId: item.itemId, complementos: item.complementos || [] });
              }}
            />
          );
        })}
      </div>

      {/* Observações */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 8 }}>📝 Observações</div>
        <textarea
          className="form-input"
          value={obs}
          onChange={e => setObs(e.target.value)}
          placeholder="Ex: Coloque mais leite condensado, troco para R$50, campainha com defeito..."
          rows={3}
          style={{ resize: "none" }}
        />
      </div>

      {/* Endereço */}
      {tipoEntrega === "entrega" && (
        <div style={{ marginBottom: 16 }}>
          {rua ? (
            <div onClick={() => setMostrarModalEndereco(true)} style={{ background: "var(--bg2)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "var(--radius)", padding: 14, cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 10 }}>
              <span style={{ fontSize: "1.3rem", flexShrink: 0 }}>📍</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--green)", marginBottom: 2 }}>Endereço confirmado</div>
                <div style={{ fontSize: "0.82rem", lineHeight: 1.5 }}>{rua}{bairro ? ` - ${bairro}` : ""}{cidade ? ` - ${cidade}` : ""}</div>
                {complemento && <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{complemento}</div>}
                {referencia && <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{referencia}</div>}
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--purple2)", fontWeight: 600, flexShrink: 0 }}>Editar</span>
            </div>
          ) : (
            <button onClick={() => setMostrarModalEndereco(true)} style={{ width: "100%", padding: "16px", background: "var(--bg2)", border: "2px dashed var(--border)", borderRadius: "var(--radius)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "'Outfit',sans-serif" }}>
              <span style={{ fontSize: "1.3rem" }}>📍</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 700, fontSize: "0.88rem" }}>Informar endereço de entrega</div>
                <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 2 }}>Toque para abrir o mapa interativo</div>
              </div>
            </button>
          )}
        </div>
      )}

      {/* Modal de endereço com mapa */}
      {mostrarModalEndereco && (
        <EnderecoModal
          enderecoInicial={{ rua: rua.split(",")[0]?.trim() || "", numero: rua.split(",")[1]?.trim() || "", bairro, complemento, referencia, cidade }}
          onClose={() => setMostrarModalEndereco(false)}
          onConfirmar={(end) => {
            setRua(end.rua);
            setBairro(end.bairro || "");
            setComplemento(end.complemento || "");
            setReferencia(end.referencia || "");
            setCidade(end.cidade || "");
            if (end.coords) setCoords(end.coords);
            setMostrarModalEndereco(false);
          }}
        />
      )}

      {/* Dados pessoais */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div className="section-label" style={{ marginBottom: 0 }}>👤 Seus dados</div>
          {!user && (
            <button onClick={() => navigate("/login")} style={{ fontSize: "0.72rem", color: "var(--purple2)", background: "none", border: "none", cursor: "pointer", fontFamily: "'Outfit',sans-serif", fontWeight: 600 }}>
              Fazer login →
            </button>
          )}
        </div>
        {!user && (
          <div style={{ fontSize: "0.72rem", color: "var(--text3)", background: "rgba(245,197,24,0.06)", border: "1px solid rgba(245,197,24,0.15)", borderRadius: 8, padding: "6px 10px", marginBottom: 10 }}>
            💡 Faça login para salvar seu endereço e acumular pontos!
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input className="form-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome *" />
          <input className="form-input" value={telefone} onChange={e => setTelefone(e.target.value)} placeholder="WhatsApp *" />
        </div>
      </div>

      {/* Cupom */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 10 }}>🏷️ Cupom de desconto</div>
        {cupomAplicado ? (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 8, padding: "10px 12px" }}>
            <span style={{ color: "var(--green)", fontWeight: 700 }}>✅ {cupomAplicado.codigo} aplicado! -R${descCupom.toFixed(2).replace(".",",")}</span>
            <button onClick={() => { setCupomAplicado(null); setCupomCodigo(""); }} style={{ background: "none", border: "none", color: "var(--red)", cursor: "pointer" }}>✕</button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <input className="form-input" style={{ flex: 1 }} value={cupomCodigo} onChange={e => setCupomCodigo(e.target.value.toUpperCase())} placeholder="Código do cupom" />
            <button onClick={aplicarCupom} style={{ padding: "0 16px", background: "var(--gold)", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: "'Outfit', sans-serif", fontWeight: 700, color: "var(--bg)" }}>Aplicar</button>
          </div>
        )}
      </div>

      {/* RECOMPENSAS */}
      {(() => {
        const modo = config.modoFidelidade || "pontos";
        if (modo === "nenhum") return null;
        const temPontos = (modo === "pontos" || modo === "ambos");
        const temCashback = (modo === "cashback" || modo === "ambos");
        if (!temPontos && !temCashback) return null;
        return (
          <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>🎁 Recompensas</div>
            {temPontos && pontos >= 0 && (
              <div style={{ marginBottom: temCashback ? 12 : 0 }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>⭐ <strong style={{ color: "var(--gold)" }}>{pontos} pontos</strong> disponíveis</span>
                  <span style={{ color: "var(--gold)" }}>= R$ {maxPontos.toFixed(2).replace(".",",")} off</span>
                </div>
                <div onClick={() => setUsarPontos(p => !p)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, cursor: "pointer", background: usarPontos ? "rgba(245,197,24,0.12)" : "var(--bg3)", border: `2px solid ${usarPontos ? "var(--gold)" : "var(--border)"}`, transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.2rem" }}>🏷️</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: usarPontos ? "var(--gold)" : "var(--text)" }}>{usarPontos ? "Pontos aplicados ✓" : "Usar pontos agora"}</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>{usarPontos ? `Desconto de R$ ${maxPontos.toFixed(2).replace(".",",")} aplicado` : "Toque para aplicar desconto"}</div>
                    </div>
                  </div>
                  <div style={{ width: 44, height: 24, borderRadius: 12, background: usarPontos ? "var(--gold)" : "var(--bg3)", border: `2px solid ${usarPontos ? "var(--gold)" : "var(--border)"}`, position: "relative", transition: "all 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: usarPontos ? 22 : 2, width: 16, height: 16, borderRadius: "50%", background: usarPontos ? "var(--bg)" : "var(--text3)", transition: "left 0.2s" }} />
                  </div>
                </div>
              </div>
            )}
            {temCashback && (
              <div>
                {temPontos && <div style={{ height: 1, background: "var(--border)", margin: "0 0 12px" }} />}
                <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>💰 <strong style={{ color: "#60a5fa" }}>R$ {cashbackDisp.toFixed(2).replace(".",",")} cashback</strong> disponível</span>
                  <span style={{ color: "#60a5fa" }}>máx. R$ {cashbackMaxUso.toFixed(2).replace(".",",")} off</span>
                </div>
                <div onClick={() => setUsarCashback(p => !p)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderRadius: 10, cursor: "pointer", background: usarCashback ? "rgba(96,165,250,0.12)" : "var(--bg3)", border: `2px solid ${usarCashback ? "#60a5fa" : "var(--border)"}`, transition: "all 0.2s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.2rem" }}>💳</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.85rem", color: usarCashback ? "#60a5fa" : "var(--text)" }}>{usarCashback ? "Cashback aplicado ✓" : "Usar cashback agora"}</div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>{usarCashback ? `Desconto de R$ ${cashbackMaxUso.toFixed(2).replace(".",",")} aplicado` : "Toque para usar seu saldo"}</div>
                    </div>
                  </div>
                  <div style={{ width: 44, height: 24, borderRadius: 12, background: usarCashback ? "#60a5fa" : "var(--bg3)", border: `2px solid ${usarCashback ? "#60a5fa" : "var(--border)"}`, position: "relative", transition: "all 0.2s", flexShrink: 0 }}>
                    <div style={{ position: "absolute", top: 2, left: usarCashback ? 22 : 2, width: 16, height: 16, borderRadius: "50%", background: usarCashback ? "var(--bg)" : "var(--text3)", transition: "left 0.2s" }} />
                  </div>
                </div>
              </div>
            )}
            <div style={{ marginTop: 10, background: "var(--bg3)", borderRadius: 8, padding: "8px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
              {(modo === "pontos" || modo === "ambos") && <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>⭐ Este pedido gera <strong style={{ color: "var(--gold)" }}>{Math.floor(total * (config.pontosPorReal || 1))} pontos</strong></span>}
              {(modo === "cashback" || modo === "ambos") && <span style={{ fontSize: "0.7rem", color: "var(--text3)" }}>💰 Este pedido gera <strong style={{ color: "#60a5fa" }}>R$ {(total * (config.cashbackPercent || 5) / 100).toFixed(2).replace(".",",")} cashback</strong></span>}
            </div>
          </div>
        );
      })()}

      {/* Pagamento */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>💳 Forma de pagamento</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { id: "pix", icon: "📱", label: "PIX", desc: "Desconto imediato" },
            { id: "cartao_online", icon: "💳", label: "Cartão Online", desc: "Crédito/Débito via Mercado Pago" },
            { id: "dinheiro", icon: "💵", label: "Dinheiro", desc: "Pague na entrega" },
            { id: "cartao", icon: "🏧", label: "Cartão na entrega", desc: "Débito ou crédito" },
          ].map(p => (
            <div key={p.id} onClick={() => setPagamento(p.id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: pagamento === p.id ? "rgba(245,197,24,0.08)" : "var(--bg3)", border: `1px solid ${pagamento === p.id ? "rgba(245,197,24,0.4)" : "var(--border)"}`, borderRadius: 10, cursor: "pointer", transition: "all 0.2s" }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${pagamento === p.id ? "var(--gold)" : "var(--border)"}`, background: pagamento === p.id ? "var(--gold)" : "transparent", flexShrink: 0, transition: "all 0.2s" }} />
              <span style={{ fontSize: "1.1rem" }}>{p.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.88rem" }}>{p.label}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--text3)" }}>{p.desc}</div>
              </div>
              {pagamento === p.id && <span style={{ color: "var(--gold)", fontSize: "0.8rem" }}>✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Resumo de valores */}
      <div style={{ background: "linear-gradient(135deg, var(--bg3), var(--bg2))", border: "1px solid var(--border2)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
        <div className="section-label" style={{ marginBottom: 12 }}>💰 Resumo</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: "0.85rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "var(--text2)" }}>Subtotal ({items.length} {items.length === 1 ? "item" : "itens"})</span>
            <span>R$ {total.toFixed(2).replace(".", ",")}</span>
          </div>
          {tipoEntrega === "entrega" && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "var(--text2)" }}>🚚 Taxa de entrega</span>
              <span style={{ color: freteGratis ? "var(--green)" : "inherit" }}>{freteGratis ? "Grátis 🎉" : FRETE > 0 ? `R$ ${FRETE.toFixed(2).replace(".",",")}` : "A combinar"}</span>
            </div>
          )}
          {descCupom > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--green)" }}><span>🏷️ Cupom {cupomAplicado.codigo}</span><span>-R$ {descCupom.toFixed(2).replace(".", ",")}</span></div>}
          {descPontos > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "var(--green)" }}><span>⭐ Desconto pontos</span><span>-R$ {descPontos.toFixed(2).replace(".", ",")}</span></div>}
          {descCashback > 0 && <div style={{ display: "flex", justifyContent: "space-between", color: "#60a5fa" }}><span>💰 Cashback usado</span><span>-R$ {descCashback.toFixed(2).replace(".", ",")}</span></div>}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>TOTAL</span>
            <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.4rem", fontWeight: 900, color: "var(--gold)" }}>R$ {totalFinal.toFixed(2).replace(".", ",")}</span>
          </div>
        </div>
      </div>

      {/* Confirmação do cliente */}
      <div style={{ background: "var(--bg2)", border: `1px solid ${confirmouItens ? "rgba(34,197,94,0.4)" : "var(--border)"}`, borderRadius: "var(--radius)", padding: 16, marginBottom: 16, transition: "border-color 0.2s" }}>
        <div onClick={() => setConfirmouItens(p => !p)} style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, flexShrink: 0, background: confirmouItens ? "var(--green)" : "var(--bg3)", border: `2px solid ${confirmouItens ? "var(--green)" : "var(--border)"}`, display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", fontSize: "0.9rem" }}>
            {confirmouItens ? "✓" : ""}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "0.85rem", color: confirmouItens ? "var(--green)" : "var(--text)" }}>
              ☑️ Confirmo que conferi todos os itens do pedido
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 2 }}>
              Necessário para finalizar — protege você e o lojista
            </div>
          </div>
        </div>
      </div>

      {/* Botão finalizar fixo */}
      <div style={{ position: "fixed", bottom: 60, left: 0, right: 0, padding: "10px 16px 12px", background: "rgba(10,4,20,0.95)", backdropFilter: "blur(10px)", borderTop: "1px solid var(--border)", zIndex: 50 }}>
        <button onClick={handleFinalizar} disabled={loading || loadingChat || items.length === 0} style={{
          width: "100%", padding: "15px",
          background: items.length === 0 ? "var(--bg3)" : "var(--loja-cor-primaria)",
          border: "none", borderRadius: 14,
          color: items.length === 0 ? "var(--text3)" : "var(--loja-btn-texto, #fff)",
          fontFamily: "'Outfit', sans-serif", fontWeight: 800, fontSize: "1rem",
          cursor: items.length === 0 ? "not-allowed" : "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        }}>
          <span>{loading ? "⏳ Processando..." : pagamento === "pix" ? "📱 Confirmar e gerar PIX" : pagamento === "cartao_online" ? "💳 Pagar com Cartão (Stripe)" : "💬 Enviar pelo WhatsApp"}</span>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem" }}>R$ {totalFinal.toFixed(2).replace(".", ",")}</span>
        </button>
        {user && pagamento !== "pix" && pagamento !== "cartao_online" && (
          <>
            <div style={{ textAlign: "center", fontSize: "0.6rem", color: "var(--text3)", margin: "5px 0 4px" }}>— ou sem WhatsApp —</div>
            <button onClick={handlePedirPeloChat} disabled={loading || loadingChat || items.length === 0} style={{
              width: "100%", padding: "12px",
              background: "rgba(6,182,212,0.1)",
              border: "1px solid rgba(6,182,212,0.35)",
              borderRadius: 14,
              color: "#22d3ee",
              fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.9rem",
              cursor: items.length === 0 ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}>
              {loadingChat ? "⏳ Criando pedido..." : "💬 Pedir pelo Chat da NexFoody"}
            </button>
          </>
        )}
      </div>

      {/* ===== COMPARTILHAR COM AFETO ===== */}
      {config.mostrarCompartilhar !== false && (() => {
        const DESTINATARIOS = [
          { id: "amor",  emoji: "❤️", label: "Amor",     msg: "Amor, pedi nosso jantar! Já vem chegando 😍" },
          { id: "filho", emoji: "🧸", label: "Filho(a)", msg: "Surpresa! Pedi seu lanche favorito 🎉" },
          { id: "amigo", emoji: "🍕", label: "Amigo(a)", msg: "Ei! Pedi comida, vem comer comigo? 😄" },
          { id: "outro", emoji: "🎁", label: "Alguém",   msg: "Olha o que pedi! Vem ver... 🛵" },
        ];
        return (
          <div style={{ background: "linear-gradient(135deg, rgba(90,45,145,0.3), rgba(59,26,110,0.3))", border: "1px solid rgba(245,197,24,0.2)", borderRadius: "var(--radius)", padding: 16, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: "1.3rem" }}>✨</span>
              <div>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.1rem", fontWeight: 700, textAlign: "center", marginBottom: 4 }}>{config.nomeLoja || "Açaí Puro Gosto"}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text2)", textAlign: "center", lineHeight: 1.5 }}>Compartilhe com quem você ama e volte para finalizar o seu pedido 💌</div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {DESTINATARIOS.map(dest => (
                <button key={dest.id} onClick={() => setAfetoSelecionado(afetoSelecionado?.id === dest.id ? null : dest)} style={{ padding: "10px 8px", background: afetoSelecionado?.id === dest.id ? "rgba(245,197,24,0.15)" : "rgba(255,255,255,0.05)", border: `1px solid ${afetoSelecionado?.id === dest.id ? "rgba(245,197,24,0.5)" : "rgba(255,255,255,0.1)"}`, borderRadius: 12, cursor: "pointer", fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: 8, transition: "all 0.2s" }}>
                  <span style={{ fontSize: "1.3rem" }}>{dest.emoji}</span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600, color: afetoSelecionado?.id === dest.id ? "var(--gold)" : "var(--text)" }}>{dest.label}</span>
                </button>
              ))}
            </div>
            {afetoSelecionado && (
              <div style={{ animation: "fadeIn 0.2s ease" }}>
                <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
                <div style={{ fontSize: "0.75rem", color: "var(--text2)", marginBottom: 6 }}>💌 Mensagem para <strong style={{ color: "var(--gold)" }}>{afetoSelecionado.label}</strong></div>
                <textarea value={afetoMsg} onChange={e => setAfetoMsg(e.target.value)} rows={2} placeholder="Adicione um toque pessoal..." style={{ width: "100%", padding: "10px 12px", marginBottom: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 10, color: "var(--text)", fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", resize: "none", boxSizing: "border-box" }} />
                <button onClick={() => {
                  const nomeLoja = config.nomeLoja || "Açaí Puro Gosto";
                  const itens = items.map(i => `• ${i.qty}x ${i.nome}`).join("\n");
                  const extra = afetoMsg.trim() ? `\n\n💬 "${afetoMsg.trim()}"` : "";
                  const txt = `${afetoSelecionado.msg}${extra}\n\n🛵 *${nomeLoja}*\n${itens}\n\n📲 Peça também: https://acaipurogosto.com.br\n_via CardápioZap • cardapiozap.com.br_`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
                  setAfetoCompartilhado(true);
                  setAfetoSelecionado(null);
                  setAfetoMsg("");
                }} style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg, #25d366, #128c7e)", border: "none", borderRadius: 12, color: "#fff", fontFamily: "'Outfit', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Compartilhar pelo WhatsApp 📲
                </button>
              </div>
            )}
            {afetoCompartilhado && (
              <div style={{ marginTop: 10, padding: "10px 14px", background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.1rem" }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "var(--green)" }}>Compartilhado com afeto!</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text2)" }}>Agora finalize seu pedido abaixo 👇</div>
                </div>
              </div>
            )}
            {!afetoCompartilhado && <div style={{ fontSize: "0.65rem", color: "var(--text3)", textAlign: "center", marginTop: 10 }}>💡 Compartilhe antes de finalizar — crie o compromisso!</div>}
          </div>
        );
      })()}

      {/* Modal editar produto */}
      {editandoItem && (
        <ModalProduto
          produto={editandoItem.produto}
          onClose={() => setEditandoItem(null)}
          complementosIniciais={editandoItem.complementos}
          isAberto={config.cardapioAtivo}
          onAddWithComplementos={(produto, complementos) => {
            if (editandoItem.itemId) removeFromExtras(editandoItem.itemId);
            addToCart(produto.id, 1);
            updateCartComplementos(produto.id, complementos);
            setEditandoItem(null);
          }}
        />
      )}

      {/* Modal pós-pedido */}
      {mostrarPosPedido && dadosPosPedido && (
        <ModalPosPedido
          dados={dadosPosPedido}
          favoritos={favoritos}
          user={user}
          onClose={() => setMostrarPosPedido(false)}
          onSalvarEndereco={salvarEndereco}
          onSalvarTelefone={salvarTelefone}
          navigate={navigate}
        />
      )}

      {/* Comprovante */}
      {pedidoFinalizado && (
        <Comprovante
          pedido={pedidoFinalizado}
          onClose={() => { setPedidoFinalizado(null); }}
        />
      )}

      {/* Canal de acompanhamento após pedido pelo chat */}
      {chatPedidoSalvo && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, padding: "20px",
        }}>
          <div style={{
            background: "#fff", borderRadius: "20px", padding: "32px 24px",
            maxWidth: "380px", width: "100%", textAlign: "center",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>✅</div>
            <h2 style={{ margin: "0 0 6px", fontSize: "20px", fontWeight: 700 }}>
              Pedido #{chatPedidoSalvo.numPedido} enviado!
            </h2>
            <p style={{ margin: "0 0 24px", color: "#666", fontSize: "14px" }}>
              Como você quer acompanhar seu pedido?
            </p>

            <button
              onClick={() => { navigate(`/chat/${chatPedidoSalvo.chatId}`); setChatPedidoSalvo(null); }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                width: "100%", padding: "14px", marginBottom: "12px",
                background: "var(--primaria, #6c3fb5)", color: "#fff",
                border: "none", borderRadius: "12px", fontSize: "16px",
                fontWeight: 600, cursor: "pointer",
              }}
            >
              💬 Chat Inteligente
            </button>

            <button
              onClick={() => {
                const msg = `Olá! Fiz o pedido #${chatPedidoSalvo.numPedido} no valor de R$${chatPedidoSalvo.total.toFixed(2).replace(".", ",")}. Pode confirmar?`;
                window.open(`https://wa.me/${chatPedidoSalvo.whatsappNum}?text=${encodeURIComponent(msg)}`, "_blank");
                setChatPedidoSalvo(null);
              }}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
                width: "100%", padding: "14px",
                background: "#25D366", color: "#fff",
                border: "none", borderRadius: "12px", fontSize: "16px",
                fontWeight: 600, cursor: "pointer",
              }}
            >
              📱 WhatsApp
            </button>

            <button
              onClick={() => setChatPedidoSalvo(null)}
              style={{
                marginTop: "16px", background: "none", border: "none",
                color: "#999", fontSize: "13px", cursor: "pointer",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

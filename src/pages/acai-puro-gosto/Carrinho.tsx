import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useStore } from "../../contexts/StoreContext";
import { useAuth } from "../../contexts/AuthContext";
import { useTenant } from "../../contexts/TenantContext";
import {
  doc, addDoc, setDoc, getDoc, updateDoc, collection, serverTimestamp, increment,
} from "firebase/firestore";
import { db } from "../../lib/firebase";

interface PedidoSalvo {
  pedidoId: string;
  items: { qty: number; produtoNome: string; precoTotal: number }[];
  totalGeral: number;
  whatsappMsg: string;
}

export default function Carrinho() {
  const { config, produtos, cartItems, removeFromCart, clearCart, cartTotal, cartCount, addToCart } = useStore();
  const { user, userData } = useAuth();
  const { tenantId, tenantConfig } = useTenant();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [observacao, setObservacao] = useState("");
  const [endereco, setEndereco] = useState((userData as any)?.endereco?.rua || "");
  const [pedidoSalvo, setPedidoSalvo] = useState<PedidoSalvo | null>(null);
  const [loadingChat, setLoadingChat] = useState(false);

  if (cartCount() === 0) {
    return (
      <div className="page">
        <div style={{ textAlign: "center", padding: "48px 16px" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🛒</div>
          <h2 style={{ color: "var(--text)", marginBottom: 8, fontFamily: "'Fraunces', serif" }}>
            Carrinho vazio
          </h2>
          <p style={{ color: "var(--text2)", fontSize: "0.85rem", marginBottom: 24 }}>
            Adicione itens do cardápio para fazer seu pedido
          </p>
          <Link
            to=""
            onClick={() => navigate(-1)}
            className="btn btn-gold"
            style={{ display: "inline-flex", textDecoration: "none" }}
          >
            Ver cardápio →
          </Link>
        </div>
      </div>
    );
  }

  const total = cartTotal();
  const taxa = Number(config?.taxaEntrega) || 0;
  const totalGeral = total + taxa;
  const formatPreco = (preco: unknown) => Number(preco).toFixed(2).replace(".", ",");

  // ── 1. Salva o pedido e exibe modal de escolha ──────────────
  const handleFinalizar = async () => {
    if (!user?.uid) { alert("Faça login para finalizar o pedido!"); return; }

    setLoading(true);
    try {
      const items = produtos
        .filter(p => cartItems[p.id])
        .map(p => ({
          produtoId: p.id,
          produtoNome: p.nome,
          qty: cartItems[p.id],
          precoUnit: Number(p.preco),
          precoTotal: Number(p.preco) * cartItems[p.id],
          foto: (p as any).foto || null,
        }));

      const pedido = {
        userId: user.uid,
        userNome: user.displayName || user.email?.split("@")[0] || "Cliente",
        telefone: (userData as any)?.telefone || "",
        items,
        observacao,
        endereco,
        subtotal: total,
        taxaEntrega: taxa,
        total: totalGeral,
        status: "pendente",
        createdAt: serverTimestamp(),
        tenantId,
        lojaNome: tenantConfig?.nomeLoja || "",
        whatsappLoja: tenantConfig?.whatsapp || "",
      };

      const pedidoRef = await addDoc(collection(db, "pedidos"), pedido);
      await addDoc(collection(db, `tenants/${tenantId}/pedidos`), {
        ...pedido,
        pedidoId: pedidoRef.id,
      });

      const whatsappMsg = encodeURIComponent(
        `🍓 *PEDIDO*\n\n` +
        items.map(i => `${i.qty}x ${i.produtoNome} — R$ ${formatPreco(i.precoTotal)}`).join("\n") +
        `\n\n💰 Total: R$ ${formatPreco(totalGeral)}` +
        `\n📍 Endereço: ${endereco || "Não informado"}` +
        `\n📝 Obs: ${observacao || "Nenhuma"}`
      );

      clearCart();
      setPedidoSalvo({ pedidoId: pedidoRef.id, items, totalGeral, whatsappMsg });
    } catch (e) {
      console.error("Erro ao finalizar pedido:", e);
      alert("Erro ao criar pedido. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // ── 2a. Cliente escolheu WhatsApp ───────────────────────────
  const handleIrWhatsApp = () => {
    if (!pedidoSalvo) return;
    const num = (tenantConfig?.whatsapp as string | undefined)?.replace(/\D/g, "") || "";
    window.open(`https://wa.me/${num}?text=${pedidoSalvo.whatsappMsg}`, "_blank");
    setPedidoSalvo(null);
  };

  // ── 2b. Cliente escolheu Chat ───────────────────────────────
  const handleIrChat = async () => {
    if (!pedidoSalvo || !user?.uid) return;
    setLoadingChat(true);
    try {
      const lojaSlug = tenantId || (tenantConfig as any)?.slug || "";
      const lojaVirtualId = `loja_${lojaSlug}`;
      const chatId = [user.uid, lojaVirtualId].sort().join("__");

      const pedidoInfo = {
        numeroPedido: pedidoSalvo.pedidoId.slice(-6).toUpperCase(),
        itens: pedidoSalvo.items.map(i => ({ qty: i.qty, nome: i.produtoNome, preco: i.precoTotal })),
        total: pedidoSalvo.totalGeral,
        tipoEntrega: "entrega",
        endereco: endereco || "Não informado",
      };

      // Atualiza pedido com canal=chat
      await updateDoc(doc(db, "pedidos", pedidoSalvo.pedidoId), {
        canal: "chat",
        chatId,
        status: "aguardando_confirmacao",
      });

      // Cria ou atualiza o chat
      const chatRef = doc(db, "chats", chatId);
      const chatSnap = await getDoc(chatRef);

      if (!chatSnap.exists()) {
        await setDoc(chatRef, {
          tipo: "loja",
          participantes: [user.uid, lojaVirtualId],
          participantesInfo: {
            [user.uid]: {
              nome: user.displayName || user.email?.split("@")[0] || "Cliente",
              foto: user.photoURL || null,
            },
            [lojaVirtualId]: {
              nome: (tenantConfig as any)?.nomeLoja || "Loja",
              foto: (tenantConfig as any)?.logoUrl || null,
              isLoja: true,
              lojaSlug,
            },
          },
          lojaId: lojaSlug,
          lojaSlug,
          bloqueado: true,
          pedidoId: pedidoSalvo.pedidoId,
          pedidoInfo,
          ultimaMensagem: {
            texto: `🛒 Novo pedido`,
            criadoEm: serverTimestamp(),
            autorId: user.uid,
          },
          naoLido: { [user.uid]: 0, [lojaVirtualId]: 1 },
          digitando: {},
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(chatRef, {
          bloqueado: true,
          pedidoId: pedidoSalvo.pedidoId,
          pedidoInfo,
          ultimaMensagem: {
            texto: `🛒 Novo pedido`,
            criadoEm: serverTimestamp(),
            autorId: user.uid,
          },
          [`naoLido.${lojaVirtualId}`]: increment(1),
          updatedAt: serverTimestamp(),
        });
      }

      navigate(`/chat/${chatId}`);
    } catch (e) {
      console.error("Erro ao abrir chat:", e);
      alert("Erro ao abrir o chat. Tente novamente.");
    } finally {
      setLoadingChat(false);
    }
  };

  // ── Modal: escolha de canal ─────────────────────────────────
  if (pedidoSalvo) {
    return (
      <div className="page">
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "40px 20px", textAlign: "center",
        }}>
          {/* Check de sucesso */}
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(52,211,153,0.12)", border: "2px solid rgba(52,211,153,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "2rem", marginBottom: 16,
          }}>✅</div>

          <h2 style={{
            fontFamily: "'Fraunces', serif", fontSize: "1.3rem",
            color: "var(--text)", marginBottom: 6,
          }}>
            Pedido confirmado!
          </h2>
          <p style={{ fontSize: "0.82rem", color: "var(--text2)", marginBottom: 32, lineHeight: 1.6, maxWidth: 280 }}>
            Seu pedido foi registrado. Como quer acompanhar?
          </p>

          {/* Opção WhatsApp */}
          <button
            onClick={handleIrWhatsApp}
            style={{
              width: "100%", maxWidth: 340, padding: "18px 20px",
              background: "linear-gradient(135deg, #25d366, #128c7e)",
              border: "none", borderRadius: 16, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 14,
              marginBottom: 12, textAlign: "left",
            }}
          >
            <span style={{ fontSize: "2rem", flexShrink: 0 }}>📱</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
                Pelo WhatsApp
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                Receba atualizações no seu WhatsApp
              </div>
            </div>
          </button>

          {/* Opção Chat */}
          <button
            onClick={handleIrChat}
            disabled={loadingChat}
            style={{
              width: "100%", maxWidth: 340, padding: "18px 20px",
              background: "linear-gradient(135deg, var(--purple2, #a78bfa), #6d28d9)",
              border: "none", borderRadius: 16, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 14,
              marginBottom: 24, textAlign: "left",
              opacity: loadingChat ? 0.7 : 1,
            }}
          >
            <span style={{ fontSize: "2rem", flexShrink: 0 }}>💬</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#fff", fontFamily: "'Outfit', sans-serif" }}>
                {loadingChat ? "Abrindo chat..." : "Pelo Chat Inteligente"}
              </div>
              <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.8)", marginTop: 2 }}>
                Acompanhe, tire dúvidas e fale com a loja
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate("/")}
            style={{
              background: "none", border: "none", color: "var(--text3)",
              fontSize: "0.78rem", cursor: "pointer", textDecoration: "underline",
            }}
          >
            Voltar ao início
          </button>
        </div>
      </div>
    );
  }

  // ── Tela principal do carrinho ──────────────────────────────
  return (
    <div className="page">
      <h1 className="display-title" style={{ fontSize: "1.4rem", marginBottom: 16 }}>
        Seu Pedido
      </h1>

      {/* Items */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
        {produtos.filter(p => cartItems[p.id]).map(produto => {
          const qty = cartItems[produto.id];
          const subtotal = Number(produto.preco) * qty;
          return (
            <div key={produto.id} style={{
              background: "var(--bg2)", border: "1px solid var(--border)",
              borderRadius: "var(--radius)", padding: "12px",
              display: "flex", gap: 10,
            }}>
              {(produto as any).foto ? (
                <img
                  src={(produto as any).foto}
                  alt={produto.nome}
                  style={{ width: 54, height: 54, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: 54, height: 54, borderRadius: 8, background: "var(--surface)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.4rem", flexShrink: 0,
                }}>
                  {(produto as any).emoji || "🍓"}
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text)" }}>{produto.nome}</div>
                <div style={{ fontSize: "0.78rem", color: "var(--text2)" }}>R$ {formatPreco(produto.preco)} cada</div>
                <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "var(--gold)", marginTop: 2 }}>
                  R$ {formatPreco(subtotal)}
                </div>
              </div>
              <div className="qty-control">
                <button onClick={() => removeFromCart(produto.id)} className="qty-btn" style={{ background: "var(--red)", color: "#fff" }}>−</button>
                <span className="qty-num" style={{ color: "var(--gold)", fontWeight: 700 }}>{qty}</span>
                <button onClick={() => addToCart(produto.id, 1)} className="qty-btn">+</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Endereço */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: "0.75rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>
          📍 Endereço de entrega
        </label>
        <input
          value={endereco}
          onChange={e => setEndereco(e.target.value)}
          placeholder="Rua, número, bairro..."
          style={{
            width: "100%", padding: "10px 12px",
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", color: "var(--text)",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem", outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Observação */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ fontSize: "0.75rem", color: "var(--text3)", display: "block", marginBottom: 4 }}>
          📝 Observação
        </label>
        <textarea
          value={observacao}
          onChange={e => setObservacao(e.target.value)}
          placeholder="Ex: sem açúcar, complemento extra..."
          rows={2}
          style={{
            width: "100%", padding: "10px 12px",
            background: "var(--bg2)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)", color: "var(--text)",
            fontFamily: "'Outfit', sans-serif", fontSize: "0.85rem",
            resize: "none", outline: "none",
          }}
        />
      </div>

      {/* Totais */}
      <div style={{
        background: "linear-gradient(135deg, var(--bg3) 0%, var(--bg2) 100%)",
        border: "1px solid var(--border)", borderRadius: "var(--radius)",
        padding: "16px", marginBottom: 20,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "var(--text2)", fontSize: "0.85rem" }}>Subtotal</span>
          <span style={{ color: "var(--text)", fontSize: "0.85rem" }}>R$ {formatPreco(total)}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ color: "var(--text2)", fontSize: "0.85rem" }}>Taxa de entrega</span>
          <span style={{ color: "var(--text)", fontSize: "0.85rem" }}>R$ {formatPreco(taxa)}</span>
        </div>
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontWeight: 700, color: "var(--text)" }}>Total</span>
            <span style={{ fontWeight: 800, color: "var(--gold)", fontSize: "1.1rem", fontFamily: "'Fraunces', serif" }}>
              R$ {formatPreco(totalGeral)}
            </span>
          </div>
        </div>
      </div>

      {/* CTA */}
      <button
        onClick={handleFinalizar}
        disabled={loading}
        className="btn btn-primary btn-full"
        style={{ fontSize: "1rem", padding: "14px 20px" }}
      >
        {loading ? "Salvando pedido..." : "Finalizar pedido →"}
      </button>
    </div>
  );
}

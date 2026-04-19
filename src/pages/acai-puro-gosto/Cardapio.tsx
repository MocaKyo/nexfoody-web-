import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useStore } from "../../contexts/StoreContext";
import type { Produto } from "../../types/tenant";
import { useAuth } from "../../contexts/AuthContext";
import { useTenant } from "../../contexts/TenantContext";

export default function Cardapio() {
  const { config, produtos, addToCart, cartCount, cartItems, removeFromCart, isAdmin } = useStore();
  const { user, userData } = useAuth();
  const { tenantId } = useTenant();
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState("todos");
  const [categorias, setCategorias] = useState(["todos"]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (produtos.length > 0) {
      setLoading(false);
      const cats = [...new Set(produtos.map(p => p.categoria || "sem categoria"))];
      setCategorias(["todos", ...cats]);
    }
  }, [produtos]);

  const filtrados = produtos.filter(p => {
    const matchBusca = p.nome?.toLowerCase().includes(busca.toLowerCase());
    const matchCat = categoriaAtiva === "todos" || p.categoria === categoriaAtiva;
    return matchBusca && matchCat;
  });

  const handleAdd = (produto: { id: string }) => {
    addToCart(produto.id, 1);
    setAdded(prev => ({ ...prev, [produto.id]: true }));
    setTimeout(() => setAdded(prev => ({ ...prev, [produto.id]: false })), 600);
  };

  const qtyNoCarrinho = (produtoId: string) => cartItems[produtoId] || 0;

  const formatPreco = (preco: unknown) => {
    return Number(preco).toFixed(2).replace(".", ",");
  };

  if (loading) {
    return (
      <div className="page">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: "16px",
              display: "flex",
              gap: 12,
              animation: "pulse 1.5s infinite",
            }}>
              <div style={{ width: 70, height: 70, borderRadius: 10, background: "var(--bg3)" }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 14, background: "var(--bg3)", borderRadius: 4, marginBottom: 8, width: "70%" }} />
                <div style={{ height: 10, background: "var(--bg3)", borderRadius: 4, marginBottom: 12, width: "50%" }} />
                <div style={{ height: 16, background: "var(--bg3)", borderRadius: 4, width: "30%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 className="display-title" style={{ fontSize: "1.5rem", marginBottom: 4 }}>
          {config?.nomeLoja || "Cardápio"}
        </h1>
        <div style={{ fontSize: "0.78rem", color: "var(--text3)" }}>
          {config?.horario || ""}
        </div>
      </div>

      {/* Search */}
      <div style={{ position: "relative", marginBottom: 12 }}>
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar..."
          style={{
            width: "100%",
            padding: "10px 14px",
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 20,
            color: "var(--text)",
            fontFamily: "'Outfit', sans-serif",
            fontSize: "0.88rem",
            outline: "none",
          }}
        />
      </div>

      {/* Category chips */}
      <div style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        paddingBottom: 8,
        marginBottom: 12,
        scrollbarWidth: "none",
      }}>
        {categorias.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoriaAtiva(cat)}
            style={{
              padding: "5px 14px",
              borderRadius: 20,
              border: "1px solid",
              borderColor: categoriaAtiva === cat ? "var(--gold)" : "var(--border)",
              background: categoriaAtiva === cat ? "var(--gold-dim)" : "transparent",
              color: categoriaAtiva === cat ? "var(--gold)" : "var(--text3)",
              fontSize: "0.75rem",
              fontWeight: 600,
              fontFamily: "'Outfit', sans-serif",
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {cat === "todos" ? "Todos" : cat}
          </button>
        ))}
      </div>

      {/* Products */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text3)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>🔍</div>
            <div>Nenhum produto encontrado</div>
          </div>
        ) : filtrados.map((produto, index) => {
          const qty = qtyNoCarrinho(produto.id);
          const isAddedAnim = added[produto.id];

          return (
            <div
              key={produto.id}
              className="product-card"
              style={{
                opacity: produto.ativo === false ? 0.4 : 1,
              }}
            >
              {produto.foto ? (
                <img
                  src={produto.foto}
                  alt={produto.nome}
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: 10,
                    objectFit: "cover",
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: 70,
                  height: 70,
                  borderRadius: 10,
                  background: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.8rem",
                  flexShrink: 0,
                }}>
                  {produto.emoji || "🍓"}
                </div>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="prod-name">{produto.nome}</div>
                {produto.desc && (
                  <div className="prod-desc">{produto.desc}</div>
                )}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                  <span className="prod-price">R$ {formatPreco(produto.preco)}</span>
                  {(produto.comentariosCount ?? 0) > 0 && (
                    <span style={{ fontSize: "0.65rem", color: "var(--text3)" }}>
                      💬 {produto.comentariosCount}
                    </span>
                  )}
                </div>
              </div>

              <div className="qty-control">
                {qty > 0 ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button
                      onClick={() => removeFromCart(produto.id)}
                      className="qty-btn"
                      style={{ background: "var(--red)", color: "#fff" }}
                    >−</button>
                    <span className="qty-num" style={{ color: "var(--gold)", fontWeight: 700 }}>{qty}</span>
                    <button onClick={() => addToCart(produto.id, 1)} className="qty-btn">+</button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAdd(produto)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: "50%",
                      background: isAddedAnim ? "var(--green)" : "linear-gradient(135deg, var(--gold), var(--gold2))",
                      border: "none",
                      color: "var(--bg)",
                      fontSize: "1.2rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "all 0.2s",
                      animation: isAddedAnim ? "pulseAdd 0.3s ease" : "none",
                    }}
                  >+</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart badge */}
      {cartCount() > 0 && (
        <div
          onClick={() => navigate("/carrinho")}
          style={{
            position: "fixed",
            bottom: 80,
            right: 16,
            background: "linear-gradient(135deg, var(--gold), var(--gold2))",
            borderRadius: 20,
            padding: "8px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 4px 16px rgba(245,197,24,0.4)",
            cursor: "pointer",
            zIndex: 50,
            animation: "pulseCTA 2s infinite",
          }}
        >
          <span style={{ fontSize: "1rem" }}>🛒</span>
          <span style={{ fontWeight: 800, color: "var(--bg)", fontSize: "0.9rem" }}>
            {cartCount()} {cartCount() === 1 ? "item" : "itens"}
          </span>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes pulseAdd {
          0% { transform: scale(1); }
          50% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes pulseCTA {
          0%, 100% { box-shadow: 0 4px 16px rgba(245,197,24,0.4); }
          50% { box-shadow: 0 4px 24px rgba(245,197,24,0.7); }
        }
      `}</style>
    </div>
  );
}
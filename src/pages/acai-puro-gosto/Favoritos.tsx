import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useStore } from "../../contexts/StoreContext";
import { useTenant } from "../../contexts/TenantContext";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

export default function Favoritos() {
  const { userData } = useAuth();
  const { produtos, addToCart, cartItems, removeFromCart } = useStore();
  const { tenantId } = useTenant();
  const [favoritos, setFavoritos] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!userData?.favoritos) return;
    const map: Record<string, boolean> = {};
    userData.favoritos.forEach((id: string) => { map[id] = true; });
    setFavoritos(map);
  }, [userData]);

  const favoritosProds = produtos.filter(p => favoritos[p.id]);

  const formatPreco = (preco: number) => Number(preco).toFixed(2).replace(".", ",");

  if (!userData) {
    return (
      <div className="page">
        <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>❤️</div>
          <div style={{ fontWeight: 700, color: "var(--gold)", marginBottom: 4 }}>Favoritos</div>
          <div style={{ fontSize: "0.8rem" }}>Faça login para ver seus favoritos</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="display-title" style={{ fontSize: "1.4rem", marginBottom: 16 }}>
        <span style={{ color: "var(--red)" }}>❤️</span> Favoritos
      </h1>

      {favoritosProds.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>💔</div>
          <div style={{ fontSize: "0.85rem" }}>Nenhum favorito ainda</div>
          <div style={{ fontSize: "0.75rem", marginTop: 4 }}>Toque no ♥ dos produtos para adicionar</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {favoritosProds.map(produto => {
            const qty = cartItems[produto.id] || 0;
            return (
              <div key={produto.id} className="product-card" style={{ opacity: produto.ativo === false ? 0.4 : 1 }}>
                {produto.foto ? (
                  <img src={produto.foto} alt={produto.nome} style={{ width: 70, height: 70, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 70, height: 70, borderRadius: 10, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", flexShrink: 0 }}>
                    {produto.emoji || "🍓"}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="prod-name">{produto.nome}</div>
                  {produto.desc && <div className="prod-desc">{produto.desc}</div>}
                  <span className="prod-price">R$ {formatPreco(produto.preco)}</span>
                </div>
                <div className="qty-control">
                  {qty > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => removeFromCart(produto.id)} className="qty-btn" style={{ background: "var(--red)", color: "#fff" }}>−</button>
                      <span className="qty-num" style={{ color: "var(--gold)", fontWeight: 700 }}>{qty}</span>
                      <button onClick={() => addToCart(produto.id, 1)} className="qty-btn">+</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(produto.id, 1)}
                      style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg, var(--gold), var(--gold2))", border: "none", color: "var(--bg)", fontSize: "1.2rem", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >+</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// src/pages/Favoritos.js
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";
import { useToast } from "../components/Toast";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Favoritos() {
  const { user } = useAuth();
  const { produtos } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const [favoritosIds, setFavoritosIds] = useState([]);

  useEffect(() => {
    if (!user?.uid) return;
    getDoc(doc(db, "users", user.uid)).then(snap => {
      if (snap.exists() && snap.data().favoritos) {
        setFavoritosIds(Object.keys(snap.data().favoritos));
      }
    });
  }, [user?.uid]);

  const favoritoProdutos = produtos.filter(p => favoritosIds.includes(p.id));

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", fontSize: "1.2rem", padding: 0 }}>←</button>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", fontWeight: 700, color: "var(--gold)", margin: 0 }}>❤️ Meus Favoritos</h1>
        </div>
        <p style={{ fontSize: "0.78rem", color: "var(--text3)", margin: 0 }}>Produtos que você salvou para pedir depois</p>
      </div>

      {favoritoProdutos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text3)" }}>
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>💔</div>
          <p style={{ fontSize: "0.88rem", marginBottom: 8 }}>Você ainda não favoritou nenhum produto</p>
          <p style={{ fontSize: "0.78rem" }}>Toque no ❤ dos produtos para adicioná-los aqui</p>
          <button onClick={() => navigate("/")} style={{ marginTop: 16, background: "linear-gradient(135deg, var(--purple2), var(--purple))", border: "none", borderRadius: 20, color: "#fff", padding: "10px 24px", fontFamily: "'Outfit', sans-serif", fontWeight: 600, cursor: "pointer" }}>
            Ver cardápio
          </button>
        </div>
      ) : (
        <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {favoritoProdutos.map(produto => (
            <div key={produto.id} onClick={() => navigate("/")} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 16, overflow: "hidden", cursor: "pointer" }}>
              <div style={{ position: "relative", paddingTop: "100%", background: "var(--bg3)" }}>
                {produto.foto ? (
                  <img src={produto.foto} alt={produto.nome} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "3rem" }}>{produto.emoji || "🫐"}</div>
                )}
                <div style={{ position: "absolute", top: 6, right: 6, width: 28, height: 28, background: "rgba(239,68,68,0.9)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>❤</div>
              </div>
              <div style={{ padding: "10px" }}>
                <div style={{ fontWeight: 700, fontSize: "0.85rem", marginBottom: 2 }}>{produto.nome}</div>
                <div style={{ fontSize: "0.75rem", color: "var(--gold)", fontFamily: "'Fraunces', serif" }}>R$ {produto.preco.toFixed(2).replace(".", ",")}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
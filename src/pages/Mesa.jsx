// src/pages/Mesa.js — página que abre ao escanear QR Code da mesa
import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function Mesa() {
  const { mesaId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (mesaId) {
      // Salvar mesa no localStorage
      localStorage.setItem("mesaAtual", mesaId);
    }
    // Redirecionar para o cardápio
    if (user) {
      navigate("/", { replace: true });
    } else {
      navigate("/welcome", { replace: true });
    }
  }, [mesaId, user, navigate]);

  return (
    <div style={{
      minHeight: "100vh", background: "#0f0518",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontFamily: "'Outfit', sans-serif", textAlign: "center",
    }}>
      <div>
        <div style={{ fontSize: "3rem", marginBottom: 12 }}>🪑</div>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", color: "#f5c518" }}>
          Mesa {mesaId}
        </div>
        <p style={{ color: "rgba(255,255,255,0.5)", marginTop: 8 }}>Abrindo cardápio...</p>
      </div>
    </div>
  );
}

// src/pages/Conta.js
import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useStore } from "../contexts/StoreContext";

export default function Conta() {
  const { user, userData, logout } = useAuth();
  const { config } = useStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="page">
      <h2 className="display-title mb-4">Minha <span>Conta</span></h2>

      {/* Perfil */}
      <div style={{
        background: "linear-gradient(135deg, var(--bg3), var(--bg2))",
        border: "1px solid var(--border2)", borderRadius: 20, padding: 20, marginBottom: 20,
        display: "flex", alignItems: "center", gap: 16
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--purple), var(--gold2))",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.5rem", flexShrink: 0
        }}>
          {(userData?.nome || "?")[0].toUpperCase()}
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{userData?.nome || user?.displayName}</div>
          <div style={{ fontSize: "0.8rem", color: "var(--text2)" }}>{user?.email}</div>
          {userData?.telefone && (
            <div style={{ fontSize: "0.8rem", color: "var(--text2)" }}>{userData.telefone}</div>
          )}
        </div>
      </div>
      <button onClick={() => navigate("/meu-perfil")} style={{ width: "100%", padding: "12px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--text2)", fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.88rem", cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
  👤 Ver e editar meu perfil
</button>
      {/* Resumo pontos */}
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: 16, marginBottom: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between"
      }}>
        <div>
          <div style={{ fontSize: "0.75rem", color: "var(--text3)", textTransform: "uppercase", letterSpacing: 1 }}>Meus pontos</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.8rem", color: "var(--gold)", fontWeight: 900 }}>
            {userData?.pontos || 0}
          </div>
        </div>
        <button className="btn btn-gold btn-sm" onClick={() => navigate("/pontos")}>
          🏆 Ver recompensas
        </button>
      </div>

      {/* Endereço e Horário */}
      <div className="section-label">📍 Informações da loja</div>
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: 16, marginBottom: 10
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.88rem" }}>🏠 Endereço de retirada</div>
        <div style={{ fontSize: "0.83rem", color: "var(--text2)", lineHeight: 1.6 }}>
          {config.endereco?.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}
        </div>
      </div>
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: "var(--radius)", padding: 16, marginBottom: 20
      }}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: "0.88rem" }}>🕐 Horário</div>
        <div style={{ fontSize: "0.83rem", color: "var(--text2)", lineHeight: 1.6 }}>
          {config.horario?.split("\n").map((l, i) => <span key={i}>{l}<br /></span>)}
        </div>
        {config.infoExtra && (
          <>
            <div style={{ height: 1, background: "var(--border)", margin: "10px 0" }} />
            <div style={{ fontSize: "0.83rem", color: "var(--text2)" }}>{config.infoExtra}</div>
          </>
        )}
      </div>

      <button className="btn btn-danger btn-full" onClick={handleLogout}>
        Sair da conta
      </button>
    </div>
  );
}

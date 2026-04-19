import { useAuth } from "../../contexts/AuthContext";
import { Link } from "react-router-dom";

export default function Conta() {
  const { userData, logout } = useAuth();

  if (!userData) {
    return (
      <div className="page">
        <div style={{ textAlign: "center", padding: "48px 16px" }}>
          <p style={{ color: "var(--text2)" }}>Faça login para ver sua conta</p>
          <Link to="/lojista/login" className="btn btn-gold" style={{ marginTop: 16, display: "inline-flex" }}>
            Entrar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "20px 16px",
        background: "linear-gradient(135deg, var(--bg3) 0%, var(--bg2) 100%)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        marginBottom: 20,
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.4rem",
          border: "2px solid var(--gold)",
        }}>
          {userData.photoURL ? (
            <img src={userData.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }} />
          ) : (
            userData.nome?.[0]?.toUpperCase() || "?"
          )}
        </div>
        <div>
          <div style={{ fontWeight: 700, color: "var(--text)", fontSize: "1rem" }}>{userData.nome}</div>
          <div style={{ fontSize: "0.78rem", color: "var(--text3)" }}>{userData.email}</div>
          <div style={{ fontSize: "0.72rem", color: "var(--gold)", marginTop: 2 }}>⭐ {userData.rankingPts} pts</div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Link to="/meu-perfil" className="btn btn-outline btn-full" style={{ justifyContent: "flex-start" }}>
          👤 Meu Perfil
        </Link>
        <Link to="/favoritos" className="btn btn-outline btn-full" style={{ justifyContent: "flex-start" }}>
          ❤️ Favoritos
        </Link>
        <Link to="/cupons" className="btn btn-outline btn-full" style={{ justifyContent: "flex-start" }}>
          🎟️ Meus Cupons
        </Link>
        <button
          onClick={logout}
          className="btn btn-danger btn-full"
          style={{ justifyContent: "center" }}
        >
          🚪 Sair
        </button>
      </div>
    </div>
  );
}
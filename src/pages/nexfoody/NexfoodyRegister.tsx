import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function NexfoodyRegister() {
  const { register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      navigate("/app");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro com login Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(nome, email, telefone, password);
      navigate("/app");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao criar conta";
      if (msg.includes("email-already-in-use")) {
        setError("Este email já está cadastrado");
      } else if (msg.includes("weak-password")) {
        setError("Senha deve ter pelo menos 6 caracteres");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#07030f", fontFamily: "'Outfit', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 24px" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Logo */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, borderRadius: 16, background: "linear-gradient(135deg,#f5c518,#e6a817)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", boxShadow: "0 8px 32px rgba(245,197,24,.4)" }}>
          🍓
        </div>
      </div>

      <h1 style={{ fontFamily: "'Fraunces',serif", fontWeight: 900, fontSize: "1.6rem", color: "#fff", marginBottom: 6, textAlign: "center" }}>
        Criar conta na <span style={{ color: "#f5c518" }}>NexFoody</span>
      </h1>
      <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,.45)", marginBottom: 32, textAlign: "center" }}>
        Cadastre-se gratuitamente e comece a pedir
      </p>

      <form style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 14 }} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Nome completo"
          value={nome}
          onChange={e => setNome(e.target.value)}
          required
          style={{ width: "100%", padding: "15px 16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, color: "#fff", fontSize: "0.95rem", fontFamily: "'Outfit', sans-serif", outline: "none", boxSizing: "border-box" }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{ width: "100%", padding: "15px 16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, color: "#fff", fontSize: "0.95rem", fontFamily: "'Outfit', sans-serif", outline: "none", boxSizing: "border-box" }}
        />
        <input
          type="tel"
          placeholder="Telefone (WhatsApp)"
          value={telefone}
          onChange={e => setTelefone(e.target.value)}
          required
          style={{ width: "100%", padding: "15px 16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, color: "#fff", fontSize: "0.95rem", fontFamily: "'Outfit', sans-serif", outline: "none", boxSizing: "border-box" }}
        />
        <input
          type="password"
          placeholder="Senha (mín. 6 caracteres)"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ width: "100%", padding: "15px 16px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, color: "#fff", fontSize: "0.95rem", fontFamily: "'Outfit', sans-serif", outline: "none", boxSizing: "border-box" }}
        />

        {error && (
          <div style={{ padding: "12px 14px", background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 12, color: "#ef4444", fontSize: "0.82rem" }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg,#f5c518,#e6a817)", border: "none", borderRadius: 14, fontWeight: 800, fontSize: "1rem", color: "#0a0414", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'Outfit', sans-serif" }}
        >
          {loading ? (
            <div style={{ width: 20, height: 20, border: "2px solid rgba(0,0,0,.3)", borderTop: "2px solid #0a0414", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          ) : "Criar conta grátis"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
          <span style={{ fontSize: "0.72rem", color: "rgba(255,255,255,.3)" }}>ou</span>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,.1)" }} />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 14, color: "#fff", fontSize: "0.95rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: "'Outfit', sans-serif" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {googleLoading ? "Cadastrando..." : "Cadastrar com Google"}
        </button>
      </form>

      <p style={{ marginTop: 28, fontSize: "0.82rem", color: "rgba(255,255,255,.4)" }}>
        Já tem conta?{" "}
        <Link to="/nexfoody/login" style={{ color: "#f5c518", fontWeight: 700, textDecoration: "none" }}>
          Fazer login
        </Link>
      </p>

      <p style={{ marginTop: 16, fontSize: "0.72rem", color: "rgba(255,255,255,.25)" }}>
        <Link to="/nexfoody/welcome" style={{ color: "rgba(255,255,255,.35)", textDecoration: "none" }}>
          ← Voltar
        </Link>
      </p>
    </div>
  );
}
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function LojistaLogin() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      navigate("/");
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
      await login(email, password);
      // After login, check role and redirect
      // For now, redirect to home - the AuthContext will update userData
      navigate("/");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro ao fazer login";
      if (msg.includes("user-not-found") || msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        setError("Email ou senha incorretos");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-logo">🏪</div>
      <h1 className="auth-title" style={{ color: "var(--gold)" }}>Entrar como Lojista</h1>
      <p className="auth-subtitle">Gerencie sua loja na Nexfoody</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <input
          type="email"
          className="input"
          placeholder="Email da sua loja"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="input"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />

        {error && (
          <div style={{
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--radius-sm)",
            color: "var(--red)",
            fontSize: "0.82rem",
          }}>{error}</div>
        )}

        <button
          type="submit"
          className="btn btn-gold btn-full"
          disabled={loading}
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>ou</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={googleLoading}
          className="btn btn-outline btn-full"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {googleLoading ? "Entrando..." : "Entrar com Google"}
        </button>
      </form>

      <p className="auth-footer">
        Não tem uma conta?{" "}
        <Link to="/lojista/cadastro">Criar loja</Link>
      </p>
    </div>
  );
}
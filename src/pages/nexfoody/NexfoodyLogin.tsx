import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const LOGO = "https://i.ibb.co/rGRxYVQY/ChatGPT-Image-12-de-abr-de-2025-s-19-35-37.png";

export default function NexfoodyLogin() {
  const { login, loginWithGoogle, register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from || "/app";

  const [mode, setMode] = useState<"options" | "email" | "register">("options");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => { setTimeout(() => setVisible(true), 60); }, []);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      navigate(from, { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro com Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg.includes("invalid-credential") || msg.includes("wrong-password") || msg.includes("user-not-found")
        ? "Email ou senha incorretos" : "Erro ao entrar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register(nome, email, telefone, password);
      navigate(from, { replace: true });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      setError(msg.includes("email-already-in-use") ? "Este email já está cadastrado." : "Erro ao criar conta.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "#04020e",
      fontFamily: "'Outfit', sans-serif",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px 20px",
      position: "relative",
      overflow: "hidden",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@700;900&family=Outfit:wght@300;400;500;600;700;800&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-20px) scale(1.1)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,30px) scale(0.9)} }
        @keyframes orb3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(15px,15px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;max-height:0} to{opacity:1;max-height:500px} }
        .nex-input {
          width: 100%; padding: 15px 16px; box-sizing: border-box;
          background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
          border-radius: 14px; color: #fff; font-size: 0.95rem;
          font-family: 'Outfit', sans-serif; outline: none; transition: border 0.2s;
        }
        .nex-input:focus { border-color: rgba(245,197,24,0.5); background: rgba(255,255,255,0.09); }
        .nex-input::placeholder { color: rgba(255,255,255,0.3); }
        .nex-btn-primary {
          width: 100%; padding: 15px; background: linear-gradient(135deg,#f5c518,#e6a817);
          border: none; border-radius: 14px; font-weight: 800; font-size: 1rem;
          color: #0a0414; cursor: pointer; font-family: 'Outfit', sans-serif;
          display: flex; align-items: center; justify-content: center; gap: 8px;
          transition: opacity 0.2s, transform 0.15s;
        }
        .nex-btn-primary:hover { opacity: 0.92; transform: translateY(-1px); }
        .nex-btn-ghost {
          width: 100%; padding: 14px 16px; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1); border-radius: 14px;
          color: #fff; font-size: 0.95rem; font-weight: 600; cursor: pointer;
          font-family: 'Outfit', sans-serif; display: flex; align-items: center;
          gap: 12px; transition: background 0.2s, border 0.2s;
        }
        .nex-btn-ghost:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); }
      `}</style>

      {/* Orbs de fundo */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)", top: "-80px", left: "-100px", animation: "orb1 8s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 320, height: 320, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,197,24,0.1) 0%, transparent 70%)", bottom: "-60px", right: "-80px", animation: "orb2 10s ease-in-out infinite" }} />
        <div style={{ position: "absolute", width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(236,72,153,0.1) 0%, transparent 70%)", top: "40%", right: "10%", animation: "orb3 12s ease-in-out infinite" }} />
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 380, position: "relative", zIndex: 1,
        opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)",
        transition: "all 0.7s cubic-bezier(0.25,0.46,0.45,0.94)",
      }}>

        {/* Logo + Marca */}
        <div style={{ textAlign: "center", marginBottom: 36, animation: "fadeUp 0.6s ease 0.1s both" }}>
          <div style={{
            width: 72, height: 72, borderRadius: 22, overflow: "hidden",
            margin: "0 auto 16px",
            boxShadow: "0 0 0 1px rgba(245,197,24,0.25), 0 12px 40px rgba(245,197,24,0.2)",
          }}>
            <img src={LOGO} alt="NexFoody" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontWeight: 900, fontSize: "1.9rem", color: "#fff", margin: "0 0 8px", lineHeight: 1.1 }}>
            {mode === "register" ? "Criar conta" : "Bem-vindo"}
          </h1>
          <p style={{ fontSize: "0.88rem", color: "rgba(255,255,255,0.4)", margin: 0, lineHeight: 1.5 }}>
            {mode === "register"
              ? "Junte-se à rede social do delivery"
              : "A rede social do delivery brasileiro 🍔"}
          </p>
        </div>

        {/* ── MODO: opções ── */}
        {mode === "options" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.6s ease 0.2s both" }}>

            {/* Google */}
            <button className="nex-btn-ghost" onClick={handleGoogle} disabled={googleLoading}>
              {googleLoading
                ? <div style={{ width: 20, height: 20, border: "2px solid rgba(255,255,255,0.2)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                : <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              }
              <span style={{ flex: 1, textAlign: "left" }}>
                {googleLoading ? "Entrando..." : "Continuar com Google"}
              </span>
            </button>

            {/* Email */}
            <button className="nex-btn-ghost" onClick={() => setMode("email")}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              <span style={{ flex: 1, textAlign: "left" }}>Continuar com Email</span>
            </button>

            {/* Telefone — em breve */}
            <button className="nex-btn-ghost" style={{ opacity: 0.45, cursor: "not-allowed" }} disabled>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.81a16 16 0 0 0 6.29 6.29l.95-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
              <span style={{ flex: 1, textAlign: "left" }}>Continuar com Telefone</span>
              <span style={{ fontSize: "0.62rem", background: "rgba(255,255,255,0.1)", borderRadius: 6, padding: "2px 7px", color: "rgba(255,255,255,0.5)" }}>Em breve</span>
            </button>

            {/* Divisor */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "4px 0" }}>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              <span style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)" }}>não tem conta?</span>
              <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
            </div>

            <button className="nex-btn-ghost" onClick={() => setMode("register")} style={{ borderColor: "rgba(245,197,24,0.25)", color: "#f5c518" }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
              </svg>
              <span style={{ flex: 1, textAlign: "left" }}>Criar conta grátis</span>
            </button>
          </div>
        )}

        {/* ── MODO: email/login ── */}
        {mode === "email" && (
          <form onSubmit={handleEmail} style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.4s ease both" }}>
            <input className="nex-input" type="email" placeholder="Seu email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus />
            <input className="nex-input" type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required />

            {error && (
              <div style={{ padding: "11px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, color: "#f87171", fontSize: "0.82rem" }}>
                {error}
              </div>
            )}

            <button type="submit" className="nex-btn-primary" disabled={loading}>
              {loading
                ? <div style={{ width: 20, height: 20, border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid #0a0414", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                : "Entrar"}
            </button>

            <button type="button" onClick={() => { setMode("options"); setError(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", cursor: "pointer", padding: "6px 0", fontFamily: "'Outfit', sans-serif" }}>
              ← Voltar
            </button>
          </form>
        )}

        {/* ── MODO: cadastro ── */}
        {mode === "register" && (
          <form onSubmit={handleRegister} style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.4s ease both" }}>
            <input className="nex-input" type="text" placeholder="Seu nome completo" value={nome} onChange={e => setNome(e.target.value)} required autoFocus />
            <input className="nex-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
            <input className="nex-input" type="tel" placeholder="WhatsApp (opcional)" value={telefone} onChange={e => setTelefone(e.target.value)} />
            <input className="nex-input" type="password" placeholder="Criar senha" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />

            {error && (
              <div style={{ padding: "11px 14px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, color: "#f87171", fontSize: "0.82rem" }}>
                {error}
              </div>
            )}

            <button type="submit" className="nex-btn-primary" disabled={loading}>
              {loading
                ? <div style={{ width: 20, height: 20, border: "2px solid rgba(0,0,0,0.2)", borderTop: "2px solid #0a0414", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                : "Criar minha conta →"}
            </button>

            <button type="button" onClick={() => { setMode("options"); setError(""); }} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: "0.82rem", cursor: "pointer", padding: "6px 0", fontFamily: "'Outfit', sans-serif" }}>
              ← Voltar
            </button>
          </form>
        )}

        {/* Rodapé */}
        <p style={{ textAlign: "center", fontSize: "0.68rem", color: "rgba(255,255,255,0.2)", marginTop: 32, lineHeight: 1.6 }}>
          Ao continuar você concorda com os{" "}
          <span style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Termos de Uso</span>{" "}
          e a{" "}
          <span style={{ color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>Política de Privacidade</span>
        </p>
      </div>
    </div>
  );
}

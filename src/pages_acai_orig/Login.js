// src/pages/Login.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  getAuth,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Login() {
  const { login, setUserData } = useAuth();
  const navigate = useNavigate();
  const [modo, setModo] = useState("opcoes"); // "opcoes" | "email" | "telefone" | "codigo"
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [codigo, setCodigo] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const recaptchaRef = useRef(null);

  const auth = getAuth();

  // Verificar resultado do redirect do Google
  useEffect(() => {
    getRedirectResult(auth).then(async (result) => {
      if (result?.user) {
        await garantirUsuarioFirestore(result.user);
        navigate("/");
      }
    }).catch(() => {});
  }, []);

  const garantirUsuarioFirestore = async (firebaseUser) => {
    const snap = await getDoc(doc(db, "users", firebaseUser.uid));
    if (!snap.exists()) {
      const data = {
        nome: firebaseUser.displayName || firebaseUser.phoneNumber || "Cliente",
        email: firebaseUser.email || "",
        telefone: firebaseUser.phoneNumber || "",
        pontos: 0,
        role: "cliente",
        createdAt: serverTimestamp(),
      };
      await setDoc(doc(db, "users", firebaseUser.uid), data);
      setUserData(data);
    } else {
      setUserData(snap.data());
    }
  };

  // Login com email
  const handleEmail = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      await login(email, senha);
      navigate("/");
    } catch {
      setErr("E-mail ou senha incorretos.");
    } finally { setLoading(false); }
  };

  // Login com Google
  const handleGoogle = async () => {
    setErr(""); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await garantirUsuarioFirestore(result.user);
      navigate("/");
    } catch (e) {
      if (e.code === "auth/popup-blocked") {
        // Fallback para redirect em celular
        const provider = new GoogleAuthProvider();
        await signInWithRedirect(auth, provider);
      } else {
        setErr("Erro ao entrar com Google. Tente novamente.");
      }
    } finally { setLoading(false); }
  };

  // Enviar SMS
  const handleEnviarSMS = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      // Formatar telefone
      const tel = telefone.replace(/\D/g, "");
      const telFormatado = tel.startsWith("55") ? `+${tel}` : `+55${tel}`;

      // Criar RecaptchaVerifier invisível
      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {},
        });
      }

      const result = await signInWithPhoneNumber(auth, telFormatado, window.recaptchaVerifier);
      setConfirmationResult(result);
      setModo("codigo");
    } catch (e) {
      console.error(e);
      if (e.code === "auth/invalid-phone-number") setErr("Número de telefone inválido.");
      else if (e.code === "auth/too-many-requests") setErr("Muitas tentativas. Aguarde alguns minutos.");
      else setErr("Erro ao enviar SMS. Tente novamente.");
      // Reset recaptcha
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        window.recaptchaVerifier = null;
      }
    } finally { setLoading(false); }
  };

  // Verificar código SMS
  const handleVerificarCodigo = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const result = await confirmationResult.confirm(codigo);
      await garantirUsuarioFirestore(result.user);
      navigate("/");
    } catch {
      setErr("Código inválido. Verifique e tente novamente.");
    } finally { setLoading(false); }
  };

  const estiloBase = {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 20px",
    fontFamily: "'Outfit', sans-serif",
  };

  const card = {
    width: "100%", maxWidth: 400,
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: 20, padding: "32px 28px",
    animation: "fadeUp 0.35s ease",
  };

  // ===== TELA DE OPÇÕES =====
  if (modo === "opcoes") return (
    <div style={estiloBase}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="https://i.ibb.co/Z1R8Y83G/Whats-App-Image-2026-03-20-at-20-32-27.jpg" alt="Açaí Puro Gosto" style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", marginBottom: 4, boxShadow: "0 4px 20px rgba(124,77,189,0.4)" }} />
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.4rem", color: "var(--gold)" }}>
            Açaí Puro Gosto
          </div>
          <p style={{ fontSize: "0.82rem", color: "var(--text2)", marginTop: 6 }}>
            Entre na sua conta para fazer pedidos
          </p>
        </div>

        {/* Google */}
        <button onClick={handleGoogle} disabled={loading} style={{
          width: "100%", padding: "13px 16px", marginBottom: 12,
          background: "white", border: "1px solid var(--border)",
          borderRadius: 12, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.95rem",
          color: "#1a1a1a", transition: "all 0.15s",
        }}
          onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.1)"}
          onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continuar com Google
        </button>

        {/* Telefone */}
        <button onClick={() => setModo("telefone")} disabled={loading} style={{
          width: "100%", padding: "13px 16px", marginBottom: 12,
          background: "linear-gradient(135deg, #25d366, #128c7e)",
          border: "none", borderRadius: 12, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          fontFamily: "'Outfit', sans-serif", fontWeight: 600, fontSize: "0.95rem",
          color: "white", transition: "all 0.15s",
          boxShadow: "0 4px 16px rgba(37,211,102,0.3)",
        }}>
          📱 Entrar com WhatsApp / Celular
        </button>

        {/* Divisor */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0" }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: "0.75rem", color: "var(--text3)" }}>ou</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Email */}
        <button onClick={() => setModo("email")} style={{
          width: "100%", padding: "13px 16px",
          background: "transparent", border: "1px solid var(--border2)",
          borderRadius: 12, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          fontFamily: "'Outfit', sans-serif", fontWeight: 500, fontSize: "0.9rem",
          color: "var(--text2)", transition: "all 0.15s",
        }}>
          ✉️ Entrar com e-mail
        </button>

        {err && <p style={{ color: "var(--red)", fontSize: "0.82rem", marginTop: 12, textAlign: "center" }}>{err}</p>}

        <div style={{ textAlign: "center", marginTop: 20, fontSize: "0.82rem", color: "var(--text2)" }}>
          Não tem conta?{" "}
          <Link to="/cadastro" style={{ color: "var(--purple2)", fontWeight: 600, textDecoration: "none" }}>
            Cadastrar grátis
          </Link>
        </div>
      </div>
      <div id="recaptcha-container" />
    </div>
  );

  // ===== TELA DE EMAIL =====
  if (modo === "email") return (
    <div style={estiloBase}>
      <div style={card}>
        <button onClick={() => setModo("opcoes")} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", marginBottom: 16, fontSize: "0.88rem", padding: 0 }}>
          ← Voltar
        </button>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", marginBottom: 6 }}>Entrar com e-mail</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--text2)", marginBottom: 24 }}>Digite seu e-mail e senha</p>
        <form onSubmit={handleEmail}>
          <div className="form-group">
            <label className="form-label">E-mail</label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
          </div>
          <div className="form-group">
            <label className="form-label">Senha</label>
            <input className="form-input" type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="••••••••" required />
          </div>
          {err && <p style={{ color: "var(--red)", fontSize: "0.82rem", marginBottom: 12 }}>{err}</p>}
          <button className="btn btn-gold btn-full" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );

  // ===== TELA DE TELEFONE =====
  if (modo === "telefone") return (
    <div style={estiloBase}>
      <div style={card}>
        <button onClick={() => setModo("opcoes")} style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", marginBottom: 16, fontSize: "0.88rem", padding: 0 }}>
          ← Voltar
        </button>
        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", marginBottom: 6 }}>Entrar com celular</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--text2)", marginBottom: 24 }}>
          Digite seu número e enviaremos um código SMS
        </p>
        <form onSubmit={handleEnviarSMS}>
          <div className="form-group">
            <label className="form-label">Número do celular</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{
                background: "var(--bg2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)", padding: "10px 14px",
                fontSize: "0.92rem", color: "var(--text2)", flexShrink: 0,
              }}>🇧🇷 +55</div>
              <input
                className="form-input"
                type="tel"
                value={telefone}
                onChange={e => setTelefone(e.target.value)}
                placeholder="(99) 9 9999-9999"
                required
                style={{ flex: 1 }}
              />
            </div>
          </div>
          {err && <p style={{ color: "var(--red)", fontSize: "0.82rem", marginBottom: 12 }}>{err}</p>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Enviando..." : "📱 Enviar código SMS"}
          </button>
        </form>
        <div id="recaptcha-container" />
      </div>
    </div>
  );

  // ===== TELA DE CÓDIGO =====
  if (modo === "codigo") return (
    <div style={estiloBase}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📱</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", marginBottom: 8 }}>Código enviado!</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--text2)", lineHeight: 1.5 }}>
            Enviamos um SMS para <strong style={{ color: "var(--text)" }}>{telefone}</strong>.
            <br />Digite o código de 6 dígitos abaixo.
          </p>
        </div>
        <form onSubmit={handleVerificarCodigo}>
          <div className="form-group">
            <label className="form-label">Código de verificação</label>
            <input
              className="form-input"
              type="number"
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="000000"
              maxLength={6}
              required
              style={{ textAlign: "center", fontSize: "1.5rem", letterSpacing: "8px", fontWeight: 700 }}
            />
          </div>
          {err && <p style={{ color: "var(--red)", fontSize: "0.82rem", marginBottom: 12 }}>{err}</p>}
          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Verificando..." : "✅ Confirmar código"}
          </button>
          <button type="button" onClick={() => setModo("telefone")} className="btn btn-ghost btn-full" style={{ marginTop: 8 }}>
            Não recebi o código
          </button>
        </form>
      </div>
    </div>
  );
}

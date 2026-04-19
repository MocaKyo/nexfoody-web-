// src/pages/Register.js
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  getAuth,
  signInWithPhoneNumber,
  RecaptchaVerifier,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function Register() {
  const navigate = useNavigate();
  const [etapa, setEtapa] = useState("dados"); // "dados" | "codigo"
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const handleEnviarSMS = async (e) => {
    e.preventDefault();
    if (!nome.trim()) { setErr("Informe seu nome."); return; }
    if (!telefone.trim()) { setErr("Informe seu celular."); return; }
    setErr(""); setLoading(true);
    try {
      const tel = telefone.replace(/\D/g, "");
      const telFormatado = tel.startsWith("55") ? `+${tel}` : `+55${tel}`;

      if (!window.recaptchaVerifier) {
        window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
          callback: () => {},
        });
      }

      const result = await signInWithPhoneNumber(auth, telFormatado, window.recaptchaVerifier);
      setConfirmationResult(result);
      setEtapa("codigo");
    } catch (e) {
      if (e.code === "auth/invalid-phone-number") setErr("Número inválido. Use o formato (99) 9 9999-9999");
      else if (e.code === "auth/too-many-requests") setErr("Muitas tentativas. Aguarde alguns minutos.");
      else setErr("Erro ao enviar SMS. Tente novamente.");
      if (window.recaptchaVerifier) { window.recaptchaVerifier.clear(); window.recaptchaVerifier = null; }
    } finally { setLoading(false); }
  };

  const handleVerificarCodigo = async (e) => {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      const result = await confirmationResult.confirm(codigo);
      const user = result.user;

      // Salvar dados no Firestore
      await setDoc(doc(db, "users", user.uid), {
        nome,
        email: email || "",
        telefone: user.phoneNumber || "",
        pontos: 0,
        role: "cliente",
        createdAt: serverTimestamp(),
      });

      navigate("/");
    } catch {
      setErr("Código inválido. Tente novamente.");
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
  };

  const card = {
    width: "100%", maxWidth: 400,
    background: "var(--bg2)",
    border: "1px solid var(--border)",
    borderRadius: 20, padding: "32px 28px",
    animation: "fadeUp 0.35s ease",
  };

  // ===== ETAPA 1 — DADOS =====
  if (etapa === "dados") return (
    <div style={estiloBase}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <img src="https://i.ibb.co/Z1R8Y83G/Whats-App-Image-2026-03-20-at-20-32-27.jpg" alt="Açaí Puro Gosto" style={{ width: 64, height: 64, borderRadius: 14, objectFit: "cover", marginBottom: 4, boxShadow: "0 4px 20px rgba(124,77,189,0.4)" }} />
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", color: "var(--gold)" }}>
            Açaí Puro Gosto
          </div>
        </div>

        <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.2rem", marginBottom: 6 }}>Criar conta</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--text2)", marginBottom: 24 }}>
          Cadastre-se e ganhe pontos a cada pedido!
        </p>

        <form onSubmit={handleEnviarSMS}>
          <div className="form-group">
            <label className="form-label">Nome completo *</label>
            <input className="form-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="João Silva" required />
          </div>

          <div className="form-group">
            <label className="form-label">Celular *</label>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{
                background: "var(--bg3)", border: "1px solid var(--border)",
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
            <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 4 }}>
              Você receberá um código SMS para confirmar
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">E-mail <span style={{ color: "var(--text3)", fontWeight: 400 }}>(opcional)</span></label>
            <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" />
          </div>

          {err && <p style={{ color: "var(--red)", fontSize: "0.82rem", marginBottom: 12 }}>{err}</p>}

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Enviando SMS..." : "📱 Enviar código de confirmação"}
          </button>
        </form>

        <div id="recaptcha-container" />

        <div style={{ textAlign: "center", marginTop: 16, fontSize: "0.82rem", color: "var(--text2)" }}>
          Já tem conta?{" "}
          <Link to="/login" style={{ color: "var(--purple2)", fontWeight: 600, textDecoration: "none" }}>
            Entrar
          </Link>
        </div>
      </div>
    </div>
  );

  // ===== ETAPA 2 — CÓDIGO =====
  return (
    <div style={estiloBase}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>📱</div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", marginBottom: 8 }}>Confirme seu celular</h2>
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
            {loading ? "Criando conta..." : "✅ Confirmar e criar conta"}
          </button>

          <button type="button" onClick={() => setEtapa("dados")} className="btn btn-ghost btn-full" style={{ marginTop: 8 }}>
            ← Voltar e corrigir número
          </button>
        </form>
      </div>
    </div>
  );
}

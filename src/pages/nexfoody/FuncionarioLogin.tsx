import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../../lib/firebase";

export default function FuncionarioLogin() {
  const { slug } = useParams();
  const { userData, loading } = useAuth();
  const [funcionarios, setFuncionarios] = useState<Array<{ uid: string; nome: string; telefone: string }>>([]);
  const [whatsapp, setWhatsapp] = useState("");
  const [pin, setPin] = useState("");
  const [gerenteTelefone, setGerenteTelefone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [lojaNome, setLojaNome] = useState("");
  const [lojaLogo, setLojaLogo] = useState("");

  useEffect(() => {
    if (!slug) return;
    // Carregar config da loja
    getDoc(doc(db, `tenants/${slug}/config/loja`)).then(snap => {
      if (snap.exists()) {
        setLojaNome(snap.data().nomeLoja || slug);
        setLojaLogo(snap.data().logoUrl || "");
      }
    });
    // Carregar funcionários
    const q = query(collection(db, "users"), where("tenantId", "==", slug), where("role", "==", "funcionario"));
    getDocs(q).then(snap => {
      setFuncionarios(snap.docs.map(d => ({ uid: d.id, nome: d.data().nome, telefone: d.data().telefone })));
    }).catch(() => {});
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsapp || pin.length !== 4) return;
    setSubmitting(true);
    setError("");

    // Buscar uid ANTES do login (precisamos do uid para bloquear)
    const q = query(collection(db, "users"), where("telefone", "==", whatsapp), where("tenantId", "==", slug), where("role", "==", "funcionario"));
    const snap = await getDocs(q);
    if (snap.empty) {
      setError("WhatsApp não encontrado nesta loja.");
      setSubmitting(false);
      return;
    }
    const uid = snap.docs[0].id;
    const emailFirebase = snap.docs[0].data().emailFirebase;
    const bloqueado = snap.docs[0].data().bloqueado;

    if (bloqueado) {
      setError("🔒 Acesso bloqueado. Fale com a gerência.");
      setSubmitting(false);
      return;
    }
    if (!emailFirebase) {
      setError("Conta sem acesso. Peça ao dono que recadastre.");
      setSubmitting(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, emailFirebase, "00" + pin);
      await updateDoc(doc(db, "users", uid), { lastLogin: serverTimestamp(), tentativasFalhas: 0 });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro";
      const novaTentativa = (snap.docs[0].data().tentativasFalhas || 0) + 1;
      await updateDoc(doc(db, "users", uid), { tentativasFalhas: novaTentativa });
      if (msg.includes("wrong-password") || msg.includes("invalid-credential")) {
        if (novaTentativa >= 3) {
          await updateDoc(doc(db, "users", uid), { bloqueado: true, bloqueadoEm: serverTimestamp() });
          setError("🔒 Conta bloqueada após 3 tentativas. Fale com a gerência.");
        } else {
          setError(`PIN incorreto. ${3 - novaTentativa} tentativa(s) restante(s).`);
        }
      } else if (msg.includes("user-not-found")) {
        setError("WhatsApp não encontrado");
      } else {
        setError(msg);
      }
      setSubmitting(false);
    }
  };

  const handleWhatsApp = () => {
    if (!gerenteTelefone) return;
    const clean = gerenteTelefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${clean}`, "_blank");
  };

  // Redirect após login — redireciona por funcao
  useEffect(() => {
    if (loading || !userData) return;
    if (userData.role !== "funcionario") return;
    const tenantId = userData.tenantId;
    const papel = userData.papel;
    if (!tenantId) { window.location.href = "/"; return; }
    // Cozinha vai direto pro KDS
    if (papel === "cozinha") {
      window.location.href = `/kds/${tenantId}`;
      return;
    }
    // Caixa e Atendente vão pro admin com tab de pedidos
    window.location.href = `/loja/${tenantId}/admin`;
  }, [loading, userData]);

  if (!slug) {
    return (
      <div className="auth-page" style={{ textAlign: "center", padding: "60px 20px" }}>
        <div style={{ fontSize: "3rem", marginBottom: 16 }}>👥</div>
        <h1 style={{ color: "var(--purple2)", fontFamily: "'Fraunces', serif", fontSize: "1.5rem", marginBottom: 12 }}>
          Painel do Funcionário
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>
          Acesse pelo link da sua loja.<br />
          Exemplo: <strong>nexfoody.com/lojista/funcionario/acaipurogosto</strong>
        </p>
        <p style={{ marginTop: 20 }}><Link to="/lojista/login">← Voltar</Link></p>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ padding: "40px 20px", maxWidth: 400, margin: "0 auto" }}>
      {/* Logo + Nome da loja */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        {lojaLogo ? (
          <img src={lojaLogo} alt="Logo" style={{ width: 60, height: 60, borderRadius: 12, objectFit: "cover", marginBottom: 12 }} />
        ) : (
          <div style={{ fontSize: "3rem", marginBottom: 12 }}>🏪</div>
        )}
        <h1 style={{
          fontFamily: "'Fraunces', serif",
          fontSize: "1.3rem",
          fontWeight: 900,
          color: "var(--text)",
          margin: "0 0 4px 0",
        }}>
          {lojaNome || slug}
        </h1>
        <p style={{ fontSize: "0.8rem", color: "var(--text3)", margin: 0 }}>
          Painel do Funcionário
        </p>
      </div>

      {/* Formulário */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* WhatsApp */}
        <div>
          <label style={{ fontSize: "0.72rem", color: "var(--text3)", display: "block", marginBottom: 6 }}>
            📱 WhatsApp
          </label>
          <input
            className="input"
            type="tel"
            placeholder="(99) 99999-9999"
            value={whatsapp}
            onChange={e => setWhatsapp(e.target.value)}
            required
            style={{ fontSize: "1rem", textAlign: "center" }}
          />
        </div>

        {/* PIN */}
        <div>
          <label style={{ fontSize: "0.72rem", color: "var(--text3)", display: "block", marginBottom: 6 }}>
            🔒 PIN de acesso (4 dígitos)
          </label>
          <input
            className="input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ""))}
            required
            style={{
              fontSize: "1.5rem",
              letterSpacing: "0.5em",
              textAlign: "center",
              fontWeight: 800,
            }}
          />
        </div>

        {error && (
          <div style={{
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 10,
            color: "var(--red)",
            fontSize: "0.82rem",
            textAlign: "center",
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-purple btn-full"
          disabled={submitting || !whatsapp || pin.length !== 4}
          style={{ padding: "14px 0", fontSize: "1rem", fontWeight: 800 }}
        >
          {submitting ? "Entrando..." : "ENTRAR"}
        </button>
      </form>

      {/* Rodapé */}
      <div style={{ marginTop: 28, borderTop: "1px solid var(--border)", paddingTop: 20 }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: "0.75rem",
          color: "var(--text3)",
          marginBottom: 12,
          justifyContent: "center",
        }}>
          ❓ Perdeu a senha?<br />
          Entre em contato com a gerência
        </div>

        <button
          onClick={handleWhatsApp}
          style={{
            width: "100%",
            padding: "10px 0",
            background: "rgba(34,197,94,0.1)",
            border: "1px solid rgba(34,197,94,0.3)",
            borderRadius: 10,
            color: "#22c55e",
            fontFamily: "'Outfit', sans-serif",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}>
          💬 Falar com gerente
        </button>
      </div>

      <p className="auth-footer" style={{ marginTop: 20 }}>
        <Link to="/lojista/login">← Voltar</Link>
      </p>
    </div>
  );
}

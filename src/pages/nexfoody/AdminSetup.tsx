// Temporary admin bootstrap — only works for the owner's email
import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const OWNER_EMAIL = "moisesrdnascimento@gmail.com";

export default function AdminSetup() {
  const { user, userData, loading } = useAuth();
  const navigate = useNavigate();
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (!user || user.email !== OWNER_EMAIL) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", color: "#fff", padding: 24, flexDirection: "column", gap: 12 }}>
        <span style={{ fontSize: 48 }}>🚫</span>
        <p style={{ color: "#f87171" }}>Acesso negado.</p>
        {!user && <p style={{ fontSize: 13, color: "#888" }}>Faça login primeiro.</p>}
      </div>
    );
  }

  const activate = async () => {
    try {
      await updateDoc(doc(db, "users", user.uid), {
        role: "admin",
        lojistaOf: "acai-puro-gosto",
      });
      setDone(true);
      setTimeout(() => navigate("/admin/saques"), 1500);
    } catch (e: unknown) {
      setError((e as Error).message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", flexDirection: "column", gap: 16, padding: 24 }}>
      <span style={{ fontSize: 56 }}>🛡️</span>
      <h2 style={{ color: "#fff", margin: 0 }}>Ativar conta Admin</h2>
      <p style={{ color: "#aaa", fontSize: 14, margin: 0 }}>Logado como: <strong style={{ color: "#fff" }}>{user.email}</strong></p>
      <p style={{ color: "#aaa", fontSize: 14, margin: 0 }}>Role atual: <strong style={{ color: userData?.role === "admin" ? "#4ade80" : "#fbbf24" }}>{userData?.role ?? "—"}</strong></p>
      <p style={{ color: "#aaa", fontSize: 14, margin: 0 }}>Loja vinculada: <strong style={{ color: (userData as any)?.lojistaOf ? "#4ade80" : "#fbbf24" }}>{(userData as any)?.lojistaOf ?? "—"}</strong></p>

      {done ? (
        <p style={{ color: "#4ade80", fontWeight: 600 }}>✅ Admin ativado! Redirecionando...</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
          <button onClick={activate} style={{ padding: "12px 32px", background: "#f97316", color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 16, cursor: "pointer" }}>
            {userData?.role === "admin" ? "Atualizar configurações" : "Ativar Admin"}
          </button>
          {userData?.role === "admin" && (
            <button onClick={() => navigate("/admin/saques")} style={{ padding: "10px 24px", background: "transparent", color: "#4ade80", border: "1px solid #4ade80", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
              Ir para Admin Saques
            </button>
          )}
          {userData?.role === "admin" && (
            <button onClick={() => navigate("/lojista/dashboard")} style={{ padding: "10px 24px", background: "transparent", color: "#60a5fa", border: "1px solid #60a5fa", borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
              Ir para Dashboard da Loja
            </button>
          )}
        </div>
      )}

      {error && <p style={{ color: "#f87171", fontSize: 13 }}>{error}</p>}
    </div>
  );
}

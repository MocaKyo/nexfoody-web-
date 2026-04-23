// src/pages/nexfoody/FeedLoja.tsx
// Feed por loja — cada loja lê de tenants/{tenantId}/posts via useTenant()
import { useState, useEffect } from "react";
import { useTenant } from "../../contexts/TenantContext";
import { useAuth } from "../../contexts/AuthContext";
import {
  collection, query, orderBy, limit, onSnapshot,
  doc, getDoc, setDoc, deleteDoc, serverTimestamp, getCountFromServer
} from "firebase/firestore";
import { db } from "../../lib/firebase";
import { useNavigate } from "react-router-dom";
import type { Post } from "../../types/tenant";

const TIPO_CONFIG = {
  promo:    { emoji: "🔥", label: "Promoção",  color: "var(--gold)",   bg: "rgba(245,197,24,0.08)" },
  novidade: { emoji: "✨", label: "Novidade",   color: "var(--green)",  bg: "rgba(34,197,94,0.08)" },
  aviso:    { emoji: "📢", label: "Aviso",      color: "#60a5fa",        bg: "rgba(96,165,250,0.08)" },
};

function formatDate(ts: unknown) {
  if (!ts || typeof (ts as { toDate?: () => Date }).toDate !== "function") return "";
  return (ts as { toDate: () => Date }).toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

export default function FeedLoja() {
  const { tenantId, tenantConfig } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [seguindo, setSeguindo] = useState(false);
  const [totalSeguidores, setTotalSeguidores] = useState(0);
  const [loadingFollow, setLoadingFollow] = useState(false);

  // Carrega posts da loja atual
  useEffect(() => {
    if (!tenantId) return;
    setLoading(true);
    const q = query(
      collection(db, `tenants/${tenantId}/posts`),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(q, snap => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Post)));
      setLoading(false);
    });
    return unsub;
  }, [tenantId]);

  // Verifica se já segue + conta seguidores
  useEffect(() => {
    if (!user || !tenantId) return;
    getDoc(doc(db, `tenants/${tenantId}/seguidores`, user.uid)).then(d => setSeguindo(d.exists()));
    getCountFromServer(collection(db, `tenants/${tenantId}/seguidores`))
      .then(snap => setTotalSeguidores(snap.data().count))
      .catch(() => {});
  }, [user, tenantId]);

  const toggleSeguir = async () => {
    if (!user) { navigate("/nexfoody/login"); return; }
    if (!tenantId) return;
    setLoadingFollow(true);
    try {
      const ref = doc(db, `tenants/${tenantId}/seguidores`, user.uid);
      if (seguindo) {
        await deleteDoc(ref);
        setSeguindo(false);
        setTotalSeguidores(n => Math.max(0, n - 1));
      } else {
        await setDoc(ref, { userId: user.uid, desde: serverTimestamp() });
        setSeguindo(true);
        setTotalSeguidores(n => n + 1);
      }
    } finally {
      setLoadingFollow(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "var(--primary)", animation: "spin 0.8s linear infinite" }} />
      </div>
    );
  }

  const foto = tenantConfig?.logoUrl || null;
  const nome = tenantConfig?.nomeLoja || "Loja";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg1)", fontFamily: "var(--font)" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        background: "var(--bg2)",
        borderBottom: "1px solid var(--border)",
        padding: "20px 16px 16px",
        marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: foto ? "transparent" : "var(--primary)",
            overflow: "hidden", flexShrink: 0,
            border: seguindo ? "3px solid var(--primary)" : "3px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {foto
              ? <img src={foto} alt={nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: "1.8rem" }}>🍽️</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text1)", marginBottom: 2 }}>{nome}</div>
            {tenantConfig?.endereco && (
              <div style={{ fontSize: "0.78rem", color: "var(--text3)", marginBottom: 6 }}>📍 {tenantConfig.endereco}</div>
            )}
            <div style={{ display: "flex", gap: 20, marginTop: 4 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text1)" }}>{posts.length}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>publicações</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text1)" }}>{totalSeguidores}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text3)" }}>seguidores</div>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={toggleSeguir}
          disabled={loadingFollow}
          style={{
            width: "100%", padding: "9px 0", borderRadius: 8,
            border: seguindo ? "1px solid var(--border)" : "none",
            background: seguindo ? "transparent" : "var(--primary)",
            color: seguindo ? "var(--text2)" : "#fff",
            fontWeight: 600, fontSize: "0.88rem",
            cursor: loadingFollow ? "not-allowed" : "pointer",
            opacity: loadingFollow ? 0.7 : 1, transition: "all 0.2s",
          }}
        >
          {loadingFollow ? "..." : seguindo ? "✓ Seguindo" : "+ Seguir"}
        </button>
        {tenantConfig?.instagram && (
          <a
            href={tenantConfig.instagram}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              marginTop: 10, padding: "7px 0",
              fontSize: "0.78rem", fontWeight: 600,
              color: "var(--text3)", textDecoration: "none",
            }}
          >
            📸 Siga no Instagram
          </a>
        )}
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text3)" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>📭</div>
          <div style={{ fontSize: "0.85rem" }}>Nenhuma publicação ainda</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "0 16px 80px" }}>
          {posts.map(post => {
            const cfg = TIPO_CONFIG[post.tipo] || TIPO_CONFIG.aviso;
            return (
              <div key={post.id} style={{
                background: "var(--bg2)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)", overflow: "hidden",
              }}>
                {post.foto && (
                  <img src={post.foto} alt="" style={{ width: "100%", height: 180, objectFit: "cover" }} />
                )}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: "1rem" }}>{cfg.emoji}</span>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>{cfg.label}</span>
                    <span style={{ fontSize: "0.68rem", color: "var(--text3)", marginLeft: "auto" }}>{formatDate(post.createdAt)}</span>
                  </div>
                  <p style={{ fontSize: "0.88rem", color: "var(--text2)", lineHeight: 1.5, margin: 0 }}>{post.texto}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

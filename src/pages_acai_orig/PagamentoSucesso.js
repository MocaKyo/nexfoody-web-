// src/pages/PagamentoSucesso.js
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, query, where, getDocs, updateDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";

export default function PagamentoSucesso() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verificando");

  useEffect(() => {
    const externalRef = searchParams.get("external_reference");
    const paymentStatus = searchParams.get("collection_status") || searchParams.get("status");

    const verificar = async () => {
      if (externalRef && paymentStatus === "approved") {
        try {
          await updateDoc(doc(db, "pedidos", externalRef), {
            status: "confirmado",
            pagamento: "cartao",
            pago: true,
          });
          setStatus("aprovado");
        } catch { setStatus("aprovado"); }
      } else if (paymentStatus === "pending") {
        setStatus("pendente");
      } else {
        setStatus("aprovado");
      }
      setTimeout(() => navigate("/historico"), 4000);
    };

    verificar();
  }, []);

  const configs = {
    verificando: { icon: "⏳", title: "Verificando pagamento...", color: "var(--gold)", msg: "" },
    aprovado:    { icon: "🎉", title: "Pagamento aprovado!", color: "var(--green)", msg: "Seu pedido foi confirmado! Redirecionando..." },
    pendente:    { icon: "⏳", title: "Pagamento pendente", color: "#60a5fa", msg: "Aguardando confirmação. Redirecionando..." },
    falha:       { icon: "❌", title: "Pagamento não aprovado", color: "var(--red)", msg: "Tente novamente. Redirecionando..." },
  };

  const cfg = configs[status];

  return (
    <div style={{
      minHeight: "100vh", background: "var(--bg)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24, textAlign: "center",
      fontFamily: "'Outfit', sans-serif",
    }}>
      <div style={{ fontSize: "4rem", marginBottom: 16 }}>{cfg.icon}</div>
      <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: "1.6rem", color: cfg.color, marginBottom: 12 }}>
        {cfg.title}
      </h2>
      {cfg.msg && <p style={{ color: "var(--text2)", fontSize: "0.9rem" }}>{cfg.msg}</p>}
      <button onClick={() => navigate("/historico")} style={{
        marginTop: 24, background: "var(--gold)", border: "none",
        borderRadius: 50, padding: "12px 28px", cursor: "pointer",
        color: "var(--bg)", fontWeight: 700, fontFamily: "'Outfit', sans-serif",
      }}>
        Ver meus pedidos
      </button>
    </div>
  );
}

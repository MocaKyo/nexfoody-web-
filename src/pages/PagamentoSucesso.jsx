// src/pages/PagamentoSucesso.js
import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { collection, query, where, getDocs, updateDoc, doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useStore } from "../contexts/StoreContext";

export default function PagamentoSucesso() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { confirmOrder } = useStore();
  const [status, setStatus] = useState("verificando");

  useEffect(() => {
    const externalRef = searchParams.get("external_reference");
    const paymentStatus = searchParams.get("collection_status") || searchParams.get("status");

    const verificar = async () => {
      if (externalRef && paymentStatus === "approved") {
        try {
          // Buscar total do pedido antes de atualizar
          const pedidoSnap = await getDoc(doc(db, "pedidos", externalRef));
          const pedidoData = pedidoSnap.exists() ? pedidoSnap.data() : null;
          const total = pedidoData?.total || 0;
          const jaConfirmado = pedidoData?.status === "confirmado";

          await updateDoc(doc(db, "pedidos", externalRef), {
            status: "confirmado",
            pagamento: "cartao",
            pago: true,
          });

          // Middleware de pontos de ranking (fan points) — idempotente
          if (total > 0 && !jaConfirmado) confirmOrder(externalRef, total);

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

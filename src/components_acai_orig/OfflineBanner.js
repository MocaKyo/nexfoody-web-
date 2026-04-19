// src/components/OfflineBanner.js
import React, { useState, useEffect } from "react";

export default function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  const [mostrar, setMostrar] = useState(false);
  const [voltou, setVoltou] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setOffline(true);
      setMostrar(true);
      setVoltou(false);
    };
    const handleOnline = () => {
      setOffline(false);
      setVoltou(true);
      setMostrar(true);
      setTimeout(() => setMostrar(false), 3000);
    };
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (!mostrar) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
      background: offline ? "#dc2626" : "#16a34a",
      color: "#fff", textAlign: "center",
      padding: "10px 16px",
      fontSize: "0.85rem", fontWeight: 600,
      fontFamily: "'Outfit', sans-serif",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
      animation: "slideDown 0.3s ease",
      boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    }}>
      <style>{`@keyframes slideDown { from{transform:translateY(-100%)} to{transform:translateY(0)} }`}</style>
      {offline ? (
        <>
          📵 Sem conexão — você está offline. O cardápio continua disponível!
        </>
      ) : (
        <>
          ✅ Conexão restaurada!
        </>
      )}
    </div>
  );
}

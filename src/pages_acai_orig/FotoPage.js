import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function FotoPage() {
  const { foto } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!foto) { navigate(-1); return; }
    // Bloqueia zoom por pinch
    document.addEventListener("touchmove", e => {
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });
    return () => {};
  }, [foto, navigate]);

  const decoded = foto ? atob(foto) : "";

  return (
    <div
      onClick={() => navigate(-1)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.95)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <button
        onClick={e => { e.stopPropagation(); navigate(-1); }}
        style={{
          position: "absolute",
          top: 12,
          right: 12,
          background: "rgba(255,255,255,0.1)",
          border: "none",
          borderRadius: "50%",
          width: 36,
          height: 36,
          color: "#fff",
          fontSize: "1.1rem",
          cursor: "pointer",
          zIndex: 2,
        }}
      >
        ✕
      </button>

      <img
        key={decoded}
        src={decoded}
        alt=""
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
          objectFit: "contain",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
        onError={() => navigate(-1)}
      />
    </div>
  );
}

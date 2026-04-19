// src/components/Toast.js
import React, { createContext, useContext, useState, useCallback } from "react";

const ToastCtx = createContext();
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2600);
  }, []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

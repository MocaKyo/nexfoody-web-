// src/hooks/useFCM.js
import { useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

const firebaseConfig = {
  apiKey: "AIzaSyCRQa_hjAoSKa5RIDKJMqVdicYQtnILfFI",
  authDomain: "acaipedidos-f53cc.firebaseapp.com",
  projectId: "acaipedidos-f53cc",
  messagingSenderId: "1032177722630",
  appId: "1:1032177722630:web:81c13975993b8ee5482a87",
};

const VAPID_KEY = "BCqDYo4dFTwxYDSvBFn3wu_Gz8WwsMf9K2ONYPSKoK3dlOEwT4gccMFlp_uFTJdQ3Mvra4ppNSe9XP5IiVpl9xQ";

// Som personalizado para novo pedido
function tocarSomPedido() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notas = [523, 659, 784, 1047, 784, 1047];
    notas.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = i % 2 === 0 ? "sine" : "triangle";
      const t = ctx.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  } catch {}
}

export function useFCM(userId) {
  const tentouRef = useRef(false);
  const bannerRef = useRef(null);

  // Mostrar banner pedindo permissão de forma amigável
  const mostrarBannerPermissao = () => {
    if (bannerRef.current) return;
    const banner = document.createElement("div");
    banner.id = "fcm-banner";
    banner.style.cssText = `
      position: fixed; bottom: 70px; left: 12px; right: 12px; z-index: 9999;
      background: linear-gradient(135deg, #5a2d91, #3b1a6e);
      border: 1px solid rgba(245,197,24,0.3);
      border-radius: 14px; padding: 14px 16px;
      display: flex; align-items: center; gap: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      font-family: 'Outfit', sans-serif;
      animation: slideUp 0.3s ease;
    `;
    banner.innerHTML = `
      <style>@keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }</style>
      <span style="font-size:1.5rem">🔔</span>
      <div style="flex:1">
        <div style="font-weight:700;font-size:0.88rem;color:#fff">Ativar notificações</div>
        <div style="font-size:0.75rem;color:rgba(255,255,255,0.6);margin-top:2px">Receba atualizações do seu pedido em tempo real!</div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button id="fcm-nao" style="padding:7px 12px;background:rgba(255,255,255,0.1);border:none;border-radius:8px;color:rgba(255,255,255,0.6);cursor:pointer;font-family:'Outfit',sans-serif;font-size:0.78rem">Agora não</button>
        <button id="fcm-sim" style="padding:7px 14px;background:linear-gradient(135deg,#f5c518,#e6a817);border:none;border-radius:8px;color:#000;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;font-size:0.78rem">Ativar</button>
      </div>
    `;
    document.body.appendChild(banner);
    bannerRef.current = banner;

    document.getElementById("fcm-sim").onclick = async () => {
      banner.remove();
      bannerRef.current = null;
      await solicitarPermissao();
    };
    document.getElementById("fcm-nao").onclick = () => {
      banner.remove();
      bannerRef.current = null;
      localStorage.setItem("fcm-negado", Date.now());
    };
  };

  const solicitarPermissao = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        await registrarToken();
      }
    } catch (e) {
      console.warn("Erro permissão FCM:", e);
    }
  };

  const registrarToken = async () => {
    try {
      const messaging = getMessaging();
      const token = await getToken(messaging, { vapidKey: VAPID_KEY });
      if (token && userId) {
        await setDoc(doc(db, "fcmTokens", userId), {
          token, userId, updatedAt: new Date().toISOString(),
        });
        console.log("✅ Token FCM registrado");
      }
    } catch (e) {
      console.warn("Erro token FCM:", e.message);
    }
  };

  useEffect(() => {
    if (!userId || tentouRef.current) return;
    tentouRef.current = true;

    const init = async () => {
      try {
        // Verificar se notificações são suportadas
        if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

        // Se já tem permissão — só registrar token
        if (Notification.permission === "granted") {
          await registrarToken();

          // Ouvir mensagens em foreground
          const messaging = getMessaging();
          onMessage(messaging, (payload) => {
            console.log("FCM foreground:", payload);
            tocarSomPedido();
            // Mostrar notificação manual em foreground
            if (Notification.permission === "granted") {
              new Notification(payload.notification?.title || "🫐 Açaí Puro Gosto", {
                body: payload.notification?.body,
                icon: "/logo192.png",
                image: payload.notification?.image,
                badge: "/logo192.png",
              });
            }
          });
          return;
        }

        // Se foi negado recentemente (menos de 3 dias) — não pedir de novo
        const negadoEm = localStorage.getItem("fcm-negado");
        if (negadoEm && Date.now() - parseInt(negadoEm) < 3 * 24 * 60 * 60 * 1000) return;

        // Se permission === "default" — mostrar banner amigável após 3 segundos
        if (Notification.permission === "default") {
          setTimeout(() => mostrarBannerPermissao(), 3000);
        }
      } catch (e) {
        console.warn("Erro FCM init:", e.message);
      }
    };

    init();
  }, [userId]);
}

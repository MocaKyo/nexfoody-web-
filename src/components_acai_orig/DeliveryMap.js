// src/components/DeliveryMap.js
import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useStore } from "../contexts/StoreContext";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const center = [-3.7449, -38.5364]; // Default (Fortaleza)

// Haversine formula for distance in km
const calcDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Component to center map and handle location marker
function MapUpdater({ storePosition, clientPosition, raioKm }) {
  const map = useMap();

  useEffect(() => {
    if (clientPosition) {
      map.flyTo(clientPosition, 13, { duration: 1 });
    } else if (storePosition) {
      map.flyTo(storePosition, 11, { duration: 1 });
    }
  }, [storePosition, clientPosition, map]);

  return null;
}

// Store icon (purple)
const storeIcon = L.divIcon({
  html: `<div style="background:#7c3aed;border:3px solid #f5c518;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;">📍</div>`,
  className: "custom-marker",
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

// Client icon (green)
const clientIcon = L.divIcon({
  html: `<div style="background:#22c55e;border:3px solid #fff;border-radius:50%;width:30px;height:30px;display:flex;align-items:center;justify-content:center;font-size:14px;">📍</div>`,
  className: "custom-marker",
  iconSize: [30, 30],
  iconAnchor: [15, 15],
});

export default function DeliveryMap({ clientePos, setClientePos, raioKm }) {
  const { config } = useStore();
  const storePos = config.latitude && config.longitude
    ? [parseFloat(config.latitude), parseFloat(config.longitude)]
    : null;

  const [error, setError] = useState(null);

  // Get user location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocalização não disponível neste navegador");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = [position.coords.latitude, position.coords.longitude];
        setClientePos(pos);
        setError(null);
      },
      (err) => {
        if (err.code === 1) {
          setError("Permissão negada. Ative a localização para ver se está no raio de entrega.");
        } else {
          setError("Não foi possível obter sua localização");
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // If no store coords configured
  if (!storePos) {
    return (
      <div style={{
        background: "var(--bg2)", border: "1px solid var(--border)",
        borderRadius: 12, padding: 16, textAlign: "center", color: "var(--text2)"
      }}>
        <div style={{ fontSize: "1.5rem", marginBottom: 8 }}>🗺️</div>
        <div style={{ fontSize: "0.82rem" }}>Configure a latitude e longitude do endereço da loja no Admin para ativar o mapa de entrega.</div>
      </div>
    );
  }

  const raioMetros = (raioKm || 8) * 1000;
  const distance = clientePos ? calcDistance(storePos[0], storePos[1], clientePos[0], clientePos[1]) : null;
  const dentroRaio = distance !== null && distance <= (raioKm || 8);

  return (
    <div style={{ borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)" }}>
      <div style={{
        height: 200, borderRadius: 12,
        background: "var(--bg2)"
      }}>
        <MapContainer
          center={storePos}
          zoom={11}
          style={{ height: "100%", width: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Store marker */}
          <Marker position={storePos} icon={storeIcon}>
            <Popup>📍 Loja</Popup>
          </Marker>

          {/* Delivery radius circle */}
          <Circle
            center={storePos}
            radius={raioMetros}
            pathOptions={{
              color: "#7c3aed",
              fillColor: "#7c3aed",
              fillOpacity: 0.15,
              weight: 2
            }}
          />

          {/* Client marker */}
          {clientePos && (
            <Marker position={clientePos} icon={clientIcon}>
              <Popup>📍 Você</Popup>
            </Marker>
          )}

          <MapUpdater storePosition={storePos} clientPosition={clientePos} raioKm={raioKm} />
        </MapContainer>
      </div>

      {/* Status */}
      <div style={{
        padding: "10px 12px",
        background: dentroRaio ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
        borderTop: `1px solid ${dentroRaio ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`
      }}>
        {clientePos ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.2rem" }}>{dentroRaio ? "✅" : "❌"}</span>
            <div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: dentroRaio ? "var(--green)" : "var(--red)" }}>
                {dentroRaio
                  ? `Dentro do raio de entrega! (${distance?.toFixed(1)} km)`
                  : `Fora do raio de entrega (${distance?.toFixed(1)} km)`
                }
              </div>
              {!dentroRaio && (
                <div style={{ fontSize: "0.72rem", color: "var(--text2)", marginTop: 2 }}>
                  Ainda não entregamos nessa região. Estamos expandindo em breve! 🚀
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: "0.78rem", color: error ? "var(--red)" : "var(--text3)" }}>
            {error || "📍 Obtendo sua localização..."}
          </div>
        )}

        {distance !== null && (
          <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 4 }}>
            Raio de entrega: {raioKm || 8}km · Distância: {distance?.toFixed(1)}km
          </div>
        )}
      </div>
    </div>
  );
}
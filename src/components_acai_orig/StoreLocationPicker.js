// src/components/StoreLocationPicker.js
import React, { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export default function StoreLocationPicker({ latitude, longitude, onChange }) {
  const defaultPos = [latitude ? parseFloat(latitude) : -3.7449, longitude ? parseFloat(longitude) : -38.5364];
  const [position, setPosition] = useState({ lat: defaultPos[0], lng: defaultPos[1] });
  const [enderecoInput, setEnderecoInput] = useState("");
  const [buscando, setBuscando] = useState(false);
  const mapRef = useRef(null);

  useEffect(() => {
    if (latitude && longitude) {
      setPosition({ lat: parseFloat(latitude), lng: parseFloat(longitude) });
    }
  }, [latitude, longitude]);

  const markerIcon = L.divIcon({
    html: `<div style="background:#7c3aed;border:3px solid #f5c518;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:move;">📍</div>`,
    className: "custom-marker",
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  });

  const buscarEndereco = async () => {
    if (!enderecoInput.trim()) return;
    setBuscando(true);
    try {
      const encoded = encodeURIComponent(enderecoInput);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encoded}&limit=1`,
        { headers: { "Accept": "application/json" } }
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        setPosition({ lat: parseFloat(lat), lng: parseFloat(lon) });
        onChange(parseFloat(lat), parseFloat(lon));
        // Pan map to location
        if (mapRef.current) {
          mapRef.current.setView([parseFloat(lat), parseFloat(lon)], 16);
        }
      } else {
        alert("Endereço não encontrado. Tente um endereço mais específico (rua, número, cidade).");
      }
    } catch (e) {
      console.error("Erro ao buscar endereço:", e);
      alert("Erro ao buscar endereço. Tente arrastar o marcador no mapa.");
    }
    setBuscando(false);
  };

  return (
    <div style={{ marginTop: 8 }}>
      {/* Input de endereço + botão buscar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          className="form-input"
          type="text"
          value={enderecoInput}
          onChange={e => setEnderecoInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && buscarEndereco()}
          placeholder="Digite o endereço da loja para buscar no mapa..."
          style={{ flex: 1, fontSize: "0.82rem" }}
        />
        <button
          onClick={buscarEndereco}
          disabled={buscando}
          style={{
            background: "linear-gradient(135deg, var(--purple2), var(--purple))",
            border: "none",
            borderRadius: 10,
            color: "#fff",
            padding: "8px 14px",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
            fontFamily: "'Outfit', sans-serif",
          }}
        >
          {buscando ? "🔍..." : "🔍 Buscar"}
        </button>
      </div>

      {/* Mapa */}
      <div style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        height: 220
      }}>
        <MapContainer
          center={position}
          zoom={14}
          style={{ height: "100%", width: "100%" }}
          zoomControl={true}
          ref={mapRef}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />
          <Marker
            position={position}
            draggable={true}
            icon={markerIcon}
            eventHandlers={{
              dragend: (e) => {
                const latlng = e.target.getLatLng();
                setPosition({ lat: latlng.lat, lng: latlng.lng });
                onChange(latlng.lat, latlng.lng);
              },
            }}
          />
        </MapContainer>
      </div>

      {/* Lat/Lng display */}
      <div style={{
        display: "flex",
        gap: 12,
        marginTop: 8,
        alignItems: "center"
      }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "0.72rem", color: "var(--text3)" }}>Latitude</label>
          <input
            className="form-input"
            type="number"
            step="any"
            value={position.lat.toFixed(6)}
            readOnly
            style={{ fontSize: "0.78rem" }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: "0.72rem", color: "var(--text3)" }}>Longitude</label>
          <input
            className="form-input"
            type="number"
            step="any"
            value={position.lng.toFixed(6)}
            readOnly
            style={{ fontSize: "0.78rem" }}
          />
        </div>
      </div>

      <div style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 6 }}>
        📍 Arraste o marcador para ajustar a posição exata da loja.
      </div>
    </div>
  );
}
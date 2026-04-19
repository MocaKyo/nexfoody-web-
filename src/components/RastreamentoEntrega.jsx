// src/components/RastreamentoEntrega.js — Mapa em tempo real do entregador + destino
import React, { useEffect, useRef, useState } from "react";

// Geocodifica endereço para coordenadas via Nominatim (free, sem API key)
async function geocodeEndereco(endereco) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(endereco)}&format=json&limit=1`,
      { headers: { "Accept-Language": "pt-BR" } }
    );
    const data = await res.json();
    if (data && data[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {}
  return null;
}

export default function RastreamentoEntrega({ entregadorLocalizacao, entregadorNome, endereco }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const entregadorMarkerRef = useRef(null);
  const destinoMarkerRef = useRef(null);
  const polylineRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [destinoCoords, setDestinoCoords] = useState(null);
  const [erro, setErro] = useState(null);

  // Carregar Leaflet CSS/JS
  useEffect(() => {
    if (window.L) { setMapLoaded(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Geocodificar endereço do destino
  useEffect(() => {
    if (!endereco) return;
    geocodeEndereco(endereco).then(coords => {
      if (coords) setDestinoCoords(coords);
      else setErro("Não foi possível localizar o endereço no mapa.");
    });
  }, [endereco]);

  // Inicializar mapa quando Leaflet e coordenadas estiverem prontas
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || mapInstanceRef.current) return;
    if (!entregadorLocalizacao && !destinoCoords) return;

    const centerLat = entregadorLocalizacao?.latitude || destinoCoords?.lat || -4.2439;
    const centerLng = entregadorLocalizacao?.longitude || destinoCoords?.lng || -44.7846;

    const map = window.L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([centerLat, centerLng], 15);

    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Destino marker (📍)
    if (destinoCoords) {
      const iconDestino = window.L.divIcon({
        html: "📍",
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      destinoMarkerRef.current = window.L.marker([destinoCoords.lat, destinoCoords.lng], { icon: iconDestino })
        .addTo(map)
        .bindPopup("🏠 Destino");
    }

    // Entrgador marker (🛵)
    if (entregadorLocalizacao) {
      const iconEntregador = window.L.divIcon({
        html: "🛵",
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      entregadorMarkerRef.current = window.L.marker(
        [entregadorLocalizacao.latitude, entregadorLocalizacao.longitude],
        { icon: iconEntregador }
      ).addTo(map).bindPopup(`🛵 ${entregadorNome || "Entregador"}`);

      // Linha entre entregador e destino
      if (destinoCoords) {
        polylineRef.current = window.L.polyline([
          [entregadorLocalizacao.latitude, entregadorLocalizacao.longitude],
          [destinoCoords.lat, destinoCoords.lng],
        ], { color: "#7c3aed", weight: 3, dashArray: "6,6" }).addTo(map);

        // Fit bounds
        map.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
      }
    } else if (destinoCoords) {
      map.setView([destinoCoords.lat, destinoCoords.lng], 15);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [mapLoaded]);

  // Atualizar posição do entregador em tempo real
  useEffect(() => {
    if (!mapInstanceRef.current || !entregadorLocalizacao) return;

    const latlng = [entregadorLocalizacao.latitude, entregadorLocalizacao.longitude];

    if (entregadorMarkerRef.current) {
      entregadorMarkerRef.current.setLatLng(latlng);
    } else {
      const iconEntregador = window.L.divIcon({
        html: "🛵",
        className: "",
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });
      entregadorMarkerRef.current = window.L.marker(latlng, { icon: iconEntregador })
        .addTo(mapInstanceRef.current)
        .bindPopup(`🛵 ${entregadorNome || "Entregador"}`);
    }

    // Atualizar linha
    if (destinoCoords && polylineRef.current) {
      polylineRef.current.setLatLngs([
        latlng,
        [destinoCoords.lat, destinoCoords.lng],
      ]);
    }
  }, [entregadorLocalizacao]);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
        🗺️ Rastreamento em tempo real
        {entregadorLocalizacao && (
          <span style={{ color: "var(--green)", fontSize: "0.65rem" }}>● Ao vivo</span>
        )}
      </div>

      {erro && (
        <div style={{ fontSize: "0.75rem", color: "var(--text3)", marginBottom: 6 }}>{erro}</div>
      )}

      <div
        ref={mapRef}
        style={{
          height: 180,
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid var(--border)",
          position: "relative",
          background: "var(--bg3)",
        }}
      />

      {!entregadorLocalizacao && (
        <div style={{ fontSize: "0.72rem", color: "var(--text3)", marginTop: 4, textAlign: "center" }}>
          Aguardando localização do entregador...
        </div>
      )}
    </div>
  );
}

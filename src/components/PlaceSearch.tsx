// src/components/PlaceSearch.tsx
// Autocomplete Google Places reutilizável para busca de estabelecimentos
import { useRef, useState, useEffect } from "react";
import { useJsApiLoader } from "@react-google-maps/api";

const GOOGLE_MAPS_KEY = "AIzaSyBVn3ymwKWoh7KJ9QIo7L6cysLBTR63hmE";
const LIBRARIES: ("places")[] = ["places"];

interface Props {
  onSelect: (placeId: string, descricao: string) => void;
  placeholder?: string;
  initialValue?: string;
}

export default function PlaceSearch({ onSelect, placeholder = "Busque sua loja no Google Maps", initialValue = "" }: Props) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_KEY, libraries: LIBRARIES });
  const svcRef = useRef<google.maps.places.AutocompleteService | null>(null);
  const [busca, setBusca] = useState(initialValue);
  const [sugestoes, setSugestoes] = useState<google.maps.places.AutocompletePrediction[]>([]);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (isLoaded) svcRef.current = new google.maps.places.AutocompleteService();
  }, [isLoaded]);

  useEffect(() => {
    setBusca(initialValue);
  }, [initialValue]);

  const pesquisar = (termo: string) => {
    setBusca(termo);
    setSugestoes([]);
    if (!svcRef.current || !termo.trim()) return;
    svcRef.current.getPlacePredictions(
      { input: termo, types: ["establishment"] },
      (preds, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && preds) {
          setSugestoes(preds.slice(0, 5));
          setAberto(true);
        }
      }
    );
  };

  const selecionar = (pred: google.maps.places.AutocompletePrediction) => {
    setBusca(pred.description);
    setSugestoes([]);
    setAberto(false);
    onSelect(pred.place_id, pred.description);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        value={busca}
        onChange={e => pesquisar(e.target.value)}
        onFocus={() => sugestoes.length > 0 && setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 200)}
        placeholder={placeholder}
        style={{
          width: "100%",
          background: "rgba(255,255,255,.08)",
          border: "1px solid rgba(255,255,255,.15)",
          borderRadius: 10,
          padding: "9px 12px",
          color: "#fff",
          fontFamily: "'Outfit', sans-serif",
          fontSize: "0.82rem",
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      {aberto && sugestoes.length > 0 && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 4px)",
          left: 0, right: 0,
          background: "#1a0a36",
          border: "1px solid rgba(255,255,255,.12)",
          borderRadius: 10,
          overflow: "hidden",
          zIndex: 200,
          boxShadow: "0 8px 24px rgba(0,0,0,.5)",
        }}>
          {sugestoes.map((s, i) => (
            <div
              key={s.place_id}
              onMouseDown={() => selecionar(s)}
              style={{
                padding: "10px 12px",
                cursor: "pointer",
                borderBottom: i < sugestoes.length - 1 ? "1px solid rgba(255,255,255,.06)" : "none",
              }}
            >
              <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#fff" }}>
                {s.structured_formatting.main_text}
              </div>
              <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,.4)", marginTop: 1 }}>
                {s.structured_formatting.secondary_text}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

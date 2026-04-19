import { useParams } from "react-router-dom";

export default function FotoPage() {
  const { foto } = useParams<{ foto: string }>();

  let fotoUrl = "";
  try {
    fotoUrl = atob(foto || "");
  } catch {
    fotoUrl = foto || "";
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    }}>
      {fotoUrl ? (
        <img
          src={fotoUrl}
          alt=""
          style={{
            maxWidth: "100%",
            maxHeight: "80vh",
            borderRadius: "var(--radius)",
            objectFit: "contain",
          }}
        />
      ) : (
        <div style={{ color: "var(--text3)" }}>Imagem não encontrada</div>
      )}
    </div>
  );
}
import { stages } from "../data/stages";
import { useNavigate } from "react-router-dom";

export default function MapPage() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "20px" }}>
      <h1>Mapa</h1>

      {stages.map((stage) => (
        <div
          key={stage.id}
          style={{
            border: "1px solid white",
            margin: "10px",
            padding: "10px",
            cursor: "pointer",
          }}
          onClick={() => navigate(`/battle/${stage.id}`)}
        >
          <h2>{stage.name}</h2>
        </div>
      ))}
    </div>
  );
}
import { BrowserRouter, Routes, Route } from "react-router-dom";
import MapPage from "./pages/MapPage";
import BattlePage from "./pages/BattlePage";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapPage />} />
        <Route path="/battle/:id" element={<BattlePage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
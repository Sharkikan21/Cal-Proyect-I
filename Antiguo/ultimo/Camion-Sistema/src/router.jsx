import { Routes, Route } from "react-router-dom";
import RecepcionApp from "./pages/Recepcion/RecepcionApp";

function AppRouter() {
    return (
        <Routes>
            <Route path="/recepcion" element={<RecepcionApp />} />
            <Route path="/" element={<RecepcionApp />} />
        </Routes>
    );
}

export default AppRouter;
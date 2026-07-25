import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LeadsDashboard from "./pages/LeadsDashboard";
import ChatterboxPage from "./pages/ChatterboxPage";

const App = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/chatterbox" element={<ChatterboxPage />} />
      <Route path="/leads" element={<LeadsDashboard />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BrowserRouter>
);

export default App;

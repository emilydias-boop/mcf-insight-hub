import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Receita from "./pages/receita/Index";
import ReceitaOverview from "./pages/receita/Overview";
import ReceitaTransacoes from "./pages/receita/Transacoes";
import ReceitaPorCanal from "./pages/receita/PorCanal";
import Custos from "./pages/custos/Index";
import CustosOverview from "./pages/custos/Overview";
import CustosDespesas from "./pages/custos/Despesas";
import CustosPorCategoria from "./pages/custos/PorCategoria";
import Relatorios from "./pages/Relatorios";
import Alertas from "./pages/Alertas";
import EfeitoAlavanca from "./pages/EfeitoAlavanca";
import Projetos from "./pages/Projetos";
import Credito from "./pages/Credito";
import Leilao from "./pages/Leilao";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="receita" element={<Receita />}>
              <Route index element={<ReceitaOverview />} />
              <Route path="transacoes" element={<ReceitaTransacoes />} />
              <Route path="por-canal" element={<ReceitaPorCanal />} />
            </Route>
            <Route path="custos" element={<Custos />}>
              <Route index element={<CustosOverview />} />
              <Route path="despesas" element={<CustosDespesas />} />
              <Route path="por-categoria" element={<CustosPorCategoria />} />
            </Route>
            <Route path="relatorios" element={<Relatorios />} />
            <Route path="alertas" element={<Alertas />} />
            <Route path="efeito-alavanca" element={<EfeitoAlavanca />} />
            <Route path="projetos" element={<Projetos />} />
            <Route path="credito" element={<Credito />} />
            <Route path="leilao" element={<Leilao />} />
            <Route path="configuracoes" element={<Configuracoes />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

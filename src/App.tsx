import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Receita from "./pages/receita/Index";
import ReceitaOverview from "./pages/receita/Overview";
import A010 from "./pages/receita/A010";
import ReceitaTransacoes from "./pages/receita/Transacoes";
import ReceitaPorCanal from "./pages/receita/PorCanal";
import ImportarA010 from "./pages/receita/ImportarA010";
import ImportarHubla from "./pages/receita/ImportarHubla";
import Custos from "./pages/custos/Index";
import CustosOverview from "./pages/custos/Overview";
import CustosDespesas from "./pages/custos/Despesas";
import CustosPorCategoria from "./pages/custos/PorCategoria";
import Relatorios from "./pages/Relatorios";
import LeadsSemTag from "./pages/relatorios/LeadsSemTag";
import Alertas from "./pages/Alertas";
import EfeitoAlavanca from "./pages/EfeitoAlavanca";
import Projetos from "./pages/Projetos";
import Credito from "./pages/Credito";
import Leilao from "./pages/Leilao";
import Configuracoes from "./pages/Configuracoes";
import GerenciamentoUsuarios from "./pages/GerenciamentoUsuarios";
import CRM from "./pages/CRM";
import CRMOverview from "./pages/crm/Overview";
import Contatos from "./pages/crm/Contatos";
import Negocios from "./pages/crm/Negocios";
import Origens from "./pages/crm/Origens";
import Grupos from "./pages/crm/Grupos";
import Tags from "./pages/crm/Tags";
import ConfiguracoesCRM from "./pages/crm/Configuracoes";
import ImportarContatos from "./pages/crm/ImportarContatos";
import ImportarNegocios from "./pages/crm/ImportarNegocios";
import ImportarHistorico from "./pages/crm/ImportarHistorico";
import TVSdrPerformance from "./pages/TVSdrPerformance";
import TVSdrFullscreen from "./pages/TVSdrFullscreen";
import TVSdrCelebrationDemo from "./pages/TVSdrCelebrationDemo";
import FechamentoSDRList from "./pages/fechamento-sdr/Index";
import FechamentoSDRDetail from "./pages/fechamento-sdr/Detail";
import FechamentoSDRConfiguracoes from "./pages/fechamento-sdr/Configuracoes";
import MeuFechamento from "./pages/fechamento-sdr/MeuFechamento";
import MeuPlaybook from "./pages/playbook/MeuPlaybook";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Public auth route */}
            <Route path="/auth" element={<Auth />} />
            
            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="receita" element={<Receita />}>
                <Route index element={<ReceitaOverview />} />
                <Route path="a010" element={<A010 />} />
                <Route path="transacoes" element={<ReceitaTransacoes />} />
                <Route path="por-canal" element={<ReceitaPorCanal />} />
                <Route path="importar-hubla" element={<ImportarHubla />} />
              </Route>
              <Route path="importar-a010" element={<ImportarA010 />} />
              <Route path="custos" element={<Custos />}>
                <Route index element={<CustosOverview />} />
                <Route path="despesas" element={<CustosDespesas />} />
                <Route path="por-categoria" element={<CustosPorCategoria />} />
              </Route>
              <Route path="relatorios" element={<Relatorios />} />
              <Route path="relatorios/leads-sem-tag" element={<LeadsSemTag />} />
              <Route path="alertas" element={<Alertas />} />
              <Route path="efeito-alavanca" element={<EfeitoAlavanca />} />
              <Route path="projetos" element={<Projetos />} />
              <Route path="credito" element={<Credito />} />
              <Route path="leilao" element={<Leilao />} />
              <Route path="configuracoes" element={<Configuracoes />} />
              <Route path="usuarios" element={<GerenciamentoUsuarios />} />
              <Route path="tv-sdr" element={<TVSdrPerformance />} />
              <Route path="fechamento-sdr" element={<FechamentoSDRList />} />
              <Route path="fechamento-sdr/configuracoes" element={<FechamentoSDRConfiguracoes />} />
              <Route path="fechamento-sdr/:payoutId" element={<FechamentoSDRDetail />} />
              <Route path="meu-fechamento" element={<MeuFechamento />} />
              <Route path="playbook" element={<MeuPlaybook />} />
              <Route path="crm" element={<CRM />}>
                <Route index element={<CRMOverview />} />
                <Route path="contatos" element={<Contatos />} />
                <Route path="negocios" element={<Negocios />} />
                <Route path="origens" element={<Origens />} />
                <Route path="grupos" element={<Grupos />} />
                <Route path="tags" element={<Tags />} />
                <Route path="importar-contatos" element={<ImportarContatos />} />
                <Route path="importar-negocios" element={<ImportarNegocios />} />
                <Route path="importar-historico" element={<ImportarHistorico />} />
                <Route path="configuracoes" element={<ConfiguracoesCRM />} />
              </Route>
            </Route>
            
            {/* Public fullscreen TV route - no auth required */}
            <Route path="/tv-sdr/fullscreen" element={<TVSdrFullscreen />} />
            <Route path="/tv-sdr/demo-celebration" element={<TVSdrCelebrationDemo />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

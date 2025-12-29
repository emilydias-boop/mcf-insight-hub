import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { TwilioProvider } from "./contexts/TwilioContext";
import { AppearanceProvider } from "./contexts/AppearanceContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ResourceGuard } from "./components/auth/ResourceGuard";
import { RoleGuard } from "./components/auth/RoleGuard";
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
import ReceitaAuditoria from "./pages/receita/Auditoria";
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
import ConfigurarClosers from "./pages/crm/ConfigurarClosers";
import ImportarContatos from "./pages/crm/ImportarContatos";
import ImportarNegocios from "./pages/crm/ImportarNegocios";
import ImportarHistorico from "./pages/crm/ImportarHistorico";
import AuditoriaAgendamentos from "./pages/crm/AuditoriaAgendamentos";
import Atendimentos from "./pages/crm/Atendimentos";
import Agenda from "./pages/crm/Agenda";
import AgendaMetricas from "./pages/crm/AgendaMetricas";
import TVSdrPerformance from "./pages/TVSdrPerformance";
import TVSdrFullscreen from "./pages/TVSdrFullscreen";
import TVSdrCelebrationDemo from "./pages/TVSdrCelebrationDemo";
import FechamentoSDRList from "./pages/fechamento-sdr/Index";
import FechamentoSDRDetail from "./pages/fechamento-sdr/Detail";
import FechamentoSDRConfiguracoes from "./pages/fechamento-sdr/Configuracoes";
import MeuFechamento from "./pages/fechamento-sdr/MeuFechamento";
import MeuPlaybook from "./pages/playbook/MeuPlaybook";
import RHColaboradores from "./pages/rh/Colaboradores";
import Financeiro from "./pages/Financeiro";
import MeuRH from "./pages/MeuRH";
import MinhasReunioes from "./pages/sdr/MinhasReunioes";
import ReunioesEquipe from "./pages/crm/ReunioesEquipe";
import SdrMeetingsDetailPage from "./pages/crm/SdrMeetingsDetailPage";
import NotFound from "./pages/NotFound";
import DashboardSemanas from "./pages/dashboard/Semanas";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppearanceProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <TwilioProvider>
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
              <Route index element={<ResourceGuard resource="dashboard"><Dashboard /></ResourceGuard>} />
              <Route path="dashboard/semanas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><DashboardSemanas /></RoleGuard>} />
              <Route path="receita" element={<ResourceGuard resource="receita"><Receita /></ResourceGuard>}>
                <Route index element={<ReceitaOverview />} />
                <Route path="a010" element={<A010 />} />
                <Route path="transacoes" element={<ReceitaTransacoes />} />
                <Route path="por-canal" element={<ReceitaPorCanal />} />
                <Route path="importar-hubla" element={<ImportarHubla />} />
                <Route path="auditoria" element={<ReceitaAuditoria />} />
              </Route>
              <Route path="importar-a010" element={<ImportarA010 />} />
              <Route path="custos" element={<ResourceGuard resource="custos"><Custos /></ResourceGuard>}>
                <Route index element={<CustosOverview />} />
                <Route path="despesas" element={<CustosDespesas />} />
                <Route path="por-categoria" element={<CustosPorCategoria />} />
              </Route>
              <Route path="relatorios" element={<ResourceGuard resource="relatorios"><Relatorios /></ResourceGuard>} />
              <Route path="relatorios/leads-sem-tag" element={<ResourceGuard resource="relatorios"><LeadsSemTag /></ResourceGuard>} />
              <Route path="alertas" element={<ResourceGuard resource="alertas"><Alertas /></ResourceGuard>} />
              <Route path="efeito-alavanca" element={<ResourceGuard resource="efeito_alavanca"><EfeitoAlavanca /></ResourceGuard>} />
              <Route path="projetos" element={<ResourceGuard resource="projetos"><Projetos /></ResourceGuard>} />
              <Route path="credito" element={<ResourceGuard resource="credito"><Credito /></ResourceGuard>} />
              <Route path="leilao" element={<ResourceGuard resource="leilao"><Leilao /></ResourceGuard>} />
              <Route path="configuracoes" element={<ResourceGuard resource="configuracoes"><Configuracoes /></ResourceGuard>} />
              <Route path="usuarios" element={<ResourceGuard resource="usuarios"><GerenciamentoUsuarios /></ResourceGuard>} />
              <Route path="tv-sdr" element={<ResourceGuard resource="tv_sdr"><TVSdrPerformance /></ResourceGuard>} />
              <Route path="fechamento-sdr" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRList /></ResourceGuard>} />
              <Route path="fechamento-sdr/configuracoes" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRConfiguracoes /></ResourceGuard>} />
              <Route path="fechamento-sdr/:payoutId" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRDetail /></ResourceGuard>} />
              <Route path="meu-fechamento" element={<ResourceGuard resource="fechamento_sdr"><MeuFechamento /></ResourceGuard>} />
              <Route path="playbook" element={<MeuPlaybook />} />
              <Route path="rh/colaboradores" element={<ResourceGuard resource={"rh" as any}><RHColaboradores /></ResourceGuard>} />
              <Route path="financeiro" element={<ResourceGuard resource={"financeiro" as any}><Financeiro /></ResourceGuard>} />
              <Route path="meu-rh" element={<MeuRH />} />
              <Route path="sdr/minhas-reunioes" element={<ResourceGuard resource="crm"><MinhasReunioes /></ResourceGuard>} />
              <Route path="crm/reunioes-equipe" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ReunioesEquipe /></RoleGuard>} />
              <Route path="crm/reunioes-equipe/:sdrEmail" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><SdrMeetingsDetailPage /></RoleGuard>} />
              <Route path="crm/configurar-closers" element={<ResourceGuard resource="configuracoes"><ConfigurarClosers /></ResourceGuard>} />
              <Route path="crm" element={<ResourceGuard resource="crm"><CRM /></ResourceGuard>}>
                <Route index element={<CRMOverview />} />
                <Route path="contatos" element={<Contatos />} />
                <Route path="negocios" element={<Negocios />} />
                <Route path="atendimentos" element={<Atendimentos />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda/metricas" element={<AgendaMetricas />} />
                <Route path="origens" element={<Origens />} />
                <Route path="grupos" element={<Grupos />} />
                <Route path="tags" element={<Tags />} />
                <Route path="importar-contatos" element={<ImportarContatos />} />
                <Route path="importar-negocios" element={<ImportarNegocios />} />
                <Route path="importar-historico" element={<ImportarHistorico />} />
                <Route path="auditoria-agendamentos" element={<AuditoriaAgendamentos />} />
                <Route path="configuracoes" element={<ConfiguracoesCRM />} />
              </Route>
            </Route>
            
            {/* Public fullscreen TV route - no auth required */}
            <Route path="/tv-sdr/fullscreen" element={<TVSdrFullscreen />} />
            <Route path="/tv-sdr/demo-celebration" element={<TVSdrCelebrationDemo />} />
            
            <Route path="*" element={<NotFound />} />
            </Routes>
            </TwilioProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AppearanceProvider>
  </QueryClientProvider>
);

export default App;

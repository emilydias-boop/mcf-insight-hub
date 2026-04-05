import { Toaster } from "@/components/ui/toaster";
import MeuDesempenhoCloser from "./pages/closer/MeuDesempenhoCloser";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { TwilioProvider } from "./contexts/TwilioContext";
import { AppearanceProvider } from "./contexts/AppearanceContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ResourceGuard } from "./components/auth/ResourceGuard";
import { RoleGuard } from "./components/auth/RoleGuard";
import { R2AccessGuard } from "./components/auth/R2AccessGuard";
import { NegociosAccessGuard } from "./components/auth/NegociosAccessGuard";
import { MainLayout } from "./components/layout/MainLayout";
import { UpdateNotifier } from "./components/layout/UpdateNotifier";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { useProductPricesCache } from "./hooks/useProductPricesCache";

// Componente que inicializa o cache de preços na startup
const PriceCacheInitializer = () => {
  useProductPricesCache();
  return null;
};
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Receita from "./pages/receita/Index";
import A010 from "./pages/receita/A010";
import ReceitaTransacoes from "./pages/receita/Transacoes";

import ImportarHubla from "./pages/receita/ImportarHubla";
import ReceitaAuditoria from "./pages/receita/Auditoria";
import Relatorios from "./pages/Relatorios";
import LeadsSemTag from "./pages/relatorios/LeadsSemTag";

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

import Agenda from "./pages/crm/Agenda";

import LeadsLimbo from "./pages/crm/LeadsLimbo";
import RetornosParceiros from "./pages/crm/RetornosParceiros";

import AgendaMetricas from "./pages/crm/AgendaMetricas";
import AgendaR2 from "./pages/crm/AgendaR2";
import R2Carrinho from "./pages/crm/R2Carrinho";
import PosReuniao from "./pages/crm/PosReuniao";
import ConfigurarClosersR2 from "./pages/crm/ConfigurarClosersR2";
import FechamentoSDRList from "./pages/fechamento-sdr/Index";
import FechamentoSDRDetail from "./pages/fechamento-sdr/Detail";
import FechamentoSDRConfiguracoes from "./pages/fechamento-sdr/Configuracoes";
import MeuFechamento from "./pages/fechamento-sdr/MeuFechamento";
import MeuPlaybook from "./pages/playbook/MeuPlaybook";
import TransacoesIncorp from "./pages/bu-incorporador/TransacoesIncorp";
import IncorporadorRelatorios from "./pages/bu-incorporador/Relatorios";

import RHColaboradores from "./pages/rh/Colaboradores";
import ColaboradorProfile from "./pages/rh/ColaboradorProfile";
import ConfiguracoesRH from "./pages/rh/Configuracoes";
import ProvaEquipe from "./pages/rh/ProvaEquipe";
import ExamDetail from "./pages/rh/ExamDetail";
import Financeiro from "./pages/Financeiro";
import Cobrancas from "./pages/Cobrancas";
import MeuRH from "./pages/MeuRH";
import MinhasReunioes from "./pages/sdr/MinhasReunioes";
import SDRCockpit from "./pages/sdr/SDRCockpit";
import ReunioesEquipe from "./pages/crm/ReunioesEquipe";
import SdrMeetingsDetailPage from "./pages/crm/SdrMeetingsDetailPage";
import CloserMeetingsDetailPage from "./pages/crm/CloserMeetingsDetailPage";
import Webhooks from "./pages/crm/Webhooks";
import WebhookAnalytics from "./pages/crm/WebhookAnalytics";
import NotFound from "./pages/NotFound";

import ConsorcioIndex from "./pages/bu-consorcio/Index";

import AdminPermissoes from "./pages/admin/Permissoes";
import AdminRoles from "./pages/admin/Roles";
import ConfiguracaoProdutos from "./pages/admin/ConfiguracaoProdutos";
import LeadDistribution from "./pages/admin/LeadDistribution";
import Automacoes from "./pages/admin/Automacoes";
import ConfiguracaoBU from "./pages/admin/ConfiguracaoBU";

// BU Consórcio - Páginas Unificadas
import ConsorcioFechamento from "./pages/bu-consorcio/Fechamento";
import ConsorcioFechamentoDetail from "./pages/bu-consorcio/FechamentoDetail";
import ConsorcioFechamentoConfig from "./pages/bu-consorcio/FechamentoConfig";

import ConsorcioPainelEquipe from "./pages/bu-consorcio/PainelEquipe";
import ConsorcioVendas from "./pages/bu-consorcio/Vendas";
import ConsorcioPagamentos from "./pages/bu-consorcio/Pagamentos";
import Chairman from "./pages/Chairman";
import Home from "./pages/Home";
import DocumentosEstrategicos from "./pages/bu-common/DocumentosEstrategicos";
import MarketingDashboard from "./pages/bu-marketing/MarketingDashboard";
import CampanhasDashboard from "./pages/bu-marketing/CampanhasDashboard";
import A010AcquisitionDashboard from "./pages/bu-marketing/A010AcquisitionDashboard";
import A010LinkMappingsConfig from "./pages/bu-marketing/A010LinkMappingsConfig";


// Patrimônio (TI)
import PatrimonioIndex from "./pages/patrimonio/Index";
import AssetDetailsPage from "./pages/patrimonio/AssetDetailsPage";
import MyEquipmentPage from "./pages/patrimonio/MyEquipmentPage";
import PatrimonioRelatorios from "./pages/patrimonio/PatrimonioRelatorios";

// BU CRM Layout
import BUCRMLayout from "./pages/crm/BUCRMLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppearanceProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <UpdateNotifier />
        <PriceCacheInitializer />
        <BrowserRouter>
          <AuthProvider>
            <TwilioProvider>
            <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Protected routes */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <MainLayout />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            >
              {/* Home - Main page after login with 4 Moons */}
              <Route path="home" element={<Home />} />
              
              {/* Chairman Dashboard - Executive View */}
              <Route path="chairman" element={<RoleGuard allowedRoles={['admin', 'manager']}><Chairman /></RoleGuard>} />
              
              <Route index element={<Navigate to="/home" replace />} />
              <Route path="dashboard" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Dashboard /></RoleGuard>} />
              
              <Route path="receita" element={<ResourceGuard resource="receita"><Receita /></ResourceGuard>}>
                <Route index element={<Navigate to="a010" replace />} />
                <Route path="a010" element={<A010 />} />
                <Route path="transacoes" element={<ReceitaTransacoes />} />
                <Route path="importar-hubla" element={<ImportarHubla />} />
                <Route path="auditoria" element={<ReceitaAuditoria />} />
              </Route>
              <Route path="relatorios" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Relatorios /></RoleGuard>} />
              <Route path="relatorios/leads-sem-tag" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LeadsSemTag /></RoleGuard>} />
              
              
              {/* BU Consórcio Routes - Unificado */}
              <Route path="consorcio" element={<ResourceGuard resource="crm"><ConsorcioIndex /></ResourceGuard>} />
              
              <Route path="consorcio/fechamento" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioFechamento /></RoleGuard>} />
              <Route path="consorcio/fechamento/configuracoes" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioFechamentoConfig /></RoleGuard>} />
              <Route path="consorcio/fechamento/:payoutId" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioFechamentoDetail /></RoleGuard>} />
              
              <Route path="consorcio/painel-equipe" element={<ResourceGuard resource="crm"><ConsorcioPainelEquipe /></ResourceGuard>} />
              <Route path="consorcio/vendas" element={<ResourceGuard resource="crm"><ConsorcioVendas /></ResourceGuard>} />
              <Route path="consorcio/pagamentos" element={<ResourceGuard resource="crm"><ConsorcioPagamentos /></ResourceGuard>} />
              <Route path="consorcio/documentos-estrategicos" element={<ResourceGuard resource="relatorios"><DocumentosEstrategicos bu="consorcio" /></ResourceGuard>} />
              
              {/* BU Consórcio CRM - Dedicado */}
              <Route path="consorcio/crm" element={<ResourceGuard resource="crm"><BUCRMLayout bu="consorcio" basePath="/consorcio/crm" /></ResourceGuard>}>
                <Route index element={<CRMOverview />} />
                <Route path="contatos" element={<Contatos />} />
                <Route path="negocios" element={<Negocios />} />
                
                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda-r2" element={<R2AccessGuard><AgendaR2 /></R2AccessGuard>} />
                <Route path="r2-carrinho" element={<R2AccessGuard><R2Carrinho /></R2AccessGuard>} />
                
                <Route path="leads-limbo" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LeadsLimbo /></RoleGuard>} />
                
                <Route path="auditoria-agendamentos" element={<AuditoriaAgendamentos />} />
                <Route path="pos-reuniao" element={<PosReuniao />} />
                <Route path="configuracoes" element={<ConfiguracoesCRM />} />
              </Route>
              
              
              {/* BU Marketing Routes */}
              <Route path="bu-marketing" element={<ResourceGuard resource="dashboard"><MarketingDashboard /></ResourceGuard>} />
              <Route path="bu-marketing/campanhas" element={<ResourceGuard resource="dashboard"><CampanhasDashboard /></ResourceGuard>} />
              <Route path="bu-marketing/aquisicao-a010" element={<ResourceGuard resource="dashboard"><A010AcquisitionDashboard /></ResourceGuard>} />
              <Route path="bu-marketing/a010-links-config" element={<ResourceGuard resource="dashboard" requiredLevel="edit"><A010LinkMappingsConfig /></ResourceGuard>} />
              <Route path="bu-marketing/documentos-estrategicos" element={<ResourceGuard resource="relatorios"><DocumentosEstrategicos bu="marketing" /></ResourceGuard>} />
              <Route path="configuracoes" element={<ResourceGuard resource="configuracoes"><Configuracoes /></ResourceGuard>} />
              <Route path="usuarios" element={<ResourceGuard resource="usuarios"><GerenciamentoUsuarios /></ResourceGuard>} />
              <Route path="admin/permissoes" element={<RoleGuard allowedRoles={['admin']}><AdminPermissoes /></RoleGuard>} />
              <Route path="admin/roles" element={<RoleGuard allowedRoles={['admin']}><AdminRoles /></RoleGuard>} />
              <Route path="admin/produtos" element={<RoleGuard allowedRoles={['admin']}><ConfiguracaoProdutos /></RoleGuard>} />
              
              <Route path="admin/automacoes" element={<RoleGuard allowedRoles={['admin']}><Automacoes /></RoleGuard>} />
              <Route path="admin/configuracao-bu" element={<RoleGuard allowedRoles={['admin', 'manager']}><ConfiguracaoBU /></RoleGuard>} />
              
              <Route path="fechamento-sdr" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRList /></ResourceGuard>} />
              <Route path="fechamento-sdr/configuracoes" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRConfiguracoes /></ResourceGuard>} />
              <Route path="fechamento-sdr/:payoutId" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRDetail /></ResourceGuard>} />
              <Route path="meu-fechamento" element={<RoleGuard allowedRoles={['sdr', 'closer']}><MeuFechamento /></RoleGuard>} />
              
              {/* BU Incorporador Routes */}
              <Route path="bu-incorporador/transacoes" element={<ResourceGuard resource="crm"><TransacoesIncorp /></ResourceGuard>} />
              <Route path="bu-incorporador/relatorios" element={<ResourceGuard resource="relatorios"><IncorporadorRelatorios /></ResourceGuard>} />
              <Route path="bu-incorporador/documentos-estrategicos" element={<ResourceGuard resource="relatorios"><DocumentosEstrategicos bu="incorporador" /></ResourceGuard>} />
              
              <Route path="playbook" element={<MeuPlaybook />} />
              <Route path="rh/colaboradores" element={<ResourceGuard resource={"rh" as any}><RHColaboradores /></ResourceGuard>} />
              <Route path="rh/colaboradores/:id" element={<ResourceGuard resource={"rh" as any}><ColaboradorProfile /></ResourceGuard>} />
              <Route path="rh/prova-equipe" element={<RoleGuard allowedRoles={['admin', 'rh']}><ProvaEquipe /></RoleGuard>} />
              <Route path="rh/prova-equipe/:id" element={<RoleGuard allowedRoles={['admin', 'rh']}><ExamDetail /></RoleGuard>} />
              <Route path="rh/configuracoes" element={<RoleGuard allowedRoles={['admin', 'manager']}><ConfiguracoesRH /></RoleGuard>} />
              <Route path="financeiro" element={<ResourceGuard resource={"financeiro" as any}><Financeiro /></ResourceGuard>} />
              <Route path="cobrancas" element={<RoleGuard allowedRoles={['admin', 'financeiro']}><Cobrancas /></RoleGuard>} />
              
              
              
              <Route path="meu-rh" element={<MeuRH />} />
              <Route path="patrimonio" element={<ResourceGuard resource="patrimonio"><PatrimonioIndex /></ResourceGuard>} />
              <Route path="patrimonio/meus-equipamentos" element={<MyEquipmentPage />} />
              <Route path="patrimonio/relatorios" element={<ResourceGuard resource="patrimonio"><PatrimonioRelatorios /></ResourceGuard>} />
              <Route path="patrimonio/:id" element={<ResourceGuard resource="patrimonio"><AssetDetailsPage /></ResourceGuard>} />
              <Route path="sdr/cockpit" element={<RoleGuard allowedRoles={['sdr']}><SDRCockpit /></RoleGuard>} />
              <Route path="sdr/minhas-reunioes" element={<RoleGuard allowedRoles={['sdr', 'closer']}><MinhasReunioes /></RoleGuard>} />
              <Route path="closer/meu-desempenho" element={<RoleGuard allowedRoles={['closer']}><MeuDesempenhoCloser /></RoleGuard>} />
              <Route path="crm/reunioes-equipe" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer', 'closer_sombra']}><ReunioesEquipe /></RoleGuard>} />
              <Route path="crm/reunioes-equipe/:sdrEmail" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><SdrMeetingsDetailPage /></RoleGuard>} />
              <Route path="crm/reunioes-equipe/closer/:closerId" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><CloserMeetingsDetailPage /></RoleGuard>} />
              <Route path="crm/configurar-closers" element={<ResourceGuard resource="configuracoes"><ConfigurarClosers /></ResourceGuard>} />
              <Route path="crm" element={<ResourceGuard resource="crm"><CRM /></ResourceGuard>}>
                <Route index element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><CRMOverview /></RoleGuard>} />
                <Route path="contatos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer', 'closer_sombra']}><Contatos /></RoleGuard>} />
                <Route path="negocios" element={<NegociosAccessGuard><Negocios /></NegociosAccessGuard>} />
                
                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda/metricas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><AgendaMetricas /></RoleGuard>} />
                <Route path="agenda-r2" element={<R2AccessGuard><AgendaR2 /></R2AccessGuard>} />
                <Route path="r2-carrinho" element={<R2AccessGuard><R2Carrinho /></R2AccessGuard>} />
                <Route path="configurar-closers-r2" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConfigurarClosersR2 /></RoleGuard>} />
                <Route path="origens" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Origens /></RoleGuard>} />
                <Route path="grupos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Grupos /></RoleGuard>} />
                <Route path="tags" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Tags /></RoleGuard>} />
                <Route path="importar-contatos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ImportarContatos /></RoleGuard>} />
                <Route path="importar-negocios" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ImportarNegocios /></RoleGuard>} />
                <Route path="importar-historico" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ImportarHistorico /></RoleGuard>} />
                
                <Route path="leads-limbo" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LeadsLimbo /></RoleGuard>} />
                
                <Route path="retornos-parceiros" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><RetornosParceiros /></RoleGuard>} />
                <Route path="auditoria-agendamentos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><AuditoriaAgendamentos /></RoleGuard>} />

                <Route path="webhooks" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Webhooks /></RoleGuard>} />
                <Route path="webhook-analytics" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><WebhookAnalytics /></RoleGuard>} />
                <Route path="configuracoes" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConfiguracoesCRM /></RoleGuard>} />
              </Route>
            </Route>
            
            
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

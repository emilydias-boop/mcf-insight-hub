import { Toaster } from "@/components/ui/toaster";
import MeuDesempenhoCloser from "./pages/closer/MeuDesempenhoCloser";
import Tarefas from "./pages/Tarefas";
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
import DealsOrfaos from "./pages/crm/DealsOrfaos";
import LeadsLimbo from "./pages/crm/LeadsLimbo";
import RetornosParceiros from "./pages/crm/RetornosParceiros";
import ContatosDuplicados from "./pages/crm/ContatosDuplicados";
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
import ConfiguracoesRH from "./pages/rh/Configuracoes";
import ProvaEquipe from "./pages/rh/ProvaEquipe";
import Financeiro from "./pages/Financeiro";
import MeuRH from "./pages/MeuRH";
import MinhasReunioes from "./pages/sdr/MinhasReunioes";
import ReunioesEquipe from "./pages/crm/ReunioesEquipe";
import SdrMeetingsDetailPage from "./pages/crm/SdrMeetingsDetailPage";
import CloserMeetingsDetailPage from "./pages/crm/CloserMeetingsDetailPage";
import Webhooks from "./pages/crm/Webhooks";
import NotFound from "./pages/NotFound";
import DashboardSemanas from "./pages/dashboard/Semanas";
import ConsorcioIndex from "./pages/bu-consorcio/Index";
import ConsorcioImportar from "./pages/bu-consorcio/Importar";
import AdminPermissoes from "./pages/admin/Permissoes";
import ConfiguracaoProdutos from "./pages/admin/ConfiguracaoProdutos";
import LeadDistribution from "./pages/admin/LeadDistribution";
import Automacoes from "./pages/admin/Automacoes";
import ConfiguracaoBU from "./pages/admin/ConfiguracaoBU";
import BUCreditoIndex from "./pages/bu-credito/Index";
import CreditoOverview from "./pages/bu-credito/Overview";
import CreditoDeals from "./pages/bu-credito/Deals";
import CreditoSocios from "./pages/bu-credito/Socios";
import CreditoClientes from "./pages/bu-credito/Clientes";
import CreditoVendas from "./pages/bu-credito/Vendas";
import CreditoRelatorios from "./pages/bu-credito/Relatorios";

// BU Projetos
import BUProjetosIndex from "./pages/bu-projetos/Index";
import ProjetosVendas from "./pages/bu-projetos/Vendas";
import ProjetosRelatorios from "./pages/bu-projetos/Relatorios";

// BU Outros
import BUOutrosIndex from "./pages/bu-outros/Index";
import OutrosVendas from "./pages/bu-outros/Vendas";

// BU Consórcio - Páginas Unificadas
import ConsorcioFechamento from "./pages/bu-consorcio/Fechamento";
import ConsorcioFechamentoDetail from "./pages/bu-consorcio/FechamentoDetail";
import ConsorcioFechamentoConfig from "./pages/bu-consorcio/FechamentoConfig";
import ConsorcioRelatorio from "./pages/bu-consorcio/Relatorio";
import ConsorcioPainelEquipe from "./pages/bu-consorcio/PainelEquipe";
import ConsorcioVendas from "./pages/bu-consorcio/Vendas";
import Chairman from "./pages/Chairman";
import Home from "./pages/Home";
import DocumentosEstrategicos from "./pages/bu-common/DocumentosEstrategicos";
import MarketingDashboard from "./pages/bu-marketing/MarketingDashboard";
import CampanhasDashboard from "./pages/bu-marketing/CampanhasDashboard";
import A010AcquisitionDashboard from "./pages/bu-marketing/A010AcquisitionDashboard";
import A010LinkMappingsConfig from "./pages/bu-marketing/A010LinkMappingsConfig";

// Gerentes de Conta
import GerenciamentoGRIndex from "./pages/gerentes-conta/Index";
import MinhaCarteira from "./pages/gerentes-conta/MinhaCarteira";
import GestaoCarteiras from "./pages/gerentes-conta/GestaoCarteiras";
import GRDetail from "./pages/gerentes-conta/GRDetail";

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
            {/* Public auth route */}
            <Route path="/auth" element={<Auth />} />
            
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
              <Route path="dashboard" element={<ResourceGuard resource="dashboard"><Dashboard /></ResourceGuard>} />
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
              
              {/* BU Consórcio Routes - Unificado */}
              <Route path="consorcio" element={<RoleGuard allowedRoles={['admin', 'manager', 'sdr', 'closer', 'coordenador']}><ConsorcioIndex /></RoleGuard>} />
              <Route path="consorcio/importar" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioImportar /></RoleGuard>} />
              <Route path="consorcio/fechamento" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioFechamento /></RoleGuard>} />
              <Route path="consorcio/fechamento/configuracoes" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioFechamentoConfig /></RoleGuard>} />
              <Route path="consorcio/fechamento/:payoutId" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioFechamentoDetail /></RoleGuard>} />
              <Route path="consorcio/relatorio" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioRelatorio /></RoleGuard>} />
              <Route path="consorcio/painel-equipe" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer']}><ConsorcioPainelEquipe /></RoleGuard>} />
              <Route path="consorcio/vendas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioVendas /></RoleGuard>} />
              <Route path="consorcio/documentos-estrategicos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><DocumentosEstrategicos bu="consorcio" /></RoleGuard>} />
              
              {/* BU Consórcio CRM - Dedicado */}
              <Route path="consorcio/crm" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer']}><BUCRMLayout bu="consorcio" basePath="/consorcio/crm" /></RoleGuard>}>
                <Route index element={<CRMOverview />} />
                <Route path="contatos" element={<Contatos />} />
                <Route path="negocios" element={<Negocios />} />
                <Route path="atendimentos" element={<Atendimentos />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda-r2" element={<R2AccessGuard><AgendaR2 /></R2AccessGuard>} />
                <Route path="r2-carrinho" element={<R2AccessGuard><R2Carrinho /></R2AccessGuard>} />
                <Route path="deals-orfaos" element={<DealsOrfaos />} />
                <Route path="leads-limbo" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LeadsLimbo /></RoleGuard>} />
                <Route path="contatos-duplicados" element={<ContatosDuplicados />} />
                <Route path="auditoria-agendamentos" element={<AuditoriaAgendamentos />} />
                <Route path="pos-reuniao" element={<PosReuniao />} />
                <Route path="configuracoes" element={<ConfiguracoesCRM />} />
              </Route>
              
              <Route path="projetos" element={<ResourceGuard resource="projetos"><Projetos /></ResourceGuard>} />
              <Route path="credito" element={<ResourceGuard resource="credito"><Credito /></ResourceGuard>} />
              
              {/* BU Crédito Routes */}
              <Route path="bu-credito" element={<BUCreditoIndex />}>
                <Route index element={<CreditoOverview />} />
                <Route path="overview" element={<CreditoOverview />} />
                <Route path="deals" element={<CreditoDeals />} />
                <Route path="socios" element={<CreditoSocios />} />
                <Route path="clientes" element={<CreditoClientes />} />
                <Route path="vendas" element={<CreditoVendas />} />
              </Route>
              <Route path="bu-credito/relatorios" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><CreditoRelatorios /></RoleGuard>} />
              <Route path="bu-credito/documentos-estrategicos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><DocumentosEstrategicos bu="credito" /></RoleGuard>} />
              
              {/* BU Crédito CRM - Dedicado */}
              <Route path="bu-credito/crm" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer']}><BUCRMLayout bu="credito" basePath="/bu-credito/crm" /></RoleGuard>}>
                <Route index element={<CRMOverview />} />
                <Route path="contatos" element={<Contatos />} />
                <Route path="negocios" element={<Negocios />} />
                <Route path="atendimentos" element={<Atendimentos />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda-r2" element={<R2AccessGuard><AgendaR2 /></R2AccessGuard>} />
                <Route path="r2-carrinho" element={<R2AccessGuard><R2Carrinho /></R2AccessGuard>} />
                <Route path="deals-orfaos" element={<DealsOrfaos />} />
                <Route path="contatos-duplicados" element={<ContatosDuplicados />} />
                <Route path="auditoria-agendamentos" element={<AuditoriaAgendamentos />} />
                <Route path="configuracoes" element={<ConfiguracoesCRM />} />
              </Route>
              
              {/* BU Projetos Routes */}
              <Route path="bu-projetos" element={<BUProjetosIndex />}>
                <Route index element={<ProjetosVendas />} />
                <Route path="vendas" element={<ProjetosVendas />} />
              </Route>
              <Route path="bu-projetos/relatorios" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ProjetosRelatorios /></RoleGuard>} />
              <Route path="bu-projetos/documentos-estrategicos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><DocumentosEstrategicos bu="projetos" /></RoleGuard>} />
              
              {/* BU Projetos CRM - Dedicado */}
              <Route path="bu-projetos/crm" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer']}><BUCRMLayout bu="projetos" basePath="/bu-projetos/crm" /></RoleGuard>}>
                <Route index element={<CRMOverview />} />
                <Route path="contatos" element={<Contatos />} />
                <Route path="negocios" element={<Negocios />} />
                <Route path="atendimentos" element={<Atendimentos />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda-r2" element={<R2AccessGuard><AgendaR2 /></R2AccessGuard>} />
                <Route path="r2-carrinho" element={<R2AccessGuard><R2Carrinho /></R2AccessGuard>} />
                <Route path="deals-orfaos" element={<DealsOrfaos />} />
                <Route path="contatos-duplicados" element={<ContatosDuplicados />} />
                <Route path="auditoria-agendamentos" element={<AuditoriaAgendamentos />} />
                <Route path="configuracoes" element={<ConfiguracoesCRM />} />
              </Route>
              
              {/* BU Outros Routes */}
              <Route path="bu-outros" element={<BUOutrosIndex />}>
                <Route index element={<OutrosVendas />} />
                <Route path="vendas" element={<OutrosVendas />} />
              </Route>
              
              {/* BU Leilão CRM - Dedicado */}
              <Route path="leilao/crm" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer']}><BUCRMLayout bu="leilao" basePath="/leilao/crm" /></RoleGuard>}>
                <Route index element={<CRMOverview />} />
                <Route path="contatos" element={<Contatos />} />
                <Route path="negocios" element={<Negocios />} />
                <Route path="atendimentos" element={<Atendimentos />} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda-r2" element={<R2AccessGuard><AgendaR2 /></R2AccessGuard>} />
                <Route path="r2-carrinho" element={<R2AccessGuard><R2Carrinho /></R2AccessGuard>} />
                <Route path="deals-orfaos" element={<DealsOrfaos />} />
                <Route path="contatos-duplicados" element={<ContatosDuplicados />} />
                <Route path="auditoria-agendamentos" element={<AuditoriaAgendamentos />} />
                <Route path="configuracoes" element={<ConfiguracoesCRM />} />
              </Route>
              
              <Route path="leilao/documentos-estrategicos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><DocumentosEstrategicos bu="leilao" /></RoleGuard>} />
              <Route path="leilao" element={<ResourceGuard resource="leilao"><Leilao /></ResourceGuard>} />
              
              {/* BU Marketing Routes */}
              <Route path="bu-marketing" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><MarketingDashboard /></RoleGuard>} />
              <Route path="bu-marketing/campanhas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><CampanhasDashboard /></RoleGuard>} />
              <Route path="bu-marketing/aquisicao-a010" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><A010AcquisitionDashboard /></RoleGuard>} />
              <Route path="bu-marketing/a010-links-config" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><A010LinkMappingsConfig /></RoleGuard>} />
              <Route path="bu-marketing/documentos-estrategicos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><DocumentosEstrategicos bu="marketing" /></RoleGuard>} />
              <Route path="configuracoes" element={<ResourceGuard resource="configuracoes"><Configuracoes /></ResourceGuard>} />
              <Route path="usuarios" element={<ResourceGuard resource="usuarios"><GerenciamentoUsuarios /></ResourceGuard>} />
              <Route path="admin/permissoes" element={<RoleGuard allowedRoles={['admin']}><AdminPermissoes /></RoleGuard>} />
              <Route path="admin/produtos" element={<RoleGuard allowedRoles={['admin']}><ConfiguracaoProdutos /></RoleGuard>} />
              <Route path="admin/distribuicao-leads" element={<RoleGuard allowedRoles={['admin', 'manager']}><LeadDistribution /></RoleGuard>} />
              <Route path="admin/automacoes" element={<RoleGuard allowedRoles={['admin']}><Automacoes /></RoleGuard>} />
              <Route path="admin/configuracao-bu" element={<RoleGuard allowedRoles={['admin', 'manager']}><ConfiguracaoBU /></RoleGuard>} />
              
              <Route path="fechamento-sdr" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRList /></ResourceGuard>} />
              <Route path="fechamento-sdr/configuracoes" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRConfiguracoes /></ResourceGuard>} />
              <Route path="fechamento-sdr/:payoutId" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRDetail /></ResourceGuard>} />
              <Route path="meu-fechamento" element={<RoleGuard allowedRoles={['sdr', 'closer']}><MeuFechamento /></RoleGuard>} />
              
              {/* BU Incorporador Routes */}
              <Route path="bu-incorporador/transacoes" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><TransacoesIncorp /></RoleGuard>} />
              <Route path="bu-incorporador/relatorios" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><IncorporadorRelatorios /></RoleGuard>} />
              <Route path="bu-incorporador/documentos-estrategicos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><DocumentosEstrategicos bu="incorporador" /></RoleGuard>} />
              
              <Route path="playbook" element={<MeuPlaybook />} />
              <Route path="rh/colaboradores" element={<ResourceGuard resource={"rh" as any}><RHColaboradores /></ResourceGuard>} />
              <Route path="rh/prova-equipe" element={<RoleGuard allowedRoles={['admin', 'rh']}><ProvaEquipe /></RoleGuard>} />
              <Route path="rh/configuracoes" element={<RoleGuard allowedRoles={['admin', 'manager']}><ConfiguracoesRH /></RoleGuard>} />
              <Route path="financeiro" element={<ResourceGuard resource={"financeiro" as any}><Financeiro /></ResourceGuard>} />
              <Route path="tarefas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Tarefas /></RoleGuard>} />
              
              {/* Gerentes de Conta Routes */}
              <Route path="gerentes-conta" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'gr']}><GerenciamentoGRIndex /></RoleGuard>}>
                <Route index element={<MinhaCarteira />} />
                <Route path="minha-carteira" element={<MinhaCarteira />} />
                <Route path="gestao" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><GestaoCarteiras /></RoleGuard>} />
                <Route path="gestao/:walletId" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><GRDetail /></RoleGuard>} />
              </Route>
              
              <Route path="meu-rh" element={<MeuRH />} />
              <Route path="patrimonio" element={<ResourceGuard resource="patrimonio"><PatrimonioIndex /></ResourceGuard>} />
              <Route path="patrimonio/meus-equipamentos" element={<MyEquipmentPage />} />
              <Route path="patrimonio/relatorios" element={<ResourceGuard resource="patrimonio"><PatrimonioRelatorios /></ResourceGuard>} />
              <Route path="patrimonio/:id" element={<ResourceGuard resource="patrimonio"><AssetDetailsPage /></ResourceGuard>} />
              <Route path="sdr/minhas-reunioes" element={<RoleGuard allowedRoles={['sdr', 'closer']}><MinhasReunioes /></RoleGuard>} />
              <Route path="closer/meu-desempenho" element={<RoleGuard allowedRoles={['closer']}><MeuDesempenhoCloser /></RoleGuard>} />
              <Route path="crm/reunioes-equipe" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer', 'closer_sombra']}><ReunioesEquipe /></RoleGuard>} />
              <Route path="crm/reunioes-equipe/:sdrEmail" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><SdrMeetingsDetailPage /></RoleGuard>} />
              <Route path="crm/reunioes-equipe/closer/:closerId" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><CloserMeetingsDetailPage /></RoleGuard>} />
              <Route path="crm/configurar-closers" element={<ResourceGuard resource="configuracoes"><ConfigurarClosers /></ResourceGuard>} />
              <Route path="crm" element={<ResourceGuard resource="crm"><CRM /></ResourceGuard>}>
                <Route index element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><CRMOverview /></RoleGuard>} />
                <Route path="contatos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Contatos /></RoleGuard>} />
                <Route path="negocios" element={<NegociosAccessGuard><Negocios /></NegociosAccessGuard>} />
                <Route path="atendimentos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Atendimentos /></RoleGuard>} />
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
                <Route path="deals-orfaos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><DealsOrfaos /></RoleGuard>} />
                <Route path="leads-limbo" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LeadsLimbo /></RoleGuard>} />
                <Route path="contatos-duplicados" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ContatosDuplicados /></RoleGuard>} />
                <Route path="retornos-parceiros" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><RetornosParceiros /></RoleGuard>} />
                
                <Route path="webhooks" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Webhooks /></RoleGuard>} />
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

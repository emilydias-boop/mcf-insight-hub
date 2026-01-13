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
import DealsOrfaos from "./pages/crm/DealsOrfaos";
import ContatosDuplicados from "./pages/crm/ContatosDuplicados";
import AgendaMetricas from "./pages/crm/AgendaMetricas";
import FechamentoSDRList from "./pages/fechamento-sdr/Index";
import FechamentoSDRDetail from "./pages/fechamento-sdr/Detail";
import FechamentoSDRConfiguracoes from "./pages/fechamento-sdr/Configuracoes";
import MeuFechamento from "./pages/fechamento-sdr/MeuFechamento";
import MeuPlaybook from "./pages/playbook/MeuPlaybook";
import TransacoesIncorp from "./pages/bu-incorporador/TransacoesIncorp";
import RelatorioSdrIncorp from "./pages/bu-incorporador/RelatorioSdr";
import RHColaboradores from "./pages/rh/Colaboradores";
import Financeiro from "./pages/Financeiro";
import MeuRH from "./pages/MeuRH";
import MinhasReunioes from "./pages/sdr/MinhasReunioes";
import ReunioesEquipe from "./pages/crm/ReunioesEquipe";
import SdrMeetingsDetailPage from "./pages/crm/SdrMeetingsDetailPage";
import Webhooks from "./pages/crm/Webhooks";
import NotFound from "./pages/NotFound";
import DashboardSemanas from "./pages/dashboard/Semanas";
import ConsorcioIndex from "./pages/bu-consorcio/Index";
import ConsorcioImportar from "./pages/bu-consorcio/Importar";
import AdminPermissoes from "./pages/admin/Permissoes";
import BUCreditoIndex from "./pages/bu-credito/Index";
import CreditoOverview from "./pages/bu-credito/Overview";
import CreditoDeals from "./pages/bu-credito/Deals";
import CreditoSocios from "./pages/bu-credito/Socios";
import CreditoClientes from "./pages/bu-credito/Clientes";

// BU Consórcio - Inside
import InsideConsorcioFechamento from "./pages/bu-consorcio/inside/Fechamento";
import InsideConsorcioRelatorio from "./pages/bu-consorcio/inside/Relatorio";
import InsideConsorcioCRM from "./pages/bu-consorcio/inside/CRM";
import InsideConsorcioPainelEquipe from "./pages/bu-consorcio/inside/PainelEquipe";
import InsideConsorcioVendas from "./pages/bu-consorcio/inside/Vendas";
import InsideConsorcioControleCartas from "./pages/bu-consorcio/inside/ControleCartas";

// BU Consórcio - Life
import LifeConsorcioFechamento from "./pages/bu-consorcio/life/Fechamento";
import LifeConsorcioRelatorio from "./pages/bu-consorcio/life/Relatorio";
import LifeConsorcioCRM from "./pages/bu-consorcio/life/CRM";
import LifeConsorcioPainelEquipe from "./pages/bu-consorcio/life/PainelEquipe";
import LifeConsorcioVendas from "./pages/bu-consorcio/life/Vendas";
import LifeConsorcioControleCartas from "./pages/bu-consorcio/life/ControleCartas";

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
              
              {/* BU Consórcio Routes */}
              <Route path="consorcio" element={<RoleGuard allowedRoles={['admin', 'manager', 'sdr', 'closer', 'coordenador']}><ConsorcioIndex /></RoleGuard>} />
              <Route path="consorcio/importar" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioImportar /></RoleGuard>} />
              
              {/* BU Consórcio - Inside */}
              <Route path="consorcio/inside/controle-cartas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><InsideConsorcioControleCartas /></RoleGuard>} />
              <Route path="consorcio/inside/fechamento" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><InsideConsorcioFechamento /></RoleGuard>} />
              <Route path="consorcio/inside/relatorio" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><InsideConsorcioRelatorio /></RoleGuard>} />
              <Route path="consorcio/inside/crm" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><InsideConsorcioCRM /></RoleGuard>} />
              <Route path="consorcio/inside/painel-equipe" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><InsideConsorcioPainelEquipe /></RoleGuard>} />
              <Route path="consorcio/inside/vendas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><InsideConsorcioVendas /></RoleGuard>} />
              
              {/* BU Consórcio - Life */}
              <Route path="consorcio/life/controle-cartas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LifeConsorcioControleCartas /></RoleGuard>} />
              <Route path="consorcio/life/fechamento" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LifeConsorcioFechamento /></RoleGuard>} />
              <Route path="consorcio/life/relatorio" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LifeConsorcioRelatorio /></RoleGuard>} />
              <Route path="consorcio/life/crm" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LifeConsorcioCRM /></RoleGuard>} />
              <Route path="consorcio/life/painel-equipe" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LifeConsorcioPainelEquipe /></RoleGuard>} />
              <Route path="consorcio/life/vendas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><LifeConsorcioVendas /></RoleGuard>} />
              
              <Route path="projetos" element={<ResourceGuard resource="projetos"><Projetos /></ResourceGuard>} />
              <Route path="credito" element={<ResourceGuard resource="credito"><Credito /></ResourceGuard>} />
              
              {/* BU Crédito Routes */}
              <Route path="bu-credito" element={<BUCreditoIndex />}>
                <Route index element={<CreditoOverview />} />
                <Route path="overview" element={<CreditoOverview />} />
                <Route path="deals" element={<CreditoDeals />} />
                <Route path="socios" element={<CreditoSocios />} />
                <Route path="clientes" element={<CreditoClientes />} />
              </Route>
              
              <Route path="leilao" element={<ResourceGuard resource="leilao"><Leilao /></ResourceGuard>} />
              <Route path="configuracoes" element={<ResourceGuard resource="configuracoes"><Configuracoes /></ResourceGuard>} />
              <Route path="usuarios" element={<ResourceGuard resource="usuarios"><GerenciamentoUsuarios /></ResourceGuard>} />
              <Route path="admin/permissoes" element={<RoleGuard allowedRoles={['admin']}><AdminPermissoes /></RoleGuard>} />
              
              <Route path="fechamento-sdr" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRList /></ResourceGuard>} />
              <Route path="fechamento-sdr/configuracoes" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRConfiguracoes /></ResourceGuard>} />
              <Route path="fechamento-sdr/:payoutId" element={<ResourceGuard resource="fechamento_sdr"><FechamentoSDRDetail /></ResourceGuard>} />
              <Route path="meu-fechamento" element={<ResourceGuard resource="fechamento_sdr"><MeuFechamento /></ResourceGuard>} />
              
              {/* BU Incorporador Routes */}
              <Route path="bu-incorporador/transacoes" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><TransacoesIncorp /></RoleGuard>} />
              <Route path="bu-incorporador/relatorio-sdr" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><RelatorioSdrIncorp /></RoleGuard>} />
              <Route path="playbook" element={<MeuPlaybook />} />
              <Route path="rh/colaboradores" element={<ResourceGuard resource={"rh" as any}><RHColaboradores /></ResourceGuard>} />
              <Route path="financeiro" element={<ResourceGuard resource={"financeiro" as any}><Financeiro /></ResourceGuard>} />
              <Route path="meu-rh" element={<MeuRH />} />
              <Route path="sdr/minhas-reunioes" element={<ResourceGuard resource="crm"><MinhasReunioes /></ResourceGuard>} />
              <Route path="crm/reunioes-equipe" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr']}><ReunioesEquipe /></RoleGuard>} />
              <Route path="crm/reunioes-equipe/:sdrEmail" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><SdrMeetingsDetailPage /></RoleGuard>} />
              <Route path="crm/configurar-closers" element={<ResourceGuard resource="configuracoes"><ConfigurarClosers /></ResourceGuard>} />
              <Route path="crm" element={<ResourceGuard resource="crm"><CRM /></ResourceGuard>}>
                <Route index element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><CRMOverview /></RoleGuard>} />
                <Route path="contatos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Contatos /></RoleGuard>} />
                <Route path="negocios" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Negocios /></RoleGuard>} />
                <Route path="atendimentos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Atendimentos /></RoleGuard>} />
                <Route path="agenda" element={<Agenda />} />
                <Route path="agenda/metricas" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><AgendaMetricas /></RoleGuard>} />
                <Route path="origens" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Origens /></RoleGuard>} />
                <Route path="grupos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Grupos /></RoleGuard>} />
                <Route path="tags" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><Tags /></RoleGuard>} />
                <Route path="importar-contatos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ImportarContatos /></RoleGuard>} />
                <Route path="importar-negocios" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ImportarNegocios /></RoleGuard>} />
                <Route path="importar-historico" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ImportarHistorico /></RoleGuard>} />
                <Route path="deals-orfaos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><DealsOrfaos /></RoleGuard>} />
                <Route path="contatos-duplicados" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ContatosDuplicados /></RoleGuard>} />
                <Route path="auditoria-agendamentos" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><AuditoriaAgendamentos /></RoleGuard>} />
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

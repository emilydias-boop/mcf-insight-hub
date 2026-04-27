import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
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
import { Loader2 } from "lucide-react";

// Componente que inicializa o cache de preços na startup
const PriceCacheInitializer = () => {
  useProductPricesCache();
  return null;
};

// Eager — auth/landing pages (small, always needed first)
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

// Lazy — all other routes (split into per-route chunks)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MeuDesempenhoCloser = lazy(() => import("./pages/closer/MeuDesempenhoCloser"));
const Receita = lazy(() => import("./pages/receita/Index"));
const A010 = lazy(() => import("./pages/receita/A010"));
const ReceitaTransacoes = lazy(() => import("./pages/receita/Transacoes"));
const ImportarHubla = lazy(() => import("./pages/receita/ImportarHubla"));
const ReceitaAuditoria = lazy(() => import("./pages/receita/Auditoria"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const LeadsSemTag = lazy(() => import("./pages/relatorios/LeadsSemTag"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const GerenciamentoUsuarios = lazy(() => import("./pages/GerenciamentoUsuarios"));
const CRM = lazy(() => import("./pages/CRM"));
const CRMOverview = lazy(() => import("./pages/crm/Overview"));
const Contatos = lazy(() => import("./pages/crm/Contatos"));
const Negocios = lazy(() => import("./pages/crm/Negocios"));
const Origens = lazy(() => import("./pages/crm/Origens"));
const Grupos = lazy(() => import("./pages/crm/Grupos"));
const Tags = lazy(() => import("./pages/crm/Tags"));
const ConfiguracoesCRM = lazy(() => import("./pages/crm/Configuracoes"));
const ConfigurarClosers = lazy(() => import("./pages/crm/ConfigurarClosers"));
const ImportarContatos = lazy(() => import("./pages/crm/ImportarContatos"));
const ImportarNegocios = lazy(() => import("./pages/crm/ImportarNegocios"));
const ImportarHistorico = lazy(() => import("./pages/crm/ImportarHistorico"));
const AuditoriaAgendamentos = lazy(() => import("./pages/crm/AuditoriaAgendamentos"));
const Agenda = lazy(() => import("./pages/crm/Agenda"));
const LeadsLimbo = lazy(() => import("./pages/crm/LeadsLimbo"));
const RetornosParceiros = lazy(() => import("./pages/crm/RetornosParceiros"));
const AgendaMetricas = lazy(() => import("./pages/crm/AgendaMetricas"));
const AgendaR2 = lazy(() => import("./pages/crm/AgendaR2"));
const R2Carrinho = lazy(() => import("./pages/crm/R2Carrinho"));
const PosReuniao = lazy(() => import("./pages/crm/PosReuniao"));
const ConfigurarClosersR2 = lazy(() => import("./pages/crm/ConfigurarClosersR2"));
const FechamentoSDRList = lazy(() => import("./pages/fechamento-sdr/Index"));
const FechamentoSDRDetail = lazy(() => import("./pages/fechamento-sdr/Detail"));
const FechamentoSDRConfiguracoes = lazy(() => import("./pages/fechamento-sdr/Configuracoes"));
const MeuFechamento = lazy(() => import("./pages/fechamento-sdr/MeuFechamento"));
const MeuPlaybook = lazy(() => import("./pages/playbook/MeuPlaybook"));
const TransacoesIncorp = lazy(() => import("./pages/bu-incorporador/TransacoesIncorp"));
const IncorporadorRelatorios = lazy(() => import("./pages/bu-incorporador/Relatorios"));
const RHColaboradores = lazy(() => import("./pages/rh/Colaboradores"));
const ColaboradorProfile = lazy(() => import("./pages/rh/ColaboradorProfile"));
const ConfiguracoesRH = lazy(() => import("./pages/rh/Configuracoes"));
const ProvaEquipe = lazy(() => import("./pages/rh/ProvaEquipe"));
const ExamDetail = lazy(() => import("./pages/rh/ExamDetail"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Cobrancas = lazy(() => import("./pages/Cobrancas"));
const MeuRH = lazy(() => import("./pages/MeuRH"));
const MinhasReunioes = lazy(() => import("./pages/sdr/MinhasReunioes"));
const ReunioesEquipe = lazy(() => import("./pages/crm/ReunioesEquipe"));
const SdrMeetingsDetailPage = lazy(() => import("./pages/crm/SdrMeetingsDetailPage"));
const CloserMeetingsDetailPage = lazy(() => import("./pages/crm/CloserMeetingsDetailPage"));
const MovimentacoesEstagio = lazy(() => import("./pages/crm/MovimentacoesEstagio"));
const Webhooks = lazy(() => import("./pages/crm/Webhooks"));
const WebhookAnalytics = lazy(() => import("./pages/crm/WebhookAnalytics"));
const ConsorcioIndex = lazy(() => import("./pages/bu-consorcio/Index"));
const AdminPermissoes = lazy(() => import("./pages/admin/Permissoes"));
const AdminRoles = lazy(() => import("./pages/admin/Roles"));
const ConfiguracaoProdutos = lazy(() => import("./pages/admin/ConfiguracaoProdutos"));
const Automacoes = lazy(() => import("./pages/admin/Automacoes"));
const ConfiguracaoBU = lazy(() => import("./pages/admin/ConfiguracaoBU"));
const ConsorcioFechamento = lazy(() => import("./pages/bu-consorcio/Fechamento"));
const ConsorcioFechamentoDetail = lazy(() => import("./pages/bu-consorcio/FechamentoDetail"));
const ConsorcioFechamentoConfig = lazy(() => import("./pages/bu-consorcio/FechamentoConfig"));
const ConsorcioPainelEquipe = lazy(() => import("./pages/bu-consorcio/PainelEquipe"));
const ConsorcioVendas = lazy(() => import("./pages/bu-consorcio/Vendas"));
const ConsorcioPagamentos = lazy(() => import("./pages/bu-consorcio/Pagamentos"));
const Chairman = lazy(() => import("./pages/Chairman"));
const Home = lazy(() => import("./pages/Home"));
const DocumentosEstrategicos = lazy(() => import("./pages/bu-common/DocumentosEstrategicos"));
const MarketingDashboard = lazy(() => import("./pages/bu-marketing/MarketingDashboard"));
const CampanhasDashboard = lazy(() => import("./pages/bu-marketing/CampanhasDashboard"));
const A010AcquisitionDashboard = lazy(() => import("./pages/bu-marketing/A010AcquisitionDashboard"));
const A010LinkMappingsConfig = lazy(() => import("./pages/bu-marketing/A010LinkMappingsConfig"));
const PatrimonioIndex = lazy(() => import("./pages/patrimonio/Index"));
const AssetDetailsPage = lazy(() => import("./pages/patrimonio/AssetDetailsPage"));
const MyEquipmentPage = lazy(() => import("./pages/patrimonio/MyEquipmentPage"));
const PatrimonioRelatorios = lazy(() => import("./pages/patrimonio/PatrimonioRelatorios"));
const BUCRMLayout = lazy(() => import("./pages/crm/BUCRMLayout"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 min — most data is fine for a minute
      gcTime: 5 * 60_000, // GC after 5 min unused
      refetchOnWindowFocus: false, // do not refetch on tab focus
      refetchOnReconnect: 'always',
      refetchIntervalInBackground: false, // pause polling when tab hidden
      retry: 1,
      retryDelay: 1000,
    },
  },
});

const PageFallback = () => (
  <div className="flex h-[60vh] w-full items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

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
            <Suspense fallback={<PageFallback />}>
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
              <Route path="home" element={<Home />} />
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
              
              {/* BU Consórcio */}
              <Route path="consorcio" element={<ResourceGuard resource="crm"><ConsorcioIndex /></ResourceGuard>} />
              <Route path="consorcio/fechamento" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioFechamento /></RoleGuard>} />
              <Route path="consorcio/fechamento/configuracoes" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioFechamentoConfig /></RoleGuard>} />
              <Route path="consorcio/fechamento/:payoutId" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ConsorcioFechamentoDetail /></RoleGuard>} />
              <Route path="consorcio/painel-equipe" element={<ResourceGuard resource="crm"><ConsorcioPainelEquipe /></ResourceGuard>} />
              <Route path="consorcio/vendas" element={<ResourceGuard resource="crm"><ConsorcioVendas /></ResourceGuard>} />
              <Route path="consorcio/pagamentos" element={<ResourceGuard resource="crm"><ConsorcioPagamentos /></ResourceGuard>} />
              <Route path="consorcio/documentos-estrategicos" element={<ResourceGuard resource="relatorios"><DocumentosEstrategicos bu="consorcio" /></ResourceGuard>} />
              
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
              
              {/* BU Marketing */}
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
              
              <Route path="fechamento-sdr" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ResourceGuard resource="fechamento_sdr"><FechamentoSDRList /></ResourceGuard></RoleGuard>} />
              <Route path="fechamento-sdr/configuracoes" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ResourceGuard resource="fechamento_sdr"><FechamentoSDRConfiguracoes /></ResourceGuard></RoleGuard>} />
              <Route path="fechamento-sdr/:payoutId" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><ResourceGuard resource="fechamento_sdr"><FechamentoSDRDetail /></ResourceGuard></RoleGuard>} />
              <Route path="meu-fechamento" element={<MeuFechamento />} />
              
              {/* BU Incorporador */}
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
              <Route path="sdr/minhas-reunioes" element={<RoleGuard allowedRoles={['sdr', 'closer']}><MinhasReunioes /></RoleGuard>} />
              <Route path="closer/meu-desempenho" element={<RoleGuard allowedRoles={['closer']}><MeuDesempenhoCloser /></RoleGuard>} />
              <Route path="crm/reunioes-equipe" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'sdr', 'closer', 'closer_sombra']}><ReunioesEquipe /></RoleGuard>} />
              <Route path="crm/reunioes-equipe/:sdrEmail" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><SdrMeetingsDetailPage /></RoleGuard>} />
              <Route path="crm/reunioes-equipe/closer/:closerId" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><CloserMeetingsDetailPage /></RoleGuard>} />
              <Route path="crm/movimentacoes" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><MovimentacoesEstagio /></RoleGuard>} />
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
            </Suspense>
            </TwilioProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AppearanceProvider>
  </QueryClientProvider>
);

export default App;

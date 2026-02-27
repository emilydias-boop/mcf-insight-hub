import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, Zap, Database, Shield, Upload, FileText, History, ClipboardList, Loader2, RefreshCw, CalendarSync, Tag } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { WebhookMonitor } from '@/components/crm/WebhookMonitor';
import { ActivityTemplateManager } from '@/components/crm/ActivityTemplateManager';
import { WhatsAppConfigCard } from '@/components/whatsapp/WhatsAppConfigCard';
import { CRMPermissionsManager } from '@/components/crm/CRMPermissionsManager';
import { QualificationFieldsManager } from '@/components/crm/QualificationFieldsManager';
import { useAuth } from '@/contexts/AuthContext';

// Import sub-page components
import ImportarContatos from './ImportarContatos';
import ImportarNegocios from './ImportarNegocios';
import ImportarHistorico from './ImportarHistorico';
import Tags from './Tags';

const ConfiguracoesContent = () => {
  const { role } = useAuth();
  const canManageTemplates = role === 'admin' || role === 'coordenador' || role === 'manager';
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [qualificationFieldsOpen, setQualificationFieldsOpen] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{ processed?: number; skipped?: number; tasksCreated?: number; tasksToCreate?: number } | null>(null);
  const [isSyncingAgenda, setIsSyncingAgenda] = useState(false);
  const [syncAgendaResult, setSyncAgendaResult] = useState<{ synced?: number; skipped?: number; processed?: number } | null>(null);

  const handleBackfillTasks = async (dryRun: boolean = false) => {
    setIsBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke('backfill-deal-tasks', {
        body: { dryRun, limit: 200 }
      });
      
      if (error) throw error;
      
      setBackfillResult(data);
      
      if (dryRun) {
        toast.info(`Simulação: ${data.tasksToCreate} tarefas seriam criadas para ${data.processed} deals`);
      } else {
        toast.success(`${data.tasksCreated} tarefas criadas para ${data.processed} deals`);
      }
    } catch (error) {
      console.error('Backfill error:', error);
      toast.error('Erro ao gerar tarefas');
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleBackfillAll = async () => {
    setIsBackfilling(true);
    let totalProcessed = 0;
    let totalTasks = 0;
    let totalSkipped = 0;
    let hasMore = true;
    let iterations = 0;
    const maxIterations = 200;

    try {
      while (hasMore && iterations < maxIterations) {
        const { data, error } = await supabase.functions.invoke('backfill-deal-tasks', {
          body: { dryRun: false, limit: 200 }
        });

        if (error) throw error;

        const processed = data.processed || 0;
        totalProcessed += processed;
        totalTasks += data.tasksCreated || 0;
        totalSkipped += data.skipped || 0;
        iterations++;

        hasMore = processed > 0;

        setBackfillResult({
          processed: totalProcessed,
          tasksCreated: totalTasks,
          skipped: totalSkipped
        });

        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      toast.success(`Concluído! ${totalTasks} tarefas criadas para ${totalProcessed} deals em ${iterations} lotes`);
    } catch (error) {
      console.error('Backfill all error:', error);
      toast.error(`Erro após ${iterations} lotes. ${totalTasks} tarefas criadas até o momento.`);
    } finally {
      setIsBackfilling(false);
    }
  };

  const handleSyncFromAgenda = async (dryRun: boolean = false) => {
    setIsSyncingAgenda(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-deals-from-agenda', {
        body: { dryRun, limit: 200 }
      });
      
      if (error) throw error;
      
      setSyncAgendaResult(data);
      
      if (dryRun) {
        toast.info(`Simulação: ${data.synced} deals seriam sincronizados de ${data.processed} processados`);
      } else {
        toast.success(`${data.synced} deals sincronizados para R1/R2 Agendada`);
      }
    } catch (error) {
      console.error('Sync agenda error:', error);
      toast.error('Erro ao sincronizar deals da agenda');
    } finally {
      setIsSyncingAgenda(false);
    }
  };

  const settingsSections = [
    {
      icon: ClipboardList,
      title: 'Campos de Qualificação',
      description: 'Configure as perguntas do formulário de qualificação por funil',
      action: 'Gerenciar Campos',
      key: 'qualification',
    },
    {
      icon: Database,
      title: 'Campos Customizados',
      description: 'Adicione campos personalizados aos seus contatos e negócios',
      action: 'Gerenciar Campos',
      key: 'custom-fields',
    },
    {
      icon: Zap,
      title: 'Automações',
      description: 'Configure automações para otimizar seu fluxo de trabalho',
      action: 'Configurar Automações',
      key: 'automations',
    },
    {
      icon: Users,
      title: 'Estágios do Pipeline',
      description: 'Personalize os estágios do seu funil de vendas',
      action: 'Editar Estágios',
      key: 'stages',
    },
    {
      icon: Shield,
      title: 'Permissões',
      description: 'Gerencie permissões de acesso ao CRM',
      action: 'Gerenciar Permissões',
      key: 'permissions',
    },
  ];

  return (
    <div className="space-y-6">
      <WebhookMonitor />

      {/* WhatsApp Z-API Configuration */}
      <WhatsAppConfigCard />

      {/* Activity Templates - Only for admin/coordenador */}
      {canManageTemplates && (
        <ActivityTemplateManager />
      )}




      <div className="grid gap-6 md:grid-cols-2">
        {settingsSections.map((section) => {
          const Icon = section.icon;
          const handleClick = () => {
            if (section.key === 'permissions') {
              setPermissionsOpen(true);
            } else if (section.key === 'qualification') {
              setQualificationFieldsOpen(true);
            }
          };
          return (
            <Card key={section.key} className="bg-card border-border">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <CardTitle className="text-foreground">{section.title}</CardTitle>
                </div>
                <CardDescription className="text-muted-foreground">
                  {section.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handleClick}
                >
                  {section.action}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de Permissões */}
      <CRMPermissionsManager open={permissionsOpen} onOpenChange={setPermissionsOpen} />

      {/* Modal de Campos de Qualificação */}
      <QualificationFieldsManager open={qualificationFieldsOpen} onOpenChange={setQualificationFieldsOpen} />

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configurações Gerais
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Ajustes gerais do sistema de CRM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Notificações por Email</p>
              <p className="text-sm text-muted-foreground">Receba alertas sobre novos contatos e negócios</p>
            </div>
            <Button variant="outline" className="border-border">
              Configurar
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Integrações</p>
              <p className="text-sm text-muted-foreground">Conecte o CRM com outras ferramentas</p>
            </div>
            <Button variant="outline" className="border-border">
              Ver Integrações
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div>
              <p className="font-medium text-foreground">Backup de Dados</p>
              <p className="text-sm text-muted-foreground">Configure backups automáticos</p>
            </div>
            <Button variant="outline" className="border-border">
              Configurar Backup
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Gerar Tarefas para Deals
              </p>
              <p className="text-sm text-muted-foreground">
                Gera tarefas automaticamente para deals existentes que não possuem tarefas pendentes
              </p>
              {backfillResult && !isBackfilling && (
                <p className="text-xs text-muted-foreground mt-1">
                  Último resultado: {backfillResult.tasksCreated ?? backfillResult.tasksToCreate} tarefas, {backfillResult.processed} deals processados, {backfillResult.skipped} ignorados
                </p>
              )}
              {isBackfilling && backfillResult && (
                <p className="text-xs text-primary mt-1 animate-pulse">
                  Processando... {backfillResult.processed} deals, {backfillResult.tasksCreated} tarefas criadas
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0 flex-wrap">
              <Button 
                variant="outline" 
                onClick={() => handleBackfillTasks(true)}
                disabled={isBackfilling}
                size="sm"
              >
                {isBackfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simular'}
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleBackfillTasks(false)}
                disabled={isBackfilling}
                size="sm"
              >
                {isBackfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Executar 200'}
              </Button>
              <Button 
                onClick={handleBackfillAll}
                disabled={isBackfilling}
                size="sm"
              >
                {isBackfilling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Processando...
                  </>
                ) : (
                  'Executar Tudo'
                )}
              </Button>
            </div>
          </div>

          {/* Sincronizar Deals da Agenda */}
          <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-muted/30">
            <div>
              <p className="font-medium text-foreground flex items-center gap-2">
                <CalendarSync className="h-4 w-4" />
                Sincronizar Deals da Agenda
              </p>
              <p className="text-sm text-muted-foreground">
                Move deals que já possuem reunião agendada para o estágio "R1 Agendada" ou "R2 Agendada"
              </p>
              {syncAgendaResult && !isSyncingAgenda && (
                <p className="text-xs text-muted-foreground mt-1">
                  Último resultado: {syncAgendaResult.synced} sincronizados, {syncAgendaResult.processed} processados, {syncAgendaResult.skipped} ignorados
                </p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button 
                variant="outline" 
                onClick={() => handleSyncFromAgenda(true)}
                disabled={isSyncingAgenda}
                size="sm"
              >
                {isSyncingAgenda ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Simular'}
              </Button>
              <Button 
                onClick={() => handleSyncFromAgenda(false)}
                disabled={isSyncingAgenda}
                size="sm"
              >
                {isSyncingAgenda ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    Sincronizando...
                  </>
                ) : (
                  'Sincronizar'
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const Configuracoes = () => {
  const [activeTab, setActiveTab] = useState('configuracoes');

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1 sm:mb-2">Configurações do CRM</h2>
        <p className="text-sm text-muted-foreground hidden sm:block">Personalize, configure e importe dados para seu CRM</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted flex flex-wrap h-auto gap-1 p-1 w-full md:w-auto">
          <TabsTrigger value="configuracoes" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 md:flex-none">
            <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">Configurações</span>
            <span className="xs:hidden">Config</span>
          </TabsTrigger>
          <TabsTrigger value="importar-contatos" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 md:flex-none">
            <Upload className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Importar Contatos</span>
            <span className="sm:hidden">Contatos</span>
          </TabsTrigger>
          <TabsTrigger value="importar-negocios" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 md:flex-none">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Importar Negócios</span>
            <span className="sm:hidden">Negócios</span>
          </TabsTrigger>
          <TabsTrigger value="importar-historico" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 md:flex-none">
            <History className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">Importar Histórico</span>
            <span className="sm:hidden">Histórico</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm flex-1 md:flex-none">
            <Tag className="h-3 w-3 sm:h-4 sm:w-4" />
            Tags
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuracoes">
          <ConfiguracoesContent />
        </TabsContent>

        <TabsContent value="importar-contatos">
          <ImportarContatos />
        </TabsContent>

        <TabsContent value="importar-negocios">
          <ImportarNegocios />
        </TabsContent>

        <TabsContent value="importar-historico">
          <ImportarHistorico />
        </TabsContent>

        <TabsContent value="tags">
          <Tags />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Configuracoes;

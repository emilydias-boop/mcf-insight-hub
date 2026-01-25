import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Settings,
  XCircle,
  Users,
  Bell,
  Eye,
  Trophy,
  Shuffle,
  Layers,
  Webhook,
  LayoutGrid,
  ClipboardList,
  Zap,
  Radio,
  FileText,
  Code,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PipelineStagesEditor } from './PipelineStagesEditor';
import { LeadDistributionConfig } from './LeadDistributionConfig';
import { WebhookConfigEditor } from './webhooks/WebhookConfigEditor';

interface PipelineConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: 'origin' | 'group';
  targetId: string;
}

type GeneralSection = 
  | 'settings'
  | 'loss-reasons'
  | 'distribution'
  | 'permissions'
  | 'win-attribution'
  | 'field-visibility'
  | 'notifications';

type StagesSection = 'kanban-stages' | 'activities' | 'automations';

type IntegrationSection = 'webhooks' | 'leads-live' | 'leads-forms' | 'leads-api';

const generalSections = [
  { id: 'settings' as const, label: 'Configurações Gerais', icon: Settings },
  { id: 'loss-reasons' as const, label: 'Motivo de Perda', icon: XCircle },
  { id: 'distribution' as const, label: 'Distribuição de dono', icon: Shuffle },
  { id: 'permissions' as const, label: 'Permissão de usuários', icon: Users },
  { id: 'win-attribution' as const, label: 'Atribuição de ganho', icon: Trophy },
  { id: 'field-visibility' as const, label: 'Visualização de campos', icon: Eye },
  { id: 'notifications' as const, label: 'Notificações', icon: Bell },
];

const stagesSections = [
  { id: 'kanban-stages' as const, label: 'Etapas do Kanban', icon: LayoutGrid },
  { id: 'activities' as const, label: 'Atividades', icon: ClipboardList },
  { id: 'automations' as const, label: 'Automações de etapa', icon: Zap },
];

const integrationSections = [
  { id: 'webhooks' as const, label: 'Webhooks', icon: Webhook },
  { id: 'leads-live' as const, label: 'Leads Live', icon: Radio },
  { id: 'leads-forms' as const, label: 'Leads Forms', icon: FileText },
  { id: 'leads-api' as const, label: 'API Externa', icon: Code },
];

export const PipelineConfigModal = ({
  open,
  onOpenChange,
  targetType,
  targetId,
}: PipelineConfigModalProps) => {
  const [activeTab, setActiveTab] = useState<'general' | 'stages' | 'integrations'>('general');
  const [activeSection, setActiveSection] = useState<GeneralSection>('settings');
  const [activeStagesSection, setActiveStagesSection] = useState<StagesSection>('kanban-stages');
  const [activeIntegrationSection, setActiveIntegrationSection] = useState<IntegrationSection>('webhooks');
  const queryClient = useQueryClient();

  // Fetch target data
  const { data: targetData, isLoading } = useQuery({
    queryKey: ['pipeline-config-target', targetType, targetId],
    queryFn: async () => {
      if (targetType === 'origin') {
        const { data, error } = await supabase
          .from('crm_origins')
          .select('*')
          .eq('id', targetId)
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('crm_groups')
          .select('*')
          .eq('id', targetId)
          .single();
        if (error) throw error;
        return data;
      }
    },
    enabled: open && !!targetId,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates: { name?: string; display_name?: string; description?: string }) => {
      const table = targetType === 'origin' ? 'crm_origins' : 'crm_groups';
      const { error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', targetId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Configurações salvas!');
      queryClient.invalidateQueries({ queryKey: ['crm-origins'] });
      queryClient.invalidateQueries({ queryKey: ['crm-groups'] });
      queryClient.invalidateQueries({ queryKey: ['pipeline-config-target'] });
    },
    onError: (error) => {
      toast.error('Erro ao salvar: ' + (error as Error).message);
    },
  });

  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    description: '',
  });

  // Update form when data loads
  const displayName = targetData?.display_name || targetData?.name || '';

  const handleSaveGeneral = () => {
    updateMutation.mutate({
      display_name: formData.display_name || undefined,
    });
  };

  const renderGeneralContent = () => {
    switch (activeSection) {
      case 'settings':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome interno</Label>
              <Input
                id="name"
                value={targetData?.name || ''}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Nome original do sistema (não editável)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">Nome de exibição</Label>
              <Input
                id="display_name"
                value={formData.display_name || targetData?.display_name || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                placeholder="Nome personalizado para exibição"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description || targetData?.description || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrição opcional"
                rows={3}
              />
            </div>

            <Button onClick={handleSaveGeneral} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        );

      case 'loss-reasons':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure os motivos de perda disponíveis para esta {targetType === 'origin' ? 'origem' : 'pipeline'}.
            </p>
            <p className="text-sm text-muted-foreground italic">
              Em desenvolvimento...
            </p>
          </div>
        );

      case 'distribution':
        if (targetType !== 'origin') {
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                A distribuição de leads só está disponível para origins específicas, não para grupos/pipelines.
              </p>
              <p className="text-xs text-muted-foreground">
                Selecione uma origin no menu lateral para configurar a distribuição.
              </p>
            </div>
          );
        }
        return (
          <LeadDistributionConfig 
            originId={targetId}
            originName={displayName}
          />
        );

      case 'permissions':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Defina quais usuários podem visualizar e editar negócios desta {targetType === 'origin' ? 'origem' : 'pipeline'}.
            </p>
            <p className="text-sm text-muted-foreground italic">
              Em desenvolvimento...
            </p>
          </div>
        );

      case 'win-attribution':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure as regras de atribuição quando um negócio é ganho.
            </p>
            <p className="text-sm text-muted-foreground italic">
              Em desenvolvimento...
            </p>
          </div>
        );

      case 'field-visibility':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Escolha quais campos são exibidos nos cards do Kanban.
            </p>
            <p className="text-sm text-muted-foreground italic">
              Em desenvolvimento...
            </p>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure alertas para eventos desta {targetType === 'origin' ? 'origem' : 'pipeline'}.
            </p>
            <p className="text-sm text-muted-foreground italic">
              Em desenvolvimento...
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  // Render sidebar menu
  const renderSidebarMenu = (
    sections: Array<{ id: string; label: string; icon: React.ComponentType<{ className?: string }> }>,
    activeId: string,
    onSelect: (id: string) => void
  ) => (
    <div className="p-2 space-y-1">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <Button
            key={section.id}
            variant="ghost"
            className={cn(
              'w-full justify-start gap-2 text-sm',
              activeId === section.id && 'bg-muted'
            )}
            onClick={() => onSelect(section.id)}
          >
            <Icon className="h-4 w-4" />
            {section.label}
          </Button>
        );
      })}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] p-0 overflow-hidden">
        {/* Inner wrapper to control layout (avoids grid/flex conflict with Radix) */}
        <div className="flex flex-col h-full">
          {/* Fixed header */}
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Configurar: {displayName}
            </DialogTitle>
          </DialogHeader>

          {/* Tabs container */}
          <Tabs 
            value={activeTab} 
            onValueChange={(v) => setActiveTab(v as typeof activeTab)} 
            className="flex flex-col flex-1 min-h-0"
          >
            {/* Fixed tab list */}
            <div className="border-b px-6 shrink-0">
              <TabsList className="h-12 bg-transparent p-0 gap-4">
                <TabsTrigger
                  value="general"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 pb-3"
                >
                  Geral
                </TabsTrigger>
                <TabsTrigger
                  value="stages"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 pb-3"
                >
                  Etapas e atividades
                </TabsTrigger>
                <TabsTrigger
                  value="integrations"
                  className="data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none bg-transparent px-0 pb-3"
                >
                  Integrações
                </TabsTrigger>
              </TabsList>
            </div>

            {/* General Tab */}
            <TabsContent value="general" className="flex-1 flex min-h-0 mt-0 data-[state=inactive]:hidden">
              {/* Left sidebar - scrollable */}
              <div className="w-56 border-r bg-muted/30 shrink-0 overflow-y-auto">
                {renderSidebarMenu(
                  generalSections,
                  activeSection,
                  (id) => setActiveSection(id as GeneralSection)
                )}
              </div>

              {/* Right content - scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="font-medium mb-4">
                  {generalSections.find((s) => s.id === activeSection)?.label}
                </h3>
                {isLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando...</p>
                ) : (
                  renderGeneralContent()
                )}
              </div>
            </TabsContent>

            {/* Stages Tab */}
            <TabsContent value="stages" className="flex-1 flex min-h-0 mt-0 data-[state=inactive]:hidden">
              {/* Left sidebar - scrollable */}
              <div className="w-56 border-r bg-muted/30 shrink-0 overflow-y-auto">
                {renderSidebarMenu(
                  stagesSections,
                  activeStagesSection,
                  (id) => setActiveStagesSection(id as StagesSection)
                )}
              </div>

              {/* Right content - scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="font-medium mb-4">
                  {stagesSections.find((s) => s.id === activeStagesSection)?.label}
                </h3>
                {activeStagesSection === 'kanban-stages' && (
                  <PipelineStagesEditor 
                    targetType={targetType} 
                    targetId={targetId} 
                  />
                )}
                {activeStagesSection === 'activities' && (
                  <p className="text-sm text-muted-foreground italic">
                    Configure atividades automáticas por etapa. Em desenvolvimento...
                  </p>
                )}
                {activeStagesSection === 'automations' && (
                  <p className="text-sm text-muted-foreground italic">
                    Configure automações ao entrar/sair de etapas. Em desenvolvimento...
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations" className="flex-1 flex min-h-0 mt-0 data-[state=inactive]:hidden">
              {/* Left sidebar - scrollable */}
              <div className="w-56 border-r bg-muted/30 shrink-0 overflow-y-auto">
                {renderSidebarMenu(
                  integrationSections,
                  activeIntegrationSection,
                  (id) => setActiveIntegrationSection(id as IntegrationSection)
                )}
              </div>

              {/* Right content - scrollable */}
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="font-medium mb-4">
                  {integrationSections.find((s) => s.id === activeIntegrationSection)?.label}
                </h3>
                
                {activeIntegrationSection === 'webhooks' && (
                  <WebhookConfigEditor originId={targetId} />
                )}
                
                {activeIntegrationSection === 'leads-live' && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      Recebe leads do formulário de Lives e distribui automaticamente.
                    </p>
                    <div className="flex items-center gap-3 p-4 border rounded-lg bg-accent/50 border-accent">
                      <div className="p-2 bg-accent rounded">
                        <Radio className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">Webhook Live Leads</h4>
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            Ativo
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Origin: LEAD GRATUITO • Etapa: Base • Tag: Lead-Live
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Ver logs
                      </Button>
                    </div>
                  </div>
                )}
                
                {activeIntegrationSection === 'leads-forms' && (
                  <p className="text-sm text-muted-foreground italic">
                    Configure integrações com formulários externos. Em desenvolvimento...
                  </p>
                )}
                
                {activeIntegrationSection === 'leads-api' && (
                  <p className="text-sm text-muted-foreground italic">
                    Configure integrações via API externa. Em desenvolvimento...
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
};

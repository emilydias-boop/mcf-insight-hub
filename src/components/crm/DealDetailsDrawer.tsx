import { useState, useMemo, useEffect } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCRMDeal, useCRMContact } from '@/hooks/useCRMData';
import { useQualificationNote } from '@/hooks/useQualificationNote';
import { useTwilio } from '@/contexts/TwilioContext';
import { DealHistory } from './DealHistory';
import { CallHistorySection } from './CallHistorySection';
import { DealNotesTab } from './DealNotesTab';
import { DealTasksSection } from './DealTasksSection';
import { SdrCompactHeader } from './SdrCompactHeader';
import { SdrSummaryBlock } from './SdrSummaryBlock';
import { NextActionBlockCompact } from './NextActionBlockCompact';
import { A010JourneyCollapsible } from './A010JourneyCollapsible';
import { QuickActionsBlock } from './QuickActionsBlock';
import { LeadJourneyCard } from './LeadJourneyCard';
import { LeadFullTimeline } from './LeadFullTimeline';
import { SdrScheduleDialog } from './SdrScheduleDialog';
import { QualificationSummaryCard } from './qualification/QualificationSummaryCard';
import { QualificationAndScheduleModal } from './QualificationAndScheduleModal';
import { LossReasonCard } from './LossReasonCard';
import { CrossPipelineHistory } from './CrossPipelineHistory';
import { Phone, History, StickyNote, CheckSquare, AlertTriangle, Clock, Package } from 'lucide-react';
import { DealProdutosAdquiridosTab } from './DealProdutosAdquiridosTab';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DealDetailsDrawerProps {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DealDetailsDrawer = ({ dealId, open, onOpenChange }: DealDetailsDrawerProps) => {
  const { role } = useAuth();
  const { setDrawerState } = useTwilio();
  const { data: deal, isLoading: dealLoading, refetch: refetchDeal } = useCRMDeal(dealId || '');
  const { data: contact, isLoading: contactLoading } = useCRMContact(deal?.contact_id || '');
  const { data: qualificationNote } = useQualificationNote(dealId || '');
  
  // State para modal de agendamento
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [leadSummaryForSchedule, setLeadSummaryForSchedule] = useState('');
  const [showQualification, setShowQualification] = useState(false);
  
  const isLoading = dealLoading || contactLoading;
  
  // Notify TwilioContext when drawer opens/closes
  useEffect(() => {
    setDrawerState(open, open ? dealId : null);
  }, [open, dealId, setDrawerState]);
  
  // Determinar comportamento baseado no stage
  const stageInfo = useMemo(() => {
    const stageName = (deal?.crm_stages as any)?.stage_name?.toLowerCase() || '';
    
    const isLostStage = ['sem interesse', 'não quer', 'perdido', 'desistente', 'cancelado'].some(
      s => stageName.includes(s)
    );
    
    const isAdvancedStage = ['qualificado', 'reunião', 'agendada', 'realizada', 'contrato'].some(
      s => stageName.includes(s)
    );
    
    return { isLostStage, isAdvancedStage, stageName };
  }, [deal?.crm_stages]);
  
  const handleScheduleFromQualification = (summary: string) => {
    setLeadSummaryForSchedule(summary);
    setShowScheduleDialog(true);
  };
  
  if (!dealId) return null;
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-2xl overflow-hidden p-0 flex flex-col">
        {isLoading ? (
          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-5 w-32" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-20" />
              </div>
            </div>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : deal ? (
          <div className="flex flex-col h-full">
            {/* ===== 1. CABEÇALHO COMPACTO ===== */}
            <SdrCompactHeader deal={deal} contact={contact} />
            
            {/* ===== CONTEÚDO PRINCIPAL ===== */}
            <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">
              
              {/* ===== ALERTA DE REEMBOLSO ===== */}
              {(deal.custom_fields as any)?.reembolso_solicitado && (
                <Alert className="bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-800">
                  <AlertTriangle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                  <AlertDescription className="text-orange-700 dark:text-orange-300 text-sm">
                    <strong>⚠️ Lead solicitou REEMBOLSO</strong>
                    {(deal.custom_fields as any)?.reembolso_em && (
                      <span className="block text-xs mt-1">
                        Em: {format(new Date((deal.custom_fields as any).reembolso_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    )}
                    {(deal.custom_fields as any)?.motivo_reembolso && (
                      <span className="block text-xs">
                        Motivo: {(deal.custom_fields as any).motivo_reembolso}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* ===== 2. AÇÕES RÁPIDAS (acima da dobra) ===== */}
              <QuickActionsBlock 
                deal={deal} 
                contact={contact}
                onStageChange={() => refetchDeal()}
                onQualify={() => setShowQualification(true)}
              />
              
              {/* ===== 3. PRÓXIMA AÇÃO (compacta) ===== */}
              <NextActionBlockCompact
                dealId={dealId}
                currentType={deal.next_action_type}
                currentDate={deal.next_action_date}
                currentNote={deal.next_action_note}
                onSaved={() => refetchDeal()}
              />
              
              {/* ===== 4. JORNADA DO LEAD (SDR, R1, R2) ===== */}
              <LeadJourneyCard dealId={dealId} dealCreatedAt={deal.created_at} />
              
              {/* ===== HISTÓRICO CROSS-PIPELINE ===== */}
              <CrossPipelineHistory contactId={deal.contact_id} currentDealId={deal.id} dealName={deal.name} />
              
              {/* ===== MOTIVO DE PERDA (apenas para stages de perda) ===== */}
              {stageInfo.isLostStage && (
                <LossReasonCard
                  stageName={(deal.crm_stages as any)?.stage_name}
                  reason={(deal.custom_fields as any)?.motivo_sem_interesse}
                />
              )}
              
              {/* ===== QUALIFICAÇÃO RESUMO (stages avançadas ou de perda) ===== */}
              {(stageInfo.isAdvancedStage || stageInfo.isLostStage) && qualificationNote && (
                <QualificationSummaryCard
                  data={(qualificationNote.metadata as any)?.qualification_data || {}}
                  summary={qualificationNote.description || ''}
                  sdrName={(qualificationNote.metadata as any)?.sdr_name}
                  qualifiedAt={(qualificationNote.metadata as any)?.qualified_at}
                  compact
                />
              )}
              
              {/* ===== 5. RESUMO (contato + negócio unificado) ===== */}
              <SdrSummaryBlock deal={deal} contact={contact} />
              
              {/* ===== 5. ABAS (com scroll) ===== */}
              <Tabs defaultValue="timeline" className="mt-2">
                <TabsList className="w-full grid grid-cols-6 bg-secondary">
                  <TabsTrigger value="timeline" className="text-xs">
                    <Clock className="h-3.5 w-3.5 mr-1" />
                    Timeline
                  </TabsTrigger>
                  <TabsTrigger value="tarefas" className="text-xs">
                    <CheckSquare className="h-3.5 w-3.5 mr-1" />
                    Tarefas
                  </TabsTrigger>
                  <TabsTrigger value="atividades" className="text-xs">
                    <History className="h-3.5 w-3.5 mr-1" />
                    Histórico
                  </TabsTrigger>
                  <TabsTrigger value="ligacoes" className="text-xs">
                    <Phone className="h-3.5 w-3.5 mr-1" />
                    Ligações
                  </TabsTrigger>
                  <TabsTrigger value="notas" className="text-xs">
                    <StickyNote className="h-3.5 w-3.5 mr-1" />
                    Notas
                  </TabsTrigger>
                  <TabsTrigger value="produtos" className="text-xs">
                    <Package className="h-3.5 w-3.5 mr-1" />
                    Produtos
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="timeline" className="mt-3 border rounded-lg min-h-[300px] p-2">
                  <LeadFullTimeline
                    dealId={deal.clint_id}
                    dealUuid={deal.id}
                    contactEmail={contact?.email}
                    contactId={deal.contact_id}
                  />
                </TabsContent>
                
                <TabsContent value="tarefas" className="mt-3 border rounded-lg min-h-[300px]">
                  <DealTasksSection 
                    dealId={deal.id} 
                    originId={deal.origin_id || undefined}
                    stageId={deal.stage_id || undefined}
                    ownerId={deal.owner_id || undefined}
                    contactPhone={contact?.phone}
                    contactEmail={contact?.email}
                    contactName={contact?.name}
                  />
                </TabsContent>
                
                <TabsContent value="atividades" className="mt-3">
                  <DealHistory dealId={deal.clint_id} dealUuid={deal.id} contactId={deal.contact_id} limit={5} />
                </TabsContent>
                
                <TabsContent value="ligacoes" className="mt-3">
                  <CallHistorySection dealId={deal.id} contactId={deal.contact_id} />
                </TabsContent>
                
                <TabsContent value="notas" className="mt-3">
                  <DealNotesTab dealUuid={deal.id} dealClintId={deal.clint_id} contactId={deal.contact_id} />
                </TabsContent>
                
                <TabsContent value="produtos" className="mt-3 border rounded-lg min-h-[300px]">
                  <DealProdutosAdquiridosTab dealId={deal.id} />
                </TabsContent>
              </Tabs>
              
              {/* ===== 6. JORNADA A010 DETALHADA (colapsável) ===== */}
              <A010JourneyCollapsible 
                email={contact?.email} 
                phone={contact?.phone}
              />
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>Negócio não encontrado</p>
          </div>
        )}
      </SheetContent>
      
      {/* Modal de qualificação manual */}
      {dealId && (
        <QualificationAndScheduleModal
          open={showQualification}
          onOpenChange={(open) => {
            setShowQualification(open);
            if (!open) refetchDeal();
          }}
          dealId={dealId}
          contactName={contact?.name}
        />
      )}
      
      {/* Modal de agendamento para SDR */}
      {dealId && (
        <SdrScheduleDialog
          open={showScheduleDialog}
          onOpenChange={setShowScheduleDialog}
          dealId={dealId}
          contactName={contact?.name}
          initialNotes={leadSummaryForSchedule}
          onScheduled={() => refetchDeal()}
        />
      )}
    </Sheet>
  );
};

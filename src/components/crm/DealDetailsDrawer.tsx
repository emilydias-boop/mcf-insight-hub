import { useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCRMDeal, useCRMContact } from '@/hooks/useCRMData';
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
import { Phone, History, StickyNote, CheckSquare } from 'lucide-react';

interface DealDetailsDrawerProps {
  dealId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DealDetailsDrawer = ({ dealId, open, onOpenChange }: DealDetailsDrawerProps) => {
  const { data: deal, isLoading: dealLoading, refetch: refetchDeal } = useCRMDeal(dealId || '');
  const { data: contact, isLoading: contactLoading } = useCRMContact(deal?.contact_id || '');
  
  const isLoading = dealLoading || contactLoading;
  
  if (!dealId) return null;
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-2xl overflow-y-auto p-0">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              
              {/* ===== 2. AÇÕES RÁPIDAS (acima da dobra) ===== */}
              <QuickActionsBlock 
                deal={deal} 
                contact={contact}
                onStageChange={() => refetchDeal()}
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
              <LeadJourneyCard dealId={dealId} />
              
              {/* ===== 5. RESUMO (contato + negócio unificado) ===== */}
              <SdrSummaryBlock deal={deal} contact={contact} />
              
              {/* ===== 5. ABAS (com scroll) ===== */}
              <Tabs defaultValue="tarefas" className="mt-2">
                <TabsList className="w-full grid grid-cols-4 bg-secondary">
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
                </TabsList>
                
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
                  <DealHistory dealId={deal.clint_id} dealUuid={deal.id} limit={5} />
                </TabsContent>
                
                <TabsContent value="ligacoes" className="mt-3">
                  <CallHistorySection dealId={deal.id} />
                </TabsContent>
                
                <TabsContent value="notas" className="mt-3">
                  <DealNotesTab dealId={deal.clint_id} />
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
    </Sheet>
  );
};

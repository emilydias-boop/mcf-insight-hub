import { useState, useCallback, useEffect } from 'react';
import { useSDRQueueInfinite, useSDRQueueCount, useSelectedDeal, LeadState } from '@/hooks/useSDRCockpit';
import { CockpitQueue } from '@/components/sdr/cockpit/CockpitQueue';
import { CockpitExecutionPanel } from '@/components/sdr/cockpit/CockpitExecutionPanel';
import { CockpitQualificationPanel } from '@/components/sdr/cockpit/CockpitQualificationPanel';

export default function SDRCockpit() {
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [leadState, setLeadState] = useState<LeadState>('novo');
  
  const { data: queue, isLoading: queueLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useSDRQueueInfinite();
  const { data: selectedDeal, isLoading: dealLoading } = useSelectedDeal(selectedDealId);

  // Auto-select first deal
  useEffect(() => {
    if (!selectedDealId && queue.length > 0) {
      setSelectedDealId(queue[0].id);
    }
  }, [queue, selectedDealId]);

  // Reset state when deal changes
  useEffect(() => {
    if (selectedDeal) {
      if (selectedDeal.isNew) setLeadState('novo');
      else if (selectedDeal.isOverdue) setLeadState('retorno');
      else if (selectedDeal.callAttempts > 0 && selectedDeal.callAttempts < 5) setLeadState('nao_atendeu');
      else setLeadState('novo');
    }
  }, [selectedDeal?.id]);

  const handleNextLead = useCallback(() => {
    const currentIndex = queue.findIndex(d => d.id === selectedDealId);
    const nextIndex = currentIndex + 1 < queue.length ? currentIndex + 1 : 0;
    if (queue[nextIndex]) {
      setSelectedDealId(queue[nextIndex].id);
    }
  }, [queue, selectedDealId]);

  return (
    <div className="h-[calc(100vh-48px)] flex" style={{ background: '#0f1117' }}>
      {/* Left column - Queue */}
      <div className="w-[240px] flex-shrink-0 border-r border-[#1e2130] overflow-hidden">
        <CockpitQueue
          deals={queue}
          selectedId={selectedDealId}
          onSelect={(id) => setSelectedDealId(id)}
          isLoading={queueLoading}
          fetchNextPage={fetchNextPage}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
        />
      </div>

      {/* Center column - Execution */}
      <div className="flex-1 min-w-0 overflow-hidden">
        <CockpitExecutionPanel
          deal={selectedDeal || null}
          leadState={leadState}
          setLeadState={setLeadState}
          onNextLead={handleNextLead}
          isLoading={dealLoading}
        />
      </div>

      {/* Right column - Qualification + Agenda */}
      <div className="w-[220px] flex-shrink-0 border-l border-[#1e2130] overflow-hidden">
        <CockpitQualificationPanel
          deal={selectedDeal || null}
          leadState={leadState}
        />
      </div>
    </div>
  );
}

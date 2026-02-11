import { useState } from 'react';
import { useContactDeals } from '@/hooks/useContactDeals';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, GitBranch } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CrossPipelineHistoryProps {
  contactId: string | undefined;
  currentDealId: string;
}

export const CrossPipelineHistory = ({ contactId, currentDealId }: CrossPipelineHistoryProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const { data: deals, isLoading } = useContactDeals(contactId, currentDealId);

  if (!contactId || isLoading || !deals || deals.length === 0) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full p-3 rounded-lg border bg-secondary/30 hover:bg-secondary/50 transition-colors">
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <GitBranch className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold flex-1 text-left">
          Histórico em Outras Pipelines ({deals.length})
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {deals.map((deal) => {
          const originName = (deal.crm_origins as any)?.name || 'Sem pipeline';
          const stageName = (deal.crm_stages as any)?.stage_name || '—';
          const stageColor = (deal.crm_stages as any)?.color;
          const createdAt = deal.created_at
            ? format(new Date(deal.created_at), "dd/MM/yyyy", { locale: ptBR })
            : '—';

          return (
            <div
              key={deal.id}
              className="p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                      {originName}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{
                        backgroundColor: stageColor ? `${stageColor}20` : undefined,
                        color: stageColor || undefined,
                        borderColor: stageColor ? `${stageColor}50` : undefined,
                      }}
                    >
                      {stageName}
                    </Badge>
                  </div>
                  {deal.value && deal.value > 0 && (
                    <p className="text-xs text-muted-foreground">
                      R$ {deal.value.toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{createdAt}</span>
              </div>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { RefreshCw } from 'lucide-react';
import { useContactDealIds } from '@/hooks/useContactDealIds';
import {
  ArrowRight,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  CheckCircle,
  Calendar,
  DollarSign,
  AlertCircle,
  Bell,
  User,
} from 'lucide-react';

interface DealHistoryProps {
  dealId: string;
  dealUuid?: string;
  contactId?: string | null;
  limit?: number;
}

const activityIcons: Record<string, any> = {
  stage_change: ArrowRight,
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  note: FileText,
  task_completed: CheckCircle,
  meeting_scheduled: Calendar,
  payment_received: DollarSign,
  no_show: AlertCircle,
  next_action_scheduled: Bell,
};

export const DealHistory = ({ dealId, dealUuid, contactId, limit }: DealHistoryProps) => {
  const [showAll, setShowAll] = useState(false);
  const { data: allDealIds = [] } = useContactDealIds(dealUuid || dealId, contactId);
  
  // Combine all IDs for querying
  const uniqueIds = [...new Set([...allDealIds, dealId, dealUuid].filter(Boolean))];
  
  // Helper para obter nome de quem fez a movimentação
  const getMovedByName = (activity: any) => {
    if (activity.metadata?.deal_user_name) return activity.metadata.deal_user_name;
    if (activity.metadata?.moved_by_name) return activity.metadata.moved_by_name;
    if (activity.metadata?.moved_by_email) return activity.metadata.moved_by_email;
    if (activity.metadata?.deal_user) return activity.metadata.deal_user;
    return activity.profiles?.full_name;
  };
  
  const { data: activities = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['deal-activities', uniqueIds],
    queryFn: async () => {
      const orFilter = uniqueIds.map(id => `deal_id.eq.${id}`).join(',');
      
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*')
        .or(orFilter)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: uniqueIds.length > 0,
  });
  
  const displayedActivities = limit && !showAll 
    ? activities.slice(0, limit) 
    : activities;
  
  const hasMore = limit && activities.length > limit;
  
  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando histórico...</div>;
  }
  
  if (activities.length === 0) {
    return (
      <div className="text-center py-6 space-y-3">
        <p className="text-sm text-muted-foreground">
          Nenhuma atividade registrada para este lead
        </p>
        <p className="text-xs text-muted-foreground/70">
          ID: {dealId?.slice(0, 8)}...
        </p>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => refetch()}
          disabled={isRefetching}
          className="gap-2"
        >
          <RefreshCw className={`h-3 w-3 ${isRefetching ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>
    );
  }
  
  return (
    <div className="space-y-3">
      <ScrollArea className={limit ? "max-h-[280px]" : "h-[400px]"}>
        <div className="space-y-3 pr-4">
          {displayedActivities.map((activity: any) => {
            const Icon = activityIcons[activity.activity_type] || FileText;
            
            return (
              <div key={activity.id} className="flex gap-3">
                <div className="flex-shrink-0">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                    <Icon className="h-3.5 w-3.5 text-primary" />
                  </div>
                </div>
                
                  <div className="flex-1 space-y-1">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-medium">{activity.description}</p>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {format(new Date(activity.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    
                    {activity.from_stage && activity.to_stage && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{activity.from_stage}</Badge>
                        <ArrowRight className="h-3 w-3" />
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{activity.to_stage}</Badge>
                      </div>
                    )}
                    
                    {getMovedByName(activity) && (
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        por {getMovedByName(activity)}
                      </p>
                    )}
                  </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
      
      {hasMore && !showAll && (
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowAll(true)}
        >
          Ver todas ({activities.length} atividades)
        </Button>
      )}
    </div>
  );
};

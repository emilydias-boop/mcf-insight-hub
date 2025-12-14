import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
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
} from 'lucide-react';

interface DealHistoryProps {
  dealId: string;
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
};

export const DealHistory = ({ dealId, limit }: DealHistoryProps) => {
  const [showAll, setShowAll] = useState(false);
  
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['deal-activities', dealId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_activities')
        .select('*, profiles:user_id(full_name)')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
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
      <div className="text-sm text-muted-foreground text-center py-8">
        Nenhuma atividade registrada ainda
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
                      {format(new Date(activity.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  
                  {activity.from_stage && activity.to_stage && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{activity.from_stage}</Badge>
                      <ArrowRight className="h-3 w-3" />
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">{activity.to_stage}</Badge>
                    </div>
                  )}
                  
                  {activity.profiles?.full_name && (
                    <p className="text-[10px] text-muted-foreground">
                      por {activity.profiles.full_name}
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

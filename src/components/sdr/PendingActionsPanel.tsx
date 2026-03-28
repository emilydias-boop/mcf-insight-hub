import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Phone, MessageCircle, Mail, Video, CheckCircle2,
  ChevronDown, AlertTriangle, Bell, Loader2
} from 'lucide-react';
import { usePendingNextActions, useCompleteNextAction, PendingAction } from '@/hooks/usePendingNextActions';
import { useTwilio } from '@/contexts/TwilioContext';
import { extractPhoneFromDeal, normalizePhoneNumber } from '@/lib/phoneUtils';
import { toast } from 'sonner';

const ACTION_ICONS: Record<string, React.ReactNode> = {
  ligar: <Phone className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  reuniao: <Video className="h-4 w-4" />,
};

const ACTION_LABELS: Record<string, string> = {
  ligar: 'Ligar',
  whatsapp: 'WhatsApp',
  email: 'E-mail',
  reuniao: 'Reunião',
};

export const PendingActionsPanel = () => {
  const { data: actions = [], isLoading } = usePendingNextActions();
  const completeAction = useCompleteNextAction();
  const { makeCall, deviceStatus, initializeDevice } = useTwilio();
  const [isOpen, setIsOpen] = useState(true);

  const overdueCount = actions.filter(a => a.isOverdue).length;
  const todayCount = actions.filter(a => a.isToday).length;
  const totalCount = actions.length;

  if (isLoading || totalCount === 0) return null;

  const handleQuickAction = async (action: PendingAction) => {
    const phone = action.contactPhone;

    if (action.actionType === 'ligar') {
      if (!phone) { toast.error('Sem telefone cadastrado'); return; }
      const normalized = normalizePhoneNumber(phone);
      if (deviceStatus !== 'ready') {
        toast.info('Inicializando Twilio...');
        const ok = await initializeDevice();
        if (!ok) { toast.error('Erro ao inicializar Twilio'); return; }
      }
      await makeCall(normalized, action.dealId);
    } else if (action.actionType === 'whatsapp') {
      if (!phone) { toast.error('Sem telefone cadastrado'); return; }
      const clean = phone.replace(/\D/g, '');
      const formatted = clean.startsWith('55') ? clean : `55${clean}`;
      window.open(`https://wa.me/${formatted}`, '_blank');
    } else if (action.actionType === 'email') {
      if (action.contactEmail) {
        window.open(`mailto:${action.contactEmail}`, '_blank');
      } else {
        toast.error('Sem email cadastrado');
      }
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn(
        "border-2 transition-colors",
        overdueCount > 0
          ? "border-destructive/60 bg-destructive/5"
          : todayCount > 0
            ? "border-yellow-500/60 bg-yellow-500/5"
            : "border-primary/40 bg-primary/5"
      )}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Bell className={cn(
                  "h-4 w-4",
                  overdueCount > 0 ? "text-destructive animate-pulse" : "text-primary"
                )} />
                Próximas Ações
                <Badge variant="secondary" className="text-xs">{totalCount}</Badge>
                {overdueCount > 0 && (
                  <Badge variant="destructive" className="text-xs animate-pulse gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {overdueCount} atrasada{overdueCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {todayCount > 0 && (
                  <Badge className="text-xs bg-yellow-500 text-black border-0">
                    {todayCount} hoje
                  </Badge>
                )}
              </CardTitle>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                isOpen && "rotate-180"
              )} />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-3 space-y-2 max-h-72 overflow-y-auto">
            {actions.map((action) => (
              <ActionItem
                key={action.dealId}
                action={action}
                onQuickAction={handleQuickAction}
                onComplete={(id) => completeAction.mutate(id)}
                isCompleting={completeAction.isPending}
              />
            ))}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

interface ActionItemProps {
  action: PendingAction;
  onQuickAction: (action: PendingAction) => void;
  onComplete: (dealId: string) => void;
  isCompleting: boolean;
}

const ActionItem = ({ action, onQuickAction, onComplete, isCompleting }: ActionItemProps) => {
  const formattedDate = format(new Date(action.actionDate), "dd/MM 'às' HH:mm", { locale: ptBR });

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors",
      action.isOverdue
        ? "border-destructive/50 bg-destructive/10 animate-pulse"
        : action.isToday
          ? "border-yellow-500/50 bg-yellow-500/10"
          : "border-border bg-background"
    )}>
      {/* Icon */}
      <div className={cn(
        "flex items-center justify-center h-8 w-8 rounded-full shrink-0",
        action.isOverdue
          ? "bg-destructive/20 text-destructive"
          : action.isToday
            ? "bg-yellow-500/20 text-yellow-600"
            : "bg-primary/20 text-primary"
      )}>
        {ACTION_ICONS[action.actionType] || <Phone className="h-4 w-4" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">
            {action.contactName || action.dealName}
          </span>
          {action.isOverdue && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              Atrasada
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">{ACTION_LABELS[action.actionType] || action.actionType}</span>
          <span>•</span>
          <span>{formattedDate}</span>
          {action.actionNote && (
            <>
              <span>•</span>
              <span className="truncate">{action.actionNote}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => onQuickAction(action)}
          title={`Executar: ${ACTION_LABELS[action.actionType]}`}
        >
          {ACTION_ICONS[action.actionType] || <Phone className="h-3.5 w-3.5" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
          onClick={() => onComplete(action.dealId)}
          disabled={isCompleting}
          title="Concluir ação"
        >
          {isCompleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
    </div>
  );
};

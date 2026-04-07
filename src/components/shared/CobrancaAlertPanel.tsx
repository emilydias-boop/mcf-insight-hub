import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertTriangle, ChevronDown, ChevronRight, Send, MessageCircle, XCircle, Loader2 } from 'lucide-react';
import { useRegistrarAcaoCobranca } from '@/hooks/useRegistrarAcaoCobranca';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertItem {
  id: string; // installment_id
  label: string; // nome / cliente
  sublabel?: string; // grupo/cota or product
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  dias_para_vencer: number;
  priority: 'urgente' | 'atencao';
}

interface CobrancaAlertPanelProps {
  alerts: AlertItem[];
  isLoading: boolean;
  type: 'consorcio' | 'billing';
  title?: string;
}

export function CobrancaAlertPanel({ alerts, isLoading, type, title = 'Alertas de Cobrança' }: CobrancaAlertPanelProps) {
  const [open, setOpen] = useState(true);
  const registrar = useRegistrarAcaoCobranca();

  if (isLoading) return null;
  if (!alerts.length) return null;

  // Group by data_vencimento
  const grouped = alerts.reduce<Record<string, AlertItem[]>>((acc, item) => {
    const key = item.data_vencimento;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort();
  const urgentCount = alerts.filter(a => a.priority === 'urgente').length;

  const handleAction = (item: AlertItem, acao: 'boleto_enviado' | 'lead_respondeu' | 'sem_retorno') => {
    const params = type === 'consorcio'
      ? { installment_id: item.id, tipo_acao: acao }
      : { billing_installment_id: item.id, tipo_acao: acao };
    registrar.mutate(params);
  };

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-foreground">{title}</span>
              <Badge variant="destructive" className="text-xs">
                {alerts.length} pendente{alerts.length !== 1 ? 's' : ''}
              </Badge>
              {urgentCount > 0 && (
                <Badge className="bg-red-600 text-white text-xs animate-pulse">
                  {urgentCount} urgente{urgentCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3 max-h-[400px] overflow-y-auto">
            {sortedDates.map(dateStr => {
              const items = grouped[dateStr];
              const diasLabel = items[0].dias_para_vencer;
              const formattedDate = format(new Date(dateStr + 'T12:00:00'), 'dd/MM (EEEE)', { locale: ptBR });
              const isUrgent = diasLabel <= 2;

              return (
                <DateGroup
                  key={dateStr}
                  date={formattedDate}
                  diasLabel={diasLabel}
                  isUrgent={isUrgent}
                  items={items}
                  onAction={handleAction}
                  isPending={registrar.isPending}
                />
              );
            })}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function DateGroup({
  date,
  diasLabel,
  isUrgent,
  items,
  onAction,
  isPending,
}: {
  date: string;
  diasLabel: number;
  isUrgent: boolean;
  items: AlertItem[];
  onAction: (item: AlertItem, acao: 'boleto_enviado' | 'lead_respondeu' | 'sem_retorno') => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(isUrgent);
  const totalValor = items.reduce((s, i) => s + i.valor, 0);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger asChild>
        <div className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors ${
          isUrgent ? 'bg-red-100/70 dark:bg-red-900/30 hover:bg-red-200/70' : 'bg-amber-100/70 dark:bg-amber-900/20 hover:bg-amber-200/70'
        }`}>
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <span className="font-medium text-sm">{date}</span>
            <Badge variant={isUrgent ? 'destructive' : 'secondary'} className="text-xs">
              {diasLabel === 0 ? 'Hoje' : diasLabel === 1 ? 'Amanhã' : `em ${diasLabel} dias`}
            </Badge>
            <span className="text-xs text-muted-foreground">{items.length} parcela{items.length !== 1 ? 's' : ''}</span>
          </div>
          <span className="text-sm font-semibold">
            {totalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </span>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 ml-4">
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between p-2 rounded bg-background border text-sm gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.label}</p>
              <p className="text-xs text-muted-foreground">
                {item.sublabel && <span>{item.sublabel} · </span>}
                P{item.numero_parcela} · {item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-green-300 text-green-700 hover:bg-green-50"
                onClick={() => onAction(item, 'boleto_enviado')}
                disabled={isPending}
              >
                <Send className="h-3 w-3" />
                Enviado
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                onClick={() => onAction(item, 'lead_respondeu')}
                disabled={isPending}
              >
                <MessageCircle className="h-3 w-3" />
                Respondeu
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => onAction(item, 'sem_retorno')}
                disabled={isPending}
              >
                <XCircle className="h-3 w-3" />
                S/ Retorno
              </Button>
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { History, ChevronDown, ChevronRight, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useCobrancaHistory, CobrancaHistoryItem } from '@/hooks/useCobrancaHistory';
import { useRegistrarAcaoCobranca } from '@/hooks/useRegistrarAcaoCobranca';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const ACAO_LABELS: Record<string, string> = {
  boleto_enviado: 'Boleto Enviado',
  lead_respondeu: 'Lead Respondeu',
  sem_retorno: 'Sem Retorno',
  pago_confirmado: 'Pago Confirmado',
};

const ACAO_COLORS: Record<string, string> = {
  boleto_enviado: 'bg-blue-100 text-blue-800 border-blue-200',
  lead_respondeu: 'bg-green-100 text-green-800 border-green-200',
  sem_retorno: 'bg-red-100 text-red-800 border-red-200',
  pago_confirmado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

interface CobrancaHistoryPanelProps {
  type: 'consorcio' | 'billing';
}

export function CobrancaHistoryPanel({ type }: CobrancaHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [limit, setLimit] = useState(50);
  const [tab, setTab] = useState('todos');
  const { data: history = [], isLoading } = useCobrancaHistory(type, limit);
  const registrar = useRegistrarAcaoCobranca();

  if (isLoading && !history.length) return null;

  const filtered = tab === 'todos' ? history : history.filter(h => h.tipo_acao === tab);

  const handlePago = (item: CobrancaHistoryItem) => {
    const params = type === 'consorcio'
      ? { installment_id: item.installment_id!, tipo_acao: 'pago_confirmado' as const }
      : { billing_installment_id: item.billing_installment_id!, tipo_acao: 'pago_confirmado' as const };
    registrar.mutate(params);
  };

  const handleSemRetorno = (item: CobrancaHistoryItem) => {
    const params = type === 'consorcio'
      ? { installment_id: item.installment_id!, tipo_acao: 'sem_retorno' as const }
      : { billing_installment_id: item.billing_installment_id!, tipo_acao: 'sem_retorno' as const };
    registrar.mutate(params);
  };

  const counts = {
    todos: history.length,
    boleto_enviado: history.filter(h => h.tipo_acao === 'boleto_enviado').length,
    lead_respondeu: history.filter(h => h.tipo_acao === 'lead_respondeu').length,
    sem_retorno: history.filter(h => h.tipo_acao === 'sem_retorno').length,
    pago_confirmado: history.filter(h => h.tipo_acao === 'pago_confirmado').length,
  };

  return (
    <Card className="border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-foreground">Histórico de Ações</span>
              {history.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {history.length} registro{history.length !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="w-full justify-start">
                <TabsTrigger value="todos" className="text-xs">
                  Todos {counts.todos > 0 && `(${counts.todos})`}
                </TabsTrigger>
                <TabsTrigger value="boleto_enviado" className="text-xs">
                  Enviados {counts.boleto_enviado > 0 && `(${counts.boleto_enviado})`}
                </TabsTrigger>
                <TabsTrigger value="lead_respondeu" className="text-xs">
                  Responderam {counts.lead_respondeu > 0 && `(${counts.lead_respondeu})`}
                </TabsTrigger>
                <TabsTrigger value="sem_retorno" className="text-xs">
                  S/ Retorno {counts.sem_retorno > 0 && `(${counts.sem_retorno})`}
                </TabsTrigger>
                <TabsTrigger value="pago_confirmado" className="text-xs">
                  Pagos {counts.pago_confirmado > 0 && `(${counts.pago_confirmado})`}
                </TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-2">
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {filtered.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro encontrado</p>
                  ) : (
                    filtered.map(item => (
                      <HistoryRow
                        key={item.id}
                        item={item}
                        onPago={handlePago}
                        onSemRetorno={handleSemRetorno}
                        isPending={registrar.isPending}
                      />
                    ))
                  )}
                </div>
                {filtered.length >= limit && (
                  <div className="text-center pt-2">
                    <Button variant="ghost" size="sm" onClick={() => setLimit(l => l + 50)}>
                      Carregar mais
                    </Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function HistoryRow({
  item,
  onPago,
  onSemRetorno,
  isPending,
}: {
  item: CobrancaHistoryItem;
  onPago: (item: CobrancaHistoryItem) => void;
  onSemRetorno: (item: CobrancaHistoryItem) => void;
  isPending: boolean;
}) {
  const isPago = item.tipo_acao === 'pago_confirmado';
  const isBoletoEnviado = item.tipo_acao === 'boleto_enviado';

  return (
    <div className="flex items-center justify-between p-2 rounded-md bg-background border text-sm gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`text-xs ${ACAO_COLORS[item.tipo_acao] || ''}`} variant="outline">
            {ACAO_LABELS[item.tipo_acao] || item.tipo_acao}
          </Badge>
          <span className="font-medium truncate">{item.label}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {item.sublabel && <span>{item.sublabel} · </span>}
          {item.numero_parcela != null && <span>P{item.numero_parcela} · </span>}
          {item.valor != null && (
            <span>{item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} · </span>
          )}
          {item.data_vencimento && (
            <span>Venc. {format(new Date(item.data_vencimento + 'T12:00:00'), 'dd/MM', { locale: ptBR })}</span>
          )}
        </p>
        {item.observacao && <p className="text-xs text-muted-foreground italic">{item.observacao}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(item.created_at), 'dd/MM HH:mm', { locale: ptBR })}
        </span>
        {!isPago && (
          <div className="flex gap-1">
            {isBoletoEnviado && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1 border-red-300 text-red-700 hover:bg-red-50"
                onClick={() => onSemRetorno(item)}
                disabled={isPending}
              >
                <XCircle className="h-3 w-3" />
                S/ Retorno
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              onClick={() => onPago(item)}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
              Pago
            </Button>
          </div>
        )}
        {isPago && (
          <Badge className="bg-emerald-100 text-emerald-800 text-xs">✓ Pago</Badge>
        )}
      </div>
    </div>
  );
}

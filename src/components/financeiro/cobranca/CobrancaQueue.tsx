import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BillingSubscription } from '@/types/billing';
import { formatCurrency } from '@/lib/formatters';
import { useBillingQueue, useBulkAssignResponsavel, QueueItem } from '@/hooks/useBillingQueue';
import { useAddBillingHistory } from '@/hooks/useBillingHistory';
import { toast } from 'sonner';
import { AlertTriangle, Flame, ShieldAlert, MessageCircle, UserPlus, ChevronDown, ChevronUp } from 'lucide-react';

const RISK_CONFIG = {
  cancelamento: { label: 'Cancelamento', icon: Flame, color: 'bg-red-600 text-white', textColor: 'text-red-600' },
  alto: { label: 'Alto', icon: ShieldAlert, color: 'bg-orange-500 text-white', textColor: 'text-orange-600' },
  medio: { label: 'Médio', icon: AlertTriangle, color: 'bg-yellow-500 text-white', textColor: 'text-yellow-700' },
};

interface CobrancaQueueProps {
  onSelect: (sub: BillingSubscription) => void;
}

export const CobrancaQueue = ({ onSelect }: CobrancaQueueProps) => {
  const { data: queue = [], isLoading } = useBillingQueue();
  const bulkAssign = useBulkAssignResponsavel();
  const addHistory = useAddBillingHistory();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [responsavelInput, setResponsavelInput] = useState('');
  const [expanded, setExpanded] = useState(true);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === queue.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(queue.map(q => q.subscription.id)));
    }
  };

  const handleBulkAssign = async () => {
    if (!responsavelInput.trim() || selectedIds.size === 0) return;
    try {
      await bulkAssign.mutateAsync({ ids: Array.from(selectedIds), responsavel: responsavelInput.trim() });
      toast.success(`${selectedIds.size} assinaturas atribuídas a ${responsavelInput.trim()}`);
      setSelectedIds(new Set());
      setResponsavelInput('');
    } catch {
      toast.error('Erro ao atribuir responsável');
    }
  };

  const handleWhatsApp = async (item: QueueItem) => {
    const sub = item.subscription;
    if (!sub.customer_phone) return;

    // Register attempt
    try {
      await addHistory.mutateAsync({
        subscription_id: sub.id,
        tipo: 'tentativa_cobranca',
        descricao: `Cobrança via WhatsApp — ${item.parcelas_atrasadas} parcela(s) atrasada(s)`,
      });
    } catch { /* silent */ }

    const phone = sub.customer_phone.replace(/\D/g, '');
    const phoneFormatted = phone.startsWith('55') ? phone : `55${phone}`;
    const saldo = sub.valor_total_contrato - (sub.valor_pago_total ?? 0);
    const msg = encodeURIComponent(
      `Olá ${sub.customer_name.split(' ')[0]}! 🙂\n\n` +
      `Identificamos ${item.parcelas_atrasadas} parcela(s) em atraso referente ao seu contrato *${sub.product_name}*.\n` +
      `Saldo devedor: ${formatCurrency(saldo)}\n\n` +
      `Podemos conversar sobre a regularização?`
    );
    window.open(`https://wa.me/${phoneFormatted}?text=${msg}`, '_blank');
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (queue.length === 0) return null;

  const riskCounts = {
    cancelamento: queue.filter(q => q.risco === 'cancelamento').length,
    alto: queue.filter(q => q.risco === 'alto').length,
    medio: queue.filter(q => q.risco === 'medio').length,
  };

  return (
    <Card className="border-red-200 bg-red-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Flame className="h-5 w-5 text-red-600" />
              Fila de Cobrança
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="secondary" className="bg-red-100 text-red-700 text-xs">{riskCounts.cancelamento} cancelamento</Badge>
              <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">{riskCounts.alto} alto</Badge>
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-xs">{riskCounts.medio} médio</Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {/* Bulk assign bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-background rounded-lg border">
              <span className="text-sm font-medium">{selectedIds.size} selecionado(s)</span>
              <Input
                placeholder="Nome do responsável..."
                value={responsavelInput}
                onChange={e => setResponsavelInput(e.target.value)}
                className="h-8 w-48"
              />
              <Button size="sm" onClick={handleBulkAssign} disabled={bulkAssign.isPending || !responsavelInput.trim()}>
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Atribuir
              </Button>
            </div>
          )}

          <div className="overflow-auto max-h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={selectedIds.size === queue.length && queue.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Risco</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Parc. Atrasadas</TableHead>
                  <TableHead className="text-center">Dias s/ Pgto</TableHead>
                  <TableHead className="text-center">Dias s/ Contato</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead className="text-right">Saldo Devedor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((item) => {
                  const sub = item.subscription;
                  const config = RISK_CONFIG[item.risco];
                  const Icon = config.icon;
                  const saldo = sub.valor_total_contrato - (sub.valor_pago_total ?? 0);

                  return (
                    <TableRow
                      key={sub.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSelect(sub)}
                    >
                      <TableCell onClick={e => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(sub.id)}
                          onCheckedChange={() => toggleSelect(sub.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-xs ${config.color}`}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm">{sub.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{sub.customer_email}</div>
                      </TableCell>
                      <TableCell className="text-sm">{sub.product_name}</TableCell>
                      <TableCell className="text-center">
                        <span className={`font-bold ${config.textColor}`}>{item.parcelas_atrasadas}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {item.dias_desde_ultimo_pagamento !== null ? `${item.dias_desde_ultimo_pagamento}d` : '—'}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {item.dias_sem_contato === null ? (
                          <span className="text-red-600 font-medium text-xs">Nunca</span>
                        ) : (
                          `${item.dias_sem_contato}d`
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{sub.responsavel_financeiro || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right font-medium text-sm">{formatCurrency(saldo)}</TableCell>
                      <TableCell onClick={e => e.stopPropagation()}>
                        {sub.customer_phone && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-700 hover:bg-green-100"
                            onClick={() => handleWhatsApp(item)}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

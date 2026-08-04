import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { ShieldAlert, History } from 'lucide-react';
import { toast } from 'sonner';
import {
  useEditarReembolso,
  useArReembolsoAuditoria,
  diffReembolso,
  type ArReembolsoWithTitulo,
} from '@/hooks/useArReembolsos';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

interface Props {
  reembolso: ArReembolsoWithTitulo | null;
  onOpenChange: (v: boolean) => void;
}

export function EditarReembolsoDialog({ reembolso, onOpenChange }: Props) {
  const editar = useEditarReembolso();
  const { data: auditoria } = useArReembolsoAuditoria(reembolso?.id ?? null);

  const [valor, setValor] = useState('');
  const [dataPedido, setDataPedido] = useState('');
  const [dataPrevista, setDataPrevista] = useState('');
  const [dataPagamento, setDataPagamento] = useState('');
  const [motivo, setMotivo] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (!reembolso) return;
    setValor(Number(reembolso.valor || 0).toFixed(2));
    setDataPedido(reembolso.data_pedido || '');
    setDataPrevista(reembolso.data_prevista_pagamento || '');
    setDataPagamento(reembolso.data_pagamento || '');
    setMotivo(reembolso.motivo || '');
    setJustificativa('');
    setShowHistory(false);
  }, [reembolso?.id]);

  const original = useMemo(
    () => ({
      valor: Number(reembolso?.valor || 0),
      data_pedido: reembolso?.data_pedido || '',
      data_prevista_pagamento: reembolso?.data_prevista_pagamento || null,
      data_pagamento: reembolso?.data_pagamento || null,
      motivo: reembolso?.motivo || null,
    }),
    [reembolso],
  );

  const next = useMemo(
    () => ({
      valor: Number(valor),
      data_pedido: dataPedido,
      data_prevista_pagamento: dataPrevista || null,
      data_pagamento: dataPagamento || null,
      motivo: motivo.trim() || null,
    }),
    [valor, dataPedido, dataPrevista, dataPagamento, motivo],
  );

  const { changed, sensitiveChanged } = useMemo(
    () => diffReembolso(original, next),
    [original, next],
  );

  const needsJustification = sensitiveChanged.length > 0;
  const justificationOk = !needsJustification || justificativa.trim().length >= 15;
  const valorValido = Number.isFinite(next.valor) && next.valor > 0;

  const handleSave = async () => {
    if (!reembolso) return;
    if (!valorValido) {
      toast.error('Informe um valor de reembolso válido.');
      return;
    }
    if (!next.data_pedido) {
      toast.error('Informe a data do pedido.');
      return;
    }
    if (changed.length === 0) {
      toast.info('Nenhuma alteração para salvar.');
      return;
    }
    try {
      await editar.mutateAsync({
        id: reembolso.id,
        titulo_id: reembolso.titulo_id,
        original,
        next,
        justificativa: justificativa.trim() || undefined,
      });
      toast.success('Reembolso atualizado.');
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar alterações.');
    }
  };

  const fmt = (d?: string | null) =>
    d ? format(new Date(d + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR }) : '—';

  return (
    <Dialog open={!!reembolso} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar reembolso</DialogTitle>
          <DialogDescription>
            {reembolso?.titulo?.customer_name || '—'} — {reembolso?.titulo?.product_code || '—'} ·
            valor atual <b>{brl(Number(reembolso?.valor || 0))}</b>
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Valor do reembolso (sensível)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
            />
          </div>
          <div>
            <Label>Data do pedido</Label>
            <Input type="date" value={dataPedido} onChange={(e) => setDataPedido(e.target.value)} />
          </div>
          <div>
            <Label>Data prevista para pagamento</Label>
            <Input
              type="date"
              value={dataPrevista}
              onChange={(e) => setDataPrevista(e.target.value)}
            />
          </div>
          <div>
            <Label>Data de pagamento efetivo (sensível)</Label>
            <Input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Motivo / observação</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>

        {needsJustification && (
          <Alert className="border-amber-500/40 bg-amber-500/10">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertDescription className="space-y-2">
              <p className="text-sm">
                Você está alterando campo(s) sensível(is):{' '}
                <b>
                  {sensitiveChanged
                    .map((c) => (c === 'valor' ? 'valor' : 'data de pagamento'))
                    .join(', ')}
                </b>
                . Justificativa obrigatória (mínimo 15 caracteres) — será registrada em auditoria.
              </p>
              <Textarea
                rows={2}
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                placeholder="Descreva o motivo da alteração"
              />
              <p className="text-xs text-muted-foreground">
                {justificativa.trim().length}/15 caracteres
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory((v) => !v)}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            {showHistory ? 'Ocultar' : 'Ver'} histórico de alterações ({auditoria?.length ?? 0})
          </Button>
          {showHistory && (
            <div className="mt-2 space-y-2 max-h-52 overflow-y-auto">
              {(auditoria || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>
              ) : (
                (auditoria || []).map((a) => (
                  <div key={a.id} className="rounded-md border p-2 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {a.action === 'update_sensitive' ? 'Alteração sensível' : 'Alteração'}
                      </span>
                      <span className="text-muted-foreground">
                        {a.created_at
                          ? format(new Date(a.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                          : '—'}
                      </span>
                    </div>
                    <div className="text-muted-foreground break-words">
                      De: {JSON.stringify(a.old_data)}
                    </div>
                    <div className="text-muted-foreground break-words">
                      Para: {JSON.stringify(a.new_data)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="text-xs text-muted-foreground">
          Pedido atual: {fmt(reembolso?.data_pedido)} · Previsto:{' '}
          {fmt(reembolso?.data_prevista_pagamento)} · Pago em: {fmt(reembolso?.data_pagamento)}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={editar.isPending || !justificationOk || changed.length === 0}
            onClick={handleSave}
          >
            {editar.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
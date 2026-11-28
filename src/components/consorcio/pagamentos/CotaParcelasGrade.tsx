import { useState } from 'react';
import { ChevronLeft, ChevronRight, Check, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmPaymentDateDialog } from '@/components/consorcio/ConfirmPaymentDateDialog';
import { usePayInstallment } from '@/hooks/useConsorcio';
import { useConsorcioParcelasBloco, type ResumoCota } from '@/hooks/useConsorcioCotasPagamentos';
import { inicioBlocoParcelas, numerosBlocoParcelas, situacaoParcelaGrade, marcaConfirmacao, type ParcelaGrade } from '@/lib/consorcioPagamentoGrade';
import { formatCurrency } from '@/lib/consorcioCalculos';
import { cn } from '@/lib/utils';

const situacoes = {
  paga: 'Paga', vencida: 'Vencida', a_vencer: 'A vencer', prevista: 'Prevista', nao_gerada: 'Não gerada',
};
const dataFormatada = (data: string) => format(new Date(`${data}T00:00:00`), 'dd/MM/yyyy');

export function CotaParcelasGrade({ cota }: { cota: ResumoCota }) {
  const prazo = cota.prazo || 0;
  const [inicio, setInicio] = useState(() => inicioBlocoParcelas(cota.bloco_atual, prazo));
  const [confirmar, setConfirmar] = useState<ParcelaGrade | null>(null);
  const numeros = numerosBlocoParcelas(inicio, prazo);
  const fim = Math.min(inicio + 11, prazo);
  const parcelas = useConsorcioParcelasBloco(cota.card_id, inicio, fim);
  const pagamento = usePayInstallment();
  const porNumero = new Map((parcelas.data || []).map(p => [p.numero_parcela, p]));
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

  return (
    <div className="w-full max-w-[calc(100vw-5rem)] space-y-4 py-4 lg:max-w-none">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {cota.parcelas_geradas} de {prazo} parcelas geradas · {cota.mcf_aberto} MCF em aberto
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" title="Bloco anterior" aria-label="Bloco anterior" disabled={inicio <= 1 || parcelas.isFetching} onClick={() => setInicio(v => v - 12)}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-32 text-center text-sm">{prazo ? `${inicio}–${fim} de ${prazo}` : 'Prazo não informado'}</span>
          <Button variant="outline" size="icon" title="Bloco seguinte" aria-label="Bloco seguinte" disabled={fim >= prazo || parcelas.isFetching} onClick={() => setInicio(v => v + 12)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {parcelas.isError ? (
        <div role="alert" className="flex items-center gap-3 text-sm text-destructive">Não foi possível consultar as parcelas.<Button variant="outline" size="sm" onClick={() => parcelas.refetch()}>Tentar novamente</Button></div>
      ) : (
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {numeros.map(numero => {
              if (parcelas.isLoading) return <Skeleton key={numero} className="h-40" />;
              const parcela = porNumero.get(numero);
              const situacao = situacaoParcelaGrade(parcela, hoje);
              const marca = parcela ? marcaConfirmacao(parcela) : null;
              return (
                <Button key={numero} variant="outline" className={cn('h-auto min-h-40 w-full flex-col items-start justify-start gap-2 whitespace-normal rounded-md p-3 text-left font-normal tracking-normal', situacao === 'vencida' && 'border-destructive/50', situacao === 'paga' && 'bg-accent/40')} disabled={!parcela || pagamento.isPending} aria-disabled={situacao === 'paga'} onClick={() => { if (parcela && situacao !== 'paga') setConfirmar(parcela); }} aria-label={`Parcela ${numero}, ${situacoes[situacao]}`}>
                  <div className="flex w-full flex-wrap items-center justify-between gap-1"><span className="font-semibold">#{numero}</span>{parcela && <Badge variant={parcela.tipo === 'empresa' ? 'default' : 'secondary'}>{parcela.tipo === 'empresa' ? 'MCF' : 'Cliente'}</Badge>}</div>
                  <span className="text-xs text-muted-foreground">{parcela ? dataFormatada(parcela.data_vencimento) : '—'}</span>
                  <span className="font-semibold">{parcela ? formatCurrency(Number(parcela.valor_parcela)) : '—'}</span>
                  {parcela?.valor_estimado && <span className="text-xs text-muted-foreground">Estimado</span>}
                  <div className="mt-auto flex w-full flex-wrap items-center justify-between gap-1">
                    <span className={cn('text-xs', situacao === 'vencida' && 'text-destructive')}>{situacoes[situacao]}</span>
                    {marca && parcela && <Tooltip><TooltipTrigger asChild><span tabIndex={0} aria-label={marca === 'embracon' ? 'Conferida Embracon' : 'Confirmação manual'}>{marca === 'embracon' ? <CheckCheck className="h-4 w-4" /> : <Check className="h-4 w-4" />}</span></TooltipTrigger><TooltipContent>{marca === 'embracon' ? `Conferida Embracon: ${dataFormatada(parcela.conferido_embracon_em || hoje)}${parcela.conferido_embracon_ref ? ` · ${parcela.conferido_embracon_ref}` : ''}` : `Manual · ${parcela.pagamento_confirmado_nome || parcela.pagamento_confirmado_por || 'Responsável não registrado'}${parcela.pagamento_confirmado_em ? ` · ${new Date(parcela.pagamento_confirmado_em).toLocaleString('pt-BR')}` : ''}`}</TooltipContent></Tooltip>}
                  </div>
                </Button>
              );
            })}
          </div>
        </TooltipProvider>
      )}
      <ConfirmPaymentDateDialog open={!!confirmar} onOpenChange={aberto => { if (!aberto) setConfirmar(null); }} numeroParcela={confirmar?.numero_parcela} dataVencimento={confirmar?.data_vencimento} cliente={cota.cliente} isSaving={pagamento.isPending} onConfirm={async dataPagamento => {
        if (!confirmar) return;
        try {
          await pagamento.mutateAsync({ installmentId: confirmar.id, dataPagamento });
          setConfirmar(null);
        } catch { /* O hook mantém o diálogo aberto e apresenta o erro. */ }
      }} />
    </div>
  );
}
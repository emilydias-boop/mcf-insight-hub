// Esteira pós-R1 da BU Crédito Imobiliário.
// Consome a RPC public.credito_avancar_etapa(p_deal_id, p_acao, p_motivo) — backend já existente.
// Renderizada apenas no AgendaMeetingDrawer quando activeBU === 'credito' e a R1 está Realizada.
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { FileCheck, FolderOpen, Search, CheckCircle2, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const STAGE = {
  R1_REALIZADA: 'c4ed1701-0000-4000-8000-000000000006',
  AGUARDANDO_DOC: 'c4ed1701-0000-4000-8000-000000000012',
  DOC_ERRADA: 'c4ed1701-0000-4000-8000-000000000013',
  DOC_OK: 'c4ed1701-0000-4000-8000-000000000014',
  GRUPO_ABERTO: 'c4ed1701-0000-4000-8000-000000000007',
  ANALISE: 'c4ed1701-0000-4000-8000-000000000008',
  APROVADO: 'c4ed1701-0000-4000-8000-000000000015',
  VENDA: 'c4ed1701-0000-4000-8000-000000000009',
  REPROVADO: 'c4ed1701-0000-4000-8000-000000000016',
  SEM_INTERESSE: 'c4ed1701-0000-4000-8000-000000000010',
  PERDIDO: 'c4ed1701-0000-4000-8000-000000000011',
} as const;

interface Acao {
  acao: string;
  rotulo: string;
  exigeMotivo?: boolean;
  variante: 'positivo' | 'ambar' | 'destrutivo' | 'neutro';
}

const ACOES_POR_ETAPA: Record<string, Acao[]> = {
  [STAGE.R1_REALIZADA]: [
    { acao: 'aguardando_documentacao', rotulo: 'Aguardando documentação', variante: 'neutro' },
  ],
  [STAGE.AGUARDANDO_DOC]: [
    { acao: 'documentacao_ok', rotulo: 'Documentação OK', variante: 'positivo' },
    { acao: 'documentacao_pendente', rotulo: 'Documentação errada/faltando', exigeMotivo: true, variante: 'ambar' },
  ],
  [STAGE.DOC_ERRADA]: [
    { acao: 'documentacao_ok', rotulo: 'Documentação OK', variante: 'positivo' },
  ],
  [STAGE.DOC_OK]: [
    { acao: 'grupo_aberto', rotulo: 'Grupo aberto', variante: 'positivo' },
  ],
  [STAGE.GRUPO_ABERTO]: [
    { acao: 'analise_credito', rotulo: 'Análise de crédito', variante: 'neutro' },
  ],
  [STAGE.ANALISE]: [
    { acao: 'credito_aprovado', rotulo: 'Crédito aprovado', variante: 'positivo' },
    { acao: 'credito_reprovado', rotulo: 'Crédito reprovado', exigeMotivo: true, variante: 'destrutivo' },
  ],
};

const ETAPAS_CONHECIDAS = new Set(Object.values(STAGE));
const ETAPAS_FINAIS = new Set([STAGE.VENDA, STAGE.REPROVADO, STAGE.SEM_INTERESSE, STAGE.PERDIDO]);

// Mini trilha: Documentação → Grupo → Análise → Resultado
const TRILHA: { rotulo: string; stageIds: string[] }[] = [
  { rotulo: 'Documentação', stageIds: [STAGE.R1_REALIZADA, STAGE.AGUARDANDO_DOC, STAGE.DOC_ERRADA, STAGE.DOC_OK] },
  { rotulo: 'Grupo', stageIds: [STAGE.GRUPO_ABERTO] },
  { rotulo: 'Análise', stageIds: [STAGE.ANALISE] },
  { rotulo: 'Resultado', stageIds: [STAGE.APROVADO, STAGE.VENDA, STAGE.REPROVADO, STAGE.SEM_INTERESSE, STAGE.PERDIDO] },
];

function passoAtual(stageId: string): number {
  const idx = TRILHA.findIndex(p => p.stageIds.includes(stageId));
  return idx === -1 ? 0 : idx;
}

const botaoClasse: Record<Acao['variante'], string> = {
  positivo: 'bg-emerald-600 text-white hover:bg-emerald-700',
  ambar: 'bg-amber-500 text-white hover:bg-amber-600',
  destrutivo: '',
  neutro: '',
};

interface CreditoEsteiraActionsProps {
  dealId: string;
}

export function CreditoEsteiraActions({ dealId }: CreditoEsteiraActionsProps) {
  const queryClient = useQueryClient();
  const [motivoDialog, setMotivoDialog] = useState<Acao | null>(null);
  const [motivo, setMotivo] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['credito-esteira', dealId],
    queryFn: async () => {
      const { data: deal, error: dealErr } = await supabase
        .from('crm_deals')
        .select('stage_id')
        .eq('id', dealId)
        .maybeSingle();
      if (dealErr) throw dealErr;
      if (!deal) throw new Error('Negócio não encontrado');

      let stageName: string | null = null;
      if (deal.stage_id) {
        const { data: stage, error: stageErr } = await supabase
          .from('crm_stages')
          .select('stage_name')
          .eq('id', deal.stage_id)
          .maybeSingle();
        if (stageErr) throw stageErr;
        stageName = stage?.stage_name ?? null;
      }

      const { data: ultima, error: actErr } = await supabase
        .from('deal_activities')
        .select('description, created_at')
        .eq('deal_id', dealId)
        .eq('activity_type', 'credito_esteira')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (actErr) throw actErr;

      return { stageId: deal.stage_id as string | null, stageName, ultima };
    },
  });

  const mutation = useMutation({
    mutationFn: async ({ acao, motivo }: { acao: string; motivo?: string }) => {
      const { data, error } = await (supabase as any).rpc('credito_avancar_etapa', {
        p_deal_id: dealId,
        p_acao: acao,
        p_motivo: motivo ?? null,
      });
      if (error) throw error;
      return data as { ok: boolean; stage_id: string; stage_name: string; acao: string };
    },
    onSuccess: (data) => {
      toast.success('Movido para ' + data.stage_name);
      queryClient.invalidateQueries({ queryKey: ['credito-esteira', dealId] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const first = q.queryKey[0];
          return typeof first === 'string' && /deal|agenda|meeting/i.test(first);
        },
      });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Falha ao avançar a esteira');
    },
  });

  const confirmar = (acao: Acao, motivoTexto?: string) => {
    mutation.mutate({ acao: acao.acao, motivo: motivoTexto });
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando esteira do crédito…
        </CardContent>
      </Card>
    );
  }

  const stageId = data?.stageId ?? null;

  if (!stageId || !ETAPAS_CONHECIDAS.has(stageId)) {
    return (
      <p className="text-xs text-muted-foreground">
        A esteira começa quando a R1 é marcada como Realizada.
      </p>
    );
  }

  const acoes = ACOES_POR_ETAPA[stageId] ?? [];
  const passo = passoAtual(stageId);
  const pendente = mutation.isPending;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">Esteira do crédito</CardTitle>
          <Badge variant="secondary">{data?.stageName ?? '—'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Mini trilha de passos */}
        <div className="flex items-center gap-1">
          {TRILHA.map((p, i) => (
            <div key={p.rotulo} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn(
                  'h-1.5 w-full rounded-full',
                  i < passo && 'bg-emerald-500',
                  i === passo && 'bg-primary',
                  i > passo && 'bg-muted',
                )}
              />
              <span
                className={cn(
                  'text-[10px]',
                  i === passo ? 'font-semibold text-foreground' : 'text-muted-foreground',
                )}
              >
                {p.rotulo}
              </span>
            </div>
          ))}
        </div>

        {data?.ultima && (
          <p className="text-xs text-muted-foreground">
            Último passo: {data.ultima.description} · {format(parseISO(data.ultima.created_at), 'dd/MM HH:mm')}
          </p>
        )}

        {stageId === STAGE.APROVADO && (
          <p className="text-xs text-muted-foreground">
            Próximo passo: registrar a venda quando o contrato for assinado no banco.
          </p>
        )}

        {acoes.length > 0 && (
          <div className={cn('grid gap-2', acoes.length > 1 ? 'grid-cols-2' : 'grid-cols-1')}>
            {acoes.map((acao) => {
              const icone =
                acao.variante === 'positivo' ? <CheckCircle2 className="h-4 w-4" /> :
                acao.variante === 'ambar' ? <AlertTriangle className="h-4 w-4" /> :
                acao.variante === 'destrutivo' ? <XCircle className="h-4 w-4" /> :
                acao.acao === 'grupo_aberto' ? <FolderOpen className="h-4 w-4" /> :
                acao.acao === 'analise_credito' ? <Search className="h-4 w-4" /> :
                <FileCheck className="h-4 w-4" />;

              const botao = (
                <Button
                  variant={acao.variante === 'destrutivo' ? 'destructive' : acao.variante === 'neutro' ? 'outline' : 'default'}
                  disabled={pendente}
                  className={cn('h-12 w-full gap-2', botaoClasse[acao.variante])}
                  onClick={() => {
                    if (acao.exigeMotivo) {
                      setMotivo('');
                      setMotivoDialog(acao);
                    }
                  }}
                >
                  {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : icone}
                  <span className="text-xs">{acao.rotulo}</span>
                </Button>
              );

              if (acao.exigeMotivo) {
                return <div key={acao.acao}>{botao}</div>;
              }

              return (
                <AlertDialog key={acao.acao}>
                  <AlertDialogTrigger asChild>{botao}</AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar movimentação</AlertDialogTitle>
                      <AlertDialogDescription>Mover para {acao.rotulo}?</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => confirmar(acao)}>Confirmar</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog de motivo (documentacao_pendente / credito_reprovado) */}
      <Dialog open={!!motivoDialog} onOpenChange={(open) => !open && setMotivoDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{motivoDialog?.rotulo}</DialogTitle>
            <DialogDescription>Informe o motivo (mínimo de 5 caracteres).</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo…"
              rows={4}
            />
            <p className="text-right text-xs text-muted-foreground">{motivo.trim().length}/5</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMotivoDialog(null)}>Cancelar</Button>
            <Button
              disabled={motivo.trim().length < 5 || pendente}
              onClick={() => {
                if (motivoDialog) confirmar(motivoDialog, motivo.trim());
                setMotivoDialog(null);
              }}
            >
              {pendente ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

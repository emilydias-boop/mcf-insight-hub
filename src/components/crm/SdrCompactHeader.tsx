import { useState } from 'react';
import { format, differenceInDays } from 'date-fns';
import { ChevronDown, Copy, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useTotalCliente } from '@/hooks/useTotaisPorCliente';
import { useUpdateCRMDeal, useCRMStages } from '@/hooks/useCRMData';
import { useDealHeaderInfo, CANAL_DOT_CLASSES } from '@/hooks/useDealHeaderInfo';
import { formatCurrency } from '@/lib/formatters';
import { LeadSegmentBadge } from '@/components/crm/LeadSegmentBadge';
import { ResgateBadge } from '@/components/crm/ResgateBadge';
import { formatarNomeExibicao } from '@/components/crm/DealKanbanCard';
import { LeadTemperatureSelector, type LeadTemperature } from '@/components/crm/LeadTemperatureSelector';
import { LossReasonDialog } from './LossReasonDialog';
import { isSemInteresseStageName, registrarMotivoSemInteresse } from '@/lib/lossReasons';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SdrCompactHeaderProps {
  deal: any;
  contact: any;
  onChanged?: () => void;
}

// Mesma regra do antigo "Mover para..." do QuickActionsBlock.
const ALWAYS_AVAILABLE_PATTERNS = [
  'sem sucesso', 'sem interesse', 'não quer', 'perdido',
  'desistente', 'cancelado', 'reembolsado', 'a reembolsar',
];
const isAlwaysAvailable = (name: string) => {
  const lower = name.toLowerCase().trim();
  return ALWAYS_AVAILABLE_PATTERNS.some(p => lower.includes(p));
};

const NEXT_ACTION_LABEL: Record<string, string> = {
  ligar: 'Ligar', whatsapp: 'WhatsApp', email: 'E-mail', reuniao: 'Reunião',
};

const iniciais = (nome: string) =>
  nome.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join('');

export const SdrCompactHeader = ({ deal, contact, onChanged }: SdrCompactHeaderProps) => {
  const { data: totaisCliente } = useTotalCliente(contact?.email);
  const { data: info } = useDealHeaderInfo(deal);
  const { data: stages } = useCRMStages(deal?.origin_id);
  const updateDeal = useUpdateCRMDeal();
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);

  const customFields = deal?.custom_fields as Record<string, any> | null;
  const estado = customFields?.estado || null;
  const faixaRenda = customFields?.faixa_de_renda || null;

  const nomeOriginal = deal?.name || '';
  const nomeExibicao = formatarNomeExibicao(contact?.name || nomeOriginal);

  // ===== Etapa =====
  const currentStageOrder = deal?.crm_stages?.stage_order || 0;
  // Sem stage_order (dado do card ainda sem a busca completa), espera o dado real.
  const stageOrderPronto = deal?.crm_stages?.stage_order !== undefined;
  const futureStages = !stageOrderPronto ? [] : stages?.filter((s: any) =>
    s.stage_order > currentStageOrder || isAlwaysAvailable(s.stage_name)
  ).filter((s: any) => s.id !== deal?.stage_id) || [];

  const executeMoveStage = async (stageId: string) => {
    try {
      await updateDeal.mutateAsync({ id: deal.id, stage_id: stageId });
      toast.success('Estágio atualizado!');
      onChanged?.();
    } catch {
      // Error handled by hook
    }
  };

  const handleSelectStage = async (stageId: string) => {
    const targetStage = stages?.find((s: any) => s.id === stageId);
    const currentStage = stages?.find((s: any) => s.id === deal?.stage_id);
    if (isSemInteresseStageName(targetStage?.stage_name) && !isSemInteresseStageName(currentStage?.stage_name)) {
      setPendingStageId(stageId);
      return;
    }
    await executeMoveStage(stageId);
  };

  // Dias de calendário em São Paulo (mesma regra do banco), não blocos de 24h.
  const diasNaEtapa = deal?.stage_moved_at
    ? diasCalendarioDesde(deal.stage_moved_at)
    : null;

  // ===== Sem contato (mesma regra do card) =====
  const resumo = info?.resumo;
  const ultimoToque = resumo?.lastTouchAt ?? resumo?.lastContactAttempt ?? null;
  let semContato: { text: string; cls: string; title?: string } | null = null;
  if (!resumo) {
    semContato = null;
  } else if (!ultimoToque && (resumo.totalActivities || 0) === 0) {
    const dias = deal.created_at ? diasCalendarioDesde(deal.created_at) : 0;
    semContato = dias < 1
      ? { text: 'Nunca contatado · novo', cls: 'text-amber-400' }
      : { text: `Nunca contatado · ${dias}d`, cls: 'text-red-400' };
  } else if (ultimoToque) {
    const dias = diasCalendarioDesde(ultimoToque);
    semContato = {
      text: rotuloContato(dias),
      cls: dias <= 1 ? 'text-emerald-400' : dias <= 3 ? 'text-amber-400' : 'text-red-400',
      title: `Último contato: ${formatarDataSP(ultimoToque)}`,
    };
  }

  // ===== Retorno =====
  let retorno: { text: string; vencido: boolean } | null = null;
  if (deal?.next_action_date) {
    const d = new Date(deal.next_action_date);
    if (!isNaN(d.getTime())) {
      const tipo = NEXT_ACTION_LABEL[deal.next_action_type] || deal.next_action_type || '';
      retorno = { text: `Retorno: ${tipo ? tipo + ' ' : ''}${format(d, 'dd/MM HH:mm')}`, vencido: d.getTime() < agora };
    }
  }

  const corDot = info?.canalCor
    ? (CANAL_DOT_CLASSES[info.canalCor.toLowerCase().trim()] || CANAL_DOT_CLASSES.gray)
    : CANAL_DOT_CLASSES.gray;
  const mesEntrada = deal?.created_at ? format(new Date(deal.created_at), 'MMM/yy', { locale: undefined }) : null;
  const mesEntradaPt = deal?.created_at
    ? new Date(deal.created_at).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'America/Sao_Paulo' })
        .replace('.', '').replace(' de ', '/').toLowerCase()
    : mesEntrada;

  const phone = contact?.phone || null;
  const copiarTelefone = async () => {
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      toast.success('Telefone copiado');
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  const stageColor = deal?.crm_stages?.color || undefined;

  return (
    <div className="bg-secondary/50 border-b border-border px-4 pt-4 pb-3 space-y-2 shrink-0">
      {/* Linha A: etapa (o X de fechar é o do Sheet, no canto) */}
      <div className="flex items-center gap-2 pr-8">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild disabled={futureStages.length === 0 || updateDeal.isPending}>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium hover:bg-muted disabled:opacity-70"
              aria-label="Mudar etapa"
            >
              <span className="h-2 w-2 rounded-full bg-primary" style={stageColor ? { backgroundColor: stageColor } : undefined} />
              {deal?.crm_stages?.stage_name || 'Sem etapa'}
              {futureStages.length > 0 && <ChevronDown className="h-3 w-3 text-muted-foreground" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            {futureStages.map((s: any) => (
              <DropdownMenuItem key={s.id} onSelect={() => handleSelectStage(s.id)}>
                {s.stage_name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {diasNaEtapa !== null && (
          <span className="text-xs text-muted-foreground">
            há {diasNaEtapa} {diasNaEtapa === 1 ? 'dia' : 'dias'} nesta etapa
          </span>
        )}
      </div>

      {/* Linha B: nome + valor */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          <h2 className="text-[22px] font-bold leading-7 text-foreground truncate" title={nomeOriginal}>
            {nomeExibicao}
          </h2>
          <LeadSegmentBadge segment={deal?.icp_segment} />
          <ResgateBadge resgateEm={deal?.resgate_em} />
        </div>
        <div className="flex flex-col items-end shrink-0">
          {totaisCliente && totaisCliente.total_liquido_pago > 0 ? (
            <>
              <span className="text-lg font-bold text-primary whitespace-nowrap">
                {formatCurrency(totaisCliente.total_liquido_pago)}
              </span>
              <span className="text-[10px] text-muted-foreground">já pagou</span>
            </>
          ) : (
            <>
              <span className="text-lg font-bold text-muted-foreground whitespace-nowrap">
                R$ {((deal.value && deal.value > 0) ? deal.value : 0).toLocaleString('pt-BR')}
              </span>
              <span className="text-[10px] text-muted-foreground">valor do negócio</span>
            </>
          )}
        </div>
      </div>

      {/* Linha C: canal, mês, dono, closer, telefone */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">
        {info?.canalRotulo && (
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-[7px] w-[7px] rounded-[2px] ${corDot}`} />
            {info.canalRotulo}
            {mesEntradaPt && <span>· {mesEntradaPt}</span>}
          </span>
        )}
        {!info?.canalRotulo && mesEntradaPt && <span>{mesEntradaPt}</span>}
        {info?.ownerName && (
          <span className="inline-flex items-center gap-1.5">
            Dono
            <span className="h-5 w-5 rounded-full bg-muted text-[10px] font-semibold text-foreground flex items-center justify-center">
              {iniciais(info.ownerName)}
            </span>
            <span className="text-foreground">{info.ownerName}</span>
          </span>
        )}
        {info?.closerR1Name && (
          <span>Closer R1 <span className="text-foreground">{info.closerR1Name}</span></span>
        )}
        {phone && (
          <span className="inline-flex items-center gap-1">
            <span className="text-foreground">{phone}</span>
            <button
              type="button"
              onClick={copiarTelefone}
              aria-label="Copiar telefone"
              className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </span>
        )}
        {estado && <span>{estado}</span>}
        {faixaRenda && <span>{faixaRenda}</span>}
      </div>

      {/* Linha D: temperatura, sem contato, retorno */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
        <LeadTemperatureSelector
          dealId={deal.id}
          value={(deal as any).lead_temperature as LeadTemperature}
          onChanged={() => onChanged?.()}
          size="sm"
          showLabel={false}
        />
        {semContato && <span className={`font-medium whitespace-nowrap ${semContato.cls}`}>{semContato.text}</span>}
        {retorno && (
          <span className={`inline-flex items-center gap-1 ${retorno.vencido ? 'text-amber-400 font-medium' : 'text-muted-foreground'}`}>
            <Clock className="h-3.5 w-3.5" />
            {retorno.text}
          </span>
        )}
      </div>

      {pendingStageId && (
        <LossReasonDialog
          open
          onOpenChange={(o) => { if (!o) setPendingStageId(null); }}
          dealCount={1}
          dealName={deal?.name}
          onConfirm={async (motivo, justificativa) => {
            const id = pendingStageId;
            await registrarMotivoSemInteresse([deal.id], motivo, justificativa);
            setPendingStageId(null);
            if (id) await executeMoveStage(id);
          }}
        />
      )}

    </div>
  );
};

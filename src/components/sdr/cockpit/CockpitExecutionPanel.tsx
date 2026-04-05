import { useState } from 'react';
import { SelectedDealData, LeadState } from '@/hooks/useSDRCockpit';
import { CallTimer } from './CallTimer';
import { CadenceDisplay } from './CadenceDisplay';
import { Button } from '@/components/ui/button';
import { useSaveNextAction } from '@/hooks/useNextAction';
import { useAddDealNote } from '@/hooks/useNextAction';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { addHours, addDays } from 'date-fns';
import {
  Phone, MessageCircle, ClipboardCheck, XCircle, Calendar,
  ArrowRight, RotateCcw, CheckCircle2, User
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CockpitExecutionPanelProps {
  deal: SelectedDealData | null;
  leadState: LeadState;
  setLeadState: (s: LeadState) => void;
  onNextLead: () => void;
  isLoading: boolean;
}

const STATE_LABELS: Record<LeadState, string> = {
  novo: 'Novo',
  em_ligacao: 'Em ligação',
  nao_atendeu: 'Não atendeu',
  qualificado: 'Qualificado',
  agendando: 'Agendando R1',
  agendado: 'Agendado',
  retorno: 'Retorno',
  perdido: 'Perdido',
};

const STATE_COLORS: Record<LeadState, string> = {
  novo: 'bg-blue-600',
  em_ligacao: 'bg-red-600',
  nao_atendeu: 'bg-amber-600',
  qualificado: 'bg-green-600',
  agendando: 'bg-purple-600',
  agendado: 'bg-green-500',
  retorno: 'bg-cyan-600',
  perdido: 'bg-gray-600',
};

function getInitials(name: string | null): string {
  if (!name) return '?';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export function CockpitExecutionPanel({
  deal, leadState, setLeadState, onNextLead, isLoading
}: CockpitExecutionPanelProps) {
  const saveNextAction = useSaveNextAction();
  const addNote = useAddDealNote();
  const queryClient = useQueryClient();

  const handleCallEnd = async (durationSeconds: number, notes: string, result: string) => {
    if (!deal) return;

    // Record activity
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from('deal_activities').insert({
      deal_id: deal.id,
      activity_type: 'call_result',
      description: `Ligação: ${result} (${Math.floor(durationSeconds / 60)}min ${durationSeconds % 60}s)${notes ? ` - ${notes}` : ''}`,
      user_id: userData.user?.id,
      metadata: { result, duration_seconds: durationSeconds, notes } as any,
    });

    if (notes) {
      addNote.mutate({ dealId: deal.id, note: notes });
    }

    // Determine next state based on result
    switch (result) {
      case 'atendeu':
        setLeadState('qualificado');
        break;
      case 'nao_atendeu':
      case 'caixa_postal': {
        setLeadState('nao_atendeu');
        // Auto-schedule next attempt
        const attempt = (deal.callAttempts || 0) + 1;
        let nextDate: Date;
        const now = new Date();
        if (attempt <= 2) nextDate = addHours(now, 2);
        else if (attempt === 3) nextDate = addDays(now, 1);
        else if (attempt === 4) nextDate = addDays(now, 2);
        else nextDate = addDays(now, 4);

        saveNextAction.mutate({
          dealId: deal.id,
          actionType: 'ligar',
          actionDate: nextDate,
          actionNote: `Tentativa ${attempt + 1}`,
          dealName: deal.name,
        });
        break;
      }
      case 'pediu_retorno':
        setLeadState('retorno');
        break;
      default:
        setLeadState('novo');
    }

    queryClient.invalidateQueries({ queryKey: ['sdr-cockpit-deal', deal.id] });
    queryClient.invalidateQueries({ queryKey: ['sdr-cockpit-queue'] });
    toast.success('Resultado registrado');
  };

  const handleMarkLost = async () => {
    if (!deal) return;
    const { data: userData } = await supabase.auth.getUser();
    // Find "Sem Interesse" stage
    const { data: stages } = await supabase
      .from('crm_stages')
      .select('id')
      .ilike('stage_name', '%sem interesse%')
      .limit(1);
    
    if (stages && stages.length > 0) {
      await supabase.from('crm_deals').update({ stage_id: stages[0].id }).eq('id', deal.id);
      await supabase.from('deal_activities').insert({
        deal_id: deal.id,
        activity_type: 'stage_change',
        description: 'Movido para Sem Interesse via Cockpit',
        user_id: userData.user?.id,
        from_stage: deal.stageId,
        to_stage: stages[0].id,
      });
    }
    setLeadState('perdido');
    queryClient.invalidateQueries({ queryKey: ['sdr-cockpit-queue'] });
    toast.success('Lead marcado como sem interesse');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-gray-600 border-t-gray-300 rounded-full animate-spin" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2">
        <User className="w-10 h-10" />
        <span className="text-sm">Selecione um lead na fila</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1e2130]">
        <div className="w-10 h-10 rounded-full bg-[#1e2130] flex items-center justify-center text-sm font-semibold text-gray-300">
          {getInitials(deal.contactName)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-white truncate">{deal.contactName || deal.name}</h2>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {deal.contactPhone && <span>{deal.contactPhone}</span>}
            {deal.originName && <span>• {deal.originName}</span>}
          </div>
        </div>
        <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium text-white', STATE_COLORS[leadState])}>
          {STATE_LABELS[leadState]}
        </span>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[#1e2130] flex-wrap">
        {renderActions(leadState, setLeadState, onNextLead, handleMarkLost)}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {renderContent(leadState, deal, handleCallEnd)}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, label, onClick, variant = 'default' }: { 
  icon: any; label: string; onClick: () => void; variant?: 'default' | 'danger' | 'success' 
}) {
  const colors = {
    default: 'bg-[#1e2130] hover:bg-[#272b3d] text-gray-300',
    danger: 'bg-red-900/30 hover:bg-red-900/50 text-red-400',
    success: 'bg-green-900/30 hover:bg-green-900/50 text-green-400',
  };
  return (
    <button onClick={onClick} className={cn('flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors', colors[variant])}>
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function renderActions(state: LeadState, setState: (s: LeadState) => void, onNext: () => void, onLost: () => void) {
  switch (state) {
    case 'novo':
      return <>
        <ActionBtn icon={Phone} label="Ligar" onClick={() => setState('em_ligacao')} variant="success" />
        <ActionBtn icon={MessageCircle} label="WhatsApp" onClick={() => {}} />
        <ActionBtn icon={ClipboardCheck} label="Qualificar" onClick={() => setState('qualificado')} />
        <ActionBtn icon={XCircle} label="Sem interesse" onClick={onLost} variant="danger" />
      </>;
    case 'em_ligacao':
      return <>
        <ActionBtn icon={ClipboardCheck} label="Qualificar" onClick={() => setState('qualificado')} />
        <ActionBtn icon={Calendar} label="Agendar R1" onClick={() => setState('agendando')} />
      </>;
    case 'qualificado':
      return <>
        <ActionBtn icon={Calendar} label="Agendar R1" onClick={() => setState('agendando')} variant="success" />
        <ActionBtn icon={MessageCircle} label="WhatsApp" onClick={() => {}} />
        <ActionBtn icon={XCircle} label="Sem interesse" onClick={onLost} variant="danger" />
      </>;
    case 'nao_atendeu':
      return <>
        <ActionBtn icon={RotateCcw} label="Tentar novamente" onClick={() => setState('em_ligacao')} variant="success" />
        <ActionBtn icon={MessageCircle} label="WhatsApp" onClick={() => {}} />
        <ActionBtn icon={ArrowRight} label="Próximo" onClick={onNext} />
      </>;
    case 'retorno':
      return <>
        <ActionBtn icon={Phone} label="Ligar agora" onClick={() => setState('em_ligacao')} variant="success" />
        <ActionBtn icon={MessageCircle} label="WhatsApp" onClick={() => {}} />
        <ActionBtn icon={XCircle} label="Sem interesse" onClick={onLost} variant="danger" />
      </>;
    case 'agendando':
      return <>
        <ActionBtn icon={CheckCircle2} label="Confirmar reunião" onClick={() => setState('agendado')} variant="success" />
        <ActionBtn icon={XCircle} label="Cancelar" onClick={() => setState('qualificado')} variant="danger" />
      </>;
    case 'agendado':
      return <>
        <ActionBtn icon={MessageCircle} label="Confirmar WhatsApp" onClick={() => {}} variant="success" />
        <ActionBtn icon={ArrowRight} label="Próximo lead" onClick={onNext} />
      </>;
    case 'perdido':
      return <>
        <ActionBtn icon={ArrowRight} label="Próximo lead" onClick={onNext} />
      </>;
    default:
      return null;
  }
}

function renderContent(state: LeadState, deal: SelectedDealData, onCallEnd: (d: number, n: string, r: string) => void) {
  switch (state) {
    case 'novo':
      return (
        <div className="space-y-4">
          <div className="rounded bg-[#1e2130] p-3">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">Informações do lead</h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-gray-500">Estágio:</span> <span className="text-gray-300">{deal.stageName}</span></div>
              <div><span className="text-gray-500">Origem:</span> <span className="text-gray-300">{deal.originName || '-'}</span></div>
              <div><span className="text-gray-500">Telefone:</span> <span className="text-gray-300">{deal.contactPhone || '-'}</span></div>
              <div><span className="text-gray-500">Email:</span> <span className="text-gray-300">{deal.contactEmail || '-'}</span></div>
            </div>
          </div>
          {deal.isNew && (
            <div className="rounded border border-blue-800/40 bg-blue-900/20 p-3 text-xs text-blue-300">
              💡 Lead novo, sem atividades. Sugestão: Ligar agora.
            </div>
          )}
          <ActivityTimeline activities={deal.activities} />
        </div>
      );

    case 'em_ligacao':
      return (
        <div className="space-y-4">
          <CallTimer onEnd={onCallEnd} />
          <div className="rounded bg-[#1e2130] p-3">
            <h4 className="text-xs font-semibold text-gray-400 mb-1">Contexto rápido</h4>
            <p className="text-xs text-gray-400">
              {deal.stageName} • {deal.activityCount} atividades • {deal.callAttempts} tentativas
            </p>
          </div>
        </div>
      );

    case 'nao_atendeu':
      return (
        <div className="space-y-4">
          <CadenceDisplay
            currentAttempt={deal.callAttempts}
            lastAttemptDate={deal.activities[0]?.created_at}
          />
          <div className="rounded border border-amber-800/40 bg-amber-900/20 p-3 text-xs text-amber-300">
            ⏳ Próxima tentativa agendada automaticamente. Continue com o próximo lead.
          </div>
        </div>
      );

    case 'qualificado':
      return (
        <div className="space-y-4">
          <div className="rounded border border-green-800/40 bg-green-900/20 p-3 text-xs text-green-300">
            ✅ Lead qualificado! Preencha os campos na coluna direita e agende a R1.
          </div>
          <div className="rounded bg-[#1e2130] p-3">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">Resumo</h4>
            <div className="text-xs text-gray-400 space-y-1">
              <p>{deal.contactName} • {deal.contactPhone}</p>
              <p>{deal.originName} • {deal.callAttempts} ligações</p>
            </div>
          </div>
          <ActivityTimeline activities={deal.activities} />
        </div>
      );

    case 'agendando':
      return (
        <div className="space-y-4">
          <div className="rounded bg-[#1e2130] p-3">
            <h4 className="text-xs font-semibold text-gray-400 mb-2">Agendar R1</h4>
            <p className="text-xs text-gray-400">
              Use a agenda na coluna direita para selecionar um horário com o Closer.
            </p>
          </div>
          <div className="rounded bg-[#1e2130] p-3">
            <h4 className="text-xs font-semibold text-gray-400 mb-1">Lead</h4>
            <p className="text-xs text-gray-300">{deal.contactName} • {deal.contactPhone}</p>
          </div>
        </div>
      );

    case 'agendado':
      return (
        <div className="space-y-4">
          <div className="rounded border border-green-800/40 bg-green-900/20 p-3 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-green-300 font-medium">R1 Agendada!</p>
            <p className="text-xs text-green-400 mt-1">Confirme via WhatsApp e vá para o próximo lead.</p>
          </div>
        </div>
      );

    case 'retorno':
      return (
        <div className="space-y-4">
          <div className="rounded border border-cyan-800/40 bg-cyan-900/20 p-3 text-xs text-cyan-300">
            📞 Este lead pediu retorno. Ligue agora ou envie WhatsApp.
          </div>
          <ActivityTimeline activities={deal.activities} />
        </div>
      );

    case 'perdido':
      return (
        <div className="space-y-4">
          <div className="rounded border border-gray-700 bg-gray-800/50 p-3 text-xs text-gray-400">
            Lead sem interesse. Siga para o próximo.
          </div>
          <ActivityTimeline activities={deal.activities} />
        </div>
      );

    default:
      return null;
  }
}

function ActivityTimeline({ activities }: { activities: any[] }) {
  if (!activities.length) return null;
  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-400 mb-2">Histórico recente</h4>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {activities.slice(0, 10).map((a: any) => (
          <div key={a.id} className="flex items-start gap-2 text-[11px]">
            <span className="text-gray-600 flex-shrink-0 w-12">
              {format(new Date(a.created_at), 'dd/MM HH:mm', { locale: ptBR })}
            </span>
            <span className="text-gray-400 truncate">{a.description}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

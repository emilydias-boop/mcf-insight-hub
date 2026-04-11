import { useMemo } from 'react';
import { LeadCarrinhoCompleto } from './useCarrinhoAnalysisReport';

export type PostSaleStatus =
  | 'desistiu_antes_r2'
  | 'nao_responde'
  | 'tentando_agendar'
  | 'agendado'
  | 'r2_realizada'
  | 'no_show'
  | 'desistiu_apos_r2'
  | 'aprovado';

export interface PostSaleLead extends LeadCarrinhoCompleto {
  statusPosVenda: PostSaleStatus;
  subStatus: string | null;
}

export interface PostSaleSlice {
  status: PostSaleStatus;
  label: string;
  count: number;
  pct: number;
  color: string;
  leads: PostSaleLead[];
}

export interface PostSaleSubSlice {
  subStatus: string;
  count: number;
  pct: number;
  leads: PostSaleLead[];
}

const STATUS_CONFIG: Record<PostSaleStatus, { label: string; color: string }> = {
  desistiu_antes_r2: { label: 'Desistiu antes R2', color: 'hsl(0, 70%, 50%)' },
  nao_responde: { label: 'Não responde', color: 'hsl(30, 70%, 50%)' },
  tentando_agendar: { label: 'Tentando agendar', color: 'hsl(45, 80%, 50%)' },
  agendado: { label: 'Agendado', color: 'hsl(200, 70%, 50%)' },
  r2_realizada: { label: 'R2 Realizada', color: 'hsl(160, 60%, 45%)' },
  no_show: { label: 'No-show', color: 'hsl(350, 60%, 55%)' },
  desistiu_apos_r2: { label: 'Desistiu após R2', color: 'hsl(15, 70%, 50%)' },
  aprovado: { label: 'Aprovado', color: 'hsl(140, 70%, 40%)' },
};

export function classifyPostSaleStatus(lead: LeadCarrinhoCompleto): { status: PostSaleStatus; subStatus: string | null } {
  // Reembolso = desistiu antes R2
  if (lead.reembolso) return { status: 'desistiu_antes_r2', subStatus: 'Reembolso' };

  // Comprou parceria = aprovado
  if (lead.comprouParceria) {
    const subStatus = lead.dataParceria
      ? `carrinho_${new Date(lead.dataParceria).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }).replace('/', '_')}`
      : null;
    return { status: 'aprovado', subStatus };
  }

  // R2 realizada mas não comprou parceria
  if (lead.r2Realizada) {
    // Check status
    const statusLower = (lead.statusR2 || '').toLowerCase();
    if (statusLower.includes('próxima') || statusLower.includes('proxima')) {
      return { status: 'r2_realizada', subStatus: 'Próxima semana' };
    }
    if (statusLower.includes('aprovad')) {
      return { status: 'r2_realizada', subStatus: 'Aprovado (sem parceria)' };
    }
    if (statusLower.includes('reprovad')) {
      return { status: 'desistiu_apos_r2', subStatus: 'Reprovado' };
    }
    return { status: 'r2_realizada', subStatus: lead.statusR2 || 'Realizada' };
  }

  // R2 agendada mas não realizada
  if (lead.r2Agendada) {
    // Check if it's a no-show (scheduled in the past but not completed)
    if (lead.dataR2) {
      const r2Date = new Date(lead.dataR2);
      const now = new Date();
      if (r2Date < now) {
        return { status: 'no_show', subStatus: null };
      }
    }
    const subStatus = lead.dataR2
      ? `Agendado ${new Date(lead.dataR2).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`
      : null;
    return { status: 'agendado', subStatus };
  }

  // Sem R2 - classify based on gap reason
  const motivo = (lead.motivoGap || '').toLowerCase();
  if (motivo.includes('sem contato') || motivo.includes('cadastro incompleto')) {
    return { status: 'nao_responde', subStatus: lead.motivoGap };
  }
  if (motivo.includes('sem agendamento')) {
    return { status: 'tentando_agendar', subStatus: null };
  }

  return { status: 'desistiu_antes_r2', subStatus: lead.motivoGap || null };
}

export function usePostSaleFunnel(leads: LeadCarrinhoCompleto[]) {
  const classifiedLeads = useMemo((): PostSaleLead[] => {
    return leads.map(lead => {
      const { status, subStatus } = classifyPostSaleStatus(lead);
      return { ...lead, statusPosVenda: status, subStatus };
    });
  }, [leads]);

  const slices = useMemo((): PostSaleSlice[] => {
    const total = classifiedLeads.length;
    if (total === 0) return [];

    const grouped = new Map<PostSaleStatus, PostSaleLead[]>();
    for (const lead of classifiedLeads) {
      if (!grouped.has(lead.statusPosVenda)) grouped.set(lead.statusPosVenda, []);
      grouped.get(lead.statusPosVenda)!.push(lead);
    }

    // Order by enum definition order
    const statusOrder: PostSaleStatus[] = [
      'desistiu_antes_r2', 'nao_responde', 'tentando_agendar', 'agendado',
      'r2_realizada', 'no_show', 'desistiu_apos_r2', 'aprovado',
    ];

    return statusOrder
      .filter(s => grouped.has(s))
      .map(status => {
        const leads = grouped.get(status)!;
        const config = STATUS_CONFIG[status];
        return {
          status,
          label: config.label,
          count: leads.length,
          pct: (leads.length / total) * 100,
          color: config.color,
          leads,
        };
      });
  }, [classifiedLeads]);

  const getSubSlices = useMemo(() => {
    return (status: PostSaleStatus): PostSaleSubSlice[] => {
      const slice = slices.find(s => s.status === status);
      if (!slice) return [];

      const grouped = new Map<string, PostSaleLead[]>();
      for (const lead of slice.leads) {
        const key = lead.subStatus || 'Sem detalhe';
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(lead);
      }

      return Array.from(grouped.entries())
        .map(([subStatus, leads]) => ({
          subStatus,
          count: leads.length,
          pct: (leads.length / slice.leads.length) * 100,
          leads,
        }))
        .sort((a, b) => b.count - a.count);
    };
  }, [slices]);

  return { classifiedLeads, slices, getSubSlices, statusConfig: STATUS_CONFIG };
}

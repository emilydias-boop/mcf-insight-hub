import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { calcularVagasEstimadas } from './useContemplacaoEngine';

export type GrupoSaudeStatus = 'verde' | 'amarelo' | 'cinza';

export interface GrupoSaudeItem {
  grupo: string;
  qtd_cotas: number;
  qtd_contempladas: number;
  valor_credito_total: number;
  ultima_assembleia: string | null;
  qtd_assembleias_registradas: number;
  vagas_estimadas: number;
  media_contemplados: number;
  status: GrupoSaudeStatus;
}

function classificar(ultima: string | null): GrupoSaudeStatus {
  if (!ultima) return 'cinza';
  const diff = (Date.now() - new Date(ultima).getTime()) / (1000 * 60 * 60 * 24);
  if (diff <= 30) return 'verde';
  if (diff <= 90) return 'amarelo';
  return 'cinza';
}

export function useGruposSaude() {
  return useQuery({
    queryKey: ['consorcio-grupos-saude'],
    queryFn: async (): Promise<GrupoSaudeItem[]> => {
      const { data: cards, error: e1 } = await supabase
        .from('consortium_cards')
        .select('grupo, valor_credito, numero_contemplacao')
        .not('grupo', 'is', null);
      if (e1) throw e1;

      const { data: assembleias, error: e2 } = await supabase
        .from('consorcio_assembleias_historico' as any)
        .select('grupo, data_assembleia, qtd_contemplados')
        .order('data_assembleia', { ascending: false });
      if (e2) throw e2;

      const byGroup = new Map<string, GrupoSaudeItem>();
      for (const c of cards || []) {
        const g = String((c as any).grupo || '').trim();
        if (!g) continue;
        const item = byGroup.get(g) || {
          grupo: g,
          qtd_cotas: 0,
          qtd_contempladas: 0,
          valor_credito_total: 0,
          ultima_assembleia: null,
          qtd_assembleias_registradas: 0,
          vagas_estimadas: 0,
          media_contemplados: 0,
          status: 'cinza' as GrupoSaudeStatus,
        };
        item.qtd_cotas += 1;
        item.valor_credito_total += Number((c as any).valor_credito || 0);
        if ((c as any).numero_contemplacao) item.qtd_contempladas += 1;
        byGroup.set(g, item);
      }

      const assemByGroup = new Map<string, { data_assembleia: string; qtd_contemplados: number; grupo: string }[]>();
      for (const a of (assembleias || []) as any[]) {
        const arr = assemByGroup.get(a.grupo) || [];
        arr.push(a);
        assemByGroup.set(a.grupo, arr);
      }

      for (const item of byGroup.values()) {
        const hist = assemByGroup.get(item.grupo) || [];
        item.qtd_assembleias_registradas = hist.length;
        item.ultima_assembleia = hist[0]?.data_assembleia || null;
        const { vagas, media } = calcularVagasEstimadas(
          hist.map((h) => ({
            id: '',
            grupo: item.grupo,
            data_assembleia: h.data_assembleia,
            numero_loteria_aplicado: null,
            qtd_contemplados: h.qtd_contemplados,
            observacao: null,
            created_at: '',
          })),
          2,
        );
        item.vagas_estimadas = vagas;
        item.media_contemplados = media;
        item.status = classificar(item.ultima_assembleia);
      }

      return Array.from(byGroup.values()).sort((a, b) => b.qtd_cotas - a.qtd_cotas);
    },
  });
}
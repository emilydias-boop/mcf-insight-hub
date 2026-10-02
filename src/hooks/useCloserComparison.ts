import { useQuery } from '@tanstack/react-query';
import { fetchInvestigacaoReunioes } from '@/hooks/useInvestigationByPeriod';

export interface ComparisonEntry {
  id: string;
  name: string;
  total: number;
  realizadas: number;
  noShows: number;
  contratosPagos: number;
  taxaConversao: number;
  taxaComparecimento: number;
  taxaNoShow: number;
}

type Agg = { total: number; realizadas: number; noShows: number; contratosPagos: number };

export function useCloserComparison(
  startDate: Date | null,
  endDate: Date | null,
  highlightId: string | null,
  type: 'closer' | 'sdr' = 'closer',
  bu: string = 'incorporador'
) {
  return useQuery({
    queryKey: ['team-comparison', type, startDate?.toISOString(), endDate?.toISOString(), bu],
    queryFn: async (): Promise<ComparisonEntry[]> => {
      if (!startDate || !endDate) return [];

      const rows = await fetchInvestigacaoReunioes(startDate, endDate, bu);
      const agg = new Map<string, Agg>();
      const names: Record<string, string> = {};

      for (const r of rows) {
        const id = type === 'closer' ? r.closer_id : r.booked_by;
        if (!id) continue;
        const name = type === 'closer' ? r.closer_name : r.sdr_name;
        if (name) names[id] = name;
        if (!agg.has(id)) agg.set(id, { total: 0, realizadas: 0, noShows: 0, contratosPagos: 0 });
        const m = agg.get(id)!;
        m.total++;
        if (r.status === 'completed') m.realizadas++;
        if (r.status === 'no_show') m.noShows++;
        if (r.status === 'contract_paid') m.contratosPagos++;
      }

      return buildEntries(agg, names);
    },
    enabled: !!startDate && !!endDate,
  });
}

function buildEntries(agg: Map<string, Agg>, nameMap: Record<string, string>): ComparisonEntry[] {
  const entries: ComparisonEntry[] = Array.from(agg.entries()).map(([id, m]) => {
    const atendidas = m.realizadas + m.contratosPagos;
    const totalReal = m.realizadas + m.noShows + m.contratosPagos;
    return {
      id,
      name: nameMap[id] || id,
      ...m,
      taxaConversao: atendidas > 0 ? (m.contratosPagos / atendidas) * 100 : 0,
      taxaComparecimento: totalReal > 0 ? (atendidas / totalReal) * 100 : 0,
      taxaNoShow: totalReal > 0 ? (m.noShows / totalReal) * 100 : 0,
    };
  });
  entries.sort((a, b) => b.contratosPagos - a.contratosPagos);
  return entries;
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, TrendingUp, CreditCard, FolderKanban, Gavel, LucideIcon } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { formatDateForDB } from "@/lib/dateHelpers";
import { ptBR } from "date-fns/locale";
import { getDeduplicatedGross, TransactionForGross } from "@/lib/incorporadorPricing";

export interface SetorData {
  id: 'incorporador' | 'efeito_alavanca' | 'credito' | 'projetos' | 'leilao';
  nome: string;
  icone: LucideIcon;
  apuradoSemanal: number;
  metaSemanal: number;
  apuradoMensal: number;
  metaMensal: number;
  apuradoAnual: number;
  metaAnual: number;
  // Efeito Alavanca specific
  comissaoSemanal?: number;
  comissaoMensal?: number;
  comissaoAnual?: number;
}

const SETOR_CONFIG: { id: SetorData['id']; nome: string; icone: LucideIcon }[] = [
  { id: 'incorporador', nome: 'MCF Incorporador', icone: Building2 },
  { id: 'efeito_alavanca', nome: 'Efeito Alavanca', icone: TrendingUp },
  { id: 'credito', nome: 'MCF Crédito', icone: CreditCard },
  { id: 'projetos', nome: 'MCF Projetos', icone: FolderKanban },
  { id: 'leilao', nome: 'MCF Leilão', icone: Gavel },
];

// Week starts on Saturday (6) for most BUs
const WEEK_STARTS_ON = 6;
// Consórcio BU uses Monday-Sunday
const CONSORCIO_WEEK_STARTS_ON = 1;

// Ajusta data para fuso horário de São Paulo (UTC-3)
const formatDateForQuery = (date: Date, isEndOfDay = false): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const time = isEndOfDay ? '23:59:59' : '00:00:00';
  return `${year}-${month}-${day}T${time}-03:00`;
};

export function useSetoresDashboard() {
  const today = new Date();
  
  // Period boundaries - Incorporador uses Sat-Fri
  const weekStart = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  // Consórcio uses Mon-Sun
  const consorcioWeekStart = startOfWeek(today, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const consorcioWeekEnd = endOfWeek(today, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const yearStart = startOfYear(today);
  const yearEnd = endOfYear(today);

  const weekStartStr = formatDateForDB(weekStart);
  const consorcioWeekStartStr = formatDateForDB(consorcioWeekStart);
  const monthStartStr = formatDateForDB(monthStart);
  const yearStartStr = formatDateForDB(yearStart);

  const mesNome = format(today, 'MMMM', { locale: ptBR });
  const semanaLabel = `Semana ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`;
  const mesLabel = `Mês ${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}`;

  const query = useQuery({
    queryKey: ['setores-dashboard', weekStartStr, consorcioWeekStartStr, monthStartStr, yearStartStr],
    queryFn: async (): Promise<{ 
      setores: SetorData[]; 
      semanaLabel: string; 
      mesLabel: string;
      totais: {
        apuradoSemanal: number;
        metaSemanal: number;
        apuradoMensal: number;
        metaMensal: number;
        apuradoAnual: number;
        metaAnual: number;
      };
    }> => {
      // 1. Fetch global first transaction IDs for Incorporador deduplication
      const { data: firstIdsData, error: firstIdsError } = await supabase.rpc('get_first_transaction_ids');
      if (firstIdsError) throw firstIdsError;
      const firstIdSet = new Set((firstIdsData || []).map((r: { id: string }) => r.id));

      // 2. Fetch all data in parallel
      const consorcioWeekStartDate = formatDateForDB(consorcioWeekStart);
      const consorcioWeekEndDate = formatDateForDB(consorcioWeekEnd);
      const monthStartDate = formatDateForDB(monthStart);
      const monthEndDate = formatDateForDB(monthEnd);
      const yearStartDate = formatDateForDB(yearStart);
      const yearEndDate = formatDateForDB(yearEnd);

      const [
        // Incorporador
        incorpWeekly, incorpMonthly, incorpAnnual,
        // Consórcio - consortium_cards por período
        consorcioCardsWeekly, consorcioCardsMonthly, consorcioCardsAnnual,
        // Targets
        targets,
      ] = await Promise.all([
        // Incorporador - Weekly (Sat-Fri)
        supabase.rpc('get_hubla_transactions_by_bu', {
          p_bu: 'incorporador',
          p_search: null,
          p_start_date: formatDateForQuery(weekStart),
          p_end_date: formatDateForQuery(weekEnd, true),
          p_limit: 5000,
        }),
        // Incorporador - Monthly
        supabase.rpc('get_hubla_transactions_by_bu', {
          p_bu: 'incorporador',
          p_search: null,
          p_start_date: formatDateForQuery(monthStart),
          p_end_date: formatDateForQuery(monthEnd, true),
          p_limit: 5000,
        }),
        // Incorporador - Annual
        supabase.rpc('get_hubla_transactions_by_bu', {
          p_bu: 'incorporador',
          p_search: null,
          p_start_date: formatDateForQuery(yearStart),
          p_end_date: formatDateForQuery(yearEnd, true),
          p_limit: 10000,
        }),
        // Consórcio Cards - Weekly (Mon-Sun)
        supabase
          .from('consortium_cards')
          .select('id, valor_credito')
          .gte('data_contratacao', consorcioWeekStartDate)
          .lte('data_contratacao', consorcioWeekEndDate),
        // Consórcio Cards - Monthly
        supabase
          .from('consortium_cards')
          .select('id, valor_credito')
          .gte('data_contratacao', monthStartDate)
          .lte('data_contratacao', monthEndDate),
        // Consórcio Cards - Annual
        supabase
          .from('consortium_cards')
          .select('id, valor_credito')
          .gte('data_contratacao', yearStartDate)
          .lte('data_contratacao', yearEndDate),
        // All setor targets
        supabase
          .from('team_targets')
          .select('target_type, target_value')
          .like('target_type', 'setor_%'),
      ]);

      // 2b. Fetch commissions for each period's cards
      const fetchComissao = async (cards: { id: string }[] | null): Promise<number> => {
        if (!cards || cards.length === 0) return 0;
        let total = 0;
        for (const card of cards) {
          const { data: installments } = await supabase
            .from('consortium_installments')
            .select('valor_comissao')
            .eq('card_id', card.id);
          installments?.forEach(inst => { total += Number(inst.valor_comissao); });
        }
        return total;
      };

      const [comissaoSemanal, comissaoMensal, comissaoAnual] = await Promise.all([
        fetchComissao(consorcioCardsWeekly.data),
        fetchComissao(consorcioCardsMonthly.data),
        fetchComissao(consorcioCardsAnnual.data),
      ]);

      // 3. Calculate Incorporador gross with deduplication (same as Vendas page)
      const calculateIncorpGross = (transactions: (TransactionForGross & { id: string })[] | null): number => {
        if (!transactions) return 0;
        return transactions.reduce((sum, t) => {
          const isFirst = firstIdSet.has(t.id);
          return sum + getDeduplicatedGross(t, isFirst);
        }, 0);
      };

      // 4. Calculate Consórcio (Efeito Alavanca) - sum valor_credito from consortium_cards
      const calculateConsorcioCredito = (cards: { valor_credito: number | null }[] | null): number => {
        if (!cards) return 0;
        return cards.reduce((sum, c) => sum + (Number(c.valor_credito) || 0), 0);
      };

      // Helper to get target value
      const getTarget = (targetType: string): number => {
        const target = targets.data?.find(t => t.target_type === targetType);
        return target?.target_value || 0;
      };

      // Build sector data
      const setores: SetorData[] = SETOR_CONFIG.map(config => {
        if (config.id === 'incorporador') {
          return {
            ...config,
            apuradoSemanal: calculateIncorpGross(incorpWeekly.data),
            metaSemanal: getTarget('setor_incorporador_semana'),
            apuradoMensal: calculateIncorpGross(incorpMonthly.data),
            metaMensal: getTarget('setor_incorporador_mes'),
            apuradoAnual: calculateIncorpGross(incorpAnnual.data),
            metaAnual: getTarget('setor_incorporador_ano'),
          };
        }

        if (config.id === 'efeito_alavanca') {
          return {
            ...config,
            apuradoSemanal: calculateConsorcioCredito(consorcioCardsWeekly.data),
            metaSemanal: getTarget('setor_efeito_alavanca_semana'),
            apuradoMensal: calculateConsorcioCredito(consorcioCardsMonthly.data),
            metaMensal: getTarget('setor_efeito_alavanca_mes'),
            apuradoAnual: calculateConsorcioCredito(consorcioCardsAnnual.data),
            metaAnual: getTarget('setor_efeito_alavanca_ano'),
            comissaoSemanal,
            comissaoMensal,
            comissaoAnual,
          };
        }

        // Crédito, Projetos, Leilão - not yet configured, return 0
        return {
          ...config,
          apuradoSemanal: 0,
          metaSemanal: getTarget(`setor_${config.id}_semana`),
          apuradoMensal: 0,
          metaMensal: getTarget(`setor_${config.id}_mes`),
          apuradoAnual: 0,
          metaAnual: getTarget(`setor_${config.id}_ano`),
        };
      });

      // Calculate totals
      const totais = {
        apuradoSemanal: setores.reduce((sum, s) => sum + s.apuradoSemanal, 0),
        metaSemanal: setores.reduce((sum, s) => sum + s.metaSemanal, 0),
        apuradoMensal: setores.reduce((sum, s) => sum + s.apuradoMensal, 0),
        metaMensal: setores.reduce((sum, s) => sum + s.metaMensal, 0),
        apuradoAnual: setores.reduce((sum, s) => sum + s.apuradoAnual, 0),
        metaAnual: setores.reduce((sum, s) => sum + s.metaAnual, 0),
      };

      return { setores, semanaLabel, mesLabel, totais };
    },
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 30,
  });

  return query;
}

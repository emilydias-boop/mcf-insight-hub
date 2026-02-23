import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Building2, TrendingUp, CreditCard, FolderKanban, Gavel, LucideIcon } from "lucide-react";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, format } from "date-fns";
import { formatDateForDB } from "@/lib/dateHelpers";
import { ptBR } from "date-fns/locale";
import { useIncorporadorGrossMetrics } from "./useIncorporadorGrossMetrics";

export interface SetorData {
  id: 'incorporador' | 'efeito_alavanca' | 'credito' | 'projetos' | 'leilao';
  nome: string;
  icone: LucideIcon;
  // Semana
  apuradoSemanal: number;
  metaSemanal: number;
  // Mês
  apuradoMensal: number;
  metaMensal: number;
  // Ano
  apuradoAnual: number;
  metaAnual: number;
  // Efeito Alavanca specific metrics (Total em Cartas = apurado*, Comissão = secondary)
  comissaoSemanal?: number;
  comissaoMensal?: number;
  comissaoAnual?: number;
}

// Maps sector ID to hubla_transactions product_category values
const SETOR_CATEGORIES: Record<string, string[]> = {
  incorporador: ['incorporador'],
  efeito_alavanca: ['efeito_alavanca'],
  projetos: ['projetos'],
  leilao: ['clube_arremate'],
};

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

export function useSetoresDashboard() {
  const today = new Date();
  
  // Fetch Incorporador gross metrics using the dedicated hook (uses same deduplication logic as Vendas page)
  const incorporadorMetrics = useIncorporadorGrossMetrics();
  
  // Calculate period boundaries
  const weekStart = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  // Consórcio-specific week (Monday-Sunday) for consortium_cards, consortium_payments, consortium_installments
  const consorcioWeekStart = startOfWeek(today, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const consorcioWeekEnd = endOfWeek(today, { weekStartsOn: CONSORCIO_WEEK_STARTS_ON });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const yearStart = startOfYear(today);
  const yearEnd = endOfYear(today);

  const weekStartStr = formatDateForDB(weekStart);
  const weekEndStr = formatDateForDB(weekEnd);
  const consorcioWeekStartStr = formatDateForDB(consorcioWeekStart);
  const consorcioWeekEndStr = formatDateForDB(consorcioWeekEnd);
  const monthStartStr = formatDateForDB(monthStart);
  const monthEndStr = formatDateForDB(monthEnd);
  const yearStartStr = formatDateForDB(yearStart);
  const yearEndStr = formatDateForDB(yearEnd);

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
      // Fetch all transaction data in parallel
      const [
        hublaWeekly,
        hublaMonthly,
        hublaAnnual,
        consortiumWeekly,
        consortiumMonthly,
        consortiumAnnual,
        insideCardsWeekly,
        insideCardsMontly,
        insideCardsAnnual,
        insideInstallmentsWeekly,
        insideInstallmentsMonthly,
        insideInstallmentsAnnual,
        targets,
      ] = await Promise.all([
        // Hubla transactions - Weekly
        supabase
          .from('hubla_transactions')
          .select('product_category, net_value')
          .gte('created_at', weekStartStr)
          .lte('created_at', weekEndStr + 'T23:59:59'),
        // Hubla transactions - Monthly
        supabase
          .from('hubla_transactions')
          .select('product_category, net_value')
          .gte('created_at', monthStartStr)
          .lte('created_at', monthEndStr + 'T23:59:59'),
        // Hubla transactions - Annual
        supabase
          .from('hubla_transactions')
          .select('product_category, net_value')
          .gte('created_at', yearStartStr)
          .lte('created_at', yearEndStr + 'T23:59:59'),
        // Consortium payments - Weekly (for credito sector) - uses Consórcio week (Mon-Sun)
        supabase
          .from('consortium_payments')
          .select('valor_comissao, data_interface')
          .gte('data_interface', consorcioWeekStartStr)
          .lte('data_interface', consorcioWeekEndStr),
        // Consortium payments - Monthly
        supabase
          .from('consortium_payments')
          .select('valor_comissao, data_interface')
          .gte('data_interface', monthStartStr)
          .lte('data_interface', monthEndStr),
        // Consortium payments - Annual
        supabase
          .from('consortium_payments')
          .select('valor_comissao, data_interface')
          .gte('data_interface', yearStartStr)
          .lte('data_interface', yearEndStr),
        // Inside consortium cards - Weekly (for Efeito Alavanca) - uses Consórcio week (Mon-Sun)
        supabase
          .from('consortium_cards')
          .select('id, valor_credito')
          .eq('categoria', 'inside')
          .gte('data_contratacao', consorcioWeekStartStr)
          .lte('data_contratacao', consorcioWeekEndStr),
        // Inside consortium cards - Monthly
        supabase
          .from('consortium_cards')
          .select('id, valor_credito')
          .eq('categoria', 'inside')
          .gte('data_contratacao', monthStartStr)
          .lte('data_contratacao', monthEndStr),
        // Inside consortium cards - Annual
        supabase
          .from('consortium_cards')
          .select('id, valor_credito')
          .eq('categoria', 'inside')
          .gte('data_contratacao', yearStartStr)
          .lte('data_contratacao', yearEndStr),
        // Inside installments - Weekly (sum valor_comissao from cards' installments) - uses Consórcio week (Mon-Sun)
        supabase
          .from('consortium_installments')
          .select('valor_comissao, consortium_cards!inner(categoria, data_contratacao)')
          .eq('consortium_cards.categoria', 'inside')
          .gte('consortium_cards.data_contratacao', consorcioWeekStartStr)
          .lte('consortium_cards.data_contratacao', consorcioWeekEndStr),
        // Inside installments - Monthly
        supabase
          .from('consortium_installments')
          .select('valor_comissao, consortium_cards!inner(categoria, data_contratacao)')
          .eq('consortium_cards.categoria', 'inside')
          .gte('consortium_cards.data_contratacao', monthStartStr)
          .lte('consortium_cards.data_contratacao', monthEndStr),
        // Inside installments - Annual
        supabase
          .from('consortium_installments')
          .select('valor_comissao, consortium_cards!inner(categoria, data_contratacao)')
          .eq('consortium_cards.categoria', 'inside')
          .gte('consortium_cards.data_contratacao', yearStartStr)
          .lte('consortium_cards.data_contratacao', yearEndStr),
        // All setor targets
        supabase
          .from('team_targets')
          .select('target_type, target_value')
          .like('target_type', 'setor_%'),
      ]);

      // Helper to calculate total for a sector from hubla data
      const calculateSetorTotal = (
        data: { product_category: string | null; net_value: number | null }[] | null,
        categories: string[]
      ): number => {
        if (!data) return 0;
        return data
          .filter(t => t.product_category && categories.includes(t.product_category))
          .reduce((sum, t) => sum + (t.net_value || 0), 0);
      };

      // Helper to calculate consortium total
      const calculateConsortiumTotal = (
        data: { valor_comissao: number | null }[] | null
      ): number => {
        if (!data) return 0;
        return data.reduce((sum, p) => sum + (p.valor_comissao || 0), 0);
      };

      // Helper to calculate total cartas (valor_credito) for Inside cards
      const calculateTotalCartas = (
        data: { valor_credito: number | null }[] | null
      ): number => {
        if (!data) return 0;
        return data.reduce((sum, c) => sum + (c.valor_credito || 0), 0);
      };

      // Helper to get target value
      const getTarget = (targetType: string): number => {
        const target = targets.data?.find(t => t.target_type === targetType);
        return target?.target_value || 0;
      };

      // Build sector data
      const setores: SetorData[] = SETOR_CONFIG.map(config => {
        if (config.id === 'credito') {
          // Credito uses consortium_payments
          return {
            ...config,
            apuradoSemanal: calculateConsortiumTotal(consortiumWeekly.data),
            metaSemanal: getTarget('setor_credito_semana'),
            apuradoMensal: calculateConsortiumTotal(consortiumMonthly.data),
            metaMensal: getTarget('setor_credito_mes'),
            apuradoAnual: calculateConsortiumTotal(consortiumAnnual.data),
            metaAnual: getTarget('setor_credito_ano'),
          };
        }

        if (config.id === 'efeito_alavanca') {
          // Efeito Alavanca uses consortium_cards (categoria = 'inside')
          return {
            ...config,
            // Total em Cartas = SUM(valor_credito)
            apuradoSemanal: calculateTotalCartas(insideCardsWeekly.data),
            metaSemanal: getTarget('setor_efeito_alavanca_semana'),
            apuradoMensal: calculateTotalCartas(insideCardsMontly.data),
            metaMensal: getTarget('setor_efeito_alavanca_mes'),
            apuradoAnual: calculateTotalCartas(insideCardsAnnual.data),
            metaAnual: getTarget('setor_efeito_alavanca_ano'),
            // Comissão Total = SUM(valor_comissao) from installments
            comissaoSemanal: calculateConsortiumTotal(insideInstallmentsWeekly.data),
            comissaoMensal: calculateConsortiumTotal(insideInstallmentsMonthly.data),
            comissaoAnual: calculateConsortiumTotal(insideInstallmentsAnnual.data),
          };
        }

        // All other sectors use hubla_transactions with net_value
        const categories = SETOR_CATEGORIES[config.id] || [];
        return {
          ...config,
          apuradoSemanal: calculateSetorTotal(hublaWeekly.data, categories),
          metaSemanal: getTarget(`setor_${config.id}_semana`),
          apuradoMensal: calculateSetorTotal(hublaMonthly.data, categories),
          metaMensal: getTarget(`setor_${config.id}_mes`),
          apuradoAnual: calculateSetorTotal(hublaAnnual.data, categories),
          metaAnual: getTarget(`setor_${config.id}_ano`),
        };
      });

      // Calculate totals across all sectors
      // For Efeito Alavanca, use comissao (the actual revenue), not total cartas
      const totais = {
        apuradoSemanal: setores.reduce((sum, s) => {
          if (s.id === 'efeito_alavanca') {
            return sum + calculateConsortiumTotal(insideInstallmentsWeekly.data);
          }
          return sum + s.apuradoSemanal;
        }, 0),
        metaSemanal: setores.reduce((sum, s) => sum + s.metaSemanal, 0),
        apuradoMensal: setores.reduce((sum, s) => {
          if (s.id === 'efeito_alavanca') {
            return sum + calculateConsortiumTotal(insideInstallmentsMonthly.data);
          }
          return sum + s.apuradoMensal;
        }, 0),
        metaMensal: setores.reduce((sum, s) => sum + s.metaMensal, 0),
        apuradoAnual: setores.reduce((sum, s) => {
          if (s.id === 'efeito_alavanca') {
            return sum + calculateConsortiumTotal(insideInstallmentsAnnual.data);
          }
          return sum + s.apuradoAnual;
        }, 0),
        metaAnual: setores.reduce((sum, s) => sum + s.metaAnual, 0),
      };

      return { setores, semanaLabel, mesLabel, totais };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30, // 30 seconds
  });

  // Create modified data with Incorporador gross metrics and recalculated totals
  const modifiedData = useMemo(() => {
    if (!query.data) return undefined;
    
    const setores = query.data.setores.map(setor => {
      if (setor.id === 'incorporador') {
        return {
          ...setor,
          apuradoSemanal: incorporadorMetrics.brutoSemanal,
          apuradoMensal: incorporadorMetrics.brutoMensal,
          apuradoAnual: incorporadorMetrics.brutoAnual,
        };
      }
      return setor;
    });

    // Recalculate totals with the updated Incorporador values
    // For Efeito Alavanca, use comissao (already correct from query.data.totais calculation)
    const incorporadorOriginal = query.data.setores.find(s => s.id === 'incorporador');
    const incorporadorDiffSemanal = incorporadorMetrics.brutoSemanal - (incorporadorOriginal?.apuradoSemanal || 0);
    const incorporadorDiffMensal = incorporadorMetrics.brutoMensal - (incorporadorOriginal?.apuradoMensal || 0);
    const incorporadorDiffAnual = incorporadorMetrics.brutoAnual - (incorporadorOriginal?.apuradoAnual || 0);

    const totais = {
      apuradoSemanal: query.data.totais.apuradoSemanal + incorporadorDiffSemanal,
      metaSemanal: query.data.totais.metaSemanal,
      apuradoMensal: query.data.totais.apuradoMensal + incorporadorDiffMensal,
      metaMensal: query.data.totais.metaMensal,
      apuradoAnual: query.data.totais.apuradoAnual + incorporadorDiffAnual,
      metaAnual: query.data.totais.metaAnual,
    };

    return {
      ...query.data,
      setores,
      totais,
    };
  }, [query.data, incorporadorMetrics.brutoSemanal, incorporadorMetrics.brutoMensal, incorporadorMetrics.brutoAnual]);

  return {
    ...query,
    data: modifiedData,
    isLoading: query.isLoading || incorporadorMetrics.isLoading,
    error: query.error || incorporadorMetrics.error,
  };
}

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

// Week starts on Saturday (6)
const WEEK_STARTS_ON = 6;

export function useSetoresDashboard() {
  const today = new Date();
  
  // Fetch Incorporador gross metrics using the dedicated hook (uses same deduplication logic as Vendas page)
  const incorporadorMetrics = useIncorporadorGrossMetrics();
  
  // Calculate period boundaries
  const weekStart = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(today, { weekStartsOn: WEEK_STARTS_ON });
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const yearStart = startOfYear(today);
  const yearEnd = endOfYear(today);

  const weekStartStr = formatDateForDB(weekStart);
  const weekEndStr = formatDateForDB(weekEnd);
  const monthStartStr = formatDateForDB(monthStart);
  const monthEndStr = formatDateForDB(monthEnd);
  const yearStartStr = formatDateForDB(yearStart);
  const yearEndStr = formatDateForDB(yearEnd);

  const mesNome = format(today, 'MMMM', { locale: ptBR });
  const semanaLabel = `Semana ${format(weekStart, 'dd/MM')} - ${format(weekEnd, 'dd/MM')}`;
  const mesLabel = `Mês ${mesNome.charAt(0).toUpperCase() + mesNome.slice(1)}`;

  const query = useQuery({
    queryKey: ['setores-dashboard', weekStartStr, monthStartStr, yearStartStr],
    queryFn: async (): Promise<{ setores: SetorData[]; semanaLabel: string; mesLabel: string }> => {
      // Fetch all transaction data in parallel
      const [
        hublaWeekly,
        hublaMonthly,
        hublaAnnual,
        consortiumWeekly,
        consortiumMonthly,
        consortiumAnnual,
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
        // Consortium payments - Weekly (for credito sector)
        supabase
          .from('consortium_payments')
          .select('valor_comissao, data_interface')
          .gte('data_interface', weekStartStr)
          .lte('data_interface', weekEndStr),
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

      return { setores, semanaLabel, mesLabel };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 30, // 30 seconds
  });

  // Override Incorporador sector values with gross metrics from dedicated hook
  const data = query.data;
  if (data) {
    const incorporadorIndex = data.setores.findIndex(s => s.id === 'incorporador');
    if (incorporadorIndex !== -1) {
      data.setores[incorporadorIndex] = {
        ...data.setores[incorporadorIndex],
        apuradoSemanal: incorporadorMetrics.brutoSemanal,
        apuradoMensal: incorporadorMetrics.brutoMensal,
        apuradoAnual: incorporadorMetrics.brutoAnual,
      };
    }
  }

  return {
    ...query,
    isLoading: query.isLoading || incorporadorMetrics.isLoading,
    error: query.error || incorporadorMetrics.error,
  };
}

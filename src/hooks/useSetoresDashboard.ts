import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfYear, endOfYear, startOfMonth, format } from "date-fns";
import { Building2, Zap, CreditCard, FolderKanban, Gavel, LucideIcon } from "lucide-react";

export interface SetorData {
  id: 'incorporador' | 'efeito_alavanca' | 'credito' | 'projetos' | 'leilao';
  nome: string;
  icone: LucideIcon;
  apuradoPeriodo: number;
  metaMensal: number;
  apuradoAnual: number;
  metaAnual: number;
}

// Categorias de produtos por setor
const SETOR_CATEGORIES: Record<string, string[]> = {
  incorporador: [
    'incorporador', 'a010', 'contrato', 'parceria', 'ob_vitalicio', 
    'ob_construir', 'ob_evento', 'ob_construir_alugar', 'imersao', 
    'imersao_socios', 'p2', 'renovacao', 'viver_aluguel'
  ],
  efeito_alavanca: ['efeito_alavanca'],
  projetos: ['projetos'],
  leilao: ['clube_arremate'],
};

const SETOR_CONFIG: { id: SetorData['id']; nome: string; icone: LucideIcon }[] = [
  { id: 'incorporador', nome: 'MCF Incorporador', icone: Building2 },
  { id: 'efeito_alavanca', nome: 'Efeito Alavanca', icone: Zap },
  { id: 'credito', nome: 'MCF Crédito', icone: CreditCard },
  { id: 'projetos', nome: 'MCF Projetos', icone: FolderKanban },
  { id: 'leilao', nome: 'MCF Leilão', icone: Gavel },
];

export function useSetoresDashboard(
  periodoInicio: Date,
  periodoFim: Date
) {
  return useQuery({
    queryKey: ['setores-dashboard', format(periodoInicio, 'yyyy-MM-dd'), format(periodoFim, 'yyyy-MM-dd')],
    queryFn: async (): Promise<SetorData[]> => {
      const today = new Date();
      const yearStart = startOfYear(today);
      const yearEnd = endOfYear(today);
      const monthStart = startOfMonth(today);

      // Fetch hubla_transactions para o período filtrado
      const { data: periodTransactions, error: periodError } = await supabase
        .from('hubla_transactions')
        .select('net_value, product_category')
        .gte('sale_date', format(periodoInicio, 'yyyy-MM-dd'))
        .lte('sale_date', format(periodoFim, 'yyyy-MM-dd'));

      if (periodError) throw periodError;

      // Fetch hubla_transactions para o ano inteiro
      const { data: yearTransactions, error: yearError } = await supabase
        .from('hubla_transactions')
        .select('net_value, product_category')
        .gte('sale_date', format(yearStart, 'yyyy-MM-dd'))
        .lte('sale_date', format(yearEnd, 'yyyy-MM-dd'));

      if (yearError) throw yearError;

      // Fetch consortium_payments para o período filtrado (MCF Crédito)
      const { data: periodConsorcio, error: consorcioError } = await supabase
        .from('consortium_payments')
        .select('valor_comissao')
        .gte('data_interface', format(periodoInicio, 'yyyy-MM-dd'))
        .lte('data_interface', format(periodoFim, 'yyyy-MM-dd'));

      if (consorcioError) throw consorcioError;

      // Fetch consortium_payments para o ano inteiro
      const { data: yearConsorcio, error: yearConsorcioError } = await supabase
        .from('consortium_payments')
        .select('valor_comissao')
        .gte('data_interface', format(yearStart, 'yyyy-MM-dd'))
        .lte('data_interface', format(yearEnd, 'yyyy-MM-dd'));

      if (yearConsorcioError) throw yearConsorcioError;

      // Fetch metas da tabela team_targets
      const { data: targets } = await supabase
        .from('team_targets')
        .select('target_type, target_value')
        .gte('week_start', format(monthStart, 'yyyy-MM-dd'))
        .in('target_type', [
          'setor_incorporador_mes', 'setor_incorporador_ano',
          'setor_efeito_alavanca_mes', 'setor_efeito_alavanca_ano',
          'setor_credito_mes', 'setor_credito_ano',
          'setor_projetos_mes', 'setor_projetos_ano',
          'setor_leilao_mes', 'setor_leilao_ano',
        ]);

      // Função para calcular total de um setor por categorias
      const calculateSetorTotal = (transactions: typeof periodTransactions, categories: string[]): number => {
        if (!transactions) return 0;
        return transactions
          .filter(t => t.product_category && categories.includes(t.product_category.toLowerCase()))
          .reduce((sum, t) => sum + (t.net_value || 0), 0);
      };

      // Função para obter meta
      const getTarget = (type: string): number => {
        const target = targets?.find(t => t.target_type === type);
        return target?.target_value || 0;
      };

      // Calcular valores para cada setor
      const setoresData: SetorData[] = SETOR_CONFIG.map(config => {
        if (config.id === 'credito') {
          // MCF Crédito usa consortium_payments
          const apuradoPeriodo = periodConsorcio?.reduce((sum, c) => sum + (c.valor_comissao || 0), 0) || 0;
          const apuradoAnual = yearConsorcio?.reduce((sum, c) => sum + (c.valor_comissao || 0), 0) || 0;

          return {
            ...config,
            apuradoPeriodo,
            metaMensal: getTarget('setor_credito_mes'),
            apuradoAnual,
            metaAnual: getTarget('setor_credito_ano'),
          };
        }

        // Outros setores usam hubla_transactions
        const categories = SETOR_CATEGORIES[config.id] || [];
        const apuradoPeriodo = calculateSetorTotal(periodTransactions, categories);
        const apuradoAnual = calculateSetorTotal(yearTransactions, categories);

        return {
          ...config,
          apuradoPeriodo,
          metaMensal: getTarget(`setor_${config.id}_mes`),
          apuradoAnual,
          metaAnual: getTarget(`setor_${config.id}_ano`),
        };
      });

      return setoresData;
    },
    staleTime: 30000, // 30 segundos
    refetchInterval: 30000, // Refresh a cada 30 segundos
  });
}

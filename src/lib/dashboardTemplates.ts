import { DashboardTemplate } from "@/types/dashboard";

export const DASHBOARD_TEMPLATES: Record<string, DashboardTemplate> = {
  executivo: {
    name: 'Visão Executiva',
    description: 'KPIs principais, Ultrameta e evolução temporal para decisões estratégicas',
    widgets: ['kpis', 'ultrameta', 'grafico-evolucao', 'resumo-financeiro']
  },
  vendas: {
    name: 'Foco em Vendas',
    description: 'Funis de vendas, comparação de períodos e alertas de metas',
    widgets: ['funil-a010', 'funil-instagram', 'kpis', 'alertas-recentes', 'comparacao-periodos']
  },
  financeiro: {
    name: 'Análise Financeira',
    description: 'Resumo financeiro detalhado, evolução e KPIs monetários',
    widgets: ['kpis', 'resumo-financeiro', 'grafico-evolucao', 'ultrameta']
  },
  completo: {
    name: 'Visão Completa',
    description: 'Todos os widgets para análise completa do negócio',
    widgets: [
      'kpis',
      'ultrameta',
      'funil-a010',
      'funil-instagram',
      'resumo-financeiro',
      'grafico-evolucao',
      'alertas-recentes',
      'comparacao-periodos'
    ]
  }
};

export const DEFAULT_PREFERENCES = {
  visible_widgets: DASHBOARD_TEMPLATES.completo.widgets,
  widgets_order: DASHBOARD_TEMPLATES.completo.widgets,
  default_period: 'mes' as const,
  default_canal: 'todos',
  auto_refresh: false,
  refresh_interval: 60,
};

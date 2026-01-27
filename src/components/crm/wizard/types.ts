export interface WizardStage {
  id: string;
  name: string;
  color: string;
  stage_type: 'normal' | 'won' | 'lost';
  stage_order: number;
}

export interface WizardDistribution {
  user_email: string;
  user_name: string;
  percentage: number;
  is_active: boolean;
}

export interface WizardIntegration {
  enabled: boolean;
  slug: string;
  auto_tags: string[];
  initial_stage_id: string;
}

export interface WizardData {
  // Step 1: Info
  type: 'group' | 'origin';
  name: string;
  display_name: string;
  description: string;
  parent_group_id: string | null;
  
  // Step 2: Stages
  stages: WizardStage[];
  
  // Step 3: Distribution
  distribution: WizardDistribution[];
  
  // Step 4: Integrations
  integration: WizardIntegration;
}

export const DEFAULT_STAGES: WizardStage[] = [
  { id: crypto.randomUUID(), name: 'Novo Lead', color: '#3b82f6', stage_type: 'normal', stage_order: 0 },
  { id: crypto.randomUUID(), name: 'Lead Qualificado', color: '#8b5cf6', stage_type: 'normal', stage_order: 1 },
  { id: crypto.randomUUID(), name: 'R1 Agendada', color: '#f59e0b', stage_type: 'normal', stage_order: 2 },
  { id: crypto.randomUUID(), name: 'R1 Realizada', color: '#10b981', stage_type: 'normal', stage_order: 3 },
  { id: crypto.randomUUID(), name: 'Contrato Pago', color: '#22c55e', stage_type: 'won', stage_order: 4 },
  { id: crypto.randomUUID(), name: 'Sem Interesse', color: '#ef4444', stage_type: 'lost', stage_order: 5 },
];

export const INITIAL_WIZARD_DATA: WizardData = {
  type: 'origin',
  name: '',
  display_name: '',
  description: '',
  parent_group_id: null,
  stages: DEFAULT_STAGES,
  distribution: [],
  integration: {
    enabled: false,
    slug: '',
    auto_tags: [],
    initial_stage_id: '',
  },
};

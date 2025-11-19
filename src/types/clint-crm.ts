// Clint CRM API Types
export interface ClintContact {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  organization_id?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ClintOrganization {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ClintDeal {
  id: string;
  name: string;
  value: number;
  stage_id: string;  // ID do estágio (UUID)
  stage: string;      // Nome do estágio (para exibição)
  probability?: number;
  contact_id?: string;
  organization_id?: string;
  expected_close_date?: string;
  owner_id?: string;
  custom_fields?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ClintGroup {
  id: string;
  name: string;
  description?: string;
  contact_count?: number;
  created_at: string;
  updated_at: string;
}

export interface ClintLostStatus {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface ClintOrigin {
  id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface ClintTag {
  id: string;
  name: string;
  color?: string;
  created_at: string;
}

export interface ClintUser {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface ClintAccount {
  id: string;
  name: string;
  plan: string;
  created_at: string;
  settings?: Record<string, any>;
}

export interface ClintAPIResponse<T> {
  data: T;
  meta?: {
    page: number;
    per_page: number;
    total: number;
  };
}

export interface ClintAPIRequest {
  resource: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  data?: any;
  params?: Record<string, string>;
}

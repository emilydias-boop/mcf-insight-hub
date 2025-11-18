import { Database } from "@/integrations/supabase/types";

export type AppRole = Database['public']['Enums']['app_role'];
export type FlagType = Database['public']['Enums']['flag_type'];
export type FlagCategory = Database['public']['Enums']['flag_category'];
export type TargetType = Database['public']['Enums']['target_type'];
export type TargetPeriod = Database['public']['Enums']['target_period'];
export type PermissionLevel = Database['public']['Enums']['permission_level'];
export type ResourceType = Database['public']['Enums']['resource_type'];

export interface UserSummary {
  user_id: string;
  email: string;
  full_name: string | null;
  role: AppRole | null;
  position: string | null;
  hire_date: string | null;
  is_active: boolean | null;
  red_flags_count: number;
  yellow_flags_count: number;
  targets_achieved: number;
  total_targets: number;
  avg_performance_3m: number | null;
  fixed_salary: number | null;
  ote: number | null;
}

export interface UserDetails {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: AppRole | null;
  employment: {
    position: string | null;
    department: string | null;
    hire_date: string | null;
    termination_date: string | null;
    fixed_salary: number | null;
    ote: number | null;
    commission_rate: number | null;
    is_active: boolean | null;
  } | null;
}

export interface UserTarget {
  id: string;
  user_id: string;
  name: string;
  type: TargetType;
  period: TargetPeriod;
  target_value: number;
  current_value: number | null;
  start_date: string;
  end_date: string;
  is_achieved: boolean | null;
  created_at: string;
  updated_at: string;
}

export interface UserFlag {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  flag_type: FlagType;
  category: FlagCategory;
  severity: number | null;
  is_resolved: boolean | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface UserObservation {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string | null;
  is_important: boolean | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface UserPermission {
  id: string;
  user_id: string;
  resource: ResourceType;
  permission_level: PermissionLevel;
  restrictions: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

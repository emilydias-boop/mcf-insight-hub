// R2 Agenda Types

export interface R2StatusOption {
  id: string;
  name: string;
  color: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface R2ThermometerOption {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  created_at?: string;
}

export interface R2AttendeeExtended {
  id: string;
  attendee_name?: string | null;
  attendee_phone?: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  deal_id: string | null;
  already_builds: boolean | null;
  // R2-specific fields
  partner_name: string | null;
  lead_profile: string | null;
  video_status: 'ok' | 'pendente' | null;
  r2_status_id: string | null;
  r2_status?: R2StatusOption | null;
  thermometer_ids: string[];
  thermometers?: R2ThermometerOption[];
  r2_confirmation: string | null;
  r2_observations: string | null;
  meeting_link: string | null;
  updated_by: string | null;
  updated_at: string | null;
  // Decision maker fields
  is_decision_maker: boolean | null;
  decision_maker_type: string | null;
  deal?: {
    id: string;
    name: string;
    custom_fields?: {
      profissao?: string;
      estado?: string;
      renda?: string;
      terreno?: string;
      investimento?: string;
      solucao?: string;
      tem_socio?: string;
      nome_socio?: string;
      possui_imovel?: string;
      [key: string]: unknown;
    } | null;
    contact?: {
      name: string;
      email: string | null;
      phone: string | null;
      tags: string[] | null;
    } | null;
  } | null;
}

// Decision maker type options
export const DECISION_MAKER_TYPE_OPTIONS = [
  { value: 'outro_socio', label: 'Outro Sócio' },
  { value: 'esposa', label: 'Esposa' },
  { value: 'marido', label: 'Marido' },
  { value: 'filho', label: 'Filho(a)' },
  { value: 'irmao', label: 'Irmão(ã)' },
  { value: 'pai', label: 'Pai' },
  { value: 'mae', label: 'Mãe' },
  { value: 'outros', label: 'Outros' },
];

export interface R2MeetingRow {
  id: string;
  scheduled_at: string;
  status: string;
  created_at: string;
  meeting_type: string;
  notes: string | null;
  closer: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  attendees: R2AttendeeExtended[];
  // Histórico do funil
  sdr?: {
    email: string;
    name: string | null;
  } | null;
  r1_closer?: {
    id: string;
    name: string;
    scheduled_at: string | null;
  } | null;
  booked_by?: {
    id: string;
    name: string | null;
  } | null;
}

export interface R2AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
  user?: {
    name?: string;
    email?: string;
  } | null;
}

// Lead profile options
export const LEAD_PROFILE_OPTIONS = [
  { value: 'lead_a', label: 'Lead A' },
  { value: 'lead_b', label: 'Lead B' },
  { value: 'lead_c', label: 'Lead C' },
  { value: 'lead_d', label: 'Lead D' },
];

// Attendance status options
export const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'invited', label: 'Agendado' },
  { value: 'completed', label: 'Compareceu' },
  { value: 'no_show', label: 'No-show' },
];

// Video status options
export const VIDEO_STATUS_OPTIONS = [
  { value: 'ok', label: 'Vídeo Ok' },
  { value: 'pendente', label: 'Pendente' },
];

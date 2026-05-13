import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type OperationalRoleSystem = 'closer' | 'closer_sombra' | 'sdr' | null;

export interface EmployeeOperationalData {
  roleSystem: OperationalRoleSystem;
  area: string | null;
  closer: {
    id: string;
    name: string;
    email: string;
    is_active: boolean | null;
    color: string | null;
    bu: string | null;
    meeting_type: 'r1' | 'r2' | null;
    calendly_event_type_uri: string | null;
    calendly_default_link: string | null;
    google_calendar_id: string | null;
    google_calendar_enabled: boolean | null;
    priority: number | null;
    max_leads_per_slot: number | null;
  } | null;
  sdr: {
    id: string;
    name: string;
    email: string;
    active: boolean | null;
    squad: string | null;
    role_type: string | null;
    allowed_origin_ids: string[] | null;
    meta_diaria: number | null;
    nivel: number | null;
  } | null;
}

export function useEmployeeOperational(employeeId: string | null | undefined) {
  return useQuery({
    queryKey: ['employee-operational', employeeId],
    enabled: !!employeeId,
    queryFn: async (): Promise<EmployeeOperationalData> => {
      if (!employeeId) {
        return { roleSystem: null, area: null, closer: null, sdr: null };
      }

      const { data: emp, error: empErr } = await supabase
        .from('employees')
        .select('id, email_pessoal, cargo_catalogo:cargo_catalogo_id(role_sistema, area)')
        .eq('id', employeeId)
        .maybeSingle();
      if (empErr) throw empErr;

      const cargo: any = (emp as any)?.cargo_catalogo;
      const roleSystem: OperationalRoleSystem = cargo?.role_sistema ?? null;
      const area: string | null = cargo?.area ?? null;
      const email = (emp as any)?.email_pessoal?.toLowerCase?.() || '';

      let closer: EmployeeOperationalData['closer'] = null;
      let sdr: EmployeeOperationalData['sdr'] = null;

      if (roleSystem === 'closer' || roleSystem === 'closer_sombra') {
        const { data } = await supabase
          .from('closers')
          .select('id, name, email, is_active, color, bu, meeting_type, calendly_event_type_uri, calendly_default_link, google_calendar_id, google_calendar_enabled, priority, max_leads_per_slot')
          .or(`employee_id.eq.${employeeId}${email ? `,email.ilike.${email}` : ''}`)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        closer = data as any;
      }

      if (roleSystem === 'sdr' && email) {
        const { data } = await supabase
          .from('sdr')
          .select('id, name, email, active, squad, role_type, allowed_origin_ids, meta_diaria, nivel')
          .ilike('email', email)
          .maybeSingle();
        sdr = data as any;
      }

      return { roleSystem, area, closer, sdr };
    },
  });
}

export function useUpdateOperationalCloser(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; data: Partial<NonNullable<EmployeeOperationalData['closer']>> }) => {
      const { error } = await supabase
        .from('closers')
        .update({ ...payload.data, updated_at: new Date().toISOString() })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-operational', employeeId] });
      qc.invalidateQueries({ queryKey: ['closers-list'] });
      qc.invalidateQueries({ queryKey: ['r2-closers-list'] });
      toast.success('Configuração do closer atualizada');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}

export function useUpdateOperationalSdr(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id: string; data: Partial<NonNullable<EmployeeOperationalData['sdr']>> }) => {
      const { error } = await supabase
        .from('sdr')
        .update({ ...payload.data, updated_at: new Date().toISOString() })
        .eq('id', payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-operational', employeeId] });
      toast.success('Configuração do SDR atualizada');
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });
}
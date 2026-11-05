import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TipoDossie } from '@/lib/dossie';
export interface RegistroDossie { id: string; employee_id: string; tipo: TipoDossie; titulo: string; conteudo: string; ocorrido_em: string; status: string; confidencial: boolean; original_id: string | null; created_by: string; created_at: string; anexos: { path: string; nome: string }[] }
export function useDossie(employeeId: string) {
  return useQuery({ queryKey: ['dossie', employeeId], queryFn: async () => {
    const [registros, ciencias, gestor, me] = await Promise.all([
      supabase.from('gov_dossie_registros').select('*').eq('employee_id', employeeId).order('ocorrido_em', { ascending: false }),
      supabase.from('gov_dossie_ciencias').select('*, gov_dossie_registros!inner(employee_id)').eq('gov_dossie_registros.employee_id', employeeId),
      supabase.rpc('gov_dossie_gestor', { p_employee: employeeId }), supabase.rpc('gov_meu_employee'),
    ]);
    for (const result of [registros, ciencias, gestor, me]) if (result.error) throw result.error;
    return { registros: (registros.data ?? []) as unknown as RegistroDossie[], ciencias: ciencias.data ?? [], gestor: !!gestor.data, proprio: me.data === employeeId };
  } });
}
export function useDossieLegado(employeeId: string, userId: string | null, enabled: boolean) {
  return useQuery({ queryKey: ['dossie-legado', employeeId, userId], enabled, queryFn: async () => {
    const [notes, pdis, flags] = await Promise.all([
      supabase.from('employee_notes').select('id,titulo,conteudo,tipo,created_at').eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(200),
      supabase.from('employee_pdi').select('id,titulo,descricao,status,created_at').eq('employee_id', employeeId).order('created_at', { ascending: false }).limit(200),
      userId ? supabase.from('user_flags').select('id,title,description,flag_type,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(200) : Promise.resolve({ data: [], error: null }),
    ]);
    for (const result of [notes, pdis, flags]) if (result.error) throw result.error;
    return [...(notes.data ?? []).map(n => ({ id: `nota-${n.id}`, titulo: n.titulo || 'Nota', conteudo: n.conteudo, tipo: n.tipo, data: n.created_at })), ...(pdis.data ?? []).map(n => ({ id: `pdi-${n.id}`, titulo: n.titulo, conteudo: n.descricao, tipo: `PDI · ${n.status}`, data: n.created_at })), ...(flags.data ?? []).map(n => ({ id: `flag-${n.id}`, titulo: n.title, conteudo: n.description, tipo: `${n.flag_type} flag`, data: n.created_at }))].sort((a,b) => (b.data ?? '').localeCompare(a.data ?? ''));
  } });
}
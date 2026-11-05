import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { TipoDossie } from '@/lib/dossie';
export interface RegistroDossie { id: string; employee_id: string; tipo: TipoDossie; titulo: string; conteudo: string; ocorrido_em: string; status: string; confidencial: boolean; original_id: string | null; created_by: string; created_at: string; anexos: { path: string; nome: string }[] }
async function todas<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) { const r = await fetch(from, from + 999); if (r.error) throw new Error(r.error.message); rows.push(...(r.data ?? [])); if ((r.data?.length ?? 0) < 1000) return rows; }
}
export function useDossie(employeeId: string) {
  return useQuery({ queryKey: ['dossie', employeeId], queryFn: async () => {
    const [registros, ciencias, gestor, me] = await Promise.all([
      todas((from,to) => supabase.from('gov_dossie_registros').select('*').eq('employee_id', employeeId).order('ocorrido_em', { ascending: false }).order('id').range(from,to)),
      todas((from,to) => supabase.from('gov_dossie_ciencias').select('*, gov_dossie_registros!inner(employee_id)').eq('gov_dossie_registros.employee_id', employeeId).order('id').range(from,to)),
      supabase.rpc('gov_dossie_gestor', { p_employee: employeeId }), supabase.rpc('gov_meu_employee'),
    ]);
    for (const result of [gestor, me]) if (result.error) throw result.error;
    return { registros: registros as unknown as RegistroDossie[], ciencias, gestor: !!gestor.data, proprio: me.data === employeeId };
  } });
}
export function useDossieLegado(employeeId: string, userId: string | null, enabled: boolean) {
  return useQuery({ queryKey: ['dossie-legado', employeeId, userId], enabled, queryFn: async () => {
    const [notes, pdis, flags] = await Promise.all([
      todas((from,to) => supabase.from('employee_notes').select('id,titulo,conteudo,tipo,created_at').eq('employee_id', employeeId).order('created_at', { ascending: false }).order('id').range(from,to)),
      todas((from,to) => supabase.from('employee_pdi').select('id,titulo,descricao,status,created_at').eq('employee_id', employeeId).order('created_at', { ascending: false }).order('id').range(from,to)),
      userId ? todas((from,to) => supabase.from('user_flags').select('id,title,description,flag_type,created_at').eq('user_id', userId).order('created_at', { ascending: false }).order('id').range(from,to)) : Promise.resolve([]),
    ]);
    return [...notes.map(n => ({ id: `nota-${n.id}`, titulo: n.titulo || 'Nota', conteudo: n.conteudo, tipo: n.tipo, data: n.created_at })), ...pdis.map(n => ({ id: `pdi-${n.id}`, titulo: n.titulo, conteudo: n.descricao, tipo: `PDI · ${n.status}`, data: n.created_at })), ...flags.map(n => ({ id: `flag-${n.id}`, titulo: n.title, conteudo: n.description, tipo: `${n.flag_type} flag`, data: n.created_at }))].sort((a,b) => (b.data ?? '').localeCompare(a.data ?? ''));
  } });
}
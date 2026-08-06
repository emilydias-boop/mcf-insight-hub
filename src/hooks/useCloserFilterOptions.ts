import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CloserFilterOption {
  email: string;
  label: string;
}

/**
 * Opções para o filtro "Closer (R1/R2)" do Kanban de Negócios.
 * Vem da tabela `closers` (não de `profiles`) e faz dedupe por email,
 * priorizando registros ativos e mais recentes.
 */
export function useCloserFilterOptions(bu?: string | null) {
  return useQuery({
    queryKey: ['closer-filter-options', bu ?? null],
    queryFn: async (): Promise<CloserFilterOption[]> => {
      let query = supabase
        .from('closers')
        .select('id, name, email, is_active, bu, created_at')
        .eq('is_active', true);

      if (bu) query = query.eq('bu', bu);

      const { data, error } = await query
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      const byEmail = new Map<string, CloserFilterOption>();
      (data || []).forEach((c: any) => {
        const email = (c.email || '').trim().toLowerCase();
        if (!email) return;
        // Primeiro registro vence (já ordenado: ativo + mais recente primeiro)
        if (!byEmail.has(email)) {
          byEmail.set(email, { email, label: c.name || email.split('@')[0] });
        }
      });

      return Array.from(byEmail.values()).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
    },
    staleTime: 5 * 60 * 1000,
  });
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContatoAlternativo {
  id: string;
  contact_id: string;
  nome: string | null;
  email: string | null;
  telefone: string | null;
  documento: string | null;
  origem: string | null;
  transaction_id: string | null;
  observacao: string | null;
  created_at: string;
  created_by: string | null;
}

const KEY = 'contatos-alternativos';

export function useContatosAlternativos(contactId?: string) {
  return useQuery({
    queryKey: [KEY, contactId],
    enabled: !!contactId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('crm_contact_aliases')
        .select('*')
        .eq('contact_id', contactId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as ContatoAlternativo[];
    },
  });
}

function invalidar(qc: ReturnType<typeof useQueryClient>) {
  [KEY, 'crm-deals', 'crm-deals-infinite', 'crm-deal', 'crm-contacts', 'crm-contact', 'contacts-enriched'].forEach((k) =>
    qc.invalidateQueries({ queryKey: [k] })
  );
}

export function useAdicionarContatoAlternativo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      contact_id: string;
      nome?: string | null;
      email?: string | null;
      telefone?: string | null;
      documento?: string | null;
      observacao?: string | null;
      origem?: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from('crm_contact_aliases')
        .insert({ ...input, origem: input.origem ?? 'manual' })
        .select()
        .single();
      if (error) throw error;
      return data as ContatoAlternativo;
    },
    onSuccess: () => invalidar(qc),
  });
}

export function useRemoverContatoAlternativo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('crm_contact_aliases').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidar(qc),
  });
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DuplicateGroup {
  email: string;
  contacts: {
    id: string;
    name: string;
    phone: string | null;
    created_at: string;
    deals_count: number;
    has_owner: boolean;
  }[];
}

export function useDuplicateContacts() {
  return useQuery({
    queryKey: ['duplicate-contacts'],
    queryFn: async () => {
      // Buscar todos os contatos com email
      const { data: contacts, error } = await supabase
        .from('crm_contacts')
        .select(`
          id,
          name,
          email,
          phone,
          created_at,
          crm_deals(id, owner_id)
        `)
        .not('email', 'is', null)
        .order('email')
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Agrupar por email lowercase
      const groups: Record<string, DuplicateGroup['contacts']> = {};
      
      for (const contact of contacts || []) {
        const email = contact.email?.toLowerCase();
        if (!email) continue;

        const deals = (contact.crm_deals as any[]) || [];
        
        if (!groups[email]) {
          groups[email] = [];
        }
        
        groups[email].push({
          id: contact.id,
          name: contact.name,
          phone: contact.phone,
          created_at: contact.created_at,
          deals_count: deals.length,
          has_owner: deals.some((d: any) => d.owner_id),
        });
      }

      // Filtrar apenas grupos com duplicados
      const duplicates: DuplicateGroup[] = Object.entries(groups)
        .filter(([_, contacts]) => contacts.length >= 2)
        .map(([email, contacts]) => ({
          email,
          contacts: contacts.sort((a, b) => {
            // Priorizar quem tem deals com owner
            if (a.has_owner !== b.has_owner) return a.has_owner ? -1 : 1;
            // Depois quem tem mais deals
            if (a.deals_count !== b.deals_count) return b.deals_count - a.deals_count;
            // Por último, o mais antigo
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          }),
        }));

      return duplicates;
    },
  });
}

export function useMergeDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ primaryId, duplicateIds }: { primaryId: string; duplicateIds: string[] }) => {
      // 1. Atualizar deals dos duplicados
      for (const dupId of duplicateIds) {
        const { error } = await supabase
          .from('crm_deals')
          .update({ 
            contact_id: primaryId,
            updated_at: new Date().toISOString()
          })
          .eq('contact_id', dupId);

        if (error) throw error;
      }

      // 2. Deletar contatos duplicados
      for (const dupId of duplicateIds) {
        const { error } = await supabase
          .from('crm_contacts')
          .delete()
          .eq('id', dupId);

        if (error) {
          console.error(`Erro ao deletar contato ${dupId}:`, error);
        }
      }

      return { merged: duplicateIds.length };
    },
    onSuccess: (data) => {
      toast.success(`${data.merged} contato(s) unificado(s) com sucesso`);
      queryClient.invalidateQueries({ queryKey: ['duplicate-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error: any) => {
      toast.error(`Erro ao unificar: ${error.message}`);
    },
  });
}

export function useMergeAllDuplicates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dryRun = false }: { dryRun?: boolean }) => {
      const { data, error } = await supabase.functions.invoke('merge-duplicate-contacts', {
        body: { dry_run: dryRun, limit: 500 },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.dry_run) {
        toast.info(`Simulação: ${data.total_groups} grupos encontrados`);
      } else {
        toast.success(`${data.merged} grupos unificados, ${data.contacts_deleted} contatos removidos`);
      }
      queryClient.invalidateQueries({ queryKey: ['duplicate-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['crm-deals'] });
    },
    onError: (error: any) => {
      toast.error(`Erro: ${error.message}`);
    },
  });
}

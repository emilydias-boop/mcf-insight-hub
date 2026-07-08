import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WaTemplateVariable {
  index: number; // posição no template ({{1}}, {{2}}…)
  label: string; // rótulo mostrado ao operador
  source?: 'customer_name' | 'product_name' | 'purchase_date' | 'custom';
  default?: string;
}

export interface WaTemplate {
  id: string;
  name: string;
  content_sid: string;
  description: string | null;
  body_preview: string | null;
  variables: WaTemplateVariable[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useWaTemplates(onlyActive = true) {
  return useQuery({
    queryKey: ['wa_templates', onlyActive],
    queryFn: async () => {
      let q = (supabase as any).from('wa_templates').select('*').order('name');
      if (onlyActive) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as WaTemplate[];
    },
  });
}

export function useUpsertWaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tpl: Partial<WaTemplate> & { name: string; content_sid: string }) => {
      const row = {
        name: tpl.name,
        content_sid: tpl.content_sid,
        description: tpl.description ?? null,
        body_preview: tpl.body_preview ?? null,
        variables: tpl.variables ?? [],
        is_active: tpl.is_active ?? true,
      };
      if (tpl.id) {
        const { error } = await (supabase as any).from('wa_templates').update(row).eq('id', tpl.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('wa_templates').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa_templates'] });
      toast.success('Template salvo');
    },
    onError: (err: any) => toast.error(err.message ?? 'Erro ao salvar template'),
  });
}

export function useDeleteWaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('wa_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa_templates'] });
      toast.success('Template removido');
    },
    onError: (err: any) => toast.error(err.message ?? 'Erro ao remover'),
  });
}
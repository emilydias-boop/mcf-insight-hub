import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { lerErroEdge } from "@/lib/automationMetaTemplate";

export type ApprovalStatus =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'paused'
  | 'disabled'
  | 'unknown';

export interface TemplateButton {
  type: 'url' | 'quick_reply' | 'phone';
  text: string;
  phone?: string;
  url?: string;
  url_param_key?: string;
  id?: string;
}

export type TemplateBU = 'incorporador' | 'consorcio' | 'credito' | 'projetos' | 'leilao' | 'marketing';

export interface AutomationTemplate {
  id: string;
  name: string;
  channel: 'whatsapp' | 'email';
  content: string;
  subject?: string;
  variables?: string[];
  twilio_template_sid?: string;
  meta_template_name?: string | null;
  meta_language?: string;
  activecampaign_template_id?: string;
  is_active: boolean;
  approval_status?: ApprovalStatus;
  approval_submitted_at?: string | null;
  approval_updated_at?: string | null;
  approval_rejected_reason?: string | null;
  buttons_config?: TemplateButton[];
  category?: 'utility' | 'marketing' | 'authentication';
  language?: string;
  variable_count?: number;
  business_units?: TemplateBU[];
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export function useAutomationTemplates(channel?: 'whatsapp' | 'email') {
  return useQuery({
    queryKey: ["automation-templates", channel],
    queryFn: async () => {
      let query = supabase
        .from("automation_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (channel) {
        query = query.eq("channel", channel);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AutomationTemplate[];
    },
  });
}

export function useAutomationTemplate(id: string | null) {
  return useQuery({
    queryKey: ["automation-template", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("automation_templates")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as unknown as AutomationTemplate | null;
    },
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (template: Partial<AutomationTemplate>) => {
      const { data, error } = await supabase
        .from("automation_templates")
        .insert({
          name: template.name!,
          channel: template.channel!,
          content: template.content!,
          subject: template.subject,
          variables: template.variables || ['nome', 'sdr', 'data', 'link', 'produto'],
          twilio_template_sid: template.twilio_template_sid,
          activecampaign_template_id: template.activecampaign_template_id,
          is_active: template.is_active ?? true,
          buttons_config: (template.buttons_config ?? []) as unknown as never,
          category: template.category ?? 'utility',
          language: template.language ?? 'pt_BR',
          variable_count: template.variables?.length ?? 0,
          business_units: (template.business_units ?? []) as unknown as never,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-templates"] });
      toast.success("Template criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating template:", error);
      toast.error("Erro ao criar template");
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutomationTemplate> & { id: string }) => {
      const { data, error } = await supabase
        .from("automation_templates")
        .update({
          name: updates.name,
          channel: updates.channel,
          content: updates.content,
          subject: updates.subject,
          variables: updates.variables,
          twilio_template_sid: updates.twilio_template_sid,
          activecampaign_template_id: updates.activecampaign_template_id,
          is_active: updates.is_active,
          buttons_config: updates.buttons_config as unknown as never,
          category: updates.category,
          language: updates.language,
          variable_count: updates.variables?.length,
          business_units: updates.business_units as unknown as never,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["automation-templates"] });
      queryClient.invalidateQueries({ queryKey: ["automation-template", data.id] });
      toast.success("Template atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating template:", error);
      toast.error("Erro ao atualizar template");
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automation_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-templates"] });
      toast.success("Template excluído com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting template:", error);
      toast.error("Erro ao excluir template");
    },
  });
}

export type TemplateMetaStatus = {
  template_id: string; meta_template_name: string | null; meta_language: string;
  status: string | null; categoria: string | null; qualidade: string | null;
  motivo_rejeicao: string | null; variaveis: number | null; sincronizado_em: string | null;
};

/** Status da Meta de cada template de WhatsApp das automações (RPC mkt_automacao_templates_meta). */
export function useAutomationTemplatesMeta() {
  return useQuery({
    queryKey: ["automation-templates-meta"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("mkt_automacao_templates_meta");
      if (error) throw error;
      return (data ?? []) as TemplateMetaStatus[];
    },
    staleTime: 60_000,
  });
}

/** Liga o template da automação ao template criado na Meta. Só é chamado depois de a Meta aceitar. */
export function useVincularTemplateMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, meta_template_name }: { id: string; meta_template_name: string }) => {
      const { data, error } = await (supabase as any)
        .from("automation_templates")
        .update({ meta_template_name, meta_language: "pt_BR", updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length !== 1) throw new Error("Sem permissão para ligar o template.");
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["automation-templates"] });
      qc.invalidateQueries({ queryKey: ["automation-template", v.id] });
      qc.invalidateQueries({ queryKey: ["automation-templates-meta"] });
    },
  });
}

/** Botão "Sincronizar status": puxa da Meta o status dos templates (edge meta-wa-sync, 429 se < 30 s). */
export function useSincronizarMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-wa-sync", { body: {} });
      if (error) {
        const { status, mensagem } = await lerErroEdge(error);
        throw new Error(status === 429 ? "Sincronizado há menos de 30 s" : mensagem);
      }
      // Não olhe d.ok: ele inclui a saúde do número. Só os templates importam aqui.
      const d = data as { ok?: boolean; error?: string; detalhe_templates?: { ok?: boolean } } | null;
      if (d?.detalhe_templates?.ok === false) throw new Error("A Meta não devolveu os templates. Tente de novo em instantes.");
    },
    onSettled: async () => {
      // roda também no erro: a sincronização pode ter gravado parte dos dados
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["automation-templates"] }),
        qc.invalidateQueries({ queryKey: ["automation-templates-meta"] }),
        qc.invalidateQueries({ queryKey: ["mkt-wa-estado"] }),
      ]);
    },
    onSuccess: () => toast.success("Status dos templates atualizado."),
    onError: (e: Error) => toast.error(e.message),
  });
}

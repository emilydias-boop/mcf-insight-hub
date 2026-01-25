import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AutomationTemplate {
  id: string;
  name: string;
  channel: 'whatsapp' | 'email';
  content: string;
  subject?: string;
  variables?: string[];
  twilio_template_sid?: string;
  activecampaign_template_id?: string;
  is_active: boolean;
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
      return (data || []) as AutomationTemplate[];
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
      return data as AutomationTemplate | null;
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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AutomationFlow {
  id: string;
  name: string;
  description?: string;
  stage_id?: string;
  origin_id?: string;
  trigger_on: 'enter' | 'exit';
  is_active: boolean;
  respect_business_hours: boolean;
  business_hours_start?: string;
  business_hours_end?: string;
  exclude_weekends: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined data
  stage?: { id: string; name: string; color?: string };
  origin?: { id: string; name: string };
  steps_count?: number;
}

export interface AutomationStep {
  id: string;
  flow_id: string;
  template_id: string;
  channel: 'whatsapp' | 'email';
  delay_days: number;
  delay_hours: number;
  delay_minutes: number;
  order_index: number;
  conditions?: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  template?: {
    id: string;
    name: string;
    channel: 'whatsapp' | 'email';
    content: string;
    subject?: string;
  };
}

export function useAutomationFlows() {
  return useQuery({
    queryKey: ["automation-flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_flows")
        .select(`
          *,
          stage:crm_stages(id, stage_name, color),
          origin:crm_origins(id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Get step counts for each flow
      const flowIds = data?.map(f => f.id) || [];
      
      if (flowIds.length > 0) {
        const { data: stepsData } = await supabase
          .from("automation_steps")
          .select("flow_id")
          .in("flow_id", flowIds);
        
        const stepCounts = (stepsData || []).reduce((acc, step) => {
          acc[step.flow_id] = (acc[step.flow_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        return (data || []).map(flow => ({
          ...flow,
          stage: flow.stage ? { ...flow.stage, name: (flow.stage as any).stage_name } : undefined,
          steps_count: stepCounts[flow.id] || 0
        })) as AutomationFlow[];
      }
      
      return (data || []).map(flow => ({
        ...flow,
        stage: flow.stage ? { ...flow.stage, name: (flow.stage as any).stage_name } : undefined,
        steps_count: 0
      })) as AutomationFlow[];
    },
  });
}

export function useAutomationFlow(id: string | null) {
  return useQuery({
    queryKey: ["automation-flow", id],
    queryFn: async () => {
      if (!id) return null;
      
      const { data, error } = await supabase
        .from("automation_flows")
        .select(`
          *,
          stage:crm_stages(id, stage_name, color),
          origin:crm_origins(id, name)
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      
      return {
        ...data,
        stage: data.stage ? { ...data.stage, name: (data.stage as any).stage_name } : undefined,
      } as AutomationFlow;
    },
    enabled: !!id,
  });
}

export function useFlowSteps(flowId: string | null) {
  return useQuery({
    queryKey: ["automation-steps", flowId],
    queryFn: async () => {
      if (!flowId) return [];
      
      const { data, error } = await supabase
        .from("automation_steps")
        .select(`
          *,
          template:automation_templates(id, name, channel, content, subject)
        `)
        .eq("flow_id", flowId)
        .order("order_index", { ascending: true });

      if (error) throw error;
      return (data || []) as AutomationStep[];
    },
    enabled: !!flowId,
  });
}

export function useCreateFlow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (flow: Partial<AutomationFlow>) => {
      const { data, error } = await supabase
        .from("automation_flows")
        .insert({
          name: flow.name!,
          description: flow.description,
          stage_id: flow.stage_id,
          origin_id: flow.origin_id,
          trigger_on: flow.trigger_on || 'enter',
          is_active: flow.is_active ?? true,
          respect_business_hours: flow.respect_business_hours ?? true,
          business_hours_start: flow.business_hours_start || '09:00',
          business_hours_end: flow.business_hours_end || '18:00',
          exclude_weekends: flow.exclude_weekends ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
      toast.success("Fluxo criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating flow:", error);
      toast.error("Erro ao criar fluxo");
    },
  });
}

export function useUpdateFlow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutomationFlow> & { id: string }) => {
      const { data, error } = await supabase
        .from("automation_flows")
        .update({
          name: updates.name,
          description: updates.description,
          stage_id: updates.stage_id,
          origin_id: updates.origin_id,
          trigger_on: updates.trigger_on,
          is_active: updates.is_active,
          respect_business_hours: updates.respect_business_hours,
          business_hours_start: updates.business_hours_start,
          business_hours_end: updates.business_hours_end,
          exclude_weekends: updates.exclude_weekends,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
      queryClient.invalidateQueries({ queryKey: ["automation-flow", data.id] });
      toast.success("Fluxo atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating flow:", error);
      toast.error("Erro ao atualizar fluxo");
    },
  });
}

export function useDeleteFlow() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      // First delete steps
      await supabase.from("automation_steps").delete().eq("flow_id", id);
      
      // Then delete flow
      const { error } = await supabase.from("automation_flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
      toast.success("Fluxo excluído com sucesso!");
    },
    onError: (error) => {
      console.error("Error deleting flow:", error);
      toast.error("Erro ao excluir fluxo");
    },
  });
}

export function useToggleFlowActive() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("automation_flows")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
    },
  });
}

export function useCreateStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (step: Partial<AutomationStep>) => {
      const { data, error } = await supabase
        .from("automation_steps")
        .insert({
          flow_id: step.flow_id!,
          template_id: step.template_id!,
          channel: step.channel!,
          delay_days: step.delay_days || 0,
          delay_hours: step.delay_hours || 0,
          delay_minutes: step.delay_minutes || 0,
          order_index: step.order_index || 0,
          conditions: step.conditions || {},
          is_active: step.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["automation-steps", data.flow_id] });
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
      toast.success("Passo adicionado!");
    },
    onError: (error) => {
      console.error("Error creating step:", error);
      toast.error("Erro ao adicionar passo");
    },
  });
}

export function useUpdateStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<AutomationStep> & { id: string }) => {
      const { data, error } = await supabase
        .from("automation_steps")
        .update({
          template_id: updates.template_id,
          channel: updates.channel,
          delay_days: updates.delay_days,
          delay_hours: updates.delay_hours,
          delay_minutes: updates.delay_minutes,
          order_index: updates.order_index,
          conditions: updates.conditions,
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
      queryClient.invalidateQueries({ queryKey: ["automation-steps", data.flow_id] });
      toast.success("Passo atualizado!");
    },
    onError: (error) => {
      console.error("Error updating step:", error);
      toast.error("Erro ao atualizar passo");
    },
  });
}

export function useDeleteStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, flowId }: { id: string; flowId: string }) => {
      const { error } = await supabase.from("automation_steps").delete().eq("id", id);
      if (error) throw error;
      return { flowId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["automation-steps", data.flowId] });
      queryClient.invalidateQueries({ queryKey: ["automation-flows"] });
      toast.success("Passo removido!");
    },
    onError: (error) => {
      console.error("Error deleting step:", error);
      toast.error("Erro ao remover passo");
    },
  });
}

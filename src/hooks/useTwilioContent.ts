import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ManageResp = { success: boolean; sid?: string; status?: string; error?: string; data?: unknown };

async function invokeManage(action: string, templateId?: string) {
  const { data, error } = await supabase.functions.invoke<ManageResp>("twilio-content-manage", {
    body: templateId ? { action, templateId } : { action },
  });
  if (error) throw new Error(error.message);
  if (data && !data.success) throw new Error(data.error || "Falha na chamada Twilio");
  return data!;
}

export function useCreateTwilioContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => invokeManage("create", templateId),
    onSuccess: (data, templateId) => {
      qc.invalidateQueries({ queryKey: ["automation-templates"] });
      qc.invalidateQueries({ queryKey: ["automation-template", templateId] });
      toast.success(`Template criado no Twilio${data.sid ? ` (${data.sid})` : ""}`);
    },
    onError: (e: Error) => toast.error(`Erro ao criar no Twilio: ${e.message}`),
  });
}

export function useSubmitTwilioContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => invokeManage("submit", templateId),
    onSuccess: (_d, templateId) => {
      qc.invalidateQueries({ queryKey: ["automation-templates"] });
      qc.invalidateQueries({ queryKey: ["automation-template", templateId] });
      toast.success("Template enviado para aprovação da Meta");
    },
    onError: (e: Error) => toast.error(`Erro ao submeter: ${e.message}`),
  });
}

export function useRefreshTwilioContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (templateId: string) => invokeManage("status", templateId),
    onSuccess: (data, templateId) => {
      qc.invalidateQueries({ queryKey: ["automation-templates"] });
      qc.invalidateQueries({ queryKey: ["automation-template", templateId] });
      toast.success(`Status atualizado: ${data.status ?? "—"}`);
    },
    onError: (e: Error) => toast.error(`Erro ao atualizar: ${e.message}`),
  });
}

export function useSyncAllTwilioStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        checked?: Array<{ id: string; status: string }>;
        error?: string;
      }>("twilio-content-status-poll", { body: {} });
      if (error) throw new Error(error.message);
      if (data && !data.success) throw new Error(data.error || "Falha na sincronização");
      return data!;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["automation-templates"] });
      const n = data.checked?.length ?? 0;
      const approved = data.checked?.filter((c) => c.status === "approved").length ?? 0;
      toast.success(`${n} template(s) verificado(s) — ${approved} aprovado(s)`);
    },
    onError: (e: Error) => toast.error(`Erro ao sincronizar: ${e.message}`),
  });
}
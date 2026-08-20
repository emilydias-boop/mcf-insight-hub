import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AgendadorOption {
  id: string;
  nome: string;
  email: string | null;
}

/**
 * Pessoas elegíveis a figurar como agendador de uma reunião (SDR, closer,
 * closer sombra, coordenação, gestão e admin, com acesso ativo).
 *
 * Vem por RPC porque `profiles` é fechado por RLS para SDR/closer — sem isso
 * o seletor apareceria vazio justamente para quem mais precisa corrigir.
 */
export function useAgendadoresDisponiveis(enabled = true) {
  return useQuery({
    queryKey: ["agendadores-disponiveis"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AgendadorOption[]> => {
      const { data, error } = await (supabase as any).rpc("listar_agendadores_disponiveis");
      if (error) throw error;
      return ((data || []) as any[]).map((p) => ({
        id: p.id,
        nome: p.full_name || p.email || "sem nome",
        email: p.email || null,
      }));
    },
  });
}

/** Última correção manual do agendador daquela reunião (para o selo de autoria). */
export function useAjusteAgendador(attendeeId: string | null | undefined) {
  return useQuery({
    queryKey: ["ajuste-agendador", attendeeId],
    enabled: !!attendeeId,
    staleTime: 30_000,
    queryFn: async (): Promise<{ em: string; por_nome: string; anterior_nome: string | null } | null> => {
      const { data, error } = await (supabase as any).rpc("agendador_ajuste_info", {
        p_attendee_id: attendeeId,
      });
      if (error) throw error;
      return (data as any) || null;
    },
  });
}

/**
 * Corrige quem agendou a reunião. Toda alteração é auditada no banco
 * (`audit_logs`, ação `attendee_booked_by_changed`) e bloqueada em mês fechado.
 */
export function useCorrigirAgendador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { attendeeId: string; bookedBy: string }) => {
      const { data, error } = await (supabase as any).rpc("corrigir_agendador_reuniao", {
        p_attendee_id: params.attendeeId,
        p_booked_by: params.bookedBy,
      });
      if (error) throw error;
      return data as { status: string };
    },
    onSuccess: (res) => {
      if (res?.status === "sem_mudanca") {
        toast.info("Este já era o agendador registrado.");
        return;
      }
      toast.success("Agendador da reunião corrigido.");
      queryClient.invalidateQueries({ queryKey: ["ajuste-agendador"] });
      queryClient.invalidateQueries({ queryKey: ["ajustes-vinculo"] });
      queryClient.invalidateQueries({ queryKey: ["agenda-data"] });
      queryClient.invalidateQueries({ queryKey: ["meeting-slots"] });
      queryClient.invalidateQueries({ queryKey: ["consorcio-agenda-fatos"] });
      queryClient.invalidateQueries({ queryKey: ["consorcio-cotas-contratadas"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao corrigir o agendador."),
  });
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Reconhecimento de venda FORA DO FUNIL.
 *
 * Existe cota contratada que nunca passou por R1 de Consórcio (venda que entrou
 * por outro caminho). Para essas, "Trocar lead" não tem como creditar SDR
 * nenhum: não existe reunião desta BU em nenhum lead do cliente. O
 * reconhecimento dá desfecho ao alerta com trilha de autoria.
 *
 * O que ele NÃO faz: não cria reunião, não preenche `booked_by`, não toca
 * `consortium_cards` nem `consorcio_pending_registrations`. Nenhuma métrica
 * (Consórcio Efetivado, Produção Gerada, Cotas Contratadas, Vendas Realizadas,
 * Ticket Médio) lê esta tabela — o efeito é apenas o recorte do alerta.
 *
 * Desfazer é SOFT: a linha permanece com `desfeito_em`/`desfeito_por` gravados
 * pela RPC `consorcio_desfazer_fora_funil`. Não há policy de UPDATE nem de
 * DELETE na tabela — a trilha do reconhecimento e a de quem desfez sobrevivem.
 */

export const MOTIVO_MIN = 10;

export function useReconhecerForaFunil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ cardId, motivo }: { cardId: string; motivo: string }) => {
      const texto = motivo.trim();
      if (texto.length < MOTIVO_MIN) {
        throw new Error(`Descreva o motivo com pelo menos ${MOTIVO_MIN} caracteres.`);
      }
      const { data: sessao } = await supabase.auth.getUser();
      const userId = sessao?.user?.id ?? null;
      if (!userId) throw new Error("Sessão expirada — entre novamente.");

      let nome: string | null = null;
      const { data: perfil } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      nome = perfil?.full_name ?? null;

      const { error } = await supabase.from("consorcio_cotas_fora_funil").insert({
        consortium_card_id: cardId,
        motivo: texto,
        reconhecido_por: userId,
        reconhecido_por_nome: nome,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcio-cotas-contratadas"] });
      toast.success("Venda reconhecida como fora do funil — a cota saiu das pendências.");
    },
    onError: (e: any) =>
      toast.error("Não foi possível reconhecer: " + (e?.message || "erro desconhecido")),
  });
}

export function useDesfazerForaFunil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("consorcio_desfazer_fora_funil", { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["consorcio-cotas-contratadas"] });
      toast.success("Reconhecimento desfeito — a cota volta às pendências (trilha preservada).");
    },
    onError: (e: any) =>
      toast.error("Não foi possível desfazer: " + (e?.message || "erro desconhecido")),
  });
}

-- Sinalizacao de pedido de saida: o lead pede para parar de receber mensagens e o
-- sistema so SINALIZA para o SDR decidir. Nada de opt-out automatico.
ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS pedido_saida_em timestamptz NULL;

COMMENT ON COLUMN public.wa_conversations.pedido_saida_em IS
  'Quando o webhook detectou pedido de descadastro na mensagem recebida. Apenas sinalizacao: o opt-out real e registrado manualmente pelo SDR via wa_register_opt_out.';
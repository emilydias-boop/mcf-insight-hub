-- Adicionar política RLS para permitir leitura pública dos webhook_events
-- Isso é necessário para que a TV em modo público (sem login) possa visualizar os dados

CREATE POLICY "Todos podem visualizar webhook_events"
ON public.webhook_events
FOR SELECT
USING (true);
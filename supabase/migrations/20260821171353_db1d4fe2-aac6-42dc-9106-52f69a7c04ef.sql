-- Bug em produção: SDR não consegue iniciar/pausar/retomar/cancelar disparo.
-- Causa raiz: a política de UPDATE `broadcast_update_dono_rascunho` só tinha USING,
-- sem WITH CHECK explícito. No Postgres, UPDATE sem WITH CHECK reaplica a expressão
-- do USING à linha NOVA. Como o USING só aceitava status em
-- ('rascunho','pausado','aguardando'), qualquer transição para 'enviando' (ou 'cancelado',
-- 'concluido') era rejeitada na linha nova → 42501 → 403 no PostgREST.
-- Admin/manager escapavam pelo ramo has_role, por isso o bug só aparecia com SDR.
--
-- Correção: USING e WITH CHECK explícitos e distintos.
--   USING     → quais linhas o dono pode tocar (status ainda "vivo").
--   WITH CHECK → como a linha pode ficar depois do update (qualquer status final).
-- NÃO simplificar removendo o WITH CHECK — sem ele o bug volta (ver histórico).

DROP POLICY IF EXISTS broadcast_update_dono_rascunho ON public.wa_broadcasts;

CREATE POLICY broadcast_update_dono_rascunho
ON public.wa_broadcasts
FOR UPDATE
TO authenticated
USING (
  (
    criado_por = auth.uid()
    AND status IN ('rascunho','aguardando','enviando','pausado')
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
)
WITH CHECK (
  -- WITH CHECK explícito: a linha nova pode ter qualquer status final
  -- (enviando, cancelado, concluido), mas o dono NÃO pode transferir
  -- a propriedade para outro usuário no mesmo update.
  (
    criado_por = auth.uid()
    AND status IN ('rascunho','aguardando','enviando','pausado','cancelado','concluido')
  )
  OR public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'manager')
);
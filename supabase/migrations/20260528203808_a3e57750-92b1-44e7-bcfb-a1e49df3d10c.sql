UPDATE public.consorcio_pending_registrations AS r
SET
  status = 'cota_aberta',
  consortium_card_id = c.id,
  categoria = COALESCE(r.categoria, c.categoria),
  grupo = COALESCE(r.grupo, c.grupo),
  cota = COALESCE(r.cota, c.cota),
  dia_vencimento = COALESCE(r.dia_vencimento, c.dia_vencimento),
  data_contratacao = COALESCE(r.data_contratacao, c.data_contratacao),
  origem = COALESCE(r.origem, c.origem),
  origem_detalhe = COALESCE(r.origem_detalhe, c.origem_detalhe),
  vendedor_id = COALESCE(r.vendedor_id, c.vendedor_id),
  vendedor_name_cota = COALESCE(r.vendedor_name_cota, c.vendedor_name),
  updated_at = now()
FROM public.consortium_cards AS c
WHERE r.status = 'aguardando_abertura'
  AND r.consortium_card_id IS NULL
  AND c.created_at >= r.updated_at - interval '5 minutes'
  AND c.created_at <= r.updated_at + interval '30 minutes'
  AND c.valor_credito = r.valor_credito
  AND (
    (r.cpf IS NOT NULL AND c.cpf IS NOT NULL AND regexp_replace(r.cpf, '\\D', '', 'g') = regexp_replace(c.cpf, '\\D', '', 'g'))
    OR
    (r.cnpj IS NOT NULL AND c.cnpj IS NOT NULL AND regexp_replace(r.cnpj, '\\D', '', 'g') = regexp_replace(c.cnpj, '\\D', '', 'g'))
  );
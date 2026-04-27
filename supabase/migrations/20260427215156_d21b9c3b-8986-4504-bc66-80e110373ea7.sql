CREATE OR REPLACE FUNCTION public.build_consorcio_sale_webhook_payload(card public.consortium_cards, event_name text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  destination_event text;
  payload jsonb;
BEGIN
  destination_event := CASE
    WHEN event_name LIKE 'consorcio.venda.%' THEN 'venda.criada'
    WHEN event_name LIKE 'consorcio.comissao.%' THEN 'comissao.paga'
    ELSE event_name
  END;

  payload := jsonb_build_object(
    'event', destination_event,
    'source', 'consorcio',
    'external_id', card.id::text,
    'occurred_at', now(),
    'grupo', card.grupo,
    'cota', card.cota,
    'valor_credito', card.valor_credito,
    'valor_carta_credito', card.valor_credito,
    'prazo_meses', card.prazo_meses,
    'tipo_produto', card.tipo_produto,
    'tipo_plano', card.tipo_produto,
    'tipo_contrato', card.tipo_contrato,
    'parcelas_pagas_empresa', card.parcelas_pagas_empresa,
    'data_contratacao', card.data_contratacao,
    'data_venda', card.data_contratacao,
    'dia_vencimento', card.dia_vencimento,
    'dia_assembleia', card.dia_vencimento,
    'origem', card.origem,
    'origem_detalhe', card.origem_detalhe,
    'tipo_pessoa', card.tipo_pessoa,
    'nome_completo', card.nome_completo,
    'nome_comprador', COALESCE(NULLIF(card.nome_completo, ''), NULLIF(card.razao_social, '')),
    'cpf', card.cpf,
    'cpf_comprador', card.cpf
  );

  payload := payload || jsonb_build_object(
    'email', card.email,
    'email_comprador', COALESCE(NULLIF(card.email, ''), NULLIF(card.email_comercial, '')),
    'telefone', card.telefone,
    'telefone_comprador', COALESCE(NULLIF(card.telefone, ''), NULLIF(card.telefone_comercial, '')),
    'razao_social', card.razao_social,
    'razao_social_comprador', card.razao_social,
    'cnpj', card.cnpj,
    'cnpj_comprador', card.cnpj,
    'vendedor_email', NULL,
    'vendedor_name', card.vendedor_name,
    'nome_vendedor', card.vendedor_name,
    'internal_event', event_name,
    'parcela_1a_12a', card.parcela_1a_12a,
    'parcela_demais', card.parcela_demais,
    'condicao_pagamento', card.condicao_pagamento,
    'inclui_seguro_vida', card.inclui_seguro_vida,
    'produto_embracon', card.produto_embracon,
    'status', card.status,
    'categoria', card.categoria,
    'email_comercial', card.email_comercial,
    'telefone_comercial', card.telefone_comercial,
    'observacoes', card.observacoes
  );

  payload := payload || jsonb_build_object(
    'comprador', jsonb_build_object(
      'tipo_pessoa', card.tipo_pessoa,
      'nome', COALESCE(NULLIF(card.nome_completo, ''), NULLIF(card.razao_social, '')),
      'cpf', card.cpf,
      'email', COALESCE(NULLIF(card.email, ''), NULLIF(card.email_comercial, '')),
      'telefone', COALESCE(NULLIF(card.telefone, ''), NULLIF(card.telefone_comercial, '')),
      'razao_social', card.razao_social,
      'cnpj', card.cnpj,
      'email_comercial', card.email_comercial,
      'telefone_comercial', card.telefone_comercial
    ),
    'vendedor', jsonb_build_object(
      'id', card.vendedor_id,
      'nome', card.vendedor_name
    ),
    'comissao', jsonb_build_object(
      'valor', card.valor_comissao
    ),
    'origem_obj', jsonb_build_object(
      'tipo', card.origem,
      'detalhe', card.origem_detalhe
    ),
    'contemplacao', jsonb_build_object(
      'numero', card.numero_contemplacao,
      'data', card.data_contemplacao,
      'motivo', card.motivo_contemplacao,
      'valor_lance', card.valor_lance,
      'percentual_lance', card.percentual_lance
    ),
    'transferencia', jsonb_build_object(
      'e_transferencia', card.e_transferencia,
      'transferido_de', card.transferido_de
    ),
    'timestamps', jsonb_build_object(
      'created_at', card.created_at,
      'updated_at', card.updated_at
    )
  );

  RETURN payload;
END;
$function$;
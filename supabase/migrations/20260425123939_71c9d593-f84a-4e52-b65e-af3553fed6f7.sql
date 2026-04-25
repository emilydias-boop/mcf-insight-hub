CREATE OR REPLACE FUNCTION public.build_consorcio_sale_webhook_payload(card consortium_cards, event_name text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN jsonb_build_object(
    -- Campos no schema raiz esperado por webhook-consorcio (destino Grima)
    'grupo', card.grupo,
    'cota', card.cota,
    'valor_credito', card.valor_credito,
    'prazo_meses', card.prazo_meses,
    'tipo_produto', card.tipo_produto,
    'tipo_contrato', card.tipo_contrato,
    'parcelas_pagas_empresa', card.parcelas_pagas_empresa,
    'data_contratacao', card.data_contratacao,
    'dia_vencimento', card.dia_vencimento,
    'origem', card.origem,
    'origem_detalhe', card.origem_detalhe,
    'tipo_pessoa', card.tipo_pessoa,
    'nome_completo', card.nome_completo,
    'cpf', card.cpf,
    'email', card.email,
    'telefone', card.telefone,
    'razao_social', card.razao_social,
    'cnpj', card.cnpj,
    'vendedor_email', NULL,
    'vendedor_name', card.vendedor_name,

    -- Metadados estendidos (ignorados por destinos que só leem o schema raiz,
    -- úteis para integrações futuras como Make/Zapier)
    'event', event_name,
    'source', 'consorcio',
    'external_id', card.id::text,
    'occurred_at', now(),
    'tipo_plano', card.tipo_produto,
    'valor_carta_credito', card.valor_credito,
    'data_venda', card.data_contratacao,
    'dia_assembleia', card.dia_vencimento,
    'parcela_1a_12a', card.parcela_1a_12a,
    'parcela_demais', card.parcela_demais,
    'condicao_pagamento', card.condicao_pagamento,
    'inclui_seguro_vida', card.inclui_seguro_vida,
    'produto_embracon', card.produto_embracon,
    'status', card.status,
    'categoria', card.categoria,
    'email_comercial', card.email_comercial,
    'telefone_comercial', card.telefone_comercial,
    'comprador', jsonb_build_object(
      'tipo_pessoa', card.tipo_pessoa,
      'nome', card.nome_completo,
      'cpf', card.cpf,
      'email', card.email,
      'telefone', card.telefone,
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
    'observacoes', card.observacoes,
    'timestamps', jsonb_build_object(
      'created_at', card.created_at,
      'updated_at', card.updated_at
    )
  );
END;
$function$;
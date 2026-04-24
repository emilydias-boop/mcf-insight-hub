-- 1) Função que monta payload de venda de consórcio
CREATE OR REPLACE FUNCTION public.build_consorcio_sale_webhook_payload(
  card public.consortium_cards,
  event_name text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN jsonb_build_object(
    'event', event_name,
    'source', 'consorcio',
    'external_id', card.id::text,
    'grupo', card.grupo,
    'cota', card.cota,
    'tipo_plano', card.tipo_produto,
    'tipo_contrato', card.tipo_contrato,
    'valor_carta_credito', card.valor_credito,
    'prazo_meses', card.prazo_meses,
    'data_venda', card.data_contratacao,
    'dia_assembleia', card.dia_vencimento,
    'parcelas_pagas_empresa', card.parcelas_pagas_empresa,
    'parcela_1a_12a', card.parcela_1a_12a,
    'parcela_demais', card.parcela_demais,
    'condicao_pagamento', card.condicao_pagamento,
    'inclui_seguro_vida', card.inclui_seguro_vida,
    'produto_embracon', card.produto_embracon,
    'status', card.status,
    'categoria', card.categoria,
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
    'origem', jsonb_build_object(
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
$$;

-- 2) Trigger function que enfileira o webhook
CREATE OR REPLACE FUNCTION public.enqueue_outbound_consorcio_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg RECORD;
  evt TEXT;
  payload JSONB;
  is_relevant_update BOOLEAN := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    evt := 'consorcio.venda.criada';
  ELSIF TG_OP = 'UPDATE' THEN
    -- Cancelamento explícito
    IF NEW.status = 'cancelado' AND COALESCE(OLD.status,'') <> 'cancelado' THEN
      evt := 'consorcio.venda.cancelada';
    ELSE
      -- Apenas dispara "atualizada" se mudaram campos relevantes
      is_relevant_update :=
        NEW.status IS DISTINCT FROM OLD.status
        OR NEW.valor_credito IS DISTINCT FROM OLD.valor_credito
        OR NEW.valor_comissao IS DISTINCT FROM OLD.valor_comissao
        OR NEW.parcelas_pagas_empresa IS DISTINCT FROM OLD.parcelas_pagas_empresa
        OR NEW.numero_contemplacao IS DISTINCT FROM OLD.numero_contemplacao
        OR NEW.data_contemplacao IS DISTINCT FROM OLD.data_contemplacao
        OR NEW.valor_lance IS DISTINCT FROM OLD.valor_lance
        OR NEW.tipo_produto IS DISTINCT FROM OLD.tipo_produto
        OR NEW.grupo IS DISTINCT FROM OLD.grupo
        OR NEW.cota IS DISTINCT FROM OLD.cota;

      IF NOT is_relevant_update THEN
        RETURN NEW;
      END IF;
      evt := 'consorcio.venda.atualizada';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  payload := public.build_consorcio_sale_webhook_payload(NEW, evt);

  FOR cfg IN
    SELECT * FROM public.outbound_webhook_configs
    WHERE is_active = true
      AND evt = ANY(events)
      AND 'consorcio' = ANY(sources)
  LOOP
    INSERT INTO public.outbound_webhook_queue (config_id, event, transaction_id, payload)
    VALUES (cfg.id, evt, NEW.id, payload);
  END LOOP;

  RETURN NEW;
END;
$$;

-- 3) Trigger
DROP TRIGGER IF EXISTS trg_enqueue_outbound_consorcio_webhook ON public.consortium_cards;
CREATE TRIGGER trg_enqueue_outbound_consorcio_webhook
AFTER INSERT OR UPDATE ON public.consortium_cards
FOR EACH ROW
EXECUTE FUNCTION public.enqueue_outbound_consorcio_webhook();
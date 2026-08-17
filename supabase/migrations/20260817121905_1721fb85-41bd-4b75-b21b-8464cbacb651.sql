-- a) tipo no modelo
ALTER TABLE public.consorcio_termo_modelos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'adesao';

CREATE UNIQUE INDEX IF NOT EXISTS consorcio_termo_modelos_um_ativo_por_tipo
  ON public.consorcio_termo_modelos (tipo) WHERE ativo;

-- b) termos: tipo, card_id, visualização
ALTER TABLE public.consorcio_termos
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'adesao',
  ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.consortium_cards(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS visualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS visualizado_ip text;

CREATE INDEX IF NOT EXISTS consorcio_termos_card_id_idx ON public.consorcio_termos (card_id);
CREATE INDEX IF NOT EXISTS consorcio_termos_tipo_idx ON public.consorcio_termos (tipo);

-- c) número do contrato na Embracon
ALTER TABLE public.consortium_cards
  ADD COLUMN IF NOT EXISTS contrato_embracon text;

-- d) modelo inicial do comprovante
INSERT INTO public.consorcio_termo_modelos (nome, conteudo, versao, ativo, tipo)
SELECT
  'Comprovante de Cadastro na Embracon',
$md$# Comprovante de Cadastro de Cota

## Identificação do cliente

**Nome / Razão social:** {{cliente_nome}}
**CPF / CNPJ:** {{cliente_documento}}
**Telefone:** {{cliente_telefone}}
**E-mail:** {{cliente_email}}
**Endereço:** {{cliente_endereco}}

## Dados da cota

**Administradora:** {{administradora}}
**Produto:** {{produto}}
**Objetivo do crédito:** {{objetivo}}
**Grupo:** {{grupo}}
**Cota:** {{cota}}
**Contrato Embracon:** {{contrato_embracon}}
**Valor do crédito:** {{valor_credito}}
**Prazo:** {{prazo}} meses
**Condição de pagamento:** {{condicao_pagamento}}
**Dia de vencimento:** {{dia_vencimento}}

## Cronograma das 12 primeiras parcelas

{{cronograma_12}}

**Parcelas sob responsabilidade da MCF Capital:** {{parcelas_mcf_qtd}} — total de {{parcelas_mcf_total}}
**Parcelas sob responsabilidade do cliente neste período:** {{parcelas_cliente_qtd}}

## Observações

Este documento comprova o cadastro da cota acima na {{administradora}} e o compromisso da MCF Capital com o pagamento das parcelas indicadas como de sua responsabilidade. Ele não substitui o contrato firmado com a administradora, que permanece o instrumento que rege o consórcio.

Eventuais reajustes aplicados pela administradora podem alterar os valores das parcelas seguintes.

Documento emitido em {{data_emissao}}.
$md$,
  1, true, 'comprovante_cadastro'
WHERE NOT EXISTS (
  SELECT 1 FROM public.consorcio_termo_modelos WHERE tipo = 'comprovante_cadastro'
);
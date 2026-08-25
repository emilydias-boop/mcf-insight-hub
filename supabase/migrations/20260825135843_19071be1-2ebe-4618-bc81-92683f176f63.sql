UPDATE public.consorcio_termo_modelos SET ativo = false WHERE tipo = 'adesao' AND ativo;

INSERT INTO public.consorcio_termo_modelos (nome, conteudo, versao, ativo, tipo)
SELECT
  'Termo de Adesão e Compromisso — Consórcio',
  $tpl$# TERMO DE ADESÃO E COMPROMISSO — CONSÓRCIO

Emitido em {{data_emissao}}

## 1. IDENTIFICAÇÃO DO CONSORCIADO

**Nome / Razão Social:** {{cliente_nome}}
**CPF / CNPJ:** {{cliente_documento}}
**Telefone:** {{cliente_telefone}}
**E-mail:** {{cliente_email}}
**Endereço:** {{cliente_endereco}}

## 2. OBJETO DA CONTRATAÇÃO

O consorciado acima identificado declara ter contratado, junto à administradora **{{administradora}}**, cota de consórcio com as seguintes características:

**Produto:** {{produto}}
**Objetivo do crédito:** {{objetivo}}
**Valor do crédito contratado:** {{valor_credito}}
**Prazo:** {{prazo}} meses
**Condição de pagamento:** {{condicao_pagamento}}
**Valor da parcela (1ª à 12ª):** {{parcela_1a_12a}}
**Valor das demais parcelas:** {{parcela_demais}}
**Dia de vencimento:** {{dia_vencimento_texto}}
**Tipo de contrato:** {{tipo_contrato}}

## 3. COMPROMISSO DA MCF CAPITAL

{{clausula_mcf}}

## 4. DECLARAÇÕES DO CONSORCIADO

O consorciado declara, expressamente, que:

1. Compreende que **consórcio não é investimento nem financiamento**, tratando-se de sistema de autofinanciamento em grupo regido pela Lei 11.795/2008;
2. Compreende que **não há garantia de contemplação** em prazo determinado, ocorrendo a contemplação exclusivamente por sorteio ou lance, conforme regulamento do grupo;
3. Está ciente de que **as parcelas não cobertas pelo compromisso da MCF Capital são de sua inteira responsabilidade**, e que a inadimplência pode implicar exclusão do grupo e demais consequências previstas em contrato;
4. **Leu e concorda** com as condições gerais do contrato de participação em grupo de consórcio da administradora, bem como com os valores, prazos e encargos aqui descritos;
5. Recebeu todas as informações necessárias e as presta de forma livre, consciente e de boa-fé.

## 5. ASSINATURA ELETRÔNICA

Este termo é assinado eletronicamente. A assinatura eletrônica aqui coletada tem validade jurídica nos termos da **Medida Provisória nº 2.200-2/2001** e da **Lei nº 14.063/2020**, ficando registrados nome, documento, data, hora, endereço IP e o resumo criptográfico (hash SHA-256) do conteúdo lido pelo signatário.
$tpl$,
  COALESCE(MAX(versao), 0) + 1,
  true,
  'adesao'
FROM public.consorcio_termo_modelos WHERE tipo = 'adesao';
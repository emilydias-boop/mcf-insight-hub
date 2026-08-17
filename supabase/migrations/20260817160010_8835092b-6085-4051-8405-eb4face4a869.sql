-- Nova versão dos modelos de documentos do Consórcio, ajustada ao papel institucional.
-- Somente dados: nenhuma alteração de estrutura ou de permissões.
-- As versões anteriores continuam gravadas (documentos já emitidos apontam para elas).

UPDATE public.consorcio_termo_modelos SET ativo = false WHERE ativo AND tipo = 'adesao';

INSERT INTO public.consorcio_termo_modelos (nome, conteudo, versao, ativo, tipo)
SELECT
  'Termo de Adesão — Consórcio Embracon',
  '# TERMO DE ADESÃO E COMPROMISSO — CONSÓRCIO

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
**Dia de vencimento:** dia {{dia_vencimento}}
**Tipo de contrato:** {{tipo_contrato}}

## 3. COMPROMISSO DA MCF CAPITAL

A **MCF Capital** assume, de forma irrevogável, o compromisso de efetuar o pagamento de **{{parcelas_mcf_qtd}}** parcelas da cota acima descrita, conforme a tabela abaixo, totalizando **{{parcelas_mcf_total}}**:

{{parcelas_mcf_lista}}

O pagamento será realizado diretamente à administradora, nas datas de vencimento das respectivas parcelas. As demais parcelas do plano são de responsabilidade exclusiva do consorciado.

## 4. DECLARAÇÕES DO CONSORCIADO

O consorciado declara, expressamente, que:

1. Compreende que **consórcio não é investimento nem financiamento**, tratando-se de sistema de autofinanciamento em grupo regido pela Lei 11.795/2008;
2. Compreende que **não há garantia de contemplação** em prazo determinado, ocorrendo a contemplação exclusivamente por sorteio ou lance, conforme regulamento do grupo;
3. Está ciente de que **as parcelas não cobertas pelo compromisso da MCF Capital são de sua inteira responsabilidade**, e que a inadimplência pode implicar exclusão do grupo e demais consequências previstas em contrato;
4. **Leu e concorda** com as condições gerais do contrato de participação em grupo de consórcio da administradora, bem como com os valores, prazos e encargos aqui descritos;
5. Recebeu todas as informações necessárias e as presta de forma livre, consciente e de boa-fé.

## 5. ASSINATURA ELETRÔNICA

Este termo é assinado eletronicamente. A assinatura eletrônica aqui coletada tem validade jurídica nos termos da **Medida Provisória nº 2.200-2/2001** e da **Lei nº 14.063/2020**, ficando registrados nome, documento, data, hora, endereço IP e o resumo criptográfico (hash SHA-256) do conteúdo lido pelo signatário.
',
  COALESCE(MAX(versao), 0) + 1,
  true,
  'adesao'
FROM public.consorcio_termo_modelos WHERE tipo = 'adesao';

UPDATE public.consorcio_termo_modelos SET ativo = false WHERE ativo AND tipo = 'comprovante_cadastro';

INSERT INTO public.consorcio_termo_modelos (nome, conteudo, versao, ativo, tipo)
SELECT
  'Comprovante de Cadastro na Embracon',
  '# COMPROVANTE DE CADASTRO DE COTA

Emitido em {{data_emissao}}

## 1. IDENTIFICAÇÃO DO CLIENTE

**Nome / Razão social:** {{cliente_nome}}
**CPF / CNPJ:** {{cliente_documento}}
**Telefone:** {{cliente_telefone}}
**E-mail:** {{cliente_email}}
**Endereço:** {{cliente_endereco}}

## 2. DADOS DA COTA

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

## 3. CRONOGRAMA DAS PRIMEIRAS {{cronograma_qtd}} PARCELAS

{{cronograma_12}}

**Parcelas sob responsabilidade da MCF Capital:** {{parcelas_mcf_qtd}} — total de {{parcelas_mcf_total}}
**Parcelas sob responsabilidade do cliente neste período:** {{parcelas_cliente_qtd}}

## 4. OBSERVAÇÕES

Este documento comprova o cadastro da cota acima na {{administradora}} e o compromisso da MCF Capital com o pagamento das parcelas indicadas como de sua responsabilidade. Ele não substitui o contrato firmado com a administradora, que permanece o instrumento que rege o consórcio.

Eventuais reajustes aplicados pela administradora podem alterar os valores das parcelas seguintes.
',
  COALESCE(MAX(versao), 0) + 1,
  true,
  'comprovante_cadastro'
FROM public.consorcio_termo_modelos WHERE tipo = 'comprovante_cadastro';
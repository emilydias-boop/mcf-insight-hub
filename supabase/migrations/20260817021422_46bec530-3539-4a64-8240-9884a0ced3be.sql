CREATE TABLE public.consorcio_termo_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  conteudo text NOT NULL,
  versao int NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consorcio_termo_modelos TO authenticated;
GRANT ALL ON public.consorcio_termo_modelos TO service_role;
ALTER TABLE public.consorcio_termo_modelos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view termo modelos"
  ON public.consorcio_termo_modelos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can insert termo modelos"
  ON public.consorcio_termo_modelos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role,'manager'::app_role,'coordenador'::app_role])));
CREATE POLICY "Managers can update termo modelos"
  ON public.consorcio_termo_modelos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role,'manager'::app_role,'coordenador'::app_role])));
CREATE POLICY "Managers can delete termo modelos"
  ON public.consorcio_termo_modelos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role,'manager'::app_role,'coordenador'::app_role])));

CREATE TABLE public.consorcio_termos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pending_registration_id uuid REFERENCES public.consorcio_pending_registrations(id) ON DELETE CASCADE,
  proposal_id uuid,
  deal_id uuid,
  modelo_id uuid REFERENCES public.consorcio_termo_modelos(id),
  modelo_versao int,
  access_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  dados_snapshot jsonb NOT NULL,
  conteudo_renderizado text NOT NULL,
  conteudo_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  assinado_em timestamptz,
  assinante_nome text,
  assinante_cpf text,
  assinante_ip text,
  assinante_user_agent text,
  cancelado_em timestamptz,
  cancelado_por uuid,
  cancelado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_consorcio_termos_pending ON public.consorcio_termos(pending_registration_id);
CREATE INDEX idx_consorcio_termos_token ON public.consorcio_termos(access_token);
CREATE INDEX idx_consorcio_termos_status ON public.consorcio_termos(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consorcio_termos TO authenticated;
GRANT ALL ON public.consorcio_termos TO service_role;
ALTER TABLE public.consorcio_termos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view termos"
  ON public.consorcio_termos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert termos"
  ON public.consorcio_termos FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Managers can update termos"
  ON public.consorcio_termos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role,'manager'::app_role,'coordenador'::app_role])) OR auth.uid() = created_by);
CREATE POLICY "Managers can delete termos"
  ON public.consorcio_termos FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = ANY (ARRAY['admin'::app_role,'manager'::app_role,'coordenador'::app_role])));

INSERT INTO public.consorcio_termo_modelos (nome, conteudo, versao, ativo)
VALUES (
'Termo de Adesão — Consórcio Embracon',
$MODELO$# TERMO DE ADESÃO E COMPROMISSO — CONSÓRCIO

Emitido em {{data_emissao}}

## 1. IDENTIFICAÇÃO DO CONSORCIADO

**Nome / Razão Social:** {{cliente_nome}}
**CPF / CNPJ:** {{cliente_documento}}
**Telefone:** {{cliente_telefone}}
**E-mail:** {{cliente_email}}
**Endereço:** {{cliente_endereco}}

## 2. OBJETO DA CONTRATAÇÃO

O consorciado acima identificado declara ter contratado, junto à administradora **{{administradora}}**, cota de consórcio com as seguintes características:

- **Produto:** {{produto}}
- **Objetivo do crédito:** {{objetivo}}
- **Valor do crédito contratado:** {{valor_credito}}
- **Prazo:** {{prazo}} meses
- **Condição de pagamento:** {{condicao_pagamento}}
- **Valor da parcela (1ª à 12ª):** {{parcela_1a_12a}}
- **Valor das demais parcelas:** {{parcela_demais}}
- **Dia de vencimento:** dia {{dia_vencimento}}
- **Tipo de contrato:** {{tipo_contrato}}

## 3. COMPROMISSO DA MCF CAPITAL

A **MCF Capital** assume, de forma irrevogável, o compromisso de efetuar o pagamento de **{{parcelas_mcf_qtd}}** parcelas da cota acima descrita, conforme discriminado abaixo, totalizando **{{parcelas_mcf_total}}**:

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
$MODELO$,
1,
true
);
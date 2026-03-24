
INSERT INTO webhook_endpoints (slug, name, description, origin_id, stage_id, auto_tags, field_mapping, required_fields, is_active)
VALUES (
  'anamnese-mcf',
  'Anamnese MCF',
  'Webhook de anamnese MCF (fonte principal)',
  'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  'd346320a-00b0-4e9f-89b6-149ad1c34061',
  ARRAY['ANAMNESE'],
  '{"esporteHobby":"esporte_hobby","faixaAporte":"faixa_aporte","faixaAporteDescricao":"faixa_aporte_descricao","fonteRenda":"fonte_renda","gostaFutebol":"gosta_futebol","imovelFinanciado":"imovel_financiado","interesseHolding":"interesse_holding","isEmpresario":"is_empresario","nome_completo":"name","objetivosPrincipais":"objetivos_principais","perfilIndicacao":"perfil_indicacao","portEmpresa":"porte_empresa","possuiCarro":"possui_carro","possuiConsorcio":"possui_consorcio","possuiDivida":"possui_divida","possuiSeguros":"possui_seguros","precisaCapitalGiro":"precisa_capital_giro","rendaBruta":"renda_bruta","rendaPassivaMeta":"renda_passiva_meta","saldoFGTS":"saldo_fgts","telefone":"phone","tempoIndependencia":"tempo_independencia","timeFutebol":"time_futebol","valorCapitalGiro":"valor_capital_giro","valorInvestido":"valor_investido"}'::jsonb,
  ARRAY['name'],
  true
),
(
  'anamnese-insta-mcf',
  'Anamnese Instagram MCF',
  'Webhook de anamnese via Instagram MCF',
  'e3c04f21-ba2c-4c66-84f8-b4341c826b1c',
  'd346320a-00b0-4e9f-89b6-149ad1c34061',
  ARRAY['ANAMNESE-INSTA'],
  '{"esporteHobby":"esporte_hobby","faixaAporte":"faixa_aporte","faixaAporteDescricao":"faixa_aporte_descricao","fonteRenda":"fonte_renda","gostaFutebol":"gosta_futebol","imovelFinanciado":"imovel_financiado","interesseHolding":"interesse_holding","isEmpresario":"is_empresario","nome_completo":"name","objetivosPrincipais":"objetivos_principais","perfilIndicacao":"perfil_indicacao","portEmpresa":"porte_empresa","possuiCarro":"possui_carro","possuiConsorcio":"possui_consorcio","possuiDivida":"possui_divida","possuiSeguros":"possui_seguros","precisaCapitalGiro":"precisa_capital_giro","rendaBruta":"renda_bruta","rendaPassivaMeta":"renda_passiva_meta","saldoFGTS":"saldo_fgts","telefone":"phone","tempoIndependencia":"tempo_independencia","timeFutebol":"time_futebol","valorCapitalGiro":"valor_capital_giro","valorInvestido":"valor_investido"}'::jsonb,
  ARRAY['name'],
  true
);

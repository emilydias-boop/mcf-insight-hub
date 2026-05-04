UPDATE public.webhook_endpoints
SET
  required_fields = ARRAY['name']::text[],
  field_mapping = '{
    "nome_completo": "name",
    "telefone": "phone",
    "rendaBruta": "renda_bruta",
    "rendaPassivaMeta": "renda_passiva_meta",
    "faixaAporte": "faixa_aporte",
    "faixaAporteDescricao": "faixa_aporte_descricao",
    "fonteRenda": "fonte_renda",
    "isEmpresario": "is_empresario",
    "portEmpresa": "porte_empresa",
    "objetivosPrincipais": "objetivos_principais",
    "perfilIndicacao": "perfil_indicacao",
    "interesseHolding": "interesse_holding",
    "tempoIndependencia": "tempo_independencia",
    "valorInvestido": "valor_investido",
    "valorCapitalGiro": "valor_capital_giro",
    "precisaCapitalGiro": "precisa_capital_giro",
    "possuiCarro": "possui_carro",
    "possuiConsorcio": "possui_consorcio",
    "possuiSeguros": "possui_seguros",
    "possuiDivida": "possui_divida",
    "imovelFinanciado": "imovel_financiado",
    "saldoFGTS": "saldo_fgts",
    "esporteHobby": "esporte_hobby",
    "gostaFutebol": "gosta_futebol",
    "timeFutebol": "time_futebol"
  }'::jsonb,
  description = 'Webhook ClientData (mesmo payload do clientdata-inside) — pipeline Alfredo',
  updated_at = now()
WHERE id = '7f693994-cd5c-4f9f-98a3-14b2d8d2a3fe';

UPDATE public.webhook_endpoints
SET is_active = false, updated_at = now()
WHERE id = '65f2a4d5-d4a0-4eb2-b7a0-d64ed9ff8e60';
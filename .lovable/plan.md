## Objetivo
Igualar o endpoint `alfredo` (slug `alfredo`) ao endpoint `clientdata-inside`, para que ambos aceitem e processem o mesmo payload do ClientData (camelCase + snake_case), mantendo cada um sua própria pipeline/origin/stage e suas tags.

## Estado atual

| Campo | clientdata-inside | alfredo (hoje) |
|---|---|---|
| `required_fields` | `["name"]` | `["name","email"]` |
| `field_mapping` | mapeamento camelCase → snake_case (rendaBruta, telefone, nome_completo, etc.) | `{}` (vazio) |
| `auto_tags` | `["ANAMNESE"]` | `["Alfredo"]` |
| `origin_id` / `stage_id` | Inside Sales / stage Base Inside | Pipeline Alfredo / stage própria |

O `webhook-lead-receiver` aplica `field_mapping` antes da validação (linhas 138-145), então copiar o mapping resolve a normalização do payload sem mudar código.

## Migração proposta (única alteração necessária)

Atualizar a linha do endpoint `alfredo` (id `7f693994-cd5c-4f9f-98a3-14b2d8d2a3fe`) na tabela `webhook_endpoints`:

- `required_fields` → `["name"]` (ClientData nem sempre envia email — vide payloads recentes do `clientdata-inside`)
- `field_mapping` → mesmo objeto do clientdata-inside:
  ```
  nome_completo → name
  telefone → phone
  rendaBruta → renda_bruta
  rendaPassivaMeta → renda_passiva_meta
  faixaAporte → faixa_aporte
  faixaAporteDescricao → faixa_aporte_descricao
  fonteRenda → fonte_renda
  isEmpresario → is_empresario
  portEmpresa → porte_empresa
  objetivosPrincipais → objetivos_principais
  perfilIndicacao → perfil_indicacao
  interesseHolding → interesse_holding
  tempoIndependencia → tempo_independencia
  valorInvestido → valor_investido
  valorCapitalGiro → valor_capital_giro
  precisaCapitalGiro → precisa_capital_giro
  possuiCarro → possui_carro
  possuiConsorcio → possui_consorcio
  possuiSeguros → possui_seguros
  possuiDivida → possui_divida
  imovelFinanciado → imovel_financiado
  saldoFGTS → saldo_fgts
  esporteHobby → esporte_hobby
  gostaFutebol → gosta_futebol
  timeFutebol → time_futebol
  ```
- `description` → "Webhook ClientData (mesmo payload do clientdata-inside) — pipeline Alfredo"
- **Mantidos**: `auto_tags = ["Alfredo"]`, `origin_id`, `stage_id`, `slug`, `name`.

## O que NÃO muda
- Código da edge function `webhook-lead-receiver` (já lê `field_mapping` do banco).
- Endpoint `clientdata-inside` permanece intacto.
- Endpoint `alfredo2` (criado hoje 23:10) — sugiro **desativar** (`is_active = false`) para não duplicar ingestão; confirmar antes.

## Validação pós-mudança
1. Disparar payload de teste no slug `alfredo` com formato camelCase do ClientData.
2. Conferir em `webhook_events` (event_type `lead.received.alfredo`) que o lead foi processado com `status=success`.
3. Conferir em `crm_deals` que o deal foi criado na pipeline do Alfredo com tag `Alfredo` e custom_fields preenchidos (renda_bruta, faixa_aporte, etc.).

## Pergunta antes de aplicar
Confirmar se desativo o endpoint duplicado `alfredo2` na mesma migração (recomendado) ou deixo intocado.
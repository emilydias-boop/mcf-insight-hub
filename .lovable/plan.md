

## Plano: Enriquecer busca "Por Lead" com visão 360° completa

### Problema
Atualmente a busca por lead mostra apenas dados básicos da reunião (horário, nome, telefone, email, status, closer, SDR, tipo, obs). Faltam informações cruciais: dados do deal/pipeline, origem, estágio atual, histórico de compras (Hubla), e dados completos do contato.

### Alterações

**1. `src/hooks/useInvestigationReport.ts` — Enriquecer dados do lead**

Expandir a interface `InvestigationAttendee` com campos adicionais:
- `deal_name`, `deal_stage`, `deal_stage_color`, `deal_created_at` (do `crm_deals` + `crm_stages`)
- `origin_name` (do `crm_origins`)
- `contact_city`, `contact_state` (do `crm_contacts`)
- `purchase_count`, `total_invested` (agregado de `hubla_transactions` por email/telefone do contato)

Na `useInvestigationByLead`, expandir a query de `crm_deals` para buscar:
- `crm_deals.name, stage:crm_stages(name, color), origin:crm_origins(name), created_at`
- Buscar `crm_contacts` com `city, state`
- Buscar `hubla_transactions` por email do contato para calcular total investido e quantidade de compras

**2. `src/components/relatorios/InvestigationReportPanel.tsx` — Card resumo do lead + tabela enriquecida**

Quando a busca por lead retorna resultados, exibir acima da tabela:
- **Card "Perfil do Lead"**: Nome, telefone, email, cidade/estado, data de entrada no CRM, origem
- **Card "Deal Atual"**: Nome do deal, estágio atual (com cor), pipeline
- **Card "Histórico Financeiro"**: Quantidade de compras, valor total investido (formatado R$)

Na tabela de reuniões, adicionar colunas:
- `Estágio` (do deal associado a cada reunião, com badge colorido)
- `Origem` (nome da origem)

No export Excel, incluir os novos campos.

**3. Resumo das queries adicionais no hook**

- `crm_deals`: expandir select para incluir `name, created_at, stage:crm_stages(name, color), origin:crm_origins(name)`
- `crm_contacts`: buscar `name, email, phone, city, state` pelos `contact_id` dos attendees
- `hubla_transactions`: buscar por email do contato, agregar `count` e `sum(product_price)`

### Resultado
A busca por lead mostrará uma visão 360° completa: perfil do contato, deal atual com estágio, origem, histórico de compras Hubla, e todas as reuniões com informações enriquecidas.


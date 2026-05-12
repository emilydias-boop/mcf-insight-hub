---
name: Lead temperature classification (quente/morno/frio)
description: SDR classifica lead como quente/morno/frio; bolinha colorida no kanban e filtro no auto-discador.
type: feature
---
- Coluna `crm_deals.lead_temperature` (text) com CHECK em ('quente','morno','frio') ou null. Index parcial idx_crm_deals_lead_temperature.
- Cores fixas: quente=red-500, morno=orange-500, frio=blue-500. Definidas em `src/components/crm/LeadTemperatureSelector.tsx` (TEMPERATURE_META).
- `LeadTemperatureSelector` (3 botões dot) é renderizado no `DealDetailsDrawer` logo abaixo de `QuickActionsBlock`. Como `AutoDialerDealDrawer` reusa o `DealDetailsDrawer`, o seletor aparece em ambos os drawers.
- `LeadTemperatureDot` é exibida no `DealKanbanCard` ao lado do nome do lead (somente quando há classificação).
- `AutoDialerPanel` (modo "Por Estágio") tem filtro Todos/Quente/Morno/Frio que restringe a fila ao discar — aplicado em `loadFromStage` via `d.lead_temperature !== tempFilter`.
- Clicar no botão ativo remove a classificação (toggle).

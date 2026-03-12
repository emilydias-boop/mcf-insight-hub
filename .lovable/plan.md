

## Plano: Substituir relatório "Desempenho" por "Carrinho"

### O que muda

Remover o report type `performance` do Incorporador e adicionar um novo tipo `carrinho` que mostra contratos pagos na semana, com informações de agendamento, reembolsos, e atribuição (Closer R1, R2, SDR).

### Arquivos a modificar/criar

**1. `src/components/relatorios/ReportTypeSelector.tsx`**
- Adicionar novo tipo `'carrinho'` ao `ReportType`
- Adicionar opção com ícone `ShoppingCart`, título "Carrinho", descrição "Contratos da semana com atribuição"

**2. `src/pages/bu-incorporador/Relatorios.tsx`**
- Trocar `'performance'` por `'carrinho'` na lista `availableReports`

**3. `src/components/relatorios/BUReportCenter.tsx`**
- Importar e renderizar `CarrinhoReportPanel` quando `selectedReport === 'carrinho'`

**4. Novo: `src/hooks/useCarrinhoReport.ts`**
- Hook que busca contratos pagos na semana selecionada
- Query `hubla_transactions` filtrando por `sale_date` no período, `product_category = 'incorporador'`
- Para cada contrato, verificar se está **agendado** (tem `linked_attendee_id` → meeting_slot_attendees → meeting_slots com meeting_type r2) ou **não agendado**
- Buscar Closer R1 via R1 meeting (deal → meeting_slot_attendees R1 → meeting_slots.closer)
- Buscar Closer R2 via R2 meeting (linked_attendee → meeting_slots.closer)
- Buscar SDR via crm_deals.owner_profile_id → profiles.full_name (fallback) ou booked_by do attendee R1
- Verificar reembolsos: status `refunded` na transação ou attendee status
- Retornar array com: nome do lead, email, data de compra, agendado/não agendado, Closer R1, Closer R2, SDR, reembolso (sim/não)

**5. Novo: `src/components/relatorios/CarrinhoReportPanel.tsx`**
- Seletor de período (semana) com DatePicker
- KPI cards no topo: Total Contratos, Agendados, Não Agendados, Reembolsos
- Tabela com colunas: Nome, Email, Data Compra, Status (Agendado/Não Agendado), Reembolso, Closer R1, Closer R2, SDR
- Filtros por Closer R2, status (agendado/não agendado)
- Exportar Excel
- Segue o mesmo padrão visual do `NaoComprouReportPanel`

### Dados e lógica

- **Agendado**: contrato com `linked_attendee_id` que aponta para um attendee em meeting R2 da semana
- **Não agendado**: contrato sem vínculo com meeting R2, ou com meeting R2 fora da semana
- **Reembolso**: transação com `refund_amount > 0` ou attendee com `status = 'refunded'`
- **Closer R1**: via deal_id → meeting_slot_attendees (R1) → meeting_slots.closer
- **Closer R2**: via linked_attendee_id → meeting_slots.closer
- **SDR**: via deal_id → crm_deals.owner_profile_id → profiles.full_name


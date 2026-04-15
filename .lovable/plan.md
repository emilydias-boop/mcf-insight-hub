

## Plano: Enriquecer Relatório de Contratos com SDR, Telefone, Dias Parado e Drawer

### Resumo
Adicionar 4 funcionalidades ao relatório de lifecycle de contratos:
1. **Telefone do lead** — coluna visível na tabela
2. **SDR que agendou** — resolver `booked_by` do meeting_slot R1 via `profiles`
3. **Dias parado** — calcular dias desde `contract_paid_at` sem terminal status
4. **Drawer do lead** — clicar na linha abre o `DealDetailsDrawer` existente

### Alterações

**`src/hooks/useContractLifecycleReport.ts`**
- Na query R1, adicionar `booked_by` do `meeting_slots` no select
- Coletar `booked_by` UUIDs e buscar nomes via `profiles(id, full_name)`
- Adicionar campos ao `ContractLifecycleRow`:
  - `sdrName: string | null`
  - `diasParado: number | null` (dias desde `contract_paid_at` para não-terminais)
- No R2, adicionar `status` do attendee R2 para presença (compareceu/no-show/agendado)
  - `r2AttendeeStatus: string | null`

**`src/components/crm/R2ContractLifecyclePanel.tsx`**
- Importar `DealDetailsDrawer` e adicionar state `selectedDealId`
- Ao clicar na linha da tabela, abrir drawer com `dealId`
- Adicionar colunas: Telefone, SDR, Presença R2, Dias
- KPI adicional: "Parados >5d" (contratos sem status terminal há mais de 5 dias)
- Cursor pointer nas linhas clicáveis
- Atualizar export CSV com novas colunas

### Dados já disponíveis
- `booked_by` está no `meeting_slots` (UUID do profile que agendou)
- `attendee_phone` já vem na query R1
- `DealDetailsDrawer` já existe em `src/components/crm/DealDetailsDrawer.tsx`
- `profiles` table tem `full_name` para resolver SDR


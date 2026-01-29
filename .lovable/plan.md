
# Plano: Corrigir Relatório de Contratos - Filtrar por Data do Pagamento

## Problema Identificado

A query atual filtra contratos pela **data da reunião** (`scheduled_at`), mas deveria filtrar pela **data do pagamento** (`contract_paid_at`). Isso causa discrepâncias nos números:

| Filtro | Quantidade |
|--------|------------|
| `scheduled_at` em Janeiro (query atual errada) | 200 |
| `contract_paid_at` em Janeiro (correto) | **225** |
| Transações A000/Contrato na Hubla | ~236-777 (inclui parcelas/duplicatas) |

## Causa Raiz

O hook `useContractReport.ts` linha 93-94:
```typescript
.gte('meeting_slots.scheduled_at', startISO)  // ← ERRADO
.lte('meeting_slots.scheduled_at', endISO)    // ← ERRADO
```

Deveria filtrar por:
```typescript
.gte('contract_paid_at', startISO)  // ← CORRETO
.lte('contract_paid_at', endISO)    // ← CORRETO
```

## Solução

Modificar o hook para filtrar pelo campo correto e também adicionar uma seção de resumo mostrando contratos pendentes de atribuição (transações sem match na agenda).

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useContractReport.ts` | **Modificar** - Trocar filtro de `scheduled_at` para `contract_paid_at` |

---

## Alterações Detalhadas

### useContractReport.ts - Corrigir Filtro de Data

**Código atual (linhas 91-94):**
```typescript
.eq('status', 'contract_paid')
.gte('meeting_slots.scheduled_at', startISO)
.lte('meeting_slots.scheduled_at', endISO);
```

**Código corrigido:**
```typescript
.eq('status', 'contract_paid')
.gte('contract_paid_at', startISO)
.lte('contract_paid_at', endISO);
```

### Ajuste da Query para Manter Join com meeting_slots

Como `contract_paid_at` está na tabela `meeting_slot_attendees` (não no join), a sintaxe permanece simples. Remover os filtros de `meeting_slots.scheduled_at` e usar `contract_paid_at` diretamente:

```typescript
let query = supabase
  .from('meeting_slot_attendees')
  .select(`
    id,
    attendee_name,
    attendee_phone,
    attendee_email,
    status,
    deal_id,
    contract_paid_at,  // Adicionar este campo
    meeting_slots!inner (...),
    crm_deals (...)
  `)
  .eq('status', 'contract_paid')
  .gte('contract_paid_at', startISO)
  .lte('contract_paid_at', endISO);
```

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| 0-200 contratos (filtro errado) | **225 contratos** (filtro correto) |
| Data base: data da reunião | Data base: data do pagamento |

---

## Fluxo Corrigido

```text
1. Usuário seleciona período: 01/01/2026 - 31/01/2026

2. Query busca:
   WHERE status = 'contract_paid'
   AND contract_paid_at >= '2026-01-01'
   AND contract_paid_at <= '2026-01-31'

3. Retorna 225 contratos atribuídos a closers R1

4. Relatório mostra dados corretos ✓
```

---

## Impacto

- **Precisão**: Relatório refletirá contratos PAGOS no período, não reuniões realizadas
- **Consistência**: Números alinhados com outras métricas do sistema
- **Admin/Manager**: Verão todos os 225 contratos de Janeiro

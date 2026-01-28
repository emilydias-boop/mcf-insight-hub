
# Corrigir Contabilização de Contratos de Follow-up

## Problema Raiz Identificado

Quando um contrato é marcado como "Contrato Pago" **manualmente via interface**, o campo `contract_paid_at` permanece **NULL**. Isso acontece porque o hook `useUpdateAttendeeAndSlotStatus` apenas atualiza o campo `status`, mas não preenche o `contract_paid_at`.

**Exemplo Real encontrado no banco:**
- Nelson Ebersol Brum
- Reunião (`scheduled_at`): 23/01/2026 
- Status alterado para `contract_paid` em: 28/01/2026 (via `updated_at`)
- `contract_paid_at`: **NULL**

Como resultado, este contrato de follow-up **não é contabilizado** nas métricas de hoje.

---

## Solução Proposta

Modificar o hook `useUpdateAttendeeAndSlotStatus` para **automaticamente preencher `contract_paid_at`** quando o status for alterado para `contract_paid`.

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAgendaData.ts` | Adicionar `contract_paid_at: new Date().toISOString()` quando status = 'contract_paid' |

---

## Mudança Técnica

### Arquivo: `src/hooks/useAgendaData.ts` (linhas 1549-1555)

```typescript
// ANTES:
const { error: attendeeError } = await supabase
  .from('meeting_slot_attendees')
  .update({ status })
  .eq('id', attendeeId);

// DEPOIS:
const updateData: { status: string; contract_paid_at?: string } = { status };

// Se o status for contract_paid, registrar timestamp do pagamento
if (status === 'contract_paid') {
  updateData.contract_paid_at = new Date().toISOString();
}

const { error: attendeeError } = await supabase
  .from('meeting_slot_attendees')
  .update(updateData)
  .eq('id', attendeeId);
```

---

## Comportamento Esperado

| Cenário | Antes | Depois |
|---------|-------|--------|
| Marcar contrato pago manualmente | `contract_paid_at = NULL` | `contract_paid_at = timestamp atual` |
| Contrato via webhook | `contract_paid_at = preenchido` | Sem mudança |
| Métricas de follow-up | Não contabiliza | Contabiliza corretamente |

---

## Impacto

- **Thayna**: O 4º contrato (Nelson Ebersol Brum) será contabilizado corretamente quando o status for atualizado
- **Outros closers**: Qualquer contrato de follow-up marcado manualmente passará a ter a data correta
- **Compatibilidade**: Contratos já existentes com `contract_paid_at = NULL` continuarão usando o fallback (`scheduled_at`)

---

## Observação

Para os contratos de follow-up **já existentes** que foram marcados manualmente e têm `contract_paid_at = NULL`, seria necessário um script de correção para popular o campo baseado em `updated_at`. Isso pode ser feito posteriormente como um ajuste de dados.

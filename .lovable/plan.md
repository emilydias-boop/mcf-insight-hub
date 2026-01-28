

# Corrigir Data dos Leads de Follow-up (R2 Pendentes)

## Problema Identificado
Os leads de follow-up dos closers R1 no painel "Pendentes" estão mostrando a **data de criação do registro** (created_at) em vez da **data real do pagamento do contrato** (contract_paid_at) ou da **data da reunião agendada** (scheduled_at).

Isso acontece porque o hook `useR2PendingLeads.ts`:
1. Busca o campo `created_at` (linha 51) mas **não busca** o campo `contract_paid_at` do banco
2. Depois **substitui** `created_at` pelo campo `contract_paid_at` (linhas 91, 123, 167)
3. Ordena pela data errada (linha 68)

O resultado é que o painel mostra "há X dias" baseado na data de criação do attendee, não na data do pagamento ou da reunião.

---

## Solução Proposta

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useR2PendingLeads.ts` | Buscar `contract_paid_at` do banco e usar como fallback a data da reunião (`scheduled_at`) |

---

## Mudanças Técnicas

### 1. Adicionar `contract_paid_at` na query (linha 51)
```typescript
// Antes
created_at,

// Depois
created_at,
contract_paid_at,
```

### 2. Ordenar por `contract_paid_at` ou `scheduled_at` (linha 68)
```typescript
// Antes
.order('created_at', { ascending: false });

// Depois  
.order('contract_paid_at', { ascending: false, nullsFirst: false });
```

### 3. Usar `contract_paid_at` real com fallback para `scheduled_at` (linhas 89-92, 121-124, 165-168)
```typescript
// Antes (em 3 lugares)
contract_paid_at: a.created_at,

// Depois
contract_paid_at: a.contract_paid_at || a.meeting_slot?.scheduled_at || a.created_at,
```

---

## Lógica de Prioridade para Data

A data exibida seguirá esta hierarquia:
1. **contract_paid_at** - Data real registrada quando o contrato foi pago (webhook ou manual)
2. **scheduled_at** - Data da reunião R1 (fallback se contract_paid_at for null)
3. **created_at** - Data de criação do registro (último fallback)

---

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| "há 15 dias" (baseado em created_at) | "há 2 dias" (baseado em contract_paid_at ou scheduled_at) |
| Leads antigos aparecem no topo | Leads com pagamento recente aparecem no topo |

O painel de "Leads Pendentes" agora mostrará corretamente quanto tempo se passou desde o pagamento do contrato (ou desde a reunião), não desde a criação do registro no sistema.


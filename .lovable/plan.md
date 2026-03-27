

## Fix: Vendas de parceria não aparecem no Carrinho R2

### Causa raiz

Dois problemas distintos:

**1. Janela de datas diferente entre vendas e "sem vínculo"**

| Hook | Filtro sale_date |
|------|-----------------|
| `useR2CarrinhoVendas` | `effectiveStart` → `effectiveEnd` (27/03 **12:00**) |
| `useUnlinkedTransactions` | `weekStart` → `endOfDay(weekEnd)` (27/03 **23:59**) |

As 5 transações de "Vendas Sem Vínculo" usam `endOfDay`, por isso aparecem. Mas o hook de vendas usa o corte do carrinho (12:00), excluindo vendas da tarde de hoje.

**2. Matching falha para TODAS as 5 transações**

Mesmo as transações dentro do horário não matcham com nenhum dos 36 aprovados. Isso significa que emails, telefones (sufixo 9 dígitos) e nomes não batem entre `hubla_transactions` e os attendees aprovados. Possíveis causas:
- Attendees sem `deal` vinculado (sem email no CRM)
- Telefone do attendee em formato diferente do Hubla
- Nome com acentos/espaços extras

### Solução

**1. `useR2CarrinhoVendas.ts` — Separar janela de datas**

Para transações: usar `endOfDay(weekEnd)` em vez de `effectiveEnd`. O corte do carrinho define quando R2s pertencem a cada semana, mas vendas podem acontecer o dia inteiro.

Para attendees aprovados: manter `effectiveStart`/`effectiveEnd` (correto — define quais R2s pertencem à semana).

**2. `useR2CarrinhoVendas.ts` — Ampliar busca de aprovados**

Atualmente o hook só busca aprovados da semana atual. Mas um lead pode ter sido aprovado em semana anterior e comprar a parceria esta semana. Remover o filtro de data dos aprovados (ou expandir para 60 dias) para garantir que vendas de parceria encontrem seu lead.

**3. `useR2CarrinhoVendas.ts` — Match mais robusto**

Adicionar match por `linked_attendee_id` como PRIMEIRO critério (antes de email/phone/name), sem exigir que o attendee esteja na lista de aprovados da semana. Se a transação tem `linked_attendee_id`, buscar os dados desse attendee diretamente.

### Detalhes técnicos

```typescript
// Transações: usar endOfDay para incluir vendas do dia inteiro
.gte('sale_date', effectiveStart.toISOString())
.lte('sale_date', endOfDay(weekEnd).toISOString())

// Aprovados: expandir para 60 dias (lead pode ter R2 em outra semana)
.gte('meeting_slot.scheduled_at', subDays(weekEnd, 60).toISOString())

// Match: linked_attendee_id primeiro
if (tx.linked_attendee_id) {
  // Buscar attendee direto, não depender da lista de aprovados da semana
}
```

### Arquivos alterados
- `src/hooks/useR2CarrinhoVendas.ts`


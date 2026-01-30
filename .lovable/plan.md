
# Plano: Sincronizar Aba "Aprovados" com Vendas Reais

## Problema Identificado

O **Iago Oliveira** (e outros leads) aparece na aba "Aprovados" mesmo após a venda ter sido registrada na aba "Vendas". Isso acontece porque:

| Aba | Lógica Atual | Problema |
|-----|--------------|----------|
| **Vendas** | Match por email/telefone com `hubla_transactions.product_category = 'parceria'` | ✅ Funciona corretamente |
| **Aprovados** | Filtra apenas por `carrinho_status !== 'comprou'` (status manual) | ❌ Ignora vendas reais |

O Iago tem:
- Transação: `iagoofr507@gmail.com`, `product_category = 'parceria'` ✅
- Attendee: `iagoofr507@gmail.com`, `carrinho_status = NULL` ❌

## Solução Proposta

Modificar a aba "Aprovados" para **excluir automaticamente leads que têm vendas reais** (mesmo sem marcar manualmente como "comprou").

### Abordagem: Cruzar dados com vendas

No componente `R2AprovadosList.tsx`, já temos acesso aos dados de vendas via:

```typescript
const { data: vendasData = [] } = useR2CarrinhoVendas(weekEnd);
```

Vamos criar um **Set de emails/telefones que já compraram** e usar para filtrar:

```typescript
// Criar set de emails/phones que já compraram
const soldIdentifiers = useMemo(() => {
  const set = new Set<string>();
  vendasData.forEach(venda => {
    if (venda.customer_email) {
      set.add(venda.customer_email.toLowerCase());
    }
    if (venda.customer_phone) {
      const normalized = venda.customer_phone.replace(/\D/g, '').slice(-11);
      if (normalized.length >= 10) set.add(normalized);
    }
  });
  return set;
}, [vendasData]);
```

E atualizar o filtro de `displayedAttendees`:

```typescript
const displayedAttendees = useMemo(() => {
  return attendees
    .filter(att => {
      // Excluir status manual "comprou"
      if (att.carrinho_status === 'comprou') return false;
      
      // Excluir se tem venda real (match por email ou telefone)
      const email = att.contact_email?.toLowerCase();
      const phone = (att.attendee_phone || att.contact_phone)?.replace(/\D/g, '').slice(-11);
      
      if (email && soldIdentifiers.has(email)) return false;
      if (phone && phone.length >= 10 && soldIdentifiers.has(phone)) return false;
      
      return true;
    })
    // ... resto dos filtros (search, closer, date)
}, [attendees, soldIdentifiers, searchTerm, closerFilter, dateFilter]);
```

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/components/crm/R2AprovadosList.tsx` | Adicionar lógica para excluir leads com vendas reais |

## Resultado Esperado

1. **Iago Oliveira** sai automaticamente da aba "Aprovados"
2. Qualquer lead com venda real (por match de email/telefone) é removido
3. Contagem "48 em acompanhamento" diminui conforme vendas são feitas
4. Status manual "comprou" continua funcionando como backup

## Sem Necessidade de SQL

A correção é 100% no frontend - os dados de vendas já estão disponíveis no componente.

## Checklist de Aceitação

- [ ] Iago Oliveira não aparece mais na aba "Aprovados" (só em "Vendas")
- [ ] Outros leads com vendas também são removidos automaticamente
- [ ] Contagem "X em acompanhamento" reflete leads sem venda
- [ ] Filtros (busca, closer, data) continuam funcionando

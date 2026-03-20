

## Plano: Vincular Acordos de Parceria ao Carrinho R2

### Contexto
Os acordos (`billing_agreements`) estão vinculados a `billing_subscriptions` via `subscription_id`, e as subscriptions têm `deal_id`. Os leads aprovados no carrinho (`meeting_slot_attendees`) também têm `deal_id`. A ponte entre os dois sistemas já existe no banco — só falta expor na UI do carrinho.

### O que será feito

**1. Novo hook `useAprovadoAgreements`**
- Recebe `deal_id` do attendee aprovado
- Busca `billing_subscriptions` pelo `deal_id`
- Com o `subscription_id`, busca `billing_agreements` e suas `billing_agreement_installments`
- Retorna dados do acordo (status, parcelas pagas/total, saldo, forma de pagamento)

**2. Badge de Acordo na lista de Aprovados (`R2AprovadosList.tsx`)**
- Para cada lead aprovado que tenha um acordo ativo, exibir um badge "Acordo" com status (em andamento, cumprido, quebrado)
- Badge colorido: azul (em andamento), verde (cumprido), vermelho (quebrado)

**3. Seção de Acordo no `AprovadoDetailDrawer.tsx`**
- Adicionar seção "Acordo/Negociação" na jornada do lead, após a venda
- Mostrar: status do acordo, valor negociado, parcelas pagas/total, próximo vencimento, saldo devedor
- Botão "Ver Cobrança" que abre o drawer de cobrança ou redireciona para `/cobrancas`

**4. Botão "Criar Acordo" no `AprovadoDetailDrawer.tsx`**
- Se o lead tem subscription mas NÃO tem acordo, mostrar botão "Novo Acordo"
- Abre o `CreateAgreementModal` já existente, passando o `subscription_id` automaticamente
- Se não tem subscription, o botão fica oculto

### Arquivos

| Arquivo | Alteração |
|---------|-----------|
| `src/hooks/useAprovadoAgreements.ts` | **Novo** — hook que busca subscription + agreements pelo deal_id |
| `src/components/crm/AprovadoDetailDrawer.tsx` | Adicionar seção de acordos e botão "Criar Acordo" |
| `src/components/crm/R2AprovadosList.tsx` | Adicionar badge de acordo na tabela (via batch query) |

### Fluxo de dados

```text
meeting_slot_attendees.deal_id
        ↓
billing_subscriptions (WHERE deal_id = ?)
        ↓ subscription_id
billing_agreements
        ↓ agreement_id
billing_agreement_installments
```

### Detalhes — hook `useAprovadoAgreements`

```typescript
export function useAprovadoAgreements(dealId: string | null) {
  return useQuery({
    queryKey: ['aprovado-agreements', dealId],
    queryFn: async () => {
      // 1. Find subscription by deal_id
      const { data: sub } = await supabase
        .from('billing_subscriptions')
        .select('id, status, valor_total_contrato')
        .eq('deal_id', dealId)
        .maybeSingle();
      if (!sub) return null;
      
      // 2. Find agreements
      const { data: agreements } = await supabase
        .from('billing_agreements')
        .select('*')
        .eq('subscription_id', sub.id)
        .order('created_at', { ascending: false });
      
      return { subscription: sub, agreements: agreements || [] };
    },
    enabled: !!dealId,
  });
}
```

### Detalhes — Badge na lista de aprovados

Para evitar N+1 queries, fazer uma única query batch: buscar todas as subscriptions cujo `deal_id` está na lista de attendees, depois buscar agreements para essas subscriptions. Resultado mapeado por `deal_id` para lookup O(1) no render.

### Detalhes — Seção no drawer

Após a seção "Venda Realizada" no timeline, adicionar:
- Ícone de handshake (`Handshake`)
- Status do acordo mais recente
- Resumo: "3/6 parcelas pagas — Saldo: R$ 1.200"
- Próximo vencimento destacado se atrasado (vermelho)
- Botão "Novo Acordo" se tem subscription sem acordo ativo
- Botão "Ver Detalhes" que linka para `/cobrancas` com filtro do cliente


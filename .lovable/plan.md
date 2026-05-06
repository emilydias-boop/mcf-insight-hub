
## Diagnóstico

Você tem razão: o card **Contratos: 22** está contando 1 a mais do que a Hubla (21).

Investiguei no banco e encontrei o caso:

**emersondaguiar@gmail.com**
- 30/04 → A000 - Contrato (completed)
- 04/05 → **A001 - MCF INCORPORADOR COMPLETO** (completed)

Esse cliente comprou o A001 (renovação/parceria de incorporador) na mesma safra. A Hubla classifica esse cliente como **recorrência/parceiro**, então não conta no "Contratos novos" — por isso ela mostra 21.

Nosso código hoje em `useR2CarrinhoKPIs.ts` só olha para `product_name = 'A000 - Contrato'` e não cruza com produtos de parceria/renovação. Isso viola a regra do projeto:

> Partner/renewal products (A001-A009, R001, etc.) block Inside Sales entry and are excluded from metrics.

Os outros 21 emails da safra estão limpos (só A010 anterior, que é a consultoria normal antes do contrato).

## Solução

Ajustar a query de "Contratos" em `src/hooks/useR2CarrinhoKPIs.ts` para excluir do contador qualquer email que também tenha uma transação `completed` de produto de parceria/renovação **na mesma safra** (Qui 00:00 → Qua 23:59).

### Mudança em `src/hooks/useR2CarrinhoKPIs.ts`

Dentro do `queryFn` da `useQuery` de contratos, depois de buscar os contratos A000:

1. Buscar uma segunda query no mesmo intervalo (`boundaries.contratos.start` → `boundaries.contratos.end`) para transações `completed` cujo `product_name` bate com o padrão de parceria/renovação:
   - `A001`, `A002`, `A003`, `A004`, `A005`, `A006`, `A007`, `A008`, `A009`, `R001`, `INCORPORADOR`, ou contém "Renovação"/"Renovacao"
2. Coletar `partnerEmails: Set<string>` (lowercase, trimmed)
3. Ao montar o `emailMap` final, **pular** qualquer email que esteja em `partnerEmails`
4. Aplicar a mesma exclusão para `refundEmails` (consistência)

Resultado esperado: **Contratos cai de 22 → 21**, batendo com a Hubla.

### Padrões SQL a usar

```sql
product_name ~* '^(A00[1-9]|R001|INCORPORADOR)' 
  OR product_name ILIKE '%Renovação%' 
  OR product_name ILIKE '%Renovacao%'
```

Filtros adicionais idênticos aos contratos A000:
- `sale_status = 'completed'`
- `source IN ('hubla','manual','make','mcfpay','kiwify')`
- `installment_number <= 1`
- `hubla_id NOT LIKE 'newsale-%'`

### Onde NÃO mexer

- O loop de `unifiedData` (R2 Agendadas, Realizadas, etc.) **não** muda — ele já reflete a operação de R2 e o lead pode continuar aparecendo lá.
- "Semanas Anteriores" (11) **não** muda.
- O esquema do banco **não** muda.

## QA depois da mudança

Rodar a mesma query manual com a exclusão e validar:
- Contratos = 21
- emersondaguiar@gmail.com **fora** da contagem
- Os outros 21 emails permanecem

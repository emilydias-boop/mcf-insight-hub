

## Plano: Corrigir notas que não aparecem no drawer do lead (consórcio)

### Diagnóstico

Os dados existem no banco: o attendee `ced53bfe` do deal `753d6bce` tem `closer_notes` e `notes` preenchidos. O `DealNotesTab` deveria exibi-los, mas mostra "Nenhuma nota ainda".

O problema provável é que a `queryFn` do `DealNotesTab` está falhando silenciosamente. Quando uma das queries internas (ex: `attendee_notes`, `profiles`) retorna erro, o React Query captura a exceção mas o componente renderiza o estado vazio em vez de um estado de erro visível, porque não há tratamento de `isError`.

Adicionalmente, o `DealNotesTab` usa `(a as any).closer_notes` em vários pontos, indicando que o TypeScript não reconhece o campo no tipo retornado. Embora isso não afete runtime, pode mascarar problemas de tipo.

### Ação: Adicionar logging + tratamento de erro

| Arquivo | O que muda |
|---------|-----------|
| `src/components/crm/DealNotesTab.tsx` | 1. Adicionar `console.log` dentro da `queryFn` para logar `uniqueIds`, resultados de cada query, e `combined.length` final. 2. Adicionar tratamento de `isError` no componente para exibir mensagem de erro visível. 3. Adicionar `console.error` nos catches de cada sub-query |

### Código proposto

```typescript
// No queryFn, adicionar logs:
console.log('[DealNotesTab] querying with uniqueIds:', uniqueIds);

// Após cada query, logar resultados:
console.log('[DealNotesTab] attendees found:', attendees?.length, attendees?.map(a => ({ id: a.id, closer_notes: (a as any).closer_notes })));

// No final:
console.log('[DealNotesTab] combined notes:', combined.length);

// No componente, tratar erro:
if (isError) {
  return <p className="text-sm text-red-500 text-center py-4">Erro ao carregar notas</p>;
}
```

### Possível causa raiz alternativa

Se os logs mostrarem que `attendees` retorna vazio (apesar dos dados existirem), o problema será no `uniqueIds` passado ao `.in('deal_id', ...)`. Pode ser que `useContactDealIds` não esteja resolvendo corretamente para deals de consórcio, ou que exista um `clint_id` não-UUID causando erro no PostgREST.

### Resultado

Com os logs, no próximo clique no drawer, os console logs revelarão exatamente onde o fluxo quebra, permitindo uma correção cirúrgica.




## Problema

A aba "Notas" mostra "Nenhuma nota ainda" para leads que possuem `clint_id` no formato legado (ex: `hubla-deal-1769551133751-20a7cf`).

### Causa raiz

O hook `useContactDealIds` retorna tanto UUIDs quanto `clint_id` (strings que nao sao UUID). Quando esses IDs sao passados para queries do Supabase em tabelas com colunas `deal_id` do tipo UUID, a query falha com erro `22P02: invalid input syntax for type uuid`, retornando status 400 e zero resultados.

Isso afeta todas as queries na aba Notas (`DealNotesTab`):
- `deal_activities`
- `meeting_slot_attendees`
- `calls`

## Solucao

### 1. Filtrar IDs nao-UUID no `useContactDealIds`

No arquivo `src/hooks/useContactDealIds.ts`, antes de retornar os IDs, filtrar apenas os que sao UUIDs validos. Adicionar uma funcao auxiliar:

```text
UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

Aplicar o filtro no retorno do hook para que apenas UUIDs validos sejam incluidos no array final.

### 2. Alternativa (mais segura): Filtrar no `DealNotesTab`

Caso o `clint_id` seja necessario em outros contextos, a filtragem pode ser feita diretamente no `DealNotesTab.tsx` na linha 59 onde `uniqueIds` e construido, garantindo que apenas UUIDs validos sejam passados para as queries.

### Abordagem recomendada

Filtrar no `useContactDealIds.ts` (opcao 1), pois o problema afeta qualquer consumidor desse hook, nao apenas o `DealNotesTab`. Isso corrige tambem os erros 400 vistos em outras queries como `calls` e `attendee_notes`.

### Arquivos a alterar

- `src/hooks/useContactDealIds.ts`: Adicionar regex UUID e filtrar `clint_id` nao-UUID do array retornado (linhas 71-78).

### Resultado esperado

- A nota de agendamento (`.`) passa a aparecer na aba Notas.
- Nenhum erro 400 por UUID invalido no console/rede.
- Outras abas (Timeline, Historico) que usam o mesmo hook tambem param de falhar silenciosamente.


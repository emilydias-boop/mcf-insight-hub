

# Filtrar closers para exibir apenas os do Consorcio

## Problema
A tabela "Realizadas" esta mostrando closers de outras BUs (Incorporador, etc.) porque o campo `owner_id` dos deals pode conter emails de closers que nao pertencem ao Consorcio. Os closers reais do Consorcio sao apenas: Joao Pedro, Luis Felipe, Thobson e Victoria Paz.

## Solucao
No hook `useRealizadas` (arquivo `src/hooks/useConsorcioPostMeeting.ts`), apos buscar os deals, fazer uma consulta adicional na tabela `closers` filtrando por `bu = 'consorcio'` e `is_active = true`. Usar os emails retornados para:

1. Filtrar os deals, mantendo apenas aqueles cujo `owner_id` (email) pertence a um closer do Consorcio
2. Resolver o nome do closer a partir da tabela `closers` diretamente (em vez de `profiles`), garantindo consistencia

## Detalhes tecnicos

### Arquivo: `src/hooks/useConsorcioPostMeeting.ts`

Na funcao `useRealizadas`, antes do mapeamento final dos deals:

1. Buscar closers do Consorcio:
```ts
const { data: consorcioClosers } = await supabase
  .from('closers')
  .select('name, email')
  .eq('bu', 'consorcio')
  .eq('is_active', true);
```

2. Criar um mapa de email para nome e um set de emails validos:
```ts
const closerEmails = new Set(
  (consorcioClosers || []).map(c => c.email?.toLowerCase())
);
const closerNameByEmail: Record<string, string> = {};
(consorcioClosers || []).forEach(c => {
  if (c.email) closerNameByEmail[c.email.toLowerCase()] = c.name;
});
```

3. Filtrar `filteredDeals` para manter apenas deals com `owner_id` pertencente a `closerEmails`

4. Usar `closerNameByEmail` no mapeamento de `closer_name` em vez do lookup via `profiles`

Isso remove a necessidade da query em `profiles` para resolver nomes de closers e garante que apenas deals atendidos por closers do Consorcio aparecam na listagem.

Nenhuma mudanca de banco de dados. 1 arquivo modificado.

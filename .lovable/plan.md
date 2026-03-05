

## Plano: Deduplicar contatos na listagem por email/telefone

### Problema
A página de Contatos mostra registros duplicados de `crm_contacts` (ex: "Carlos Henrique" aparece 2x com mesmo email e telefone). Esses são registros distintos na tabela mas representam a mesma pessoa.

### Solução
No hook `useContactsEnriched.ts`, após buscar e enriquecer os contatos, aplicar deduplicação client-side agrupando por email (ou telefone como fallback). Para cada grupo de duplicados, manter apenas o contato "primário" (o que tem mais deals, ou o mais antigo), consolidando os deals de todos os duplicados nele.

### Alterações

**Arquivo: `src/hooks/useContactsEnriched.ts`**

Após construir o array `enriched` (linha ~170), adicionar uma etapa de deduplicação:

1. Agrupar contatos por `email.toLowerCase()` (quando email existe) e por sufixo de telefone (últimos 9 dígitos, quando não há email)
2. Para cada grupo com 2+ contatos:
   - Escolher o primário: mais deals → mais antigo
   - Consolidar: manter o `latestDeal` do que tiver o deal mais recente, somar informações
   - Marcar `isDuplicate: true` no card consolidado
3. Retornar apenas contatos únicos

Isso garante que a listagem mostra cada pessoa uma única vez, independentemente de quantos registros duplicados existam em `crm_contacts`. Os deals de todas as cópias são considerados ao determinar o status térmico e deal mais recente.

### Resultado
- "Carlos Henrique Guimarães do Vale" aparece 1x no lugar de 2x
- O card consolidado mostra o deal mais relevante entre todos os registros
- Badge "Dup" permanece para indicar que existem registros duplicados no banco


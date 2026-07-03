## Diagnóstico

Confirmei o bug consultando o banco: os 45 contatos criados na sua importação de ontem (`clint_id LIKE 'spreadsheet_import_1783027%'`) foram criados com `email = NULL` e `phone = NULL`, mesmo a planilha (`Lead_planilha_-_24-06-2026_-_02-07-2026-2.csv`) tendo esses dados nas colunas `Email ` e `telefone`.

O fluxo atual (`src/components/crm/SpreadsheetCompareDialog.tsx` → `compareSpreadsheetGlobal` → edge function `import-spreadsheet-leads`):

1. Faz o parse do CSV e tenta auto-mapear as colunas `Nome`, `Email `, `telefone` para os campos `name`, `email`, `phone`.
2. Compara com a base global. Rows `not_found` são enviadas com `{ name, email, phone }` para a edge function.
3. A edge function cria `crm_contacts` com esses valores.

O problema aconteceu porque as colunas `email` e/ou `phone` ficaram desmapeadas no passo 2 (auto-map falhou pelo espaço em `Email ` ou o usuário passou direto), e o código **permite prosseguir mapeando apenas o `name`**. Resultado: todos os leads viram "not_found" pelo nome, a edge function cria contatos vazios, o deal aparece sem telefone e sem email.

Além disso, encontrei problemas correlatos que também podem causar leads sem dados:

- Em `compareSpreadsheetGlobal` (`src/hooks/useSpreadsheetCompare.ts`), a busca por **nome exato** (linhas 145-153) casa qualquer contato homônimo já existente (mesmo vazio) e marca como `found_elsewhere`, reusando o `contact_id` errado.
- As buscas usam `.ilike()` com o valor cru — se o email contiver `_` ou `%`, esses caracteres viram wildcards e podem casar contatos errados.

## O que vou mudar

**1. `src/components/crm/SpreadsheetCompareDialog.tsx`**
- Melhorar `autoMapColumns`: normalizar removendo espaços internos duplos e caracteres invisíveis; reconhecer também `telefone(s)`, `celular(es)`, `whatsapp`, `contato`, `número`.
- Bloquear o botão "Continuar" (e mostrar toast) se **nem `email` nem `phone` estiverem mapeados** — só nome não é suficiente.
- Mostrar um preview das 3 primeiras linhas mapeadas antes de comparar, para o usuário conferir visualmente que os valores estão nas colunas certas.

**2. `src/hooks/useSpreadsheetCompare.ts` (`compareSpreadsheetGlobal`)**
- Trocar `.ilike('email', emailKey)` por `.eq('email', emailKey)` (ou usar `filter` com escape) para evitar wildcards acidentais.
- Remover a busca por nome exato como fallback de matching — ela produz falsos positivos que reusam contatos vazios. Se o usuário quiser esse comportamento, pode ser adicionado explicitamente no futuro; hoje causa perda de dados.

**3. `supabase/functions/import-spreadsheet-leads/index.ts`**
- Mesma correção de `.ilike` → `.eq`/`.filter` escapado nas buscas por email.
- Reduzir agressividade do fallback de 8 dígitos: só usar se o suffix de 9 dígitos não casar e o telefone tiver DDI+DDD válidos.
- Quando um `contact_id` for reusado (found_elsewhere) mas o contato existente tiver `email` ou `phone` nulos, preencher com os dados da planilha (nunca sobrescrever dados existentes).

**4. Recuperar os leads afetados desta importação**
- Rodar um `UPDATE` para preencher `crm_contacts.email` e `crm_contacts.phone` dos 45 contatos com `clint_id LIKE 'spreadsheet_import_1783027%'`, cruzando pelo nome com os dados do CSV que você enviou.

## Fora do escopo

- Não vou mexer no fluxo de "Colar Lista" além do que já é compartilhado.
- Não vou alterar como o card do CRM exibe telefone/email — o problema é no dado gravado, não na UI.

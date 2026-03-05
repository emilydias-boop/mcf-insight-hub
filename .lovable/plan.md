

## Plano: Busca Global + Criação na Pipeline Atual com SDR

### Problema Real
O usuário quer:
1. Colar uma lista de nomes/telefones
2. O sistema buscar se esses contatos existem em QUALQUER pipeline
3. Para os encontrados: criar um deal na **pipeline atual** (ex: Consórcio) com o **SDR escolhido**, reaproveitando o contato existente (sem duplicar contato)
4. Para os não encontrados: criar contato + deal na pipeline atual com o SDR escolhido

Ou seja, o resultado final é: todos os leads da lista acabam na pipeline atual, com o SDR correto, sem duplicar contatos.

### Alterações

**Arquivo: `src/hooks/useSpreadsheetCompare.ts`**

- Adicionar função `compareSpreadsheetGlobal(rows)` que busca cada lead diretamente em `crm_contacts` (por email → telefone últimos 9 dígitos → nome ilike)
- Para cada contato encontrado, verificar se já existe deal na pipeline atual (`crm_deals` com `contact_id` + `origin_id`)
- Retornar status: `found_in_current` (já existe nesta pipeline), `found_elsewhere` (contato existe mas não nesta pipeline), `not_found` (contato não existe)

**Arquivo: `src/components/crm/SpreadsheetCompareDialog.tsx`**

- No `handleCompare`, chamar `compareSpreadsheetGlobal` em vez de `compareSpreadsheetWithDeals`
- Mostrar nos resultados 3 categorias:
  - "Já nesta pipeline" — só transfere owner
  - "Em outra pipeline" — cria deal nesta pipeline reaproveitando o contato
  - "Não encontrado" — cria contato + deal
- Seletor de SDR + botão "Importar X leads" que:
  - Para `found_in_current`: faz UPDATE do owner_id
  - Para `found_elsewhere`: cria novo deal na pipeline atual com contact_id existente + owner escolhido
  - Para `not_found`: cria contato + deal (como já faz hoje)

**Arquivo: `supabase/functions/import-spreadsheet-leads/index.ts`**

- Estender para aceitar `owner_email` e `owner_profile_id` opcionais no body
- Quando fornecidos, criar o deal já com esses campos preenchidos
- Aceitar também `contact_id` opcional — quando o contato já existe em outra pipeline, pular criação de contato e usar o ID existente

### Fluxo Final
1. Usuário cola lista no CRM Consórcio
2. Sistema busca contatos em toda a base
3. Mostra: "15 já nesta pipeline, 8 em outra pipeline, 4 novos"
4. Usuário escolhe SDR e clica "Importar"
5. Os 15 existentes têm owner atualizado
6. Os 8 de outra pipeline ganham um novo deal em Consórcio com o SDR
7. Os 4 novos ganham contato + deal em Consórcio com o SDR
8. Nenhum contato é duplicado


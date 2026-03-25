

## Situação atual e o que fazer com os duplicados já criados

### O que aconteceu
Antes do fix que acabamos de aplicar, a importação salvou contatos com aspas literais nos nomes e telefones (ex: `"Wallyson Diego"` em vez de `Wallyson Diego`). Isso criou duplicatas — o sistema não encontrou o contato existente porque o nome/telefone com aspas não batia na busca.

### O que já foi corrigido (futuras importações)
- **Frontend** (`SpreadsheetCompareDialog.tsx`): `stripQuotes` remove aspas antes de enviar
- **Edge Function** (`import-spreadsheet-leads`): sanitiza `cleanName` e `cleanPhone` no servidor

### O que falta: limpar os duplicados já existentes

**Plano em 2 etapas:**

#### Etapa 1 — Limpar aspas de todos os contatos existentes (migration SQL)
Criar uma migration que remove aspas literais de `name` e `phone` na tabela `crm_contacts` e de `name` na tabela `crm_deals`:

```sql
-- Limpar aspas dos nomes de contatos
UPDATE crm_contacts
SET name = TRIM(BOTH '"' FROM TRIM(BOTH '''' FROM name))
WHERE name LIKE '"%"' OR name LIKE '''%''';

-- Limpar aspas dos telefones de contatos  
UPDATE crm_contacts
SET phone = TRIM(BOTH '"' FROM TRIM(BOTH '''' FROM phone))
WHERE phone LIKE '"%"' OR phone LIKE '''%''';

-- Limpar aspas dos nomes de deals
UPDATE crm_deals
SET name = TRIM(BOTH '"' FROM TRIM(BOTH '''' FROM name))
WHERE name LIKE '"%"' OR name LIKE '''%''';
```

#### Etapa 2 — Mergear os duplicados resultantes
Após limpar as aspas, contatos que antes tinham nomes diferentes (com/sem aspas) agora terão o mesmo email ou telefone — serão detectados como duplicados pela ferramenta existente em **Contatos Duplicados** (`/crm/contatos-duplicados`). Basta rodar o merge (por email e por telefone) usando a funcionalidade que já existe.

### Arquivos alterados
- Nova migration SQL — limpeza de aspas em `crm_contacts.name`, `crm_contacts.phone`, `crm_deals.name`

### Resultado esperado
- Nomes e telefones limpos no banco
- Duplicados detectados automaticamente pela ferramenta existente
- Merge pode ser executado pela página de Contatos Duplicados


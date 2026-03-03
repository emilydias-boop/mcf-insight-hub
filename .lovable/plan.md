

## Plano: Criar deals para "Não encontrados" com tag `base clint`

### Entendimento
- A tag `base clint` vai **somente** nos leads **não encontrados** (novos que serão criados)
- Os encontrados servem apenas para visualização (aberto/ganho/perdido)
- O botão atual "Aplicar tag nos encontrados" será substituído por "Criar leads não encontrados"

### Solução

#### 1. Edge Function `import-spreadsheet-leads`
Recebe array de leads não encontrados + `origin_id`, e para cada um:
- Deduplica contato (email → telefone, padrão existente)
- Cria `crm_contacts` com `clint_id` sintético (`spreadsheet_import_<timestamp>_<index>`)
- Cria `crm_deals` com `tags: ['base clint']`, `origin_id`, primeiro estágio da pipeline
- Usa `SUPABASE_SERVICE_ROLE_KEY` (já disponível)

#### 2. Modificar `useSpreadsheetCompare.ts`
- **Remover** `useAddBaseClintTag` (não mais necessário)
- **Adicionar** `useCreateNotFoundDeals` — mutation que chama a edge function com os leads não encontrados

#### 3. Modificar `SpreadsheetCompareDialog.tsx`
- Trocar botão de "Aplicar tag encontrados" por **"Criar leads não encontrados"**
- Ao clicar, envia os `not_found` para a edge function
- Toast com resultado: "X leads criados com tag 'base clint'"

#### 4. Modificar `Negocios.tsx`
- Passar `originId` para o dialog (necessário para saber em qual pipeline criar os deals)

### Arquivos
- **Criar** `supabase/functions/import-spreadsheet-leads/index.ts`
- **Modificar** `supabase/config.toml` (adicionar entry)
- **Modificar** `src/hooks/useSpreadsheetCompare.ts`
- **Modificar** `src/components/crm/SpreadsheetCompareDialog.tsx`
- **Modificar** `src/pages/crm/Negocios.tsx`


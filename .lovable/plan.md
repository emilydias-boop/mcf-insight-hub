

## Plano: Aceitar lista de texto além de .xlsx no SpreadsheetCompareDialog

### Problema
Atualmente o dialog só aceita arquivos `.xlsx/.xls`. O usuário frequentemente tem listas simples (texto colado ou `.txt/.csv`) com nome e telefone, e precisa cruzar com a base e transferir para um SDR.

### Alterações

**Arquivo: `src/components/crm/SpreadsheetCompareDialog.tsx`**

**Step 1 (Upload) — duas opções de entrada:**

1. **Aba "Arquivo"**: Mantém o input de `.xlsx/.xls` atual, adicionando também `.csv,.txt`
2. **Aba "Colar Lista"**: Um `<textarea>` onde o usuário cola linhas no formato livre (ex: `Nome - 11999998888` ou `Nome;telefone;email`). O sistema detecta automaticamente o separador (`;`, `,`, `-`, tab) e extrai as colunas.

Usar `Tabs` do shadcn para alternar entre as duas opções na step de upload.

**Lógica de parsing da lista colada:**
- Detectar separador mais comum (`;` > `,` > tab > `-`)
- Primeira linha pode ser header ou dado (auto-detectar se contém palavras como "nome", "telefone")
- Gerar o mesmo `headers[]` + `rawData[]` que o upload de arquivo produz, alimentando o mesmo fluxo de mapping → compare → results

**Parsing de CSV/TXT via file input:**
- Para `.csv` e `.txt`: ler como texto (`readAsText`), aplicar a mesma lógica de split por separador
- Para `.xlsx/.xls`: manter o parsing atual via XLSX

**Step 2 (Mapping) e Step 3 (Results):** Sem alterações — o fluxo downstream permanece idêntico.

**Adição do seletor de SDR + transferência (conforme plano anterior aprovado):**
- Adicionar checkboxes nos leads `found` na tabela de resultados
- Adicionar seletor de SDR (query profiles com roles sdr/closer/admin/manager)
- Botão "Transferir X leads" usando `useBulkTransfer`

### Resumo de mudanças
- `SpreadsheetCompareDialog.tsx`: Adicionar tabs Upload/Colar no step 1, parsing de texto, aceitar `.csv/.txt`, checkboxes + seletor SDR + botão transferir no step 3


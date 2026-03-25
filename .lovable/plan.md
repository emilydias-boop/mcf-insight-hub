

## Corrigir contagem de contratos no Controle Diego — filtrar por BU

### Problema
O `useContractReport` busca TODOS os `meeting_slot_attendees` com `contract_paid_at` de qualquer BU (Incorporador, Consórcio, Crédito, Leilão, etc.), resultando em 69 contratos. A página de Vendas filtra corretamente por `product_category = 'incorporador'`, mostrando 39.

### Causa raiz
A query principal em `meeting_slot_attendees` não filtra por origem/BU. Todos os contratos pagos de todas as pipelines aparecem.

### Solução
Filtrar os resultados do `useContractReport` para incluir apenas contratos da BU Incorporador:

#### 1. `src/hooks/useContractReport.ts`
- Na query de `meeting_slot_attendees`, adicionar um filtro por `crm_deals.crm_origins.bu` igual a `'incorporador'` (se o campo `bu` existir na tabela `crm_origins`)
- **OU** filtrar pelos `origin_id` conhecidos da BU Incorporador
- **OU** (abordagem mais simples e segura) fazer um filtro client-side após o fetch, removendo rows cuja `originName` não pertença à BU Incorporador

#### 2. Abordagem recomendada
Verificar a estrutura da tabela `crm_origins` para saber se tem um campo `bu`. Se sim, adicionar o filtro na query SQL. Se não, filtrar client-side.

Preciso verificar a tabela `crm_origins` antes de definir a abordagem exata.

### Alterações previstas
- **`src/hooks/useContractReport.ts`**: Adicionar filtro por BU na query principal e na query de transações Hubla não vinculadas
- **`src/components/relatorios/ControleDiegoPanel.tsx`**: Possivelmente passar o parâmetro `bu` para o hook

### Resultado
O total de contratos no Controle Diego vai bater com o total de Vendas quando o mesmo período for selecionado.


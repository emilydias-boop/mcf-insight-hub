

## Fix: Cross-BU report not finding leads (email field empty)

### Problema raiz
A tabela `consortium_cards` tem **0 emails preenchidos** (de 215 registros). O código atual faz match por email, o que resulta em zero resultados. Os nomes (`nome_completo`) existem em 203 registros e batem com `customer_name` da `hubla_transactions` quando normalizados (UPPER/TRIM).

### Solução

**Alterar `CrossBUReportPanel.tsx`** para fazer matching por **nome** ao invés de email:

1. **Query 1 (consortium_cards)**: Buscar `nome_completo` (já faz), criar map `UPPER(nome) → lead[]` (array, pois um nome pode ter múltiplas cotas)

2. **Query 2 (hubla_transactions)**: Em vez de `.in('customer_email', emails)`, buscar por nomes:
   - Extrair nomes únicos dos leads
   - Fazer query com `.in('customer_name', nomes)` — mas isso é case-sensitive no Supabase
   - Alternativa: usar uma abordagem de buscar todas as transações no período e filtrar client-side pelo nome (upper/trim comparison), já que o `.in()` do Supabase não suporta case-insensitive matching nativo para arrays grandes
   - Melhor abordagem: buscar transações pelo período e depois fazer join client-side por nome normalizado

3. **Join client-side**: `UPPER(TRIM(tx.customer_name))` === `UPPER(TRIM(lead.nome_completo))`

4. **Grupo/Cota**: Como um lead pode ter múltiplas cotas (ex: JOSECLER tem 9), mostrar a transação com os dados do lead mas no campo Grupo/Cota exibir "múltiplas" ou listar todas as cotas separadas

5. **Enriquecer com dados do Hubla**: Já que `consortium_cards` não tem email/telefone, pegar esses dados do `customer_email` e `customer_phone` da `hubla_transactions`

### Mudanças em arquivo

**`src/components/relatorios/CrossBUReportPanel.tsx`**:
- Map: `UPPER(TRIM(nome))` → `ConsorcioLead[]` (array para múltiplas cotas)
- Query transações: buscar por período sem filtro de email, depois filtrar client-side por nomes que existem no map
- Ou usar RPC/chunked `.or()` queries com `customer_name.ilike` para performance
- Grupo/Cota: se lead tem múltiplas cotas, mostrar todas (ex: "7253/1405, 7258/4991, ...")
- Email e telefone: preencher do `hubla_transactions` (`customer_email`, `customer_phone`)

### Preocupação de performance
Buscar todas as transações do período pode ser pesado. Para mitigar:
- Manter limite de 5000 transações
- Fazer o filter por nomes client-side após fetch
- Usar `.ilike` em batches de nomes se necessário


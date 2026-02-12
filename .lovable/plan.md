
# Categorizar Vendas de Lancamento ("Launch")

## Contexto

Leads que vieram de lancamentos (lives do marketing) compram contrato e parceria fora do fluxo normal de closer R1. Por isso, aparecem como "Sem closer" nos relatorios. A identificacao ja existe parcialmente:

- **Tags no CRM**: Deals possuem tags como `Launch`, `DZAM1-Lead Launch`, `Lead Launch 2404.01`
- **Tag `Lead-Lancamento`**: Ja utilizada pelo sistema de distribuicao de leads (`distribute-leads-list`)
- **UTM Campaign**: Presente em algumas transacoes da Hubla
- **Produto especifico**: Alguns launches podem ter produtos distintos

## Solucao

### 1. Adicionar coluna `sale_origin` na tabela `hubla_transactions`

Nova coluna para categorizar a origem da venda:

```text
sale_origin TEXT DEFAULT NULL
-- Valores possiveis: 'launch', 'closer', 'direct', 'outside', NULL (nao categorizado)
```

### 2. Funcao de deteccao de Launch via CRM tags

Ao atribuir transacoes nos relatorios, alem do match por email/telefone com attendees, o sistema verifica se o deal do lead possui tags de lancamento. A logica:

1. Buscar deals no CRM cujo contato tem o mesmo email da transacao
2. Verificar se alguma tag contem "Launch" ou "Lead Launch" ou "Lead-Lancamento"
3. Se sim, categorizar como `sale_origin = 'launch'`

### 3. Interface de categorizacao em massa

Na pagina de Transacoes (`/bu-incorporador/transacoes`), adicionar:

- **Filtro por origem**: Dropdown com "Todos", "Launch", "Closer", "Direto", "Sem categoria"
- **Acao em massa**: Selecionar multiplas transacoes e marcar como "Launch"
- **Upload de lista**: Botao para importar lista de emails do marketing e marcar automaticamente como Launch

### 4. Separacao nos relatorios

Na tabela `CloserRevenueSummaryTable`, adicionar uma linha "Launch" separada de "Sem closer":

```text
Closer      | Transacoes | Bruto    | % Total
Cristiane   | 12         | R$ 50k   | 30%
Thayna      | 8          | R$ 35k   | 20%
Launch      | 15         | R$ 60k   | 35%  <-- Nova linha
Sem closer  | 5          | R$ 25k   | 15%  <-- Reduzido
```

### 5. Deteccao automatica nos webhooks

Atualizar os webhooks para detectar lancamento ao processar transacoes:
- Verificar tags do deal do lead
- Verificar utm_campaign com palavras-chave de launch
- Se detectado, preencher `sale_origin = 'launch'`

## Detalhes Tecnicos

### Migracao SQL

```sql
ALTER TABLE hubla_transactions 
ADD COLUMN sale_origin TEXT DEFAULT NULL;

CREATE INDEX idx_hubla_transactions_sale_origin 
ON hubla_transactions(sale_origin);
```

### Arquivos a criar
- `src/components/incorporador/BulkLaunchTagDialog.tsx` -- Dialog para marcar transacoes em massa como Launch (upload de lista de emails)

### Arquivos a modificar
- `src/components/relatorios/CloserRevenueSummaryTable.tsx` -- Separar "Launch" de "Sem closer" usando tags do CRM
- `src/components/relatorios/CloserRevenueDetailDialog.tsx` -- Condicional para mostrar detalhes de Launch
- `src/pages/bu-incorporador/TransacoesIncorp.tsx` -- Adicionar filtro por sale_origin e acao em massa
- `src/hooks/useAllHublaTransactions.ts` -- Incluir sale_origin nos dados retornados
- `supabase/functions/hubla-webhook-handler/index.ts` -- Preencher sale_origin ao processar transacao

### Logica de atribuicao no relatorio (CloserRevenueSummaryTable)

```text
Para cada transacao:
  1. Match por email/telefone com attendee R1 → atribui ao closer
  2. Se nao matchou, verificar se deal do lead tem tag "Launch" → categoriza como Launch
  3. Se nao tem tag, fica como "Sem closer"
```

A verificacao de tags sera feita com uma query adicional que busca deals com tags de lancamento e cruza por email do contato, sem necessidade de alterar a estrutura existente de attendees.

### Ordem de implementacao

1. Migracao: adicionar coluna `sale_origin`
2. Atualizar `CloserRevenueSummaryTable` para separar Launch de Sem closer
3. Criar dialog de categorizacao em massa
4. Adicionar filtro na pagina de Transacoes
5. Atualizar webhook para deteccao automatica

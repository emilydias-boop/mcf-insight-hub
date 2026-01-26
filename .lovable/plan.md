
# Plano Implementado: Classificação de Canal de Leads (Bio Instagram vs LIVE)

## ✅ Status: Concluído

## Mudanças Realizadas

### 1. Webhook Clint - Parsing de Tags
**Arquivo**: `supabase/functions/clint-webhook-handler/index.ts`
- Adicionada função `parseClintTags()` para converter strings como `[A010 - Construa para Vender BIO - Instagram]` em arrays
- Adicionada função `extractTagsFromClintPayload()` para extrair tags de múltiplas fontes
- Atualizado `handleContactCreated()` para salvar tags parseadas
- Atualizado `handleDealCreated()` para salvar tags parseadas nos deals

### 2. Hook de Detecção de Canal
**Arquivo**: `src/hooks/useBulkA010Check.ts`
- Adicionado tipo `SalesChannel = 'a010' | 'bio' | 'live'`
- Adicionada função `detectSalesChannel()` com lógica de prioridade:
  1. **A010**: Compra confirmada em hubla_transactions
  2. **BIO**: Tag contém "bio" ou "instagram"
  3. **LIVE**: Padrão para leads gratuitos
- Adicionado hook `useBulkChannelCheck()` para detecção em batch

### 3. Componente DealKanbanCard
**Arquivo**: `src/components/crm/DealKanbanCard.tsx`
- Removido uso do hook `useA010Journey` (substituído por prop)
- Adicionada prop `salesChannel?: SalesChannel`
- Badge agora suporta 3 cores:
  - A010: Azul
  - BIO: Verde
  - LIVE: Roxo

### 4. Filtros
**Arquivo**: `src/components/crm/DealFilters.tsx`
- Adicionado tipo `SalesChannelFilter`
- Dropdown de canal agora inclui opção "BIO"

### 5. Página Negocios
**Arquivo**: `src/pages/crm/Negocios.tsx`
- Criado `channelMap` que mapeia email → SalesChannel
- Atualizada lógica de filtro para suportar 3 canais
- Passando `channelMap` para `DealKanbanBoard`

### 6. DealKanbanBoard
**Arquivo**: `src/components/crm/DealKanbanBoard.tsx`
- Adicionada prop `channelMap`
- Passando `salesChannel` para cada `DealKanbanCard`

## Resultado

- Leads Bio Instagram agora exibem badge verde "BIO"
- Leads A010 (com compra) exibem badge azul "A010"
- Leads LIVE (gratuitos) exibem badge roxo "LIVE"
- Filtro permite selecionar cada canal separadamente
- Tags do Clint são sincronizadas corretamente para o Supabase

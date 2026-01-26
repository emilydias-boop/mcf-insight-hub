
# Plano: Classificação de Canal de Leads (Bio Instagram vs LIVE)

## Problema Identificado

O sistema está classificando leads vindos do Bio Instagram como "LIVE" porque:

1. **Tags do Clint não estão sincronizando**: O campo `contact_tag` do Clint vem como string `[A010 - Construa para Vender BIO - Instagram]` e não está sendo parseado para o array `tags` do deal
2. **Lógica de classificação é binária**: Só verifica A010 (compra em hubla_transactions) vs LIVE (padrão)

### Evidência
O lead "Thiago Grossi da Silva" (tgrossis17@gmail.com):
- **No Clint**: `contact_tag:[A010 - Construa para Vender BIO - Instagram]`
- **No Supabase**: `tags: null` (não sincronizado)
- **Exibição**: Badge "LIVE" (incorreto - deveria ser "BIO")

---

## Solução Proposta

### Parte 1: Corrigir Sincronização de Tags (Webhook Clint)

Modificar `supabase/functions/clint-webhook-handler/index.ts` para:
1. Parsear o campo `contact_tag` de string para array
2. Incluir essas tags no deal criado/atualizado

Exemplo de parsing:
```text
"[A010 - Construa para Vender BIO - Instagram]"
  → ["A010 - Construa para Vender", "BIO - Instagram"]
```

### Parte 2: Expandir Classificação de Canal

Adicionar uma terceira categoria **BIO** para leads do Bio Instagram:

| Canal | Badge | Cor | Critério |
|-------|-------|-----|----------|
| A010 | A010 | Azul | Compra A010 confirmada em hubla_transactions |
| BIO | BIO | Verde | Tag contém "BIO" ou "instagram" OU custom_fields.source contém "bio" |
| LIVE | LIVE | Roxo | Padrão (leads de lives gratuitas) |

### Parte 3: Atualizar Filtros

Adicionar "BIO" ao filtro de canal:
- Todos
- A010 (azul)
- BIO (verde)
- LIVE (roxo)

---

## Arquivos a Modificar

### 1. Edge Function: Parsing de Tags
**Arquivo**: `supabase/functions/clint-webhook-handler/index.ts`
- Criar função `parseClintTags(tagString)` para converter string em array
- Aplicar parsing em `handleDealCreated`, `handleDealUpdated`, e `handleContactCreated`

### 2. Hook de Classificação em Batch
**Arquivo**: `src/hooks/useBulkA010Check.ts` → renomear para `useBulkChannelCheck.ts`
- Retornar 3 estados: `'a010' | 'bio' | 'live'`
- Verificar hubla_transactions para A010
- Verificar tags/custom_fields para BIO

### 3. Componente de Card Kanban
**Arquivo**: `src/components/crm/DealKanbanCard.tsx`
- Atualizar badge para suportar 3 canais
- Badge verde para "BIO"

### 4. Filtros
**Arquivo**: `src/components/crm/DealFilters.tsx`
- Adicionar opção "BIO" no dropdown de canal
- Atualizar tipo `salesChannel: 'all' | 'a010' | 'bio' | 'live'`

### 5. Lógica de Filtro
**Arquivo**: `src/pages/crm/Negocios.tsx`
- Usar nova função de classificação
- Aplicar filtro por 3 canais

---

## Detalhes Técnicos

### Função de Parsing de Tags Clint

```text
parseClintTags("[A010 - Construa para Vender BIO - Instagram]")
  → Remover colchetes [ ]
  → Detectar padrões como "A010 - ...", "BIO - ..."
  → Retornar array: ["A010 - Construa para Vender", "BIO - Instagram"]
```

### Nova Lógica de Classificação

```text
function detectSalesChannel(deal, a010StatusMap):
  email = deal.crm_contacts?.email?.toLowerCase()
  
  // 1. A010: Compra confirmada (prioridade máxima)
  if (a010StatusMap?.get(email) === true):
    return 'a010'
  
  // 2. BIO: Verificar tags e source
  tags = deal.tags || []
  source = deal.custom_fields?.source || ''
  
  hasBioTag = tags.some(tag => 
    tag.toLowerCase().includes('bio') || 
    tag.toLowerCase().includes('instagram')
  )
  hasBioSource = source.toLowerCase().includes('bio') || 
                 source.toLowerCase().includes('instagram')
  
  if (hasBioTag || hasBioSource):
    return 'bio'
  
  // 3. LIVE: Padrão
  return 'live'
```

### Interface de Tipos Atualizada

```typescript
type SalesChannel = 'a010' | 'bio' | 'live';

interface DealFiltersState {
  salesChannel: 'all' | SalesChannel;
  // ... outros campos
}
```

### Badge Visual

| Canal | Classe CSS |
|-------|------------|
| A010 | `bg-blue-100 text-blue-700 border-blue-300` |
| BIO | `bg-green-100 text-green-700 border-green-300` |
| LIVE | `bg-purple-100 text-purple-700 border-purple-300` |

---

## Resultado Esperado

1. Leads Bio Instagram exibem badge verde "BIO"
2. Leads A010 (com compra) exibem badge azul "A010"
3. Leads LIVE (gratuitos sem bio) exibem badge roxo "LIVE"
4. Filtro permite selecionar cada canal separadamente
5. Tags do Clint são sincronizadas corretamente para o Supabase

---

## Resumo dos Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/clint-webhook-handler/index.ts` |
| Renomear/Editar | `src/hooks/useBulkA010Check.ts` → `useBulkChannelCheck.ts` |
| Editar | `src/components/crm/DealKanbanCard.tsx` |
| Editar | `src/components/crm/DealFilters.tsx` |
| Editar | `src/pages/crm/Negocios.tsx` |

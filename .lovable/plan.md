
# Plano: Seleção por Quantidade e Ordenação por Movimento no Kanban

## Visão Geral

Duas melhorias no CRM Kanban:
1. **Seleção numérica**: Permitir escolher quantidade de leads para selecionar (de cima para baixo)
2. **Ordenação por movimento**: Leads novos ou movidos aparecem sempre no topo do estágio

---

## Parte 1: Seleção por Quantidade

### Mudanças na Interface

**Arquivo: `src/components/crm/DealFilters.tsx`**
Adicionar um seletor de quantidade no modo de seleção:
- Input numérico para definir "Selecionar X leads"
- Botão "Aplicar" que seleciona os primeiros X leads de cada estágio
- Opção "Selecionar Todos"

**Arquivo: `src/components/crm/DealKanbanBoard.tsx`**
Adicionar handler para seleção por quantidade:
- Receber prop `selectCount: number | 'all'`
- Função `onSelectByCount` que itera pelos estágios e seleciona os primeiros N

**Arquivo: `src/pages/crm/Negocios.tsx`**
- Novo estado: `selectionCount: number | null`
- Função que aplica a seleção em todos os estágios visíveis

### Fluxo de Uso

```text
1. Usuário ativa "Modo Seleção"
2. Aparece input "Quantidade a selecionar: [___] ou [Todos]"
3. Usuário digita "50" e clica "Aplicar"
4. Sistema seleciona os primeiros 50 leads de CADA estágio (de cima para baixo)
5. BulkActionsBar mostra "150 leads selecionados" (50 x 3 estágios)
```

---

## Parte 2: Ordenação por Movimento

### Mudança no Banco de Dados

**Nova coluna em `crm_deals`:**
```sql
ALTER TABLE crm_deals 
ADD COLUMN stage_moved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Preencher dados existentes com created_at como fallback
UPDATE crm_deals SET stage_moved_at = COALESCE(updated_at, created_at);

-- Index para performance na ordenação
CREATE INDEX idx_crm_deals_stage_moved_at ON crm_deals(stage_moved_at DESC);
```

### Mudanças no Código

**Arquivo: `src/hooks/useCRMData.ts`**

1. **useCRMDeals** - Alterar ordenação:
```typescript
// ANTES
.order('created_at', { ascending: false })

// DEPOIS
.order('stage_moved_at', { ascending: false, nullsFirst: false })
```

2. **useUpdateCRMDeal** - Atualizar timestamp ao mover:
```typescript
// Quando stage_id muda, atualizar stage_moved_at
if (deal.stage_id && previousStageId !== deal.stage_id) {
  deal.stage_moved_at = new Date().toISOString();
}
```

3. **useCreateCRMDeal** - Definir ao criar:
```typescript
// Incluir stage_moved_at na criação
const dealWithTimestamp = {
  ...deal,
  stage_moved_at: new Date().toISOString(),
};
```

**Arquivos de Webhook (Edge Functions):**
- `webhook-lead-receiver/index.ts`
- `webhook-live-leads/index.ts`
- `clint-webhook-handler/index.ts`
- `hubla-webhook-handler/index.ts`

Todos precisam incluir `stage_moved_at: new Date().toISOString()` ao inserir ou atualizar deals.

### Benefícios da Ordenação

| Ação | Resultado |
|------|-----------|
| Novo lead entra via webhook | Aparece no topo do estágio inicial |
| SDR arrasta lead para outro estágio | Lead vai para o topo do novo estágio |
| Automação move lead (ex: agendamento) | Lead aparece no topo |

---

## Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/pages/crm/Negocios.tsx` | Adicionar estado/UI de seleção por quantidade |
| `src/components/crm/DealKanbanBoard.tsx` | Adicionar prop e handler de seleção numérica |
| `src/components/crm/BulkActionsBar.tsx` | Adicionar input de quantidade |
| `src/hooks/useCRMData.ts` | Alterar ordenação e atualizar timestamp |
| `supabase/functions/webhook-lead-receiver/index.ts` | Incluir stage_moved_at |
| `supabase/functions/webhook-live-leads/index.ts` | Incluir stage_moved_at |
| `supabase/functions/clint-webhook-handler/index.ts` | Incluir stage_moved_at |
| `supabase/functions/hubla-webhook-handler/index.ts` | Incluir stage_moved_at |

---

## Migração SQL Necessária

```sql
-- 1. Adicionar coluna
ALTER TABLE crm_deals 
ADD COLUMN IF NOT EXISTS stage_moved_at TIMESTAMP WITH TIME ZONE;

-- 2. Preencher dados existentes
UPDATE crm_deals 
SET stage_moved_at = COALESCE(updated_at, created_at) 
WHERE stage_moved_at IS NULL;

-- 3. Definir default para novos registros
ALTER TABLE crm_deals 
ALTER COLUMN stage_moved_at SET DEFAULT NOW();

-- 4. Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_crm_deals_stage_moved_at 
ON crm_deals(stage_moved_at DESC NULLS LAST);
```

---

## Interface de Seleção por Quantidade

A UI ficará assim no modo de seleção:

```text
┌─────────────────────────────────────────────────────────────┐
│  🔲 Modo Seleção    Quantidade: [  50  ] [Aplicar] [Todos]  │
└─────────────────────────────────────────────────────────────┘

Kanban:
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Novo Lead 75 │ │ Qualificado  │ │ Agendado 40  │
├──────────────┤ ├──────────────┤ ├──────────────┤
│ ✓ Lead 1     │ │ ✓ Lead 1     │ │ ✓ Lead 1     │
│ ✓ Lead 2     │ │ ✓ Lead 2     │ │ ✓ Lead 2     │
│ ...          │ │ ...          │ │ ...          │
│ ✓ Lead 50    │ │ ✓ Lead 50    │ │ ✓ Lead 40    │
│ □ Lead 51    │ │ □ Lead 51    │ │              │
│ □ Lead 52    │ │ ...          │ │              │
└──────────────┘ └──────────────┘ └──────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ✓ 140 leads selecionados  │ [Transferir para...] [X]       │
└─────────────────────────────────────────────────────────────┘
```

---

## Resumo Técnico

- **Banco de dados**: 1 nova coluna + 1 índice
- **Frontend**: 3 arquivos modificados
- **Backend**: 4 Edge Functions atualizadas
- **Impacto**: Zero downtime, migração compatível com dados existentes

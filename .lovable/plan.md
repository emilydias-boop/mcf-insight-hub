
# Correções: Contagem Duplicada e Detalhes dos Parceiros GR

## Problemas Identificados

### 1. Contagem Duplicada (current_count = 2x o valor real)

| Carteira | current_count | entries reais |
|----------|---------------|---------------|
| William | 2152 | 1076 |
| Marceline | 1580 | 790 |

**Causa**: O trigger `trigger_update_gr_wallet_count` incrementou o contador durante a execucao de `sync_crm_deals_to_gr_wallets()`, resultando em contagem dupla (funcao inseriu + trigger incrementou).

**Solucao**: Corrigir os valores no banco para refletir a contagem real.

### 2. Botao de Olho nao Abre Detalhes

O componente `GRPartnersTab.tsx` tem o botao com icone `<Eye />` mas **nao tem onClick** para abrir o drawer de detalhes (`GREntryDrawer.tsx`).

**Solucao**: Adicionar estado para controlar o drawer e conectar o botao.

### 3. Historico de Stages Incompleto

A timeline em `GREntryDrawer` busca acoes GR e pagamentos Hubla, mas **nao inclui o historico de movimentacao entre stages** da tabela `deal_activities`.

**Solucao**: Incluir o historico de stages (from_stage/to_stage) na timeline unificada.

---

## Plano de Implementacao

### Passo 1: Corrigir Contagem Duplicada (SQL)

Criar migracao para recalcular o `current_count` baseado nas entries reais:

```sql
-- Recalcular current_count para refletir contagem real
UPDATE gr_wallets gw
SET current_count = (
  SELECT COUNT(*) 
  FROM gr_wallet_entries gwe 
  WHERE gwe.wallet_id = gw.id
);
```

### Passo 2: Conectar Botao de Olho ao Drawer

Modificar `src/components/gr/GRPartnersTab.tsx`:

- Adicionar estado `selectedEntry` para armazenar a entry selecionada
- Adicionar estado `drawerOpen` para controlar abertura
- Importar `GREntryDrawer`
- Conectar botao Eye ao onClick que abre o drawer

### Passo 3: Incluir Historico de Stages na Timeline

Modificar `src/hooks/useGRActions.ts` na funcao `useGREntryTimeline`:

- Adicionar busca na tabela `deal_activities` filtrando pelo `deal_id` da entry
- Mapear `from_stage` e `to_stage` para nomes legíveis usando as stages do CRM
- Incluir na timeline com tipo `stage_change`

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Recalcular current_count |
| `src/components/gr/GRPartnersTab.tsx` | Conectar botao Eye ao GREntryDrawer |
| `src/hooks/useGRActions.ts` | Incluir deal_activities na timeline |

---

## Detalhes Tecnicos

### GRPartnersTab.tsx - Mudancas

```typescript
// Adicionar imports
import { GREntryDrawer } from './GREntryDrawer';

// Adicionar estados
const [selectedEntry, setSelectedEntry] = useState<GRWalletEntry | null>(null);

// Modificar botao Eye
<Button 
  variant="ghost" 
  size="sm"
  onClick={() => setSelectedEntry(entry)}
>
  <Eye className="h-4 w-4" />
</Button>

// Adicionar drawer no final
<GREntryDrawer 
  entry={selectedEntry}
  open={!!selectedEntry}
  onClose={() => setSelectedEntry(null)}
/>
```

### useGRActions.ts - Timeline com Stages

```typescript
// 4. Historico de stages (deal_activities)
const entryData = await supabase
  .from('gr_wallet_entries')
  .select('deal_id')
  .eq('id', entryId)
  .single();

if (entryData.data?.deal_id) {
  const { data: stageChanges } = await supabase
    .from('deal_activities')
    .select('*')
    .eq('deal_id', entryData.data.deal_id)
    .eq('activity_type', 'stage_change')
    .order('created_at', { ascending: false });
  
  stageChanges?.forEach(sc => {
    timeline.push({
      type: 'stage_change',
      date: sc.created_at,
      title: 'Mudanca de Stage',
      description: `${sc.from_stage} → ${sc.to_stage}`,
    });
  });
}
```

---

## Resultado Esperado

1. **Contagem correta**: William mostrara 1076, Marceline 790
2. **Drawer funcional**: Clicar no icone de olho abre os detalhes do parceiro
3. **Timeline completa**: Historico inclui acoes GR + pagamentos + mudancas de stage

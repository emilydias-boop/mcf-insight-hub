

## Adicionar suporte a origens individuais na Configuração de BU

### Problema
A página `/admin/configuracao-bu` lista apenas `crm_groups` (funis pai). Origens filhas como "PIPELINE INSIDE SALES" (que é uma `crm_origin` dentro de um grupo) não aparecem na lista, então não podem ser vinculadas individualmente a uma BU.

A tabela `bu_origin_mapping` já suporta `entity_type: 'origin'`, mas a UI nunca oferece essa opção.

### Solução

Modificar a página `ConfiguracaoBU` para mostrar uma lista hierárquica: grupos com suas origens filhas expansíveis. Permitir selecionar tanto grupos inteiros quanto origens individuais.

**Arquivo:** `src/pages/admin/ConfiguracaoBU.tsx`

#### 1. Buscar origens junto com grupos
Adicionar query para `crm_origins` com `group_id`, agrupando-as sob seus respectivos grupos. Usar a query existente de `useCRMPipelines` para grupos e uma nova query para origens.

#### 2. UI hierárquica com accordion/collapsible
Cada grupo na lista terá um ícone de expandir (chevron). Ao expandir, mostra as origens filhas com checkboxes individuais. O checkbox do grupo seleciona todas as origens do grupo de uma vez.

```text
☑ Perpétuo - X1              [expandir ▾]
   ☐ PIPELINE INSIDE SALES
   ☐ PIPELINE INSIDE SALES - LEAD GRATUITO
   ☐ Perpétuo - Origem ABC
```

#### 3. Salvar mapeamento misto (groups + origins)
Atualizar `handleSave` para incluir tanto `entity_type: 'group'` quanto `entity_type: 'origin'` no array de mappings enviado ao `useSaveBUOriginMapping`.

#### 4. Carregar mapeamento existente de origens
Atualizar o `useEffect` que sincroniza `currentMapping` para também popular um `selectedOrigins` state separado, lendo entries com `entity_type === 'origin'`.

### Detalhes técnicos

| Item | Detalhe |
|------|---------|
| Arquivo principal | `src/pages/admin/ConfiguracaoBU.tsx` |
| Nova query | `crm_origins` com `select('id, name, display_name, group_id')` |
| State novo | `selectedOrigins: Set<string>`, `expandedGroups: Set<string>` |
| Compatibilidade | `bu_origin_mapping` já suporta `entity_type: 'origin'` — sem mudança no banco |


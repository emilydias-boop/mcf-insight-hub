
## Permitir SDRs moverem deals para SEM SUCESSO e SEM INTERESSE

### Problema

No `QuickActionsBlock` (ações rápidas dentro do Drawer do deal), o dropdown de "Mover para estágio" filtra apenas estágios com `stage_order` MAIOR que o estágio atual:

```
const futureStages = stages?.filter(s => s.stage_order > currentStageOrder) || [];
```

O "SEM SUCESSO" tem `stage_order: 13` e o "SEM INTERESSE" tem `stage_order: 101`. Quando o deal já está em um estágio com order >= 13 (como PRODUTOS FECHADOS, order 100), o "SEM SUCESSO" desaparece do dropdown porque 13 < 100. O SDR não consegue voltar o deal para esse estágio pelo dropdown.

No drag-and-drop do Kanban a movimentação funciona normalmente (não tem esse filtro), mas muitos SDRs usam o drawer para mover estágios.

### Solução

Alterar o filtro de estágios no `QuickActionsBlock` para SEMPRE incluir estágios de "perda" (SEM SUCESSO, SEM INTERESSE, Perdido) independentemente do `stage_order`, além dos estágios futuros. Isso garante que o SDR sempre consiga mover um deal para esses estágios, não importa em qual estágio o deal esteja atualmente.

### Alteração

**`src/components/crm/QuickActionsBlock.tsx`**

Modificar a linha do `futureStages` para incluir estágios de perda/rejeição:

```typescript
// Padrões de estágios que sempre devem estar disponíveis para mover
const ALWAYS_AVAILABLE_PATTERNS = [
  'sem sucesso', 'sem interesse', 'não quer', 'perdido', 
  'desistente', 'cancelado', 'reembolsado', 'a reembolsar'
];

const isAlwaysAvailable = (stageName: string) => {
  const lower = stageName.toLowerCase().trim();
  return ALWAYS_AVAILABLE_PATTERNS.some(p => lower.includes(p));
};

const futureStages = stages?.filter(s => 
  s.stage_order > currentStageOrder || isAlwaysAvailable(s.stage_name)
).filter(s => s.id !== deal?.stage_id) || []; // excluir estágio atual
```

Essa mudança garante que:
- Estágios futuros continuam aparecendo normalmente
- Estágios de perda/rejeição sempre aparecem no dropdown, independente da ordem
- O estágio atual é excluído para evitar duplicação
- Funciona para todas as BUs (Consórcio, Incorporador, etc.)

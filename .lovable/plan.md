

## Plano: Tag "Outside" visível no Kanban

### Problema
O badge atual de Outside mostra `$ A010 - Consultoria...` (o nome do produto), que não comunica claramente que o lead é "Outside". O usuário quer ver a palavra **"Outside"** de forma explícita no card.

### Solução
Alterar o badge de Outside no `DealKanbanCard.tsx` para exibir **"Outside"** como texto principal, com o nome do produto como tooltip (hover). Isso mantém a informação do produto acessível sem poluir visualmente o card.

### Arquivo alterado
**`src/components/crm/DealKanbanCard.tsx`** (linhas 357-364)

Trocar:
```tsx
{outsideInfo.productName ? `$ ${outsideInfo.productName}` : '$ Outside'}
```

Por um badge com:
- Texto fixo: **`Outside`** (com ícone `$`)
- Tooltip com o nome do produto (ex: "A010 - Consultoria...")
- Manter o mesmo estilo amarelo já existente

### O que NÃO muda
- O lead permanece em "Novo Lead" (comportamento correto, não há movimentação automática para Outside)
- A lógica de detecção no `useOutsideDetectionForDeals` permanece igual
- Nenhuma alteração no banco de dados




## Plano: Mover badge de capacidade (cadeado) para o topo do slot

### Problema

O badge com o ícone de cadeado e contador (ex: 🔒 3/3) está posicionado no canto inferior direito do card de reunião (`absolute bottom-0.5 right-0.5`), ficando oculto ou difícil de visualizar rapidamente.

### Alteração

| Arquivo | O que muda |
|---------|-----------|
| `src/components/crm/CloserColumnCalendar.tsx` | Mover o badge de `bottom-0.5 right-0.5` para `top-0.5 right-0.5` na linha 537 |

Isso coloca o indicador de capacidade no canto superior direito do slot, ao lado do botão de "Adicionar lead" (que aparece no hover), garantindo visibilidade imediata.


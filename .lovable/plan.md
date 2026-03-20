

## Plano: Reposicionar badge de capacidade (cadeado) para o topo-esquerdo

### Problema

O badge 🔒 3/3 no canto superior direito está sobrepondo os badges de status dos atendees (NS, Agendado, etc.) que ficam alinhados à direita de cada linha.

### Alteração

| Arquivo | O que muda |
|---------|-----------|
| `src/components/crm/CloserColumnCalendar.tsx` (linha 537) | Mover o badge de `top-0.5 right-0.5` para `top-0.5 left-0.5` |

Isso posiciona o indicador de capacidade no canto superior esquerdo, livre de conflito com os badges de status à direita.


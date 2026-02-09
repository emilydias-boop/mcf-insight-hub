
# Corrigir Clique na Reuniao Sobreposta - Juliano vs Raerica

## Problema

Quando duas reunioes do mesmo closer se sobrepoem no tempo (Raerica 16:30-17:30 com 60min e Juliano 17:15), clicar na reuniao do Juliano abre a da Raerica.

**Causa raiz**: No slot das 17:15, existem dois elementos:
1. A reuniao do Juliano que INICIA nesse slot (renderizada como card clicavel)
2. A reuniao da Raerica que COBRE esse slot (16:30 com 60min de duracao)

O problema e que o card do Juliano (linha 1375) nao tem `e.stopPropagation()`. Quando o usuario clica no card, o evento sobe ate o div pai (linha 1214) que detecta `isOccupied = true` e chama `getMeetingCoveringSlot` - que encontra a reuniao da Raerica primeiro.

## Solucao

Adicionar `e.stopPropagation()` nos handlers de click dos cards de reuniao na week view, impedindo que o click propague para o handler do slot pai. Isso garante que clicar em um card de reuniao abre apenas aquela reuniao especifica.

## Secao Tecnica

### Arquivo a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/crm/AgendaCalendar.tsx` | Adicionar `e.stopPropagation()` no onClick do card de reuniao na week view (linha ~1375) |

### Mudanca Especifica

Na linha 1375 do `AgendaCalendar.tsx`, o onClick do button do card de reuniao:

**Antes:**
```typescript
onClick={() => onSelectMeeting(firstMeeting)}
```

**Depois:**
```typescript
onClick={(e) => { e.stopPropagation(); onSelectMeeting(firstMeeting); }}
```

Isso impede que o clique no card de reuniao propague ate o div pai que tem a logica de `isOccupied`, resolvendo o conflito quando duas reunioes do mesmo closer se sobrepoem no tempo.

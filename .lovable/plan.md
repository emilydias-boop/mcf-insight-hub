

# Liberar busca de leads no agendamento R2 para todos os usuários

## Problema

Na modal "Agendar Reunião R2", a busca de leads é restrita para SDRs — eles só veem seus próprios negócios (filtro por `ownerEmail`). Para R2, closers precisam agendar leads de qualquer SDR, então essa trava não faz sentido.

## Mudança

| Arquivo | Alteração |
|---|---|
| `src/components/crm/R2QuickScheduleModal.tsx` | Remover o filtro `sdrOwnerEmail` — passar `undefined` sempre para `useSearchDealsForSchedule`, ignorando o papel do usuário |

### Detalhe técnico

Linha 101:
```typescript
// De:
const sdrOwnerEmail = role === 'sdr' ? user?.email || undefined : undefined;

// Para: (sempre undefined — sem filtro de dono)
const sdrOwnerEmail = undefined;
```

Isso faz com que a busca retorne leads de todos os SDRs, independentemente de quem está logado.


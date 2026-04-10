

# Ocultar pré-agendamentos da grade R2 (manter apenas na aba Pré-Agendados)

## Problema

Leads pré-agendados aparecem na grade do calendário R2 com badge "Pré", poluindo a visualização. O usuário quer que pré-agendamentos fiquem **exclusivamente na aba "Pré-Agendados"** e só apareçam na grade quando confirmados.

## Solução

Filtrar attendees com status `pre_scheduled` nas queries que alimentam a grade do calendário.

| Arquivo | Alteração |
|---|---|
| `src/hooks/useR2AgendaMeetings.ts` | Na função `useR2AgendaMeetings` (linha 91) e `useR2MeetingsByCloser` (linha 147), adicionar filtro para excluir attendees com `status === 'pre_scheduled'` junto com o filtro existente de `cancelled` |

### Alteração

Nas duas funções do arquivo, o filtro de attendees muda de:

```typescript
.filter((att) => att.status !== 'cancelled')
```

Para:

```typescript
.filter((att) => att.status !== 'cancelled' && att.status !== 'pre_scheduled')
```

Como meetings sem attendees visíveis já são filtrados (`.filter(meeting => meeting.attendees.length > 0)`), slots que só têm pré-agendados desaparecerão automaticamente da grade.

O fluxo de pré-agendamento continua funcionando normalmente: o lead é criado com status `pre_scheduled`, aparece na aba "Pré-Agendados", e ao confirmar o status muda para `invited` -- momento em que passa a aparecer na grade.


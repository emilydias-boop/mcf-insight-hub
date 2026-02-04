
# Plano: Permitir Admin Mover Leads para Qualquer Dia

## Problema

O modal "Mover Participante" bloqueia movimentacao para dias diferentes se o status nao for "No-Show". O admin deveria ter poder total para mover leads independente do status.

Linha 140 atual:
```typescript
const blockDifferentDay = isDifferentDay && !isNoShow;
```

Resultado: admin ve a mensagem de bloqueio igual a qualquer usuario.

---

## Solucao

Adicionar `&& !isAdmin` na condicao de bloqueio, permitindo que admins movam para qualquer dia.

---

## Alteracoes

### Arquivo: `src/components/crm/MoveAttendeeModal.tsx`

**Linha 140** - Atualizar logica de bloqueio:

De:
```typescript
const blockDifferentDay = isDifferentDay && !isNoShow;
```

Para:
```typescript
const blockDifferentDay = isDifferentDay && !isNoShow && !isAdmin;
```

---

## Resultado Esperado

- **Admin**: pode mover leads para qualquer dia, independente do status atual
- **Outros usuarios**: continuam precisando marcar como No-Show para mover para outro dia
- Nenhuma mensagem de bloqueio aparece para admin

---

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `MoveAttendeeModal.tsx` | Adicionar `&& !isAdmin` na linha 140 |

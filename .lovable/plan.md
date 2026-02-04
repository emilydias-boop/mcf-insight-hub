
# Plano: Permitir Admin Selecionar Datas Anteriores

## Problema

O calendário no modal "Mover Participante" bloqueia todas as datas anteriores a hoje, mesmo para administradores. O admin deveria poder mover leads para qualquer data, incluindo datas passadas.

## Solucao

Condicionar o bloqueio de datas passadas apenas para usuarios que nao sao admin.

---

## Alteracoes

### Arquivo: `src/components/crm/MoveAttendeeModal.tsx`

**Linha 484** - Atualizar prop `disabled` do CalendarComponent:

De:
```typescript
disabled={(date) => date < startOfToday()}
```

Para:
```typescript
disabled={(date) => !isAdmin && date < startOfToday()}
```

---

## Resultado Esperado

- **Admin**: pode selecionar qualquer data no calendario, incluindo dias passados (1, 2, 3 de fevereiro)
- **Outros usuarios**: continuam bloqueados de selecionar datas anteriores a hoje
- Consistente com as outras permissoes de admin ja implementadas

---

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `MoveAttendeeModal.tsx` | Adicionar `!isAdmin &&` na linha 484 |

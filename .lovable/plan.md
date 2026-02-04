
# Plano: Permitir Admin Ver Slots de Datas Passadas

## Problema

O admin pode selecionar datas passadas no calendario, mas os slots nao aparecem porque a logica de geracao filtra slots que nao estao no futuro.

**Linha 104 atual:**
```typescript
if (isAfter(slotTime, new Date())) {
```

**Resultado:** Para terça-feira 03/02 (passado), mesmo com Mateus Macedo tendo slot as 18:00, nenhum slot aparece.

---

## Solucao

Condicionar a verificacao de "futuro" apenas para usuarios nao-admin.

---

## Alteracoes

### Arquivo: `src/components/crm/MoveAttendeeModal.tsx`

**Linha 104** - Atualizar verificacao de horario:

De:
```typescript
if (isAfter(slotTime, new Date())) {
```

Para:
```typescript
if (isAdmin || isAfter(slotTime, new Date())) {
```

---

## Resultado Esperado

- **Admin**: ve todos os slots configurados para qualquer data selecionada (incluindo passadas)
- **Outros usuarios**: continuam vendo apenas slots futuros
- Mateus Macedo aparecera com slot as 18:00 na terca-feira 03/02

---

## Arquivos

| Arquivo | Alteracao |
|---------|-----------|
| `MoveAttendeeModal.tsx` | Adicionar `isAdmin ||` na linha 104 |

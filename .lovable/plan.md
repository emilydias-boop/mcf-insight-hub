
# Corrigir Exibição de Horários Além das 21:00 no Agenda R2

## Diagnóstico do Problema

### Evidência no Banco de Dados
Thobson Motta tem os seguintes slots configurados para 28/01/2026:
| Horário | Status |
|---------|--------|
| 09:00 | ✅ Configurado |
| 13:00 | ✅ Configurado |
| **22:00** | ✅ Configurado no banco, **mas invisível na interface** |

### Causa Raiz
No arquivo `R2CloserColumnCalendar.tsx`, a constante `ALL_TIME_SLOTS` está **hardcoded** para exibir apenas horários de **07:00 a 21:00**:

```typescript
// Linha 38-43
const ALL_TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7;  // 7 + 14 = 21 (máximo)
  const minute = (i % 2) * 30;
  return { hour, minute, label: `...` };
});
```

**Cálculo atual:**
- `length: 29` → 29 slots de 30 min = 14.5 horas
- Hora inicial: 7
- Hora final: 7 + 14 = **21:00** (21:30 não existe)

Resultado: Horários como **21:30, 22:00, 22:30, 23:00** nunca são exibidos, mesmo que configurados no banco.

---

## Solução Proposta

### Abordagem
Expandir o range de `ALL_TIME_SLOTS` para cobrir **07:00 até 23:30** (todo o dia útil estendido).

### Cálculo Corrigido

| Range Desejado | Início | Fim | Slots |
|----------------|--------|-----|-------|
| 07:00 - 23:30 | 07:00 | 23:30 | 34 slots |

**Fórmula:**
- 07:00 até 23:30 = 16.5 horas = 33 intervalos de 30 min + 1 = **34 slots**

---

## Implementação

### Arquivo: `src/components/crm/R2CloserColumnCalendar.tsx`

**Mudança (linhas 38-43):**

De:
```typescript
// Fixed time slots for R2 (07:00 to 21:00, 30-min intervals)
const ALL_TIME_SLOTS = Array.from({ length: 29 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7;
  const minute = (i % 2) * 30;
  return { hour, minute, label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` };
});
```

Para:
```typescript
// Fixed time slots for R2 (07:00 to 23:30, 30-min intervals)
const ALL_TIME_SLOTS = Array.from({ length: 34 }, (_, i) => {
  const hour = Math.floor(i / 2) + 7;
  const minute = (i % 2) * 30;
  return { hour, minute, label: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}` };
});
```

---

## Resultado Esperado

### Novos Horários Visíveis

| Slot | Horário |
|------|---------|
| 30 | 21:30 |
| 31 | 22:00 ← **Thobson aparece aqui** |
| 32 | 22:30 |
| 33 | 23:00 |
| 34 | 23:30 |

### Comportamento

- O filtro `timeSlots` já existe (linha 112-126) e só exibe horários **configurados** no banco
- Portanto, só aparecerão os horários 22:00+ se algum closer tiver slots configurados nesse período
- Para Thobson: aparecerá o slot das 22:00 como disponível ou com a reunião agendada

---

## Resumo

| Item | Valor |
|------|-------|
| **Arquivo** | `src/components/crm/R2CloserColumnCalendar.tsx` |
| **Linha** | 39 |
| **Mudança** | `length: 29` → `length: 34` |
| **Impacto** | Exibe horários de 07:00 a 23:30 |
| **Risco** | Baixo (apenas expande range visual) |

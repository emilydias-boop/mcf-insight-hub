
# Plano: Permitir Admin Mover para Qualquer Horario do Closer (R1)

## Problema Atual

No `MoveAttendeeModal` (Agenda R1), a logica atual (linhas 107-121) filtra slots que ja tem reunioes:

```typescript
const isBooked = bookedSlots?.some(booked => {...});

if (!isBooked) {
  slots.push({...}); // So adiciona se NAO estiver reservado
}
```

Isso significa que horarios com reunioes existentes NAO aparecem como "Slots Disponiveis" - eles so aparecem na secao "Reunioes Existentes" (se houver alguma reuniao naquele dia).

O admin precisa ver TODOS os horarios configurados do closer para poder mover leads para qualquer um deles.

---

## Solucao

Adicionar bypass para admin que mostra todos os slots, independente de ja terem reuniao.

---

## Alteracoes

### Arquivo: `src/components/crm/MoveAttendeeModal.tsx`

**1. Importar useAuth e criar variavel isAdmin (apos linha 32):**

```typescript
import { useAuth } from '@/contexts/AuthContext';

// Dentro do componente (apos linha 71):
const { role } = useAuth();
const isAdmin = role === 'admin';
```

**2. Modificar logica de availableSlots (linhas 107-121):**

De:
```typescript
if (!isBooked) {
  slots.push({...});
}
```

Para:
```typescript
// Admin pode ver todos os horarios, mesmo os reservados
if (isAdmin || !isBooked) {
  slots.push({
    closerId: closer.id,
    closerName: closer.name,
    closerColor: (closer as any).color || '#3B82F6',
    datetime: new Date(slotTime),
    duration: avail.slot_duration_minutes,
    isBooked: isBooked, // Flag para indicar visualmente
  });
}
```

**3. Atualizar interface AvailableSlot (linha 49):**

```typescript
interface AvailableSlot {
  closerId: string;
  closerName: string;
  closerColor: string;
  datetime: Date;
  duration: number;
  isBooked?: boolean; // Nova propriedade
}
```

**4. Atualizar UI para indicar slots ja reservados (linhas 570-605):**

Adicionar badge visual amarelo para slots que ja tem reuniao:

```typescript
<Badge
  variant={slot.isBooked ? 'secondary' : 'outline'}
  className={cn(
    'text-xs',
    slot.isBooked 
      ? 'text-amber-600 border-amber-300 bg-amber-50' 
      : 'text-green-600 border-green-300'
  )}
>
  {slot.isBooked ? 'Ocupado (Admin)' : 'Livre'}
</Badge>
```

---

## Fluxo Visual Resultante

**Usuario Normal:**
```text
Slots Disponiveis:
  Closer A - 09:00 [Livre] [Mover]
  Closer A - 11:00 [Livre] [Mover]
  
Encaixar em Reuniao Existente:
  Closer A - 10:00 - 2 participantes [Encaixar]
```

**Admin:**
```text
Slots Disponiveis:
  Closer A - 09:00 [Livre] [Mover]
  Closer A - 10:00 [Ocupado (Admin)] [Mover]  <- NOVO
  Closer A - 11:00 [Livre] [Mover]
  
Encaixar em Reuniao Existente:
  Closer A - 10:00 - 2 participantes [Encaixar]
```

---

## Resumo das Alteracoes

| Local | Linhas | Alteracao |
|-------|--------|-----------|
| Imports | ~32 | Adicionar `useAuth` |
| Componente | ~71 | Criar `isAdmin` |
| Interface | ~49 | Adicionar `isBooked?: boolean` |
| availableSlots | ~107-121 | Bypass `isBooked` para admin |
| UI | ~570-605 | Badge visual para slots ocupados |

---

## Comportamento

- **Usuarios normais**: Continuam vendo apenas slots vazios + reunioes existentes
- **Admin**: Ve TODOS os horarios configurados do closer, com indicador visual de ocupacao
- Ao clicar em um slot "ocupado", o sistema cria/adiciona o lead na reuniao existente daquele horario (logica ja existe no `moveToNewSlot`)

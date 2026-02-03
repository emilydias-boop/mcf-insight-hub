
# Plano: Permitir Admin Ultrapassar Limite de Leads por Reuniao

## Contexto do Problema

O sistema atual possui um limite configuravel de leads por slot de reuniao (padrao: 4). Este limite e aplicado em:

1. **R2AttendeeTransferModal** (linha 236): `disabled={!slot.isAvailable}` - slots cheios ficam desabilitados
2. **useR2CloserAvailableSlots** (linha 114): `isAvailable: currentCount < maxLeadsPerSlot` - marca slots cheios como indisponiveis

Quando um slot atinge a capacidade maxima, NINGUEM pode adicionar mais leads, nem mesmo admins.

---

## Solucao Proposta

Adicionar um parametro `isAdmin` que permite ultrapassar o limite de capacidade:

- Se `isAdmin = true`: todos os slots aparecem como selecionaveis, mesmo os cheios
- Se `isAdmin = false`: comportamento atual (slots cheios ficam desabilitados)

---

## Arquivos a Modificar

### 1. `src/hooks/useR2CloserAvailableSlots.ts`

Adicionar parametro opcional `bypassCapacity`:

```typescript
export function useR2CloserAvailableSlots(
  closerId: string | undefined, 
  date: Date | undefined,
  bypassCapacity: boolean = false  // NOVO
)
```

Alterar calculo de disponibilidade (linha 114):

```typescript
isAvailable: bypassCapacity || currentCount < maxLeadsPerSlot,
```

---

### 2. `src/components/crm/R2AttendeeTransferModal.tsx`

Importar `useAuth` e verificar se usuario e admin:

```typescript
import { useAuth } from '@/hooks/useAuth';

// Dentro do componente:
const { role } = useAuth();
const isAdmin = role === 'admin';
```

Passar flag para o hook:

```typescript
const { data: slotsData } = useR2CloserAvailableSlots(
  selectedCloserId || undefined,
  selectedDate,
  isAdmin  // Bypass para admin
);
```

Adicionar indicador visual para slots cheios (mas selecionaveis):

```typescript
<Badge
  variant={slot.isAvailable ? 'outline' : 'secondary'}
  className={cn(
    'text-xs',
    slot.currentCount >= slot.maxCount 
      ? 'text-amber-600 border-amber-300'  // Cheio mas permitido
      : 'text-green-600 border-green-300'  // Disponivel normal
  )}
>
  {slot.currentCount}/{slot.maxCount}
  {slot.currentCount >= slot.maxCount && isAdmin && ' (Admin)'}
</Badge>
```

---

## Fluxo Visual Resultante

**Usuario Normal** (SDR, Closer, Coordenador):
```text
Horario        Capacidade
09:00          3/4  [verde - selecionavel]
10:00          4/4  [cinza - DESABILITADO]
11:00          2/4  [verde - selecionavel]
```

**Admin**:
```text
Horario        Capacidade
09:00          3/4  [verde - selecionavel]
10:00          4/4 (Admin)  [amarelo - SELECIONAVEL]
11:00          2/4  [verde - selecionavel]
```

---

## Alteracoes de Codigo

| Arquivo | Linhas | Alteracao |
|---------|--------|-----------|
| `useR2CloserAvailableSlots.ts` | ~20, ~114 | Novo parametro + logica bypass |
| `R2AttendeeTransferModal.tsx` | ~30-35, ~59, ~240-248 | useAuth + passar flag + UI visual |

---

## Consideracoes

1. **Apenas Admin**: A permissao e exclusiva para role `admin` - managers e coordenadores respeitam o limite
2. **Indicador Visual**: Slots acima da capacidade mostram badge amarelo com "(Admin)" para clareza
3. **Auditoria**: O log de transferencia (`attendee_movement_logs`) ja registra quem fez a acao
4. **Sem Alteracao de Banco**: Nao requer migrations - apenas logica de frontend/hook

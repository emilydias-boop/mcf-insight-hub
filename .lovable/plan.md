

## Problema: Botão "Excluir" não aparece para reuniões com status "Realizada"

### Causa raiz

O botão "Excluir Permanentemente" no drawer da agenda só é exibido quando a reunião está com status `scheduled`, `rescheduled` ou `no_show` (linha 1135 de `AgendaMeetingDrawer.tsx`):

```typescript
{(isPending || activeMeeting.status === 'no_show') && canDeleteMeeting && (
```

Como o lead "Luiz" está com status **"Realizada"** (`completed`), o botão não aparece — mesmo para admins.

### Correção

**Arquivo**: `src/components/crm/AgendaMeetingDrawer.tsx` (linha 1135)

Expandir a condição para incluir `completed` (e opcionalmente `contract_paid`), permitindo que coordenadores/admins excluam reuniões em qualquer status:

```typescript
// Antes:
{(isPending || activeMeeting.status === 'no_show') && canDeleteMeeting && (

// Depois:
{canDeleteMeeting && (
```

Remover a restrição de status para quem tem permissão de exclusão (`canDeleteMeeting` já valida que o usuário é admin/manager/coordenador). Isso permite excluir reuniões em qualquer status, o que faz sentido para roles elevados.

### Arquivo afetado
- `src/components/crm/AgendaMeetingDrawer.tsx` — Remover filtro de status do botão "Excluir"


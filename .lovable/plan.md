
# Plano: Remover Funcao de Restaurar Contrato Pago

## Alteracoes

### 1. Arquivo: `src/hooks/useAgendaData.ts`

Remover a funcao `useRestoreAttendeeContractPaid` (linhas 541-571).

### 2. Arquivo: `src/components/crm/AgendaMeetingDrawer.tsx`

**Parte A**: Remover import do hook (linha 58):
```typescript
// Remover: useRestoreAttendeeContractPaid
```

**Parte B**: Remover inicializacao do hook (linha 150):
```typescript
// Remover: const restoreContractPaid = useRestoreAttendeeContractPaid();
```

**Parte C**: Remover o botao de restaurar (linhas 725-740):
```typescript
// Remover todo o bloco do botao "Restaurar Contrato Pago"
```

## Resumo

| Arquivo | Alteracao |
|---------|-----------|
| `useAgendaData.ts` | Remover funcao `useRestoreAttendeeContractPaid` |
| `AgendaMeetingDrawer.tsx` | Remover import, hook e botao |

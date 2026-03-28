

## Remover alerta sonoro

### Mudança
Remover o som de sirene do sistema de alertas de ações atrasadas, mantendo apenas o alerta visual (overlay pulsante).

### Arquivos alterados
1. **`src/components/sdr/OverdueAlertOverlay.tsx`** — remover import e chamada do `useOverdueAlertSound`
2. **`src/hooks/useOverdueAlertSound.ts`** — pode ser deletado ou mantido (não será mais usado)


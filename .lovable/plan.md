

## Limpeza: remover imports não utilizados

### Problema encontrado
Após as alterações recentes, sobrou um import não utilizado:

- **`src/components/sdr/OverdueAlertOverlay.tsx`** — `useCallback` é importado mas nunca usado (foi removido junto com a lógica de áudio)

O arquivo `useOverdueAlertSound.ts` já foi deletado e não há mais referências a ele no projeto — está limpo.

### Correção
- Remover `useCallback` do import do React em `OverdueAlertOverlay.tsx`

### Arquivo alterado
- `src/components/sdr/OverdueAlertOverlay.tsx` (1 linha)


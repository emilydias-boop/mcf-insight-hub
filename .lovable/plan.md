

## Overlay global de ações atrasadas + botão "Ignorar 2min"

### Problema
O `OverdueAlertOverlay` só aparece em MinhasReunioes. Se o SDR navega para Negócios ou outra tela, o alerta desaparece.

### Solução

#### 1. Mover overlay para `MainLayout.tsx`
- Importar e renderizar `<OverdueAlertOverlay />` dentro do `MainLayout`, ao lado do `<TwilioSoftphone />` — assim aparece em **todas as páginas**
- Remover o `<OverdueAlertOverlay />` de `MinhasReunioes.tsx`
- O overlay só deve renderizar para usuários com role SDR (verificar com `useAuth`)

#### 2. Adicionar botão "Ignorar 2min" no overlay
- Atualizar `OverdueAlertOverlay.tsx` com estado `isDismissed` + `setTimeout` de 2 minutos
- Ao clicar no X/botão "Ignorar", o overlay some por 2 minutos e depois reaparece
- O click no corpo do overlay continua navegando para `/sdr/minhas-reunioes` (ou scroll se já estiver na página)
- Layout: botão X pequeno no canto superior direito do overlay

#### 3. Também mover o som para o MainLayout
- O som está no `PendingActionsPanel` (só roda em MinhasReunioes). Mover o `useOverdueAlertSound` para o overlay global para que toque em qualquer página
- Respeitar o mesmo `isDismissed` de 2min para silenciar o som

### Arquivos alterados
- `src/components/sdr/OverdueAlertOverlay.tsx` — adicionar dismiss 2min + som + check de role SDR
- `src/components/layout/MainLayout.tsx` — renderizar `<OverdueAlertOverlay />`
- `src/pages/sdr/MinhasReunioes.tsx` — remover `<OverdueAlertOverlay />`


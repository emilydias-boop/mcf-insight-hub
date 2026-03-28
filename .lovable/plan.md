

## Alerta sonoro agressivo para Próximas Ações atrasadas

### Objetivo
Fazer o sistema "irritar" o SDR com som e alertas visuais impossíveis de ignorar quando há ações atrasadas.

### Mudanças

#### 1. `src/hooks/useOverdueAlertSound.ts` (novo)
Hook que:
- Usa Web Audio API para gerar um beep de alerta (sem precisar de arquivo .mp3)
- Toca som a cada 30 segundos enquanto houver ações atrasadas
- Toca som imediatamente ao detectar novas ações atrasadas
- Usa `useRef` para controlar intervalo e evitar tocar quando tab está inativa (`document.hidden`)
- Função `playAlertBeep()` gera tom de 800Hz por 200ms, pausa, repete 3x (padrão urgente)
- Respeita um estado `muted` (botão para silenciar temporariamente por 5 min)

#### 2. `src/components/sdr/PendingActionsPanel.tsx` (atualizar)
- Integrar `useOverdueAlertSound` passando `overdueCount`
- Adicionar botão "Silenciar 5min" (ícone Volume/VolumeX) no header quando há atrasadas
- Modal/toast fullscreen bloqueante quando há 3+ ações atrasadas: overlay vermelho com "Você tem X ações atrasadas!" e botão "Ver ações" que abre o painel
- Animação mais agressiva: `animate-bounce` no header + borda vermelha grossa pulsante

#### 3. `src/components/sdr/OverdueAlertOverlay.tsx` (novo)
Overlay vermelho semi-transparente que aparece quando há ações atrasadas:
- Fixo no canto inferior direito (não bloqueia uso, mas incomoda)
- Mostra contagem de atrasadas com ícone pulsante
- Som de alerta ao aparecer
- Botão "Resolver agora" que scrolla até o painel
- Aparece apenas na rota do SDR (MinhasReunioes e Negocios)

#### 4. `src/pages/sdr/MinhasReunioes.tsx` (atualizar)
- Importar e renderizar `<OverdueAlertOverlay />`

### Comportamento do som
- Beep triplo usando Web Audio API (oscilador 800Hz, gain ramp)
- Toca ao carregar a página se há atrasadas
- Repete a cada 30s enquanto houver atrasadas
- Para quando todas as ações são concluídas ou silenciadas
- Silenciar temporário: 5 minutos, depois volta

### Arquivos
- `src/hooks/useOverdueAlertSound.ts` (novo)
- `src/components/sdr/OverdueAlertOverlay.tsx` (novo)
- `src/components/sdr/PendingActionsPanel.tsx` (atualizar)
- `src/pages/sdr/MinhasReunioes.tsx` (atualizar)


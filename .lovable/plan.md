## Problema

Ao clicar em **Pausar** no discador automático, ele fica "processando" e não volta a fazer ligações ao retomar. Isso acontece por 4 bugs em `src/contexts/AutoDialerContext.tsx`:

1. **`pause()` reusa o estado `'idle'`** (mesmo estado de "fila nunca iniciada"), em vez de um estado próprio `'paused'`. A UI e a lógica não distinguem os dois.
2. **`resume()` exige `currentIndex < queue.length - 1`** — se a pausa ocorre no último lead ou logo após avançar, retomar não faz nada.
3. **Race condition** entre `pause()` e o `setTimeout(handleCompletion, 1500)` que decide o próximo passo após uma chamada terminar — quando o callback dispara, o estado já é `'idle'` e ele aborta sem avançar `currentIndex`. Ao retomar, o índice está "preso" no lead anterior.
4. **`pause()` não derruba chamada em andamento** — se pausar durante `ringing`/`connecting`, a ligação fica viva no Twilio e o estado interno fica inconsistente.

## Solução

Refatorar `pause` / `resume` e os handlers internos para usar um estado de pausa explícito.

### Mudanças em `src/contexts/AutoDialerContext.tsx`

1. **Adicionar estado `'paused'`** ao tipo `AutoDialerState`:
   ```ts
   export type AutoDialerState = 'idle' | 'running' | 'paused' | 'paused-in-call' | 'paused-qualifying' | 'finished';
   ```

2. **`pause()` passa a:**
   - Setar estado para `'paused'` (não mais `'idle'`).
   - Limpar todos os timers (ring + advance).
   - Cancelar chamada em andamento se `callStatus` for `ringing` / `connecting` (não derrubar `in-progress` — neste caso já estamos em `paused-in-call`).
   - Resetar `isAdvancingRef.current = false` para permitir avanço futuro.
   - Se o lead atual estava `in-progress` mas não foi atendido, voltar resultado para `'pending'` para ele ser rediscado no resume.

3. **`resume()` passa a:**
   - Só exigir `state === 'paused' && currentIndex >= 0 && currentIndex < queue.length`.
   - Se o lead atual ainda está `pending` ou `in-progress` (não foi finalizado), **rediscar o índice atual** (`dialIndex(currentIndex)`).
   - Se o lead atual já foi finalizado (answered/no-answer/failed/skipped), avançar para o próximo (`advanceToNext`).
   - Se já estiver no fim da fila, marcar como `'finished'`.

4. **`handleCompletion` (linha 221-280)** passa a:
   - Verificar `stateRef.current === 'running' || stateRef.current === 'paused'`.
   - Se `paused`: registrar resultado normalmente, mas **não disparar `retryCurrent` nem `advanceToNext`** — apenas atualizar o estado do lead. O próximo passo fica para o `resume()` decidir.

5. **`loadQueue` e `start`** passam a tratar `'paused'` como bloqueador igual a `'running'` na hora de carregar nova fila.

### Mudanças nos componentes consumidores

6. **`src/components/sdr/AutoDialerPanel.tsx`** e **`AutoDialerInCallBanner.tsx`**:
   - Adicionar `'paused'` na lógica de exibição do botão Retomar.
   - Mostrar badge "Pausado" quando estado for `'paused'`.
   - Habilitar botão "Retomar" quando estado for `'paused'` (hoje provavelmente verifica `'idle'`, o que confunde com fila nova).

### Validação

- Verificar TypeScript não quebra em outros consumidores de `AutoDialerState` (`rg "AutoDialerState\\|state ===" src/`).
- Testar fluxo: iniciar fila → pausar durante ringing → retomar (deve rediscar mesmo lead).
- Testar: pausar durante in-progress (paused-in-call) → desligar → continuar.
- Testar: pausar no último lead → retomar (deve marcar finished, não travar).

## Arquivos afetados

- `src/contexts/AutoDialerContext.tsx` (principal)
- `src/components/sdr/AutoDialerPanel.tsx` (UI do botão)
- `src/components/sdr/AutoDialerInCallBanner.tsx` (UI do banner)

Sem mudanças de banco, sem edge functions, sem secrets.

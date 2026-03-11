

## Plano: Mudar grid do calendário de 15 para 30 minutos

### O que muda

O calendário atualmente gera slots de 15 em 15 minutos (08:00, 08:15, 08:30, 08:45...), resultando em 4 linhas por hora. Mudar para 30 minutos reduz para 2 linhas por hora, deixando o calendário mais compacto.

### Alterações em `src/components/crm/AgendaCalendar.tsx`

1. **Geração de time slots** (linha ~193-198): Trocar divisor de 4 para 2, multiplicador de 15 para 30
   ```typescript
   const totalSlots = (maxHour - minHour) * 2;
   // i / 2 + minHour, (i % 2) * 30
   ```

2. **SLOT_HEIGHT** (linha 63): Manter 48px por slot (cada linha agora representa 30min)

3. **Todas as referências a `15` minutos** (~15 ocorrências): Trocar para `30` nos cálculos de:
   - Current time indicator position (`/ 15` → `/ 30`)
   - Meeting matching (`minute + 15` → `minute + 30`)
   - `getSlotsNeeded` (`/ 15` → `/ 30`)
   - Scroll position calculations
   - `isCurrentSlot` check

4. **Label do horário**: Remover a lógica que esmaece labels de `:15` e `:45` (não existirão mais)

5. **Meeting card height**: Com slots de 30min, uma reunião de 30min ocupa 1 slot (48px) em vez de 2. Cards ficam proporcionais.

### Impacto

- R1 e R2 usam o mesmo componente — ambos ficam com grid de 30min
- Reuniões que começam em horários quebrados (ex: 09:15) serão agrupadas no slot 09:00




## Tornar o alerta sonoro mais agressivo e alto

### Problema
O beep atual usa ganho de 0.3 com onda quadrada a 800Hz — volume baixo e tom pouco chamativo.

### Solução

Alterar `src/hooks/useOverdueAlertSound.ts`:

1. **Aumentar volume**: ganho de `0.3` → `0.8`
2. **Usar dois tons alternados** (sirene): 800Hz e 1200Hz alternando nos 3 beeps — padrão de alarme mais irritante
3. **Aumentar duração**: `BEEP_DURATION` de 0.15s → 0.3s
4. **Aumentar repetições**: `BEEP_COUNT` de 3 → 5
5. **Adicionar distorção**: usar `WaveShaperNode` para criar um som mais áspero e impossível de ignorar
6. **Tom tipo sirene**: frequência sobe de 600Hz para 1200Hz durante cada beep (`linearRampToValueAtTime`)

O resultado será um som tipo alarme/sirene que sobe e desce, bem mais alto e irritante que o beep atual.

### Arquivo alterado
- `src/hooks/useOverdueAlertSound.ts`


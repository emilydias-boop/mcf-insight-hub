
# Liberacao do iFood Ultrameta para Equipe Inside Incorporador

## Situacao Atual

Na tela de Fechamento SDR (janeiro/2026), apenas o **Antony Elias** esta recebendo R$ 840 de iFood Ultrameta, enquanto **toda a equipe Inside Incorporador** deveria receber R$ 1.000 cada.

### Dados Verificados

| Dado | Valor |
|------|-------|
| Faturamento Incorporador (jan/2026) | R$ 5.035.678 |
| Meta Ultrameta configurada | R$ 1.600.000 |
| Premio Ultrameta (team_monthly_goals) | R$ 1.000 |
| SDRs elegíveis no Incorporador | 10 (Julia, Carol Correa, Leticia, Carol Souza, Antony, Cristiane, Juliana, Vinicius, Jessica Martins, Yanca) |
| Closers elegíveis no Incorporador | 3 (Jessica Bellini, Julio, Thayna) |

### Valores Atuais no Banco

```
Antony Elias    → ifood_ultrameta: 840 (INCORRETO - deveria ser 1000)
Julio           → ifood_ultrameta: 50  (INCORRETO - deveria ser 1000)
Todos os outros → ifood_ultrameta: 0   (INCORRETO - deveria ser 1000)
```

## Diagnostico

Analisando a Edge Function `recalculate-sdr-payout`, identifiquei **dois problemas**:

### Problema 1: Logica de Calculo Individual Sobrescreve o Time

Na funcao `calculatePayoutValues()` (linha 366), o `ifood_ultrameta` e calculado baseado na **performance individual**:

```javascript
const ifood_ultrameta = pct_media_global >= 100 ? compPlan.ifood_ultrameta : 0;
```

Isso usa `compPlan.ifood_ultrameta` que e R$ 50 (valor individual), NAO o premio do time (R$ 1.000).

### Problema 2: Substituicao do Time Nao Esta Funcionando

A logica nas linhas 1175-1185 deveria substituir o valor individual pelo premio do time:

```javascript
if (teamUltrametaHit && teamGoal && elegivelUltrameta) {
  baseValues.ifood_ultrameta = teamGoal.ultrameta_premio_ifood || 0;
}
```

Mas `teamUltrametaHit` pode nao estar sendo calculado corretamente OU o calculo de faturamento da BU Incorporador esta errado na funcao.

### Problema 3: Valor 840 do Antony

O valor R$ 840 para Antony Elias nao corresponde a nenhuma configuracao:
- Premio do time: R$ 1.000
- Premio individual: R$ 50
- R$ 840 parece ser um valor remanescente de calculo antigo ou erro de arredondamento

## Solucao

### Passo 1: Correcao Imediata via SQL

Atualizar manualmente o `ifood_ultrameta` para R$ 1.000 em todos os SDRs/Closers elegiveis do Inside Incorporador para janeiro/2026:

```sql
UPDATE sdr_month_payout p
SET 
  ifood_ultrameta = 1000,
  total_ifood = ifood_mensal + 1000,
  updated_at = NOW()
FROM sdr s
WHERE p.sdr_id = s.id
  AND p.ano_mes = '2026-01'
  AND s.squad = 'incorporador'
  AND s.active = true
  AND p.status != 'LOCKED'
  AND EXISTS (
    SELECT 1 FROM employees e 
    WHERE e.sdr_id = s.id 
    AND e.status = 'ativo'
    AND (e.data_admissao IS NULL OR e.data_admissao < '2026-01-01')
  );
```

### Passo 2: Corrigir Edge Function

Modificar `supabase/functions/recalculate-sdr-payout/index.ts` para garantir que:

1. O calculo de faturamento da BU Incorporador use a mesma logica do frontend (`useUltrametaByBU`)
2. Adicionar logs de debug para verificar o calculo de `buUltrametaHit`
3. Garantir que o premio do time seja aplicado ANTES da funcao `calculatePayoutValues` retornar, nao depois

---

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| Nova migracao SQL | Corrigir ifood_ultrameta para R$ 1000 nos SDRs/Closers Incorporador |
| `supabase/functions/recalculate-sdr-payout/index.ts` | Melhorar logica de verificacao ultrameta do time |

---

## Resultado Esperado

| SDR/Closer | iFood Mensal | iFood Ultrameta | Total iFood |
|------------|--------------|-----------------|-------------|
| Julia Caroline | R$ 600 | R$ 1.000 | R$ 1.600 |
| Carol Correa | R$ 600 | R$ 1.000 | R$ 1.600 |
| Leticia Nunes | R$ 600 | R$ 1.000 | R$ 1.600 |
| Carol Souza | R$ 600 | R$ 1.000 | R$ 1.600 |
| Antony Elias | R$ 600 | R$ 1.000 | R$ 1.600 |
| Cristiane Gomes | R$ 600 | R$ 1.000 | R$ 1.600 |
| Juliana Rodrigues | R$ 600 | R$ 1.000 | R$ 1.600 |
| Vinicius Rangel | R$ 600 | R$ 1.000 | R$ 1.600 |
| Jessica Martins | R$ 600 | R$ 1.000 | R$ 1.600 |
| Yanca Oliveira | R$ 600 | R$ 1.000 | R$ 1.600 |
| Jessica Bellini | R$ 600 | R$ 1.000 | R$ 1.600 |
| Julio | R$ 650* | R$ 1.000 | R$ 1.650 |
| Thayna | R$ 600 | R$ 1.000 | R$ 1.600 |

*Julio tem iFood Mensal de R$ 650 configurado no calendario

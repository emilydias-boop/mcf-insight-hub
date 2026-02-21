

# Fix: Outside Trabalhados mostrando leads nao trabalhados

## Problema

O campo `last_worked_at` foi preenchido em massa (provavelmente por uma migracao ou script) em `2026-02-03 19:26:44` para milhares de deals, mesmo aqueles sem nenhuma atividade real (0 calls, 0 notas, 0 whatsapp). Isso faz com que o filtro "Outside Trabalhados" mostre leads que nunca foram efetivamente trabalhados por um SDR.

Exemplo: deals no estagio "Novo Lead" com `last_worked_at = 2026-02-03` e `activity_count = 0` aparecem como "trabalhados".

## Solucao

Remover `last_worked_at` da logica de determinacao de "trabalhado" e usar **apenas** a contagem real de atividades (`totalActivities` do `activitySummaries`).

### Arquivo: `src/pages/crm/Negocios.tsx`

Alterar as duas verificacoes (linhas ~492-501):

De:
```
const hasActivity = (summary?.totalActivities ?? 0) > 0 || !!(deal as any).last_worked_at;
```

Para:
```
const hasActivity = (summary?.totalActivities ?? 0) > 0;
```

Isso garante que apenas deals com chamadas, notas ou mensagens reais sejam considerados "trabalhados", independente do valor de `last_worked_at`.

## Impacto

- Leads em "Novo Lead" sem atividades reais passam a aparecer corretamente como "Outside Nao Trabalhados"
- Leads com pelo menos 1 atividade real continuam como "Outside Trabalhados"
- Nenhuma query adicional necessaria - apenas remocao de uma condicao incorreta


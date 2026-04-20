

## Esclarecer: "Acumulado" soma > "Leads únicos" é o comportamento correto

### Por que 455 + 78 + 192 + 2 = 727 ≠ 668

A coluna **Acumulado** mostra, para cada estágio, **quantos leads únicos já passaram por ele** (incluindo inferência da trilha). Como um mesmo lead aparece em **múltiplos estágios** ao longo da jornada, somar a coluna verticalmente conta o mesmo lead várias vezes.

Exemplo concreto: um lead que hoje está em "Lead Qualificado" também passou por "Anamnese Incompleta" e "Novo Lead" → conta nos 3 estágios. A soma vertical é uma soma de **passagens acumuladas**, não de leads únicos.

**668** é o universo real (cada lead contado 1 vez). **727** é a soma das passagens nos 4 estágios visíveis. Os dois números medem coisas diferentes — ambos estão corretos.

### Validação numérica

Com os 4 estágios da imagem (todos no topo do funil, antes de qualificação):
- 668 leads únicos no universo
- Cada lead "passa" em média por ~1,09 estágios desses 4 → 668 × 1,09 ≈ 727 ✅

Isso é matematicamente consistente. Não há bug.

### O que propor para resolver a confusão visual

**Opção A — Tooltip explicativo no header "Acumulado"** (recomendado, mínimo)

Atualizar o tooltip do ícone (ⓘ) ao lado de "Acumulado" para deixar explícito:

> "Quantidade de leads únicos que já passaram por este estágio no período. Como cada lead passa por vários estágios, a **soma vertical desta coluna é maior que o total de leads únicos** — isso é esperado."

**Opção B — Remover a soma vertical do rodapé da coluna Acumulado**

Hoje o rodapé mostra "Soma (passagens) = 727" para Acumulado, o que reforça a confusão. Substituir por um traço (—) ou pelo texto "n/a (ver Leads únicos)" deixa claro que somar essa coluna não tem significado.

**Opção C — Renomear "Acumulado" para "Passou pelo estágio"**

Tornar o nome da coluna autoexplicativo: deixa claro que é uma contagem por estágio, não cumulativa.

### Mudanças no código

**`src/components/crm/StageMovementsSummaryTable.tsx`** (~10 linhas)

1. Atualizar o texto do `Tooltip` do header "Acumulado" com a explicação acima.
2. No rodapé, na linha "Soma (passagens)", trocar o número da coluna Acumulado por `—` (ou manter, mas ajustar tooltip).
3. (Opcional) Renomear coluna para "Passou pelo estágio".

**Sem mudanças em hooks ou queries** — os dados estão corretos.

### Recomendação

Aplicar **A + B juntos**: tooltip claro no header + remover a soma vertical sem sentido no rodapé da coluna Acumulado. Resolve a confusão sem quebrar a leitura horizontal por estágio.

Sobre a **Opção C** (renomear coluna) — me avise se prefere também trocar o nome "Acumulado" para algo mais explícito como "Passou no estágio" ou "Leads únicos no estágio".

### Escopo

- 1 arquivo (`src/components/crm/StageMovementsSummaryTable.tsx`)
- ~10 linhas
- Zero migration, zero mudança em queries


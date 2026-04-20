

## Fix: Linha Total da tabela — esclarecer que Acumulado é soma de passagens, não leads únicos

### Diagnóstico

- No CRM você vê **668 oportunidades** com tag ANAMNESE nas duas pipelines (universo de leads únicos).
- No dashboard, o **1490** é a **soma vertical** da coluna Acumulado entre todos os estágios. Como cada lead aparece em vários estágios (por inferência da trilha do funil — quem chegou em R1 Realizada também conta em Lead Qualificado, R1 Agendada, etc.), a soma vertical **necessariamente** é maior que o número de leads únicos.
- Você confirmou que Acumulado deve continuar contando **passagem por estágio** (lead avança = aparece em vários). Então o número 1490 está correto para o que ele representa.
- O problema real: a célula no rodapé chama-se **"Total"**, o que sugere "total de leads únicos" — e aí parece divergir do CRM.

### Solução

**1. Renomear/esclarecer a linha Total**

No `StageMovementsSummaryTable.tsx`, trocar o rótulo "Total" por **"Soma (passagens)"** com tooltip explicando que esse número soma as passagens entre estágios e não representa leads únicos.

**2. Adicionar uma linha extra "Leads únicos no universo"**

Acima ou abaixo da Soma, mostrar o número de **leads únicos** no universo filtrado (`filteredDealsMap.size`). Esse é o número que bate com o CRM (668 esperado).

Para isso:
- `useStageMovements` passa a retornar também `totalUniqueLeads: number` (= `filteredDealsMap.size`).
- O hook já tem essa informação; só falta expor no retorno.

**3. Linha "Total" final do rodapé**

```
Leads únicos no universo:    668     —     —
Soma de passagens:           1490    1490   668
```

- Coluna 1 (Acumulado): soma vertical = 1490 (passagens)
- Coluna 2 (Passaram): soma de eventos no período
- Coluna 3 (Estão lá): snapshot — soma = leads únicos com posição (≈ 668)

Tooltip no header da linha "Leads únicos": "Total de oportunidades distintas que compõem o universo deste filtro (origens + tags + período). Bate com o que você vê no CRM filtrando os mesmos critérios."

Tooltip na linha "Soma de passagens": "Soma vertical da coluna Acumulado. Como um lead que avança aparece em vários estágios (inferência da trilha), esse número é maior que o número de leads únicos — é esperado."

### Mudanças no código

**`src/hooks/useStageMovements.ts`** (~5 linhas)
- Adicionar `totalUniqueLeads` ao tipo de retorno.
- Calcular `const totalUniqueLeads = filteredDealsMap.size;` e retornar junto com `summary` e `rows`.

**`src/components/crm/StageMovementsSummaryTable.tsx`** (~30 linhas)
- Receber `totalUniqueLeads` via props.
- Renderizar duas linhas no rodapé: "Leads únicos" e "Soma (passagens)" com tooltips.
- Aplicar destaque visual diferente (Leads únicos = primary, Soma = muted).

**`src/pages/crm/MovimentacoesEstagio.tsx`** (~2 linhas)
- Passar `totalUniqueLeads={data?.totalUniqueLeads ?? 0}` para `StageMovementsSummaryTable`.

### Resultado esperado

Com INSIDE SALES + PILOTO ANAMNESE + tag ANAMNESE no período:

| | Acumulado | Passaram | Estão lá |
|---|---|---|---|
| Anamnese Incompleta | ~668 | ... | ... |
| Lead Qualificado | ~168 | ... | ... |
| ... | ... | ... | ... |
| **Leads únicos no universo** | **668** | — | — |
| **Soma (passagens)** | 1490 | 1490 | 668 |

O 668 vai aparecer explicitamente e bater com o CRM. O 1490 continua existindo, mas com rótulo correto que evita confusão.

### Escopo

- 3 arquivos, ~40 linhas no total
- Zero migration, zero mudança em queries


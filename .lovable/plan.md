

## Fix: Inferir trilha principal do funil para acumulado monotonicamente decrescente

### Problema atual

O acumulado busca o histórico de `deal_activities`, mas muitas movimentações intermediárias nunca foram registradas (lead criado direto em "Lead Qualificado" e movido para "R1 Agendada" sem passar explicitamente por "Anamnese Incompleta" ou "Novo Lead"). Resultado: estágios iniciais ficam com menos leads que estágios posteriores.

### Solução

Definir uma **trilha fixa do funil principal** (main trail). Para cada lead que está num estágio dessa trilha, inferir que ele **passou por todos os estágios anteriores** da trilha. Estágios laterais (No-Show, Sem Interesse, Lead Gratuito, Lead Instagram, No-Show R2) ficam fora da inferência e mostram apenas passagens reais.

### Trilha principal do Inside Sales (baseada no stage_order)

```text
ANAMNESE INCOMPLETA (0)
  → Novo Lead (3)
    → Lead Qualificado (5)
      → Reunião 01 Agendada (6)
        → Reunião 01 Realizada (8)
          → Reunião 02 Agendada (10)
            → Reunião 02 Realizada (11)
              → Contrato Pago (9) / Venda realizada (12)
```

**Estágios laterais (sem inferência):**
- Lead Gratuito (1)
- Lead Instagram (2)
- Sem Interesse (4)
- No-Show (7)
- No-Show R2 (8)

### Mudanças no código

**Arquivo:** `src/hooks/useStageMovements.ts`

**1. Definir a trilha principal por nome normalizado**

```ts
const MAIN_TRAIL: string[] = [
  'anamnese incompleta',
  'novo lead',
  'lead qualificado',
  'reuniao 01 agendada',
  'reuniao 01 realizada',
  'reuniao 02 agendada',
  'reuniao 02 realizada',
  'contrato pago',
  'venda realizada',
];
```

**2. Após construir `stagesPassedByDeal`, aplicar inferência na trilha**

Para cada deal, verificar o estágio mais avançado que ele atingiu na trilha (seja por histórico registrado OU por estágio atual). Todos os estágios anteriores na trilha recebem o deal no Set.

```ts
stagesPassedByDeal.forEach((stagesSet, dealId) => {
  let maxTrailIndex = -1;
  stagesSet.forEach((stageKey) => {
    const idx = MAIN_TRAIL.indexOf(stageKey);
    if (idx > maxTrailIndex) maxTrailIndex = idx;
  });
  if (maxTrailIndex >= 0) {
    for (let i = 0; i <= maxTrailIndex; i++) {
      stagesSet.add(MAIN_TRAIL[i]);
    }
  }
});
```

**3. Resto do código permanece igual**

- O `uniqueLeads` do summaryMap continua sendo alimentado por `stagesPassedByDeal`
- Passagens e Parados não mudam
- Linhas de detalhe não mudam

### Resultado esperado

| Estágio | Acumulado | Passaram | Estão lá |
|---------|-----------|----------|----------|
| Anamnese Incompleta | **~400+** | X | Y |
| Novo Lead | **~350+** | X | Y |
| Lead Qualificado | **~300+** | X | Y |
| R1 Agendada | **~200** | X | Y |
| R1 Realizada | **~150** | X | Y |
| ... | decrescente | ... | ... |
| No-Show | só real | ... | ... |
| Sem Interesse | só real | ... | ... |

Funil monotonicamente decrescente nos estágios principais. Estágios laterais com números independentes.

### Aplicabilidade cross-pipeline

A trilha é definida por **nome normalizado**, não por UUID. Como os nomes dos estágios são consistentes entre pipelines (todos têm "Reunião 01 Agendada", "Lead Qualificado", etc.), a inferência funciona automaticamente para qualquer pipeline que use esses nomes.

### Escopo

- 1 arquivo editado: `src/hooks/useStageMovements.ts` (~15 linhas adicionadas)
- Zero migration, zero RLS, zero mudanças de UI
- Tooltip já está correto ("leads que já passaram por este estágio")


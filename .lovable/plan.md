## Contexto

Hoje a classificação trata QUALQUER tag contendo a string "ANAMNESE" como sinal válido de ANAMNESE — incluindo `ANAMNESE-INCOMPLETA` e `ANAMNESE-INCOMPLETO`. Resultado: leads que **só preencheram parte do formulário** estão sendo contados como ANAMNESE no funil, inflando o canal.

### Diagnóstico (abril/2026, BU Incorporador)
| Combinação de tags | Qtd deals | Como deve ser tratado |
|---|---|---|
| Só `ANAMNESE-INCOMPLETA` | **1.076** | NÃO é ANAMNESE → vira OUTROS (ou A010 se houver compra recente) |
| `ANAMNESE-INCOMPLETA` + `ANAMNESE` | **547** | É ANAMNESE COMPLETA ✓ |
| `ANAMNESE-INCOMPLETA` + `ANAMNESE-INSTA` | **33** | É ANAMNESE-INSTA COMPLETA ✓ |
| Só `ANAMNESE` (sem incompleta) | 11 | É ANAMNESE ✓ |
| Só `ANAMNESE-INSTA` | 1 | É ANAMNESE ✓ |
| Sem nenhuma tag de anamnese | 1.223 | OUTROS / A010 conforme demais regras |

**Regra confirmada pelo usuário:** uma anamnese só é "completa" quando o lead tem a tag `ANAMNESE` (ou `ANAMNESE-INSTA`/`LIVE`/`LANÇAMENTO`). A tag `ANAMNESE-INCOMPLETA` sozinha indica formulário abandonado e **não conta como canal ANAMNESE**.

## Mudanças

### A) SQL — RPC `get_channel_funnel_metrics` (nova migration)
Hoje (linha 37 da migration `20260424144922`):
```sql
WHERE UPPER(t.val) ~ '(ANAMNESE|LIVE|LAN[CÇ]AMENTO)'
```
Esta regex captura `ANAMNESE-INCOMPLETA`. Precisa virar:
```sql
WHERE (
  UPPER(t.val) IN ('ANAMNESE','ANAMNESE-INSTA','LIVE','LEAD-LIVE','LANÇAMENTO','LANCAMENTO','LEAD-LANÇAMENTO','LEAD-LANCAMENTO')
  OR UPPER(t.val) ~ '^LIVE'
)
AND UPPER(t.val) NOT LIKE '%INCOMPLET%'
```
Mesma correção precisa ser aplicada na verificação de `origin.name` e `lead_channel` (linhas 39-40), embora origens dificilmente tenham "INCOMPLETA".

Afeta: **Entradas, R1 Agend., R1 Realiz., No-Show, Contrato Pago** das colunas A010 / ANAMNESE / OUTROS.

### B) TS — `src/hooks/useChannelFunnelReport.ts`
Função `classifyChannelWith30dRule` (linha 109) tem o mesmo bug na linha 119:
```ts
tags.some(t => t.includes('ANAMNESE') || t.includes('LIVE') || t.includes('LANÇ') || t.includes('LANC'))
```

Substituir por uma verificação que:
1. Normaliza cada tag (uppercase, trim).
2. Considera sinal de ANAMNESE apenas se a tag for **exatamente** `ANAMNESE`, `ANAMNESE-INSTA`, `LIVE`, `LEAD-LIVE`, `LANÇAMENTO`, `LANCAMENTO`, `LEAD-LANÇAMENTO`, ou começar com `LIVE`.
3. **Ignora explicitamente** qualquer tag que contenha `INCOMPLET` (cobre `INCOMPLETA` e `INCOMPLETO`).

Afeta: **R2 Agend., R2 Realiz., Aprovados, Reprovados, Próx. Semana, Venda Final, Faturamento** (carrinho + parceria).

### C) UI — tooltip
Atualizar o cabeçalho/tooltip da coluna ANAMNESE em `src/components/relatorios/ChannelFunnelTable.tsx` para deixar explícito:
> "ANAMNESE: leads com tag `ANAMNESE`, `ANAMNESE-INSTA`, `LIVE` ou `LANÇAMENTO`. Leads com **apenas** `ANAMNESE-INCOMPLETA` (formulário abandonado) NÃO contam aqui."

### D) Memória
Atualizar `mem://reporting/commercial-channel-reporting-and-data-integrity-v5` registrando que `ANAMNESE-INCOMPLETA` é tag-ruído e não classifica canal.

## Resultado esperado

Em abril/2026:
- **OUTROS** vai aumentar (recebe os ~1.076 deals que tinham SÓ `ANAMNESE-INCOMPLETA`), salvo aqueles que forem reclassificados como **A010** pela regra de compra ≤30d.
- **ANAMNESE** vai reduzir: passa a contar apenas ~582 deals com `ANAMNESE` ou `ANAMNESE-INSTA` "real" (incompleta + completa).
- **A010** permanece com a mesma lógica (compra fresca <30d).

## Arquivos afetados

1. **Nova migration SQL** — corrigir regex em `get_channel_funnel_metrics`.
2. **`src/hooks/useChannelFunnelReport.ts`** — refinar `classifyChannelWith30dRule` para excluir `INCOMPLETA`.
3. **`src/components/relatorios/ChannelFunnelTable.tsx`** — tooltip da coluna ANAMNESE.
4. **`mem://reporting/commercial-channel-reporting-and-data-integrity-v5`** — registrar ruído de `ANAMNESE-INCOMPLETA`.

## Confirmações

1. Tags consideradas **válidas para ANAMNESE**: `ANAMNESE`, `ANAMNESE-INSTA`, `LIVE`, `LEAD-LIVE`, `LANÇAMENTO`, `LANCAMENTO`, `LEAD-LANÇAMENTO`. Tudo que contiver `INCOMPLET` é ignorado. **Ok?**
2. Lead com **só** `ANAMNESE-INCOMPLETA` (sem outra tag) e **sem compra A010 recente** → cai em **OUTROS**. **Ok?**
3. Lead com `ANAMNESE-INCOMPLETA` + `ANAMNESE` continua sendo **ANAMNESE** (anamnese completa). **Ok?**

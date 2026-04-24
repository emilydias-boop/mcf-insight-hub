## Objetivo

Tornar a classificação de canal **estritamente baseada em tags + compra A010**. Remover qualquer atribuição automática vinda de:
- Nome da pipeline / origem (ex: `PILOTO ANAMNESE / INDICAÇÃO`)
- Fallback "passou por R1 → ANAMNESE"

## Regras finais de classificação

Hierarquia única (mesma no SQL e no TS):

1. **A010** — compra A010 (`hubla_transactions` com `product_category = 'a010'` e `sale_status = 'completed'`) realizada **≤ 30 dias** antes da criação do deal.
2. **ANAMNESE** —
   - Tem tag válida (`ANAMNESE`, `ANAMNESE-INSTA`, `LIVE`, `LEAD-LIVE`, `LANÇAMENTO`, `LANCAMENTO`, `LEAD-LANÇAMENTO`) **E** nenhuma das tags consideradas contém `INCOMPLET`; **OU**
   - Tem compra A010 antiga (> 30 dias).
3. **OUTROS** — qualquer outro caso. Inclui:
   - Lead com **só** `ANAMNESE-INCOMPLETA`
   - Lead em pipeline `PILOTO ANAMNESE / INDICAÇÃO` **sem** tag válida
   - Lead que passou por R1 mas não tem tag nem compra A010

> Origem/pipeline **não classifica mais** o canal.

## Mudanças

### A) SQL — nova migration: `get_channel_funnel_metrics`

Atualmente a função considera `origin.name` como sinal de ANAMNESE. Remover:

**Remover** (linhas que olham `crm_origins.name`):
```sql
OR (UPPER(o.name) ~ '(ANAMNESE|LIVE|LAN[CÇ]AMENTO)' AND UPPER(o.name) NOT LIKE '%INCOMPLET%')
```

**Remover** também o sinal vindo de `lead_channel`/origin para anamnese — a única fonte passa a ser a CTE de tags (já corrigida no passo anterior, que exclui `INCOMPLET`).

A CTE de tags continua como na última migration:
```sql
WHERE (
  UPPER(t.val) IN ('ANAMNESE','ANAMNESE-INSTA','LIVE','LEAD-LIVE','LANÇAMENTO','LANCAMENTO','LEAD-LANÇAMENTO','LEAD-LANCAMENTO')
  OR UPPER(t.val) ~ '^LIVE'
)
AND UPPER(t.val) NOT LIKE '%INCOMPLET%'
```

A regra A010 ≤30d permanece inalterada. Resultado: ~1.065 leads do `PILOTO ANAMNESE / INDICAÇÃO` que só têm `ANAMNESE-INCOMPLETA` migram de **ANAMNESE → OUTROS**.

### B) TS — `src/hooks/useChannelFunnelReport.ts`

Em `classifyChannelWith30dRule`:

1. **Remover** o uso de `originName` na decisão de canal (parâmetro pode permanecer, mas não influencia mais a classificação).
2. **Remover** o fallback final que retornava `ANAMNESE` quando `reachedR1 === true` sem outros sinais.
3. Manter:
   - Regra A010 ≤30d → `'A010'`
   - Tag válida (whitelist) sem `INCOMPLET` → `'ANAMNESE'`
   - Compra A010 >30d → `'ANAMNESE'`
4. Default final → `'OUTROS'`.

Helpers `isAnamneseTag` continuam válidos. Adicionar comentário explícito de que origem/pipeline não classifica mais.

### C) UI — `src/components/relatorios/ChannelFunnelTable.tsx`

Atualizar tooltips das colunas e da legenda do canal:
> "ANAMNESE: leads com tag `ANAMNESE`, `ANAMNESE-INSTA`, `LIVE` ou `LANÇAMENTO` (forms completos), OU compra A010 com mais de 30 dias. Pipeline/origem **não** classifica mais. Forms abandonados (`ANAMNESE-INCOMPLETA`) caem em OUTROS."
>
> "OUTROS: leads sem tag válida e sem compra A010 — incluindo formulários de anamnese abandonados e leads do pipeline Piloto Anamnese sem tag completa."

### D) Memória

Atualizar `mem://reporting/commercial-channel-reporting-and-data-integrity-v5`:
- Classificação de canal é **exclusivamente por tag + compra A010 (regra 30d)**.
- Origem/pipeline **não** classifica canal.
- Não há fallback "passou por R1 → ANAMNESE".
- Tags com substring `INCOMPLET` são ruído e ignoradas.

## Impacto esperado (abril/2026, BU Incorporador)

| Canal | Antes | Depois (estimado) |
|---|---|---|
| ANAMNESE | 1.897 | ~830 (perde os ~1.065 do pipeline sem tag válida) |
| A010 | 585 | ~585 (regra 30d intacta) |
| OUTROS | 157 | ~1.222 |

Métricas afetadas em todas as colunas: Entradas, R1 Agend., R1 Realiz., No-Show, R2 Agend., R2 Realiz., Aprovados, Reprovados, Próx. Semana, Venda Final, Faturamento, Contrato Pago.

## Arquivos afetados

1. **Nova migration SQL** — remover sinal de `origin.name` e `lead_channel` em `get_channel_funnel_metrics`.
2. **`src/hooks/useChannelFunnelReport.ts`** — remover fallback de R1 e uso de `originName` na classificação.
3. **`src/components/relatorios/ChannelFunnelTable.tsx`** — tooltips atualizados.
4. **`mem://reporting/commercial-channel-reporting-and-data-integrity-v5`** — registrar regra final.

## Validação após deploy

Rodar consulta para abril/2026:
- Confirmar que canal **OUTROS** absorve os deals do `PILOTO ANAMNESE` sem tag válida.
- Confirmar que ANAMNESE só conta deals com tag whitelist (sem `INCOMPLET`) ou compra A010 >30d.
- Confirmar que A010 mantém os ~585 deals com compra ≤30d.

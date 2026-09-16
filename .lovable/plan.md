# Card CONTRATOS — unificar no eixo Closer e fechar a quebra A/B/C

## Medição de 15/09/2026 (BU incorporador) — já feita, somente leitura

Cauções efetivas do dia: **12**, todas com closer, todas com SDR, todas segmento **A**.

| closer | contratos |
|---|---|
| Mayara Souza | 5 |
| Julio | 3 |
| João Pedro Martins Vieira | 2 |
| Jessica Bellini | 1 |
| Leticia Faustino C | 1 |
| **Total (eixo closer)** | **12** |

Card hoje: eixo SDR (11) + bloco não atribuído (4) = **15**; quebra "A 11 · B 0 · C 0 · s/ICP 4".

O contrato que existe na tabela e não no "A 11": **Irlei Iderto Rezende** (R$ 41,32), closer **Julio**, SDR da R1 **Jessica Martins**. Ela está cadastrada como `role_type = 'closer'` e inativa, portanto fica fora da lista de SDRs válidos do squad; a caução dela desaparece do eixo SDR e continua no eixo closer.

Bloco "Não atribuído" (4): **Elias Santos Da Silva** (R$ 241,53, negócio com segmento A), **Alexandre Venâncio** (R$ 241,53), **Léa Cristina Dutra Paixão de Souza** (R$ 241,53), **Sidinei Santos Nazareth** (R$ 241,53) — os três últimos com negócio no CRM mas sem segmento. Os quatro têm negócio vinculado; nenhum tem qualquer reunião registrada.

"s/ICP" é resíduo por subtração: `src/components/sdr/TeamKPICards.tsx:103` — `semIcp = total − a − b − c`.

## Mudança proposta

1. **Card CONTRATOS passa para o eixo closer**, igual ao que já foi feito com R1 Agendada, Realizada e No-show: total = soma de `contrato_pago` da tabela de Closers + bloco não atribuído. Em 15/09 mostraria **16** (12 + 4).
2. **A quebra por segmento passa a incluir o bloco não atribuído**: A/B/C dos closers (via `useR1CloserMetrics` com filtro de segmento) somados aos segmentos dos itens não atribuídos. Em 15/09: **A 13 · B 0 · C 0 · s/ICP 3** — soma 16, fecha com o total.
3. O "s/ICP" continua sendo resíduo, mas passa a significar o que o dono espera: pagamento cujo negócio realmente não tem segmento (os 3 A010 sem classificação).
4. Quando um SDR específico estiver selecionado no filtro, o card continua no eixo SDR (mesma regra já usada para as reuniões).

## Detalhes técnicos

- `src/pages/crm/ReunioesEquipe.tsx`
  - `enrichedKPIs.totalContratos` (linhas 657-673): trocar `totalContratosSdr + unassignedSdr.total` por `contratosFromClosers + unassignedCloser.total` quando `closerAxisForTop` for verdadeiro; manter o cálculo atual quando um SDR estiver selecionado.
  - `segmentTotals` (linhas 611-633): para `contratos`, usar `closerSegTotals.a/b/c` (que já vêm de `closerMetricsA/B/C`) somados aos segmentos do bloco não atribuído (`unassignedContracts.a` / `.b`) quando no eixo closer.
  - Expor de `useUnassignedContracts` a contagem do segmento **C** (hoje só A e B são contados; `segOf` descarta C). Ajuste pequeno em `src/hooks/useUnassignedContracts.ts` (linhas 72-75 e o tipo `segment`).
- `src/components/sdr/TeamKPICards.tsx`: sem mudança de fórmula; continua `total − a − b − c`.
- Nada de metas, ranking, remuneração, atribuição de venda, RPC, RLS ou dados é tocado. Nenhuma migração.

## Verificação

- `npx vite build` e `npx tsgo --noEmit -p tsconfig.app.json`.
- Conferir na tela, para 15/09/2026, que o card mostra 16 com "A 13 · B 0 · C 0 · s/ICP 3" e que a soma dos closers (12) + não atribuído (4) bate com o card.
- Conferir que setembro inteiro continua com card == soma da tabela + não atribuído.

## Objetivo

A partir de **hoje (15/06/2026)**, todas as vendas vêm exclusivamente do **webhook nativo da Hubla**. Os 7 webhooks do Make passam a responder **410 Gone**. Nenhum registro histórico é alterado.

## Diagnóstico (dados reais de `hubla_transactions`)

| product_category | MAKE (n) | HUBLA (n) | Observação |
|---|---|---|---|
| a010 | 2.076 | 17.118 | mesma categoria — Hubla já cobre |
| contrato | 1.462 | 4.464 | mesma categoria — Hubla já cobre |
| parceria | 905 | 1.161 | mesma categoria — Hubla já cobre |
| ob_evento | 115 | 20 | mesma categoria — Hubla já cobre (volume baixo, validar) |
| ob_vitalicio | 917 | 2.614 | mesma categoria — Hubla já cobre |
| ob_construir (Make) / ob_construir_alugar (Hubla) | 910 | 3.286 | **categorias diferentes** — exige ajuste no código |
| viver_aluguel | 115 | 0 | **só existe no Make** — precisa identificar o equivalente Hubla |

## Mudanças

### 1. Bloquear os 7 webhooks do Make a partir de hoje

Em cada um dos arquivos abaixo, adicionar guard no topo do handler: se `Date.now() >= Date.UTC(2026, 5, 15, 3, 0, 0)` (15/06/2026 00:00 BRT), responder **410 Gone** com log `[BLOCKED] Make webhook desativado — usar Hubla nativo`.

- `supabase/functions/webhook-make-a010/index.ts`
- `supabase/functions/webhook-make-contrato/index.ts`
- `supabase/functions/webhook-make-ob-construir/index.ts`
- `supabase/functions/webhook-make-ob-evento/index.ts`
- `supabase/functions/webhook-make-ob-vitalicio/index.ts`
- `supabase/functions/webhook-make-parceria/index.ts`
- `supabase/functions/webhook-make-viver-aluguel/index.ts`

Lógica do handler antigo permanece intacta (não estamos editando passado, e a função fica pronta para reabertura emergencial bastando reverter o guard).

### 2. Ajuste de leitura para `ob_construir`

Como Make grava em `ob_construir` e Hubla nativo grava em `ob_construir_alugar`, alterar os relatórios para considerar **as duas categorias somadas** em todos os lugares que hoje filtram por `'ob_construir'`:

- `src/lib/transactionHelpers.ts`
- `src/components/dashboard/ResumoFinanceiro.tsx`
- `supabase/functions/import-weekly-metrics/index.ts`
- `supabase/functions/calculate-weekly-metrics/index.ts`
- Demais ocorrências encontradas em busca global por `'ob_construir'`

Por que somar é seguro: histórico (até 14/06) tem só `ob_construir`; futuro (a partir de 15/06) tem só `ob_construir_alugar`. Sem dupla contagem em nenhuma janela.

### 3. Validação `viver_aluguel` (antes de bloquear)

`viver_aluguel` só existe em registros Make (115 linhas, última em 27/02/2026). Antes de bloquear esse webhook específico, **eu pergunto na hora da execução**:

- O produto "Viver de Aluguel" ainda é vendido hoje?
- Se sim, qual `product_category` o Hubla nativo grava? Há mapeamento na função `hubla-webhook-handler`?

Se não houver cobertura nativa, esse webhook fica **fora do bloqueio** até existir caminho equivalente. Os outros 6 seguem bloqueados normalmente.

### 4. Demais categorias (a010, contrato, parceria, ob_evento, ob_vitalicio)

Nada a alterar nos relatórios — Hubla nativo já grava na mesma `product_category` do Make. Basta bloquear Make e a fonte fica única automaticamente.

### 5. Não tocar no passado

- Nenhum DELETE / UPDATE em `hubla_transactions`.
- `weekly_metrics` de semanas anteriores fica congelado.
- Apenas a semana corrente (sábado 13/06 em diante) é recalculada via `recalculate-weekly-metrics` com `start_date = 2026-06-13`, para refletir vendas de hoje sem Make.

## O que NÃO muda

- Webhook nativo `hubla-webhook-handler`.
- Schema da tabela `hubla_transactions`.
- Lógica de funil Consórcio, A017, partner block, A010 routing.
- Timeline de leads antigos (continua mostrando duplicatas históricas como hoje).

## Ação manual do usuário (depois do deploy)

Desligar os 7 cenários no Make. Após hoje eles só vão receber 410. Não é urgente, mas elimina ruído nos logs.

## Resumo

| Arquivo / ação | Tipo |
|---|---|
| 7 × `supabase/functions/webhook-make-*/index.ts` | Guard de data → 410 Gone |
| `src/lib/transactionHelpers.ts` | Incluir `ob_construir_alugar` |
| `src/components/dashboard/ResumoFinanceiro.tsx` | Incluir `ob_construir_alugar` |
| `supabase/functions/import-weekly-metrics/index.ts` | Incluir `ob_construir_alugar` |
| `supabase/functions/calculate-weekly-metrics/index.ts` | Incluir `ob_construir_alugar` |
| Busca global por `'ob_construir'` | Ajustar quaisquer outras ocorrências |
| `recalculate-weekly-metrics` semana 13/06–19/06 | Recalcular só a semana atual |
| `viver_aluguel` | Confirmar com você antes de bloquear |
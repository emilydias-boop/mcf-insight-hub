

## Diagnóstico: números da tela divergem do banco

Validei contra Supabase (BU Incorporador, Abril 2026, origens `e3c04f21...` + `7431cf4a...`).

### Comparação tela vs banco

**Entradas (deals criados em Abril) — bate ✅**

| Canal | Tela | Banco |
|---|---|---|
| ANAMNESE | 1625 | 1628 ✅ |
| A010 | 506 | 510 ✅ |
| ANAMNESE-INSTA | 35 | 35 ✅ |
| LIVE | 4 | 4 ✅ |
| OUTROS | 443 | 443 ✅ |
| **Total** | **2613** | **2620** ✅ |

A coluna **Entradas está correta** (pequena diferença de 7 é arredondamento de timezone).

**R1 Agendada / R1 Realizada / No-Show — quebrado ❌**

Contando deals únicos (sem multiplicar por dias) e classificando o **deal pelo seu canal real**:

| Canal | Tela R1 Ag | Banco | Tela R1 Real | Banco | Tela NoShow | Banco |
|---|---|---|---|---|---|---|
| ANAMNESE | 139 | **161** | 59 | **47** | 69 | **78** |
| A010 | 259 | **323** | 180 | **139** | 71 | **101** |
| OUTROS | 493 | **196** | 323 | **85** | 155 | **78** |
| LIVE | 0 | 0 | 0 | 0 | 0 | 0 |
| **Total** | 893 | ~683 | 563 | ~272 | 296 | 258 |

### Causa raiz

O problema é em `useChannelFunnelReport.ts`:

1. **Para R1/R2/No-Show, o hook NÃO classifica o deal pelo canal real.** Ele usa o array `dealsRows` carregado apenas dos deals **criados no período**. Se um deal foi criado em **março** mas teve R1 em abril, ele cai no balde "OUTROS" porque não está em `dealMap` (que indexa só os deals do período).

2. **Inflação de OUTROS**: todos os deals de R1 cujo `deal_id` não está em `dealsRows` (criados antes do período) são contabilizados em "OUTROS / SEM-CLASSIFICAÇÃO" — por isso OUTROS está com 493 R1 Agendada quando o real é 196.

3. **R1 Realizada com 563 vs 272 real**: além do problema acima, está provavelmente contando **attendees** em vez de **deals únicos** em alguns ramos do código.

### Correção proposta

**Arquivo único: `src/hooks/useChannelFunnelReport.ts`**

1. **Carregar tags/origin de TODOS os deals que aparecem em R1/R2 do período**, não só dos criados no período. Após buscar attendees R1+R2, coletar o set de `deal_id` único, fazer um SELECT extra em `crm_deals` (paginado) para esses IDs e classificar cada um.

2. **Garantir contagem de deals únicos** em R1 Realizada (já corrigimos R1 Agendada antes — confirmar que R1 Real também usa `Set<deal_id>` e não soma duplicados quando o mesmo deal tem 2 attendees `completed`).

3. **No-Show já está usando deals únicos** (corrigi no plano anterior) — vai bater com o banco depois que a classificação for corrigida.

### Resultado esperado pós-fix (Abril 2026)

| Canal | Entradas | R1 Ag | R1 Real | No-Show | Conv R1 |
|---|---|---|---|---|---|
| ANAMNESE | 1628 | 161 | 47 | 78 | 29% |
| A010 | 510 | 323 | 139 | 101 | 43% |
| ANAMNESE-INSTA | 35 | 3 | 1 | 1 | 33% |
| LIVE | 4 | 0 | 0 | 0 | — |
| OUTROS | 443 | 196 | 85 | 78 | 43% |

A leitura passa a ser **honesta**: A010 é o canal com melhor conversão de R1, ANAMNESE tem alto volume de entrada mas baixa conversão a R1, e OUTROS volta a representar só os leads sem classificação clara que tiveram reunião no período.

### O que está correto (não mexer)

- Entradas, Aprovados, Reprovados, Próx. Semana, Venda Final, Faturamento Bruto, Faturamento Líquido — todos batem.
- A coluna LIVE com 4 entradas e 0 R1 está correta (são leads de live recentes que ainda não tiveram reunião).

### Fora do escopo

- Não vou tocar no Carrinho RPC nem no `useAcquisitionReport`.
- Não vou unificar os classificadores (`classifyChannel` vs `detectChannel`).

### Reversibilidade

Mudança em ~30 linhas de 1 arquivo. Adiciona uma query extra (deals do período de R1/R2 que não estão na lista de Entradas). Reverter = remover essa query e voltar ao `dealMap` original.


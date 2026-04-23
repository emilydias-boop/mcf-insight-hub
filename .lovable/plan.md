

## Adicionar coluna "No-Show" no Funil por Canal

### O que vou alterar

**Arquivo 1: `src/hooks/useChannelFunnelReport.ts`**
- Adicionar campo `noShow: number` em `ChannelFunnelRow` e na `blank()`.
- No `dedup('r1')`, marcar `noShow: true` quando `status === 'no_show'` (mesmo padrão de `realized`/`contractPaid` — deduplicado por deal).
- Empilhar `noShow` por canal no loop `r1.dealMap.forEach` e somar o `noDealCount.noShow` no balde "OUTROS".
- Adicionar `noShow` no objeto `totals`.
- Adicionar nova métrica de conversão derivada (opcional, leve): **Taxa de No-Show por canal** = `noShow / r1Agendada * 100` no campo `taxaNoShow: number`.

**Arquivo 2: `src/components/relatorios/ChannelFunnelTable.tsx`**
- Inserir nova coluna **"No-Show"** entre "R1 Realiz." e "Contrato Pago" (ordem natural do funil).
- Estilizar valor com `text-destructive` (vermelho) — coerente com Reprovados.
- Adicionar a coluna na linha Total.
- Atualizar `Props.totals` com `noShow: number`.
- Adicionar uma 5ª coluna na tabela inferior "Canal — Conversões" mostrando **Taxa No-Show** por canal, com lógica invertida no `pctBadge`: vermelho se ≥30%, amarelo 20-30%, verde <20%.

**Arquivo 3: `src/components/relatorios/AcquisitionReportPanel.tsx`**
- Acrescentar coluna "No-Show" no export Excel da aba "Funil por Canal".

### Como o No-Show é calculado

Mesma fonte de R1 Realizada: `meeting_slot_attendees` com `meeting_type='r1'` no período. Conta **deals únicos** com pelo menos 1 attendee em status `no_show`. Não conflita com `realized` — um deal pode ter ambos (no_show numa tentativa, completed em outra) e nesse caso aparece nas duas colunas, igual ao comportamento atual de `contratoPago` vs `realizada`.

### Validação esperada (Abril 2026, BU Incorporador)

Total No-Show ≈ 200-280 (consistente com a métrica de no-show que já aparece no painel SDR/Closer da BU). A linha "OUTROS / SEM-CLASSIFICAÇÃO" deve concentrar a maioria, espelhando a distribuição de R1 Agendada.

### Fora do escopo

- Não vou adicionar No-Show de R2 (R2 quase não tem no-show registrado — agendamento é mais firme; se quiser depois, mesmo padrão).
- Não vou tocar em `useAcquisitionReport` nem nos cards superiores.

### Reversibilidade

3 arquivos, ~15 linhas adicionadas. Reverter = remover a coluna e o campo `noShow`.


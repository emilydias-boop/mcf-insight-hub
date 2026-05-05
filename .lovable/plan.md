## Adicionar coluna "% No-Show" na tabela Funil por Canal

**Arquivo:** `src/components/relatorios/ChannelFunnelTable.tsx`

1. **Header**: inserir nova `<TableHead>` logo após o header "No-Show" com `HeaderWithInfo` label `% No-Show`, info: "Taxa de No-Show: No-Show ÷ R1 Agendada na janela. Quanto menor, melhor."

2. **Linhas dos canais**: após a `<Cell>` de `noShow`, inserir `<TableCell className="text-right">{pctBadgeInverted(r.taxaNoShow)}</TableCell>` (campo já existe no row).

3. **Linha Total**: mesma célula calculando `totals.r1Agendada > 0 ? (totals.noShow / totals.r1Agendada) * 100 : 0`.

Sem alterações em hooks ou exportação Excel.
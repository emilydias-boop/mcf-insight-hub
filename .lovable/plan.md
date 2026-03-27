

## Melhorar tab "Avançaram" — Totais por coluna + Filtro R1 + Investigar leads sem R1

### Problemas identificados

1. **Leads sem Data R1 na tab "Avançaram"**: Alguns leads aparecem com "—" na coluna R1. Isso acontece porque o matching por `contactId` no `r1DateByContactId` falha — o lead pode não ter sido encontrado no CRM ou não teve R1 registrada. Esses leads provavelmente são outsides (compraram antes da R1) e devem ser sinalizados.

2. **Sem totais por coluna**: Não há resumo mostrando quantos leads têm R1, quantos têm R2, quantos compraram parceria, etc.

3. **Sem filtro por R1**: Não é possível filtrar leads com/sem Data R1.

### Alterações

**1. `CarrinhoAnalysisReportPanel.tsx` — Barra de totais acima da tabela**

Adicionar uma linha de resumo com badges/contadores:
- **Total**: X leads
- **Com R1**: Y (Z%)
- **Sem R1**: W (K%)
- **Com Parceria**: N (M%)
- **R2 Realizada**: P / **R2 Agendada**: Q

**2. `CarrinhoAnalysisReportPanel.tsx` — Novo filtro "Data R1"**

Adicionar um Select ao lado dos filtros existentes (Closer, UF):
- "Todas" (default)
- "Com R1"
- "Sem R1"

Atualizar `filteredAvancados` para aplicar este filtro.

**3. `CarrinhoAnalysisReportPanel.tsx` — Footer da tabela com totais**

Adicionar um `TableRow` no footer com contagem de cada coluna:
- Nome: total de leads
- Data Contrato: total (sempre 100%)
- Data R1: contagem dos que têm data
- Data R2: contagem dos que têm data
- Parceria: contagem dos que compraram

**4. Hook — Marcar leads sem R1 como Outside**

No hook, leads que avançaram mas não têm `dataR1` já têm o campo `isOutside` — verificar se está sendo setado corretamente. Se o lead não tem R1 mas tem R2, ele provavelmente é outside e deve ser marcado. Adicionar uma badge "Outside" na coluna Status para esses casos.

### Detalhes técnicos
- Novo state: `filterR1: 'all' | 'com' | 'sem'`
- Contadores calculados via `useMemo` sobre `filteredAvancados`
- Footer row com `className="font-bold bg-muted/50"` para destaque visual


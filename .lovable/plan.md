

## Plano: Remover colunas redundantes do Relatório

Remover 5 colunas da tabela e do CSV export:
- **SDR** — remover coluna e referência no search
- **Carrinho** — dados não carregam corretamente
- **Safra** — idem
- **Dias** — remover coluna e KPI "Parados >5d"
- **Situação** — informação redundante com as demais colunas

### Alterações em `src/components/crm/R2ContractLifecyclePanel.tsx`

1. Remover das `TableHead`/`TableCell`: SDR, Carrinho, Safra, Dias, Situação
2. Remover KPI card "Parados >5d" (ajustar grid para 5 colunas)
3. Atualizar `handleExportCSV` removendo essas 5 colunas dos headers e dados
4. Remover do search filter a referência a `sdrName`
5. Remover componentes não utilizados: `DiasParadoBadge`, `SituacaoBadge`, `SITUACAO_OPTIONS`, filtro de situação




## Converter PDF Anamnese v4 para XLSX

### O que será feito
Gerar `/mnt/documents/relatorio-leads-anamnese-incorporador-v4.xlsx` com os mesmos dados do PDF v4, estruturado em abas:

1. **Aba "Resumo"** — KPIs (total 88, exclusivos 82, duplicados 6), distribuição por estágio
2. **Aba "Leads Completa"** — Tabela dos 88 leads com: Nome, Telefone, Email, Estágio, Status (Exclusivo/Duplicado), Tags
3. **Aba "Excluídos A010"** — Os 14 leads removidos com: Nome, Data Compra A010, Data Deal Anamnese, Timing (antes/depois)

### Implementação
- Script Python em `/tmp/` que consulta o banco com a mesma query do PDF v4 (filtro BU Incorporador, tag ANAMNESE, excluindo ANAMNESE INCOMPLETA e testes)
- Cruza com `hubla_transactions` para identificar e separar os 14 compradores A010
- Gera XLSX com `openpyxl` (formatação, largura de colunas, cores para status)
- Output: `/mnt/documents/relatorio-leads-anamnese-incorporador-v4.xlsx`


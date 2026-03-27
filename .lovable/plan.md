

## Relatório PDF: 420 Leads A010 Puros Sem Dono — Março 2026

### Objetivo
Gerar um PDF focado nos **420 leads que compraram APENAS A010** (sem contrato, renovação, parceria ou OB), que estão sem dono e parados — prontos para distribuição.

### Filtros aplicados
- Pipeline: Inside Sales (incorporador) — origin `e3c04f21-...`
- Período: Março 2026
- Sem dono (`owner_id IS NULL`)
- Tem compra A010 confirmada (`product_category = 'a010'`, `sale_status = 'completed'`)
- **NÃO** tem compra em categorias avançadas: `contrato`, `renovacao`, `parceria`, `ob_vitalicio`, `contrato-anticrise`, `contrato_clube_arremate`, `socios`

### Conteúdo do PDF

1. **Resumo executivo**: Total (420), distribuição por estágio, distribuição por semana de compra A010
2. **Tabela principal**: Nome, Email, Telefone, Produto A010, Data da Compra, Valor Pago, Estágio Atual
3. Ordenado por data de compra (mais antigos primeiro — prioridade de contato)
4. Landscape, multi-página com reportlab

### Execução
1. Query SQL extraindo os 420 leads com JOIN em `hubla_transactions` para dados da compra A010
2. Gerar PDF com reportlab (landscape)
3. QA visual das páginas
4. Salvar em `/mnt/documents/`


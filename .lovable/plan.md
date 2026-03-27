

## Relatorio PDF: 632 Leads A010 Sem Dono - Marco 2026

### Objetivo
Gerar um PDF completo com os 632 leads A010 sem dono do mes de marco, incluindo dados de contato, compra e estagio atual no CRM.

### Execucao

1. **Query ao banco** — Extrair os 632 deals sem dono da pipeline "INSIDE SALES" (incorporador) criados em marco 2026, cruzando com `hubla_transactions` para pegar dados da compra A010 (produto, data, valor). Joins com `crm_contacts` (nome, email, telefone) e `crm_stages` (estagio atual).

2. **Gerar PDF com reportlab** — Documento com:
   - Capa com titulo, data de geracao, total de leads
   - Resumo executivo: distribuicao por estagio, por origem, por semana de compra
   - Tabela principal com colunas: Nome, Email, Telefone, Produto A010, Data da Compra, Valor Pago, Estagio Atual, Origem
   - Paginacao e cabecalho em todas as paginas

3. **QA visual** — Converter paginas para imagem e verificar layout, texto cortado, alinhamento de tabela.

4. **Salvar em `/mnt/documents/`** e entregar ao usuario.

### Detalhes tecnicos
- Query via `psql` com JOIN entre `crm_deals`, `crm_contacts`, `crm_stages`, `hubla_transactions`
- Filtros: `owner_id IS NULL`, pipeline da BU incorporador, `created_at` em marco 2026, produto com `product_category = 'a010'` ou `product_name ilike '%a010%'`
- PDF gerado com `reportlab` (platypus para tabelas multi-pagina)
- Landscape para caber todas as colunas


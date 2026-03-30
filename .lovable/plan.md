

## PDF — Lista Completa dos 124 Leads ANAMNESE Completa

### O que será gerado
PDF em `/mnt/documents/relatorio-leads-anamnese-completa.pdf` com:

1. **Capa** — Título, data de geração
2. **Resumo** — Total: 124 leads | Duplicados cross-base: 98 | Exclusivos: 26
3. **Distribuição por Estágio** — Tabela com contagem por stage
4. **Lista Completa (124 leads)** — Tabela com: Nome, Telefone, Email, Estágio, Status (Duplicado/Exclusivo), Tags
5. **Lista Exclusivos (26 leads)** — Apenas os que não existem fora do canal ANAMNESE

### Lógica de dados
- Query `crm_deals` com `tags ILIKE '%ANAMNESE%'`
- Excluir stage "ANAMNESE INCOMPLETA"
- Excluir nomes com "teste"
- Cross-check por nome contra deals sem tag ANAMNESE para marcar duplicados
- Join com `crm_contacts` para telefone/email e `crm_stages` para nome do estágio

### Implementação
- Script Python com `reportlab` + queries via `psql`
- Output: `/mnt/documents/relatorio-leads-anamnese-completa.pdf`
- QA visual obrigatória

### Arquivos
- `/tmp/gen_anamnese_completa.py` (temporário)
- `/mnt/documents/relatorio-leads-anamnese-completa.pdf` (entregável)


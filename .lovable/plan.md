

## Gerar PDF — Relatório Detalhado Webhook ClientData Inside

### O que será feito
Gerar um PDF profissional com o relatório completo dos 100+ leads do webhook `clientdata-inside`, contendo:

1. **Capa** com título, período (17/03 a 30/03/2026), e data de geração
2. **KPIs Resumo** — total de leads, taxa de agendamento R1 (43%), taxa de R1 realizada (31%), conversão em contrato (~10%), venda realizada (1%)
3. **Funil por Estágio** — tabela com contagem por estágio (Lead Gratuito: 35, R1 Agendada: 12, R1 Realizada: 23, etc.)
4. **Distribuição por SDR** — tabela com nome, total de leads, R1 agendadas, R1 realizadas, contratos
5. **Atividades Registradas** — resumo (101 mudanças de estágio, 34 ligações, 9 vídeos enviados, 7 perdas)
6. **Compras Identificadas** — tabela com nome do cliente, produto, valor, data, status
7. **Lista Completa de Leads** — tabela com nome, telefone, email, estágio atual, SDR responsável, data de entrada

### Implementação
- Script Python usando `reportlab` para gerar o PDF
- Dados já coletados via queries ao Supabase
- Output em `/mnt/documents/relatorio-clientdata-inside.pdf`
- QA visual obrigatória após geração

### Arquivos
- `/tmp/gen_report.py` — script de geração (temporário)
- `/mnt/documents/relatorio-clientdata-inside.pdf` — relatório final


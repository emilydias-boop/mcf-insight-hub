

## Relatorio: Compras detalhadas dos 632 leads A010 sem dono

### Objetivo
Gerar um PDF com o historico completo de compras de cada um dos 632 leads A010 sem dono de marco 2026, para permitir a reclassificacao correta por estagio.

### Execucao

1. **Query ao banco** — Para cada lead sem dono (pipeline Inside Sales, marco 2026, owner_id IS NULL), buscar TODAS as transacoes em `hubla_transactions` vinculadas por email ou telefone (nao so A010, mas todas as compras: contrato, renovacao, OB, etc.)

2. **Gerar PDF** com:
   - Resumo geral: total de leads, distribuicao por quantidade de produtos comprados
   - Tabela principal agrupada por lead: Nome, Email, Telefone, Estagio Atual, e lista de compras (Produto, Data, Valor, Status, Categoria, Fonte)
   - Destaque para leads com contrato pago, renovacao, ou multiplas compras (potenciais parceiros)
   - Ordenacao por quantidade de compras (mais compras primeiro)

3. **QA visual** das paginas geradas

4. **Salvar em `/mnt/documents/`**

### Detalhes tecnicos
- Query 1: deals sem dono em marco na pipeline incorporador com emails/telefones dos contatos
- Query 2: todas as transacoes em `hubla_transactions` para esses emails/telefones (sem filtro de categoria)
- Cruzamento client-side para agrupar transacoes por lead
- PDF landscape com reportlab, tabela multi-pagina


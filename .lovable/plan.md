

# Exportar Transacoes "Parceria" de Fevereiro para Excel

## Objetivo
Gerar e baixar automaticamente um arquivo CSV com todas as 81 transacoes "Parceria" do periodo 01/02 a 19/02/2026, para verificacao manual nas plataformas.

## Colunas do arquivo
O CSV tera as seguintes colunas para facilitar a conferencia:

| Coluna | Descricao |
|--------|-----------|
| Cliente | Nome do cliente |
| Email | Email do cliente |
| Telefone | Telefone do cliente |
| Data Venda | Data da transacao |
| Valor Pago (Bruto Atual) | product_price - valor que o sistema usa como bruto hoje |
| Valor Liquido | net_value recebido |
| Parcela | Numero da parcela |
| Total Parcelas | Total de parcelas |
| Gross Override | Se ja tem override manual |
| Hubla ID | ID para rastreio |
| Produto Real | Coluna vazia para voce preencher manualmente (A001, A009, etc) |
| Bruto Correto | Coluna vazia para voce preencher o valor bruto correto |
| Observacoes | Coluna vazia para anotacoes |

## Implementacao

Sera adicionada uma funcao temporaria na pagina de transacoes do Incorporador (`/bu-incorporador/transacoes`) que:

1. Consulta todas as transacoes com `product_name = 'Parceria'` do periodo de fevereiro via query direta ao Supabase
2. Formata os dados em CSV com separador ponto-e-virgula (compativel com Excel BR)
3. Inclui as 3 colunas vazias no final para preenchimento manual
4. Dispara o download automaticamente

### Detalhes Tecnicos

- Arquivo: `src/pages/bu-incorporador/Transacoes.tsx` (ou componente equivalente da pagina)
- Adicionar botao "Exportar Parcerias" temporario na pagina
- Usar a mesma logica de export CSV ja existente em `src/lib/exportHelpers.ts` e `src/components/financeiro/FinanceiroTransacoes.tsx`
- Query direta: `supabase.from('hubla_transactions').select('*').ilike('product_name', 'parceria').gte('sale_date', '2026-02-01').lt('sale_date', '2026-02-20')`
- Encoding UTF-8 com BOM para acentos no Excel


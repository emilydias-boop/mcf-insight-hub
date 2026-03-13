

## Diagnóstico: 3 parceiros restantes no pipeline

### Problema encontrado

A limpeza anterior filtrou parceiros usando `product_category IN ('parceria', 'incorporador')`, mas **3 leads escaparam** porque seus produtos de parceria estão registrados com categorias diferentes no banco:

| Lead | Email | Produto Parceria | Categoria no BD | Data Compra |
|---|---|---|---|---|
| Bruno Freitas Gomes | brunofgjj@gmail.com | A002 - MCF INCORPORADOR BÁSICO | `outros` | Set/2024 |
| Johnatas Santos | johnatassantos095@gmail.com | A004 - MCF Plano Anticrise Básico | `imersao_socios` | Mai/2025 |
| Hélio dos Santos Duarte | heliotur@gmail.com | A003 - MCF Plano Anticrise Completo | `imersao_socios` | Nov/2025 |

**Causa raiz**: A função `checkIfPartner` nos webhooks verifica pelo **nome do produto** (A001, A002, A003, A004, A009, INCORPORADOR, ANTICRISE), mas a cleanup function e o backfill verificaram pela **`product_category`** (`parceria`/`incorporador`). Essas 3 transações têm `product_category` incorreta (`outros`, `imersao_socios`), por isso escaparam.

### Solução

1. **Remover os 3 deals** restantes: registrar em `partner_returns` e deletar do pipeline
2. **Corrigir a verificação no `cleanup-backfill-partners` e no `backfill-a010-offer-leads`** para usar a mesma lógica de `checkIfPartner` — verificar pelo **product_name** (padrões A001-A004, A009, INCORPORADOR, ANTICRISE) em vez de depender do `product_category`

### Arquivos alterados
- `supabase/functions/cleanup-backfill-partners/index.ts` — trocar filtro `product_category` por filtro `product_name` com os mesmos padrões do `checkIfPartner`
- `supabase/functions/backfill-a010-offer-leads/index.ts` — mesma correção no check de parceiro
- Executar cleanup para remover os 3 deals restantes

### Resultado
- Pipeline: de 148 para **145 leads legítimos**
- Verificação alinhada com a lógica dos webhooks (`checkIfPartner`)


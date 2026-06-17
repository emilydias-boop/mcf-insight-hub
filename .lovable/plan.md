## Diagnóstico final (16/06/2026, A010)

Comparação direta da planilha Kiwify (28 emails) com `hubla_transactions`:

| Situação | Qtd | Impacto no funil |
|---|---|---|
| Kiwify gravada com `sale_date = 16/06` | 14 | Já contam no canal A010 |
| Kiwify gravada com `sale_date = 17/06` (timezone deslocou +1 dia) | 3 | **Não contam em 16/06** |
| Email já existia como compra Hubla antiga (2026-05-19), venda Kiwify de hoje não foi inserida | 1 | Não conta como compra do dia |
| **Ausentes no banco** (webhook nunca registrou) | **10** | **Não contam** |

Planilha Hubla (13) + Kiwify (28) = 41. Funil mostra 29 porque o banco tem 30 compradores distintos no dia 16, dos quais 29 têm deal em INSIDE SALES + PILOTO ANAMNESE. **A classificação está correta — a falha é ingestão Kiwify.**

## Plano de correção

### 1. Backfill imediato dos 10 ausentes (16/06)
Rodar a edge function `kiwify-backfill-a010-csv` (ou `kiwify-recover-orphan-transactions`) com a planilha do usuário. Inserir as 10 linhas faltantes em `hubla_transactions` com:
- `source = 'kiwify'`
- `product_category = 'a010'`
- `sale_status = 'completed'` (planilha marca `paid`)
- `sale_date = 2026-06-16` (data da planilha, sem aplicar timezone)

Entregável: relatório "X de 10 inseridas" + lista de erros se algum CPF/email duplicar.

### 2. Corrigir as 3 vendas com data deslocada
UPDATE em `hubla_transactions` movendo `sale_date` de 17/06 para 16/06 para os 3 emails identificados (`andersonscb@yahoo.com.br`, `gduartedealencar@icloud.com`, `mjosedanielmoreira@gmail.com`). Migração one-off, idempotente, com WHERE estrito por email + product_category + source + dia.

### 3. Tratar o caso `dri.dibiase@gmail.com`
Inserir nova linha Kiwify de 16/06 mesmo havendo compra Hubla antiga (não é deduplicação por contato, é registro de transação). Inclusão no mesmo backfill da etapa 1.

### 4. Investigar a causa-raiz do webhook Kiwify
Olhar logs da função `kiwify-webhook-handler` nas últimas 48h e cruzar com os 10 ausentes. Hipóteses prováveis:
- Eventos `order.approved` chegando sem campos esperados (rejeitados na validação)
- Timezone aplicado em cima de `created_at` UTC desloca a data
- Pagamentos `pix` confirmados via job que não está rodando

Entregável: lista das tentativas dos 10 emails (encontradas ou não) e proposta de fix do handler (planejada em mensagem separada, não nesta tarefa).

### 5. Validar
Re-executar a query de auditoria de A010 do dia 16/06 e confirmar:
- 30 + 10 + 1 (dri.dibiase) = ~41 compradores distintos
- Funil de canais sobe A010 de 29 → ~40 (deve ficar ≈41 menos compradores sem deal em IS/Anamnese)

## Confirmações necessárias

- OK rodar o backfill agora (etapas 1, 2, 3)? São inserts/updates em `hubla_transactions`, não mexem em `crm_deals` nem em métricas calculadas.
- A etapa 4 (investigação do handler) entra como tarefa separada ou junto?

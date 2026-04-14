

## Plano: Relatórios semanais personalizados por BU para gestores

### Objetivo

Criar uma nova edge function `weekly-manager-report` que envia relatórios semanais detalhados e personalizados para cada gestor de BU, com dados do time completo da semana anterior.

### Destinatarios

| Gestor | Email | BU | Conteudo |
|--------|-------|----|----------|
| Jessica Bellini | jessica.bellini.r2@minhacasafinanciada.com | Incorporador | Carrinho R2 + performance SDRs/Closers |
| Thobson Motta | thobson.motta@minhacasafinanciada.com | Consorcio | Vendas de cartas por dia + performance SDRs/Closers |

### Conteudo do email — Incorporador (Jessica)

1. **KPIs do Carrinho**: Contratos pagos, R2 agendadas/realizadas, aprovados
2. **Tabela SDRs**: Nome, aprovados no carrinho (dados de `meeting_slot_attendees` + `hubla_transactions`)
3. **Tabela Closers**: Nome, aprovados no carrinho
4. **Resumo financeiro**: Vendas A010, contratos, faturamento total da semana
5. Periodo: semana do carrinho (Qui-Qua / corte na Sexta)

### Conteudo do email — Consorcio (Thobson)

1. **KPIs**: Total de cartas vendidas, valor de credito total, comissao
2. **Vendas por dia**: Tabela com data_contratacao agrupada por dia da semana (Seg-Dom)
3. **Tabela SDRs**: Nome do vendedor, cartas vendidas, valor de credito
4. **Tabela Closers**: Nome, cartas atribuidas
5. Periodo: semana Seg-Dom (padrao consorcio)

### Alteracoes

**Novo arquivo**: `supabase/functions/weekly-manager-report/index.ts`

- Funcao que busca os SDRs e closers de cada squad via `sdr` table
- Para **Incorporador**: busca `hubla_transactions` (contratos A000), `meeting_slot_attendees` (R2 aprovados), `closers`, e agrega por SDR/closer
- Para **Consorcio**: busca `consortium_cards` com `data_contratacao` no periodo, agrupa por dia e por `vendedor_name`
- Gera HTML personalizado para cada BU
- Envia via `brevo-send` para cada gestor

**Agendamento**: Adicionar pg_cron job para disparar toda segunda-feira as 07:30 (BRT), 30 min apos o relatorio do diretor

### Detalhes tecnicos

- Reutiliza a mesma logica de boundaries do carrinho (Qui-Qua com corte na sexta) para o relatorio de incorporador
- Para consorcio usa Seg-Dom conforme padrao da BU
- Emails dos gestores sao constantes na edge function (simples e direto)
- Cada gestor recebe APENAS o relatorio da sua BU


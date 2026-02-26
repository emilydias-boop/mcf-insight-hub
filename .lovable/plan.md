

## Plano: Alinhar Efeito Alavanca do Dashboard com dados do Controle Consórcio

### Problema
O Dashboard "Efeito Alavanca" busca dados de `get_hubla_transactions_by_bu('consorcio')` somando `product_price` (Hubla) = **R$ 465K**. O Painel Equipe do Consórcio busca de `consortium_cards.valor_credito` = **R$ 22.9MM**. O correto é o segundo.

### Causa
- **Dashboard**: usa Hubla transactions (vendas online)
- **Painel Consórcio**: usa `useConsorcioSummary` → `consortium_cards.valor_credito` + `consortium_installments.valor_comissao`

### Correção

**Arquivo: `src/hooks/useSetoresDashboard.ts`**

1. Remover as 3 chamadas `get_hubla_transactions_by_bu(p_bu='consorcio')` (semana/mês/ano)
2. Substituir por 3 queries diretas a `consortium_cards` (mesma lógica de `useConsorcioSummary`):
   - Filtrar por `data_contratacao` nos períodos semana/mês/ano (usando semana Mon-Sun do Consórcio)
   - Somar `valor_credito` para "Total em Cartas"
   - Buscar `consortium_installments.valor_comissao` agrupado por período para "Comissão Total"
3. Popular os campos `comissaoSemanal`, `comissaoMensal`, `comissaoAnual` no `SetorData` do `efeito_alavanca`
4. Manter `apuradoSemanal/Mensal/Anual` = soma de `valor_credito` (Total em Cartas)

**Resultado**: Dashboard "Efeito Alavanca" mostrará os mesmos valores que o card "BU Consórcio" no Painel Equipe e o Controle Consórcio. Metas já compartilham o mesmo prefixo (`setor_efeito_alavanca`) em ambos os painéis, portanto editar em um atualiza o outro automaticamente.


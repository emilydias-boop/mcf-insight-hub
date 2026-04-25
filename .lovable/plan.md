# Adicionar tooltips explicativos em todas as colunas do Funil por Canal

## Objetivo
Completar a documentação inline da tabela **Funil por Canal** (`/bu-incorporador/relatorios` → Aquisição) adicionando tooltips em todas as colunas que ainda não têm, explicando **fonte de dados, período de referência e regras** de cada métrica. Hoje só 4 colunas têm tooltip (Canal, Entradas, R1 Agend., Venda Final); as outras 10 ficam sem contexto.

## Arquivo a modificar
- `src/components/relatorios/ChannelFunnelTable.tsx`

## Mudança
Substituir os `<TableHead>` simples (linhas 98–105 e 112–113) por `<HeaderWithInfo>` (componente já existente no arquivo) com os textos abaixo. **Nada muda na lógica de dados** — apenas UI.

### Tooltips a adicionar

| Coluna | Texto do tooltip |
|---|---|
| **R1 Realiz.** | R1 com status `realizada`/`completed` no período selecionado (`scheduled_at` dentro do range), filtradas pela BU. Cap de 2 reagendamentos por deal. |
| **No-Show** | R1 com status `no_show` no período selecionado, filtradas pela BU. Cap de 2 reagendamentos por deal. |
| **Contrato Pago** | Attendees R1 com `contract_paid_at` dentro do período, OU deals que entraram no estágio 'Contrato Pago' no período. Atribuído ao canal do deal (TAG + compra A010). |
| **R2 Agend.** | Attendees de reuniões R2 com `scheduled_at` dentro do período exato selecionado (não mais semanas inteiras — alinhado ao filtro de datas desde a última atualização). Deduplicado por contato. |
| **R2 Realiz.** | R2 com status `completed`/`realizada` no período exato selecionado. Deduplicado por contato. |
| **Aprovados** | Attendees R2 com `r2_status_name` contendo 'aprovado' no período exato selecionado. Independe da data do contrato (apenas a R2 conta no período). |
| **Reprovados** | Attendees R2 cujo `r2_status_name` indica saída do carrinho (reembolso, desistente, reprovado, cancelado) no período selecionado. |
| **Próx. Semana** | Aprovados cuja R2 ocorreu no período mas o contrato cai fora da janela de corte da safra atual — serão contabilizados na próxima semana operacional. |
| **Fat. Bruto** | Soma de `reference_price` das vendas finais únicas no período. Usa o preço de tabela do produto (não o valor recebido). |
| **Fat. Líquido** | Soma do valor recebido no Hubla (líquido de taxas) das vendas finais únicas no período. |

## Validação esperada
- Hover em cada cabeçalho mostra o tooltip correspondente.
- Nenhum número da tabela muda — é só UI.
- Layout dos cabeçalhos permanece alinhado à direita (componente `HeaderWithInfo` já trata isso).

## Out of scope (posso fazer depois se quiser)
- (a) coluna extra "Vendas (incl. recompra)" mostrando os 26 em vez dos 11
- (d) coluna "Aprovados que compraram em até 30d" para refletir conversão real do carrinho
- Tooltips na tabela secundária "Canal — Conversões"
## Plano: Relatório Incorporador completo para Jessica Bellini

### Correções e melhorias

**Email**: Corrigir de `jessica.bellini.r2@minhacasafinanciada.com` para `jessica.bellini@minhacasafinanciada.com`

### Estrutura do novo relatório (4 seções)

#### Seção 1 — KPIs do Carrinho (semana Qui-Qua)

KPIs expandidos em cards:

- **Contratos Pagos** (Qui-Qua, `hubla_transactions` product_name A000) pode mostrar os reembolsos tambem e so identificar quantos foram reembolsados antes da r2 realizada ou depois 
- **R1 Agendada** / **R1 Realizada** / **No-Show** (de `meeting_slots` tipo r1 + attendees)
- **R2 Agendada** / **R2 Realizada** 
- **Aprovados** / **Fora do Carrinho** / **Proxima Semana**
- **Origem**: quantos vieram de LIVE (lead_type='B') vs A010 (lead_type='A')
- Gráfico de pizza HTML/CSS mostrando distribuição de R2 status (aprovados, fora, pendentes, em análise)

#### Seção 2 — Ranking SDRs

Tabela com cada SDR do squad incorporador (via `employees` + `profiles`):
| SDR | Meta Sem. | Agendados | R1 Realizada | No-Show | Contratos | Taxa No-Show | Taxa Conv. | Ligações |

Dados de:

- **Meta**: `sdr_comp_plan.meta_reunioes_agendadas` / dias_uteis do mes * dias uteis da semana
- **Agendados/R1 Realizada/No-Show/Contratos**: RPC `get_sdr_metrics_from_agenda` ou query direta em `meeting_slot_attendees` + `meeting_slots`
- **Ligações**: tabela `calls` contando por `user_id` no periodo
- Ordenado por ranking (mais contratos primeiro)

#### Seção 3 — Performance Closers (R1 separado de R2)

**Tabela Closers R1** (closers com `meeting_type='r1'` e `bu='incorporador'`):
| Closer R1 | R1 Agendada | R1 Realizada | Contratos | R2 Marcadas | Aprovados |

**Tabela Closers R2** (closers com `meeting_type='r2'` e `bu='incorporador'`):
| Closer R2 | R2 Agendadas | R2 Realizadas | Aprovados | Reprovados | Vendas Parceria |

Vendas de parceria por closer R2: match attendees aprovados com `hubla_transactions` de parceria/incorporador (excluindo contrato e renovação). Se possivel, mini-lista dos produtos vendidos por closer.( a001 e a009 os procutos a serem mostrados )

#### Seção 4 — Resumo Financeiro

Tabela com entradas por categoria:


| Tipo                   | Qtd               | Valor                   |
| ---------------------- | ----------------- | ----------------------- |
| Vendas A010            | count             | faturamento             |
| Contratos (A000)       | count             | —                       |
| Parceria (por produto) | count por produto | faturamento por produto |


Query em `hubla_transactions` agrupando por `product_name` onde `product_category` in `('parceria','incorporador','ob_vitalicio')` excluindo contrato e renovação.

### Alterações técnicas

**Arquivo**: `supabase/functions/weekly-manager-report/index.ts`

1. Corrigir email de Jessica para `jessica.bellini@minhacasafinanciada.com`
2. Reescrever `buildIncorporadorReport()` com as 4 seções acima
3. Buscar SDRs via `employees` (squad=incorporador, status=ativo, cargo=sdr) + join com `sdr_comp_plan` para metas
4. Buscar closers R1 e R2 separadamente da tabela `closers` (meeting_type r1/r2, bu incorporador)
5. Buscar R1 attendees do periodo para KPIs e per-closer metrics
6. Buscar ligações da tabela `calls` por `user_id` no periodo
7. Buscar transações financeiras agrupadas por produto
8. Gráficos de pizza em HTML/CSS puro (div com border-radius + conic-gradient)

### Detalhes

- Periodo do contrato: Qui-Qua (carrinho)
- R1/R2 meetings: mesmo periodo Qui-Qua
- Closers R1 consultados via tabela `closers` com `meeting_type='r1'` e `bu='incorporador'`
- Closers R2 consultados via tabela `closers` com `meeting_type='r2'` e `bu='incorporador'`  
- Lead origin: `meeting_slots.lead_type` = 'A' (A010) ou 'B' (LIVE)
- Ligações: tabela `calls` contando `started_at` no periodo por `user_id`
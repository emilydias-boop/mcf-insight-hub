# Reavaliação de reuniões: últimos 7 dias e mais rápida

## O que encontrei (só leitura)
- O botão funcionou: as **1.192 reuniões de R1** voltaram para a fila às 14:55.
- A fila processa na prática **1 reunião a cada 10 minutos** (cada análise leva ~46 s). Por isso as notas parecem não mudar: levaria mais de 8 dias.

## O que vou mudar
1. **Janela de 7 dias**: o botão passa a reavaliar só reuniões dos últimos 7 dias (hoje são **123** de R1). O texto de confirmação diz isso.
2. **Limpar a fila atual**: as reuniões mais antigas que 7 dias que estão aguardando por causa do clique de hoje voltam para "analisado" (mantêm a nota que já tinham). Reuniões que ainda não tinham nota nenhuma continuam na fila.
3. **Acelerar**: 3 análises em paralelo por rodada, rodada a cada 2 minutos. As 123 terminam em cerca de 1h30.
4. **Progresso na tela**: ao lado do botão, "Reavaliação: X de Y concluídas", atualizado sozinho.

## Detalhes técnicos
- Migration: `script_reavaliar` filtra `s.scheduled_at >= now() - interval '7 days'`; nova RPC de leitura `script_reavaliacao_progresso(_meeting_type)` (admin/manager).
- SQL pontual: gravações `pendente` com `analysis_attempts=0`, slot com mais de 7 dias e que já possuem `meeting_ai_reviews` → `analysis_status='analisado'`.
- `meetgeek-analisar`: processar o lote com concorrência 3 (Promise.allSettled), mantendo pausa por cota e MAX_TENTATIVAS.
- Cron `meetgeek-analisar`: `*/2 * * * *` (720 rodadas/dia; sem fila, a rodada só consulta e sai).
- `ScriptVendas.tsx`: texto do diálogo e contador com refetch a cada 30 s.

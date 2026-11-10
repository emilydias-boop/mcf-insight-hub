# Reavaliação de reuniões: por que "não aconteceu" e como corrigir

## O que encontrei (só leitura)
- O botão funcionou: as **1.192 reuniões de R1** voltaram para a fila às 14:55 (e 1 de R2).
- A reanálise roda sozinha a cada 10 minutos, mas hoje processa **na prática 1 reunião por rodada** (cada análise leva ~46 s e a rodada é cortada em 55 s).
- Resultado: cerca de 6 reuniões por hora, ou seja, **mais de 8 dias** para reavaliar tudo. Enquanto isso, as notas antigas continuam aparecendo, dando a impressão de que nada mudou.
- A tela não mostra nenhum progresso depois do aviso de "reenfileiradas".

## O que vou mudar
1. **Acelerar a fila**: analisar várias reuniões ao mesmo tempo em cada rodada (3 em paralelo) e rodar a cada 2 minutos. Estimativa: ~90 reuniões por hora, cerca de 13 horas para as 1.192. Se a cota de IA acabar, a fila pausa sozinha e continua depois, sem perder nada (isso já existe).
2. **Mostrar o progresso na tela do Script de vendas**: ao lado do botão, um contador "Reavaliação em andamento: X de Y concluídas", atualizado sozinho, e "concluída" ao terminar.
3. Nada muda nas notas já gravadas: a nota nova é salva junto da versão do script, e a antiga fica no histórico.

## Detalhes técnicos
- `supabase/functions/meetgeek-analisar/index.ts`: processar os itens reivindicados com concorrência 3 (Promise.allSettled), mantendo o tratamento de IAQuotaError (interrompe e devolve à fila) e MAX_TENTATIVAS.
- Cron `meetgeek-analisar`: schedule `*/2 * * * *`, body com `lote: 3` (via SQL de `cron.alter_job`, não migration de schema).
- Nova RPC só de leitura `script_reavaliacao_progresso(_meeting_type)` (admin/manager): contagem de pendente/analisado/erro das gravações ingeridas com transcrição. `ScriptVendas.tsx` consulta com refetch a cada 30 s enquanto houver pendentes.
- Custo: o mesmo número de análises de antes, só que concluídas mais rápido.

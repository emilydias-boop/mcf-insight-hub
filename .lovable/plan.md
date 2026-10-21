# Script Piloto de Reuniões R1 (ainda não implementado)

Situação atual: nenhuma das 5 funções foi construída. O trabalho foi pausado para os relatórios diários. Nada foi gravado.

## O que será construído
1. **Reuniões candidatas a piloto (automático)** — lista das R1 em que o mesmo closer, no mesmo horário, teve 2 ou 3 participantes com Contrato pago sem reembolso, e que têm transcrição. No-show continua na reunião, mas não conta como venda. Mostra closer, data, participantes, quantos pagaram, duração e nota atual.
2. **Gestor confirma as pilotos** — botão para marcar e desmarcar cada reunião. Nada vira piloto sozinho.
3. **Gerar Script Piloto** — a IA lê as transcrições escolhidas e propõe as etapas no formato da tela "Script de Vendas": etapa, descrição, critério, peso e se é obrigatória, com trechos reais de exemplo. O resultado abre como rascunho no editor que já existe. Só vira oficial com o botão "Publicar", que cria uma nova versão e guarda as anteriores.
4. **Notas das próximas reuniões** — a avaliação atual passa a comparar com o script publicado. A tela de notas não muda. Reavaliar reuniões antigas fica opcional, pelo botão "Reavaliar".
5. **Indicador de saúde** — taxa de contrato pago por faixa de nota (0–4, 4–6, 6–8, 8–10).

## Garantias
- Não altera regras, permissões (RLS), procedures ou gatilhos existentes.
- Só cria tabelas novas: pilotos marcados e rascunhos gerados. As consultas de candidatas e do indicador são somente leitura.
- Só o gestor e o admin podem marcar pilotos, gerar e publicar.

## Detalhes técnicos
- Tabelas novas `script_piloto_reunioes` e `script_piloto_rascunhos`, com GRANT e RLS próprios.
- Funções de leitura `script_piloto_candidatas(periodo)` e `script_saude_faixas()`, com `security invoker`. Elas leem `meeting_slots`, `meeting_slot_attendees` (`refunded_at` nulo) e as transcrições.
- Nova função no servidor `gerar-script-piloto`, via Lovable AI, que devolve as etapas em formato estruturado.
- Nova aba "Pilotos" na tela Script de Vendas. O rascunho é carregado no editor atual, e a publicação usa o fluxo de versão que já existe.

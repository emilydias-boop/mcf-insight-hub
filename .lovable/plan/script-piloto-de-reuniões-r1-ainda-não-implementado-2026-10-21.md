# Script Piloto de Reuniões R1 (ainda não implementado)

Situação atual: nenhuma das 5 funções foi construída. O trabalho foi pausado para os relatórios diários. Nada foi gravado.

## O que será construído
1. **Reuniões piloto (automático, sem gestor)** — vale para todos os closers e qualquer horário. Uma R1 marcada como **Realizada** vira piloto sozinha quando 2 ou 3 participantes dela têm a etiqueta **Contrato Pago**, sem reembolso. Exemplo: Julio, 19/10, 10:15 — Ivan Silva e Evandro com Contrato Pago (o no-show do Edivaldo não atrapalha). A lista mostra closer, data, participantes, quantos pagaram, duração e nota atual. Para gerar o script, a reunião também precisa ter transcrição; sem transcrição, ela aparece como "piloto sem transcrição".
2. **Saída automática** — se um dos contratos for reembolsado e sobrar menos de 2 pagos, a reunião deixa de ser piloto sozinha. Não há botão de confirmação.
3. **Gerar Script Piloto** — a IA lê as transcrições escolhidas e propõe as etapas no formato da tela "Script de Vendas": etapa, descrição, critério, peso e se é obrigatória, com trechos reais de exemplo. O resultado abre como rascunho no editor que já existe. Só vira oficial com o botão "Publicar", que cria uma nova versão e guarda as anteriores.
4. **Notas das próximas reuniões** — a avaliação atual passa a comparar com o script publicado. A tela de notas não muda. Reavaliar reuniões antigas fica opcional, pelo botão "Reavaliar".
5. **Indicador de saúde** — taxa de contrato pago por faixa de nota (0–4, 4–6, 6–8, 8–10).
6. **Resumo semanal dos closers por e-mail** — toda segunda às 08:00 (horário de Brasília), com a semana anterior (segunda a domingo). Para cada closer: reuniões R1 realizadas, contratos pagos sem reembolso e conversão (contratos ÷ realizadas). Também mostra o total da equipe. Vai para os coordenadores e gerentes de cada BU, cada um recebendo só os closers da própria BU. Usa o envio de e-mail que o sistema já tem (Brevo).

## Garantias
- Não altera regras, permissões (RLS), procedures ou gatilhos existentes.
- Só cria tabelas novas: pilotos detectados, rascunhos gerados e o registro dos envios do resumo. As consultas de pilotos, do indicador e do resumo são somente leitura.
- A marcação de piloto é automática. Só o gestor e o admin podem gerar e publicar o script.
- O resumo registra cada semana enviada, para não mandar duas vezes.

## Detalhes técnicos
- Tabelas novas `script_piloto_reunioes`, `script_piloto_rascunhos` e `resumo_semanal_closers_envios`, com GRANT e RLS próprios.
- Pilotos: a função de leitura `script_piloto_detectar()` encontra slots R1 com status realizada que têm de 2 a 3 participantes com `contract_paid` (ou `contract_paid_at`) e `refunded_at` nulo. Um job diário sincroniza a tabela, inserindo e retirando pilotos.
- `script_saude_faixas()` e `resumo_semanal_closers(inicio, fim, bu)` são funções de leitura com `security invoker`.
- Nova função no servidor `gerar-script-piloto`, via Lovable AI, que devolve as etapas em formato estruturado.
- Nova função no servidor `resumo-semanal-closers`, acionada por um agendamento toda segunda às 11:00 UTC. Ela monta o e-mail em HTML e envia pela integração Brevo que já existe, sem mexer nos envios atuais.
- Nova aba "Pilotos" na tela Script de Vendas. O rascunho é carregado no editor atual, e a publicação usa o fluxo de versão que já existe.

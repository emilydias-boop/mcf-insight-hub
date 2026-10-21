# Script Piloto a partir das reuniões que mais venderam contrato

## Parecer sobre o prompt sugerido

O prompt não bate com o seu pedido e traz riscos de efeito colateral. O sistema já tem quase tudo o que ele manda criar do zero:

- Gravação e transcrição das reuniões (MeetGeek) já chegam sozinhas e ficam ligadas a cada reunião da agenda.
- Já existe a avaliação por IA com Nota, Aderência, etapas, pontos fortes e de melhoria (a sua tela 2).
- Já existe a tela "Script de Vendas", com versões, publicação e reavaliação.
- O "Contrato pago" já é marcado em cada participante da reunião (a tag da tela 1).

Pontos do prompt que entram em conflito com o seu pedido:

| Item do prompt | Problema |
|---|---|
| Criar módulo novo com upload de áudio, provedor de transcrição, bucket novo | Duplica o MeetGeek que já funciona |
| Resultado da reunião "sincronizado por trigger" com o CRM | Cria gatilho nas tabelas do CRM — você pediu para não tocar em trigger |
| Tabelas `closer_*` com regras de acesso próprias | Duplica cadastros e regras que já existem |
| Piloto escolhido manualmente, mínimo de 5 por produto | Seu critério é: reunião em que o closer vendeu contrato para 2 ou 3 participantes |
| Cores e fonte novas (#C8FF00, Plus Jakarta Sans) | Mudaria o visual atual do app |
| Avaliação refeita do zero | A nota atual (tela 2) seria trocada por outra lógica |

Recomendação: não usar o prompt como está. Fazer a versão abaixo, que só acrescenta e reaproveita o que existe.

## O que será feito

1. **Reuniões candidatas a piloto (automático)**
   Lista das reuniões R1 em que o mesmo closer, no mesmo horário, teve 2 ou 3 participantes com Contrato pago (sem reembolso) e que têm transcrição. Ex.: Julio 10:15 — Ivan Silva e Evandro (Edivaldo no-show não conta como venda, mas a reunião continua elegível).
   Mostra closer, data, participantes, quantos pagaram, duração e a nota atual.

2. **Gestor confirma as pilotos**
   Um botão marca/desmarca cada reunião como piloto. Nada vira piloto sozinho; a lista só sugere.

3. **Gerar Script Piloto**
   Botão "Gerar script a partir das pilotos": a IA lê as transcrições escolhidas e propõe as etapas no mesmo formato da tela "Script de Vendas" atual (etapa, descrição, critério, peso, obrigatória), com trechos reais de exemplo.
   O resultado abre como **rascunho** no editor existente. Só vira o script oficial quando o gestor clicar em "Publicar" (botão que já existe), gerando nova versão e preservando as anteriores.

4. **Notas das próximas reuniões**
   Depois de publicado, a avaliação que já roda passa a comparar cada reunião com esse script — a tela 2 continua igual, com nota e aderência medidas contra o piloto. Reavaliar reuniões antigas fica opcional, pelo botão "Reavaliar" já existente.

5. **Indicador de saúde (simples)**
   Na tela do script: taxa de contrato pago por faixa de nota (0–4, 4–6, 6–8, 8–10), para ver se nota alta realmente vende mais.

## O que NÃO será tocado

- Nenhuma regra, permissão (RLS), procedure ou trigger existente.
- Nenhuma alteração na agenda, no "Contrato pago", no reembolso, na distribuição ou nas outras BUs.
- A função de avaliação atual e o MeetGeek seguem como estão.

## Pergunta antes de construir

- Valer só para **R1** ou também R2? (plano assume R1)
- Período padrão para buscar candidatas: últimos 90 dias?

## Detalhes técnicos

- Banco (somente acréscimos, com sua aprovação na hora): 1 tabela nova `script_piloto_reunioes` (meeting_slot_id, marcado_por, marcado_em, ativo) e 1 tabela `script_piloto_rascunhos` (etapas jsonb, fontes, status), com GRANT e RLS próprias só delas (admin/manager/coordenador). Uma função de leitura nova `script_piloto_candidatas(p_inicio, p_fim, p_tipo)` (SECURITY INVOKER) que lê `meeting_slots`, `meeting_slot_attendees` (contract_paid_at ou status contract_paid, refunded_at nulo, contagem 2–3) e `meeting_recordings` (transcrição presente). Nenhum ALTER em tabela/função existente.
- Edge function nova `gerar-script-piloto`: valida JWT e papel, lê transcrições das pilotos, chama o Lovable AI Gateway (modelo padrão, saída JSON com schema estrito, streaming), grava só em `script_piloto_rascunhos`. Não escreve em `sales_script_steps`.
- Publicação reutiliza o RPC já existente `script_publicar_versao`, chamado pelo gestor no editor — é o mesmo caminho manual de hoje.
- `meetgeek-analisar` não é alterada; ela já lê o script ativo de `sales_script_steps`.
- Front: nova aba "Pilotos" em `src/pages/crm/ScriptVendas.tsx` + hook novo; editor carrega o rascunho.
- Teste: regra de candidata (2 ou 3 pagos, reembolsado não conta, no-show não conta como venda).

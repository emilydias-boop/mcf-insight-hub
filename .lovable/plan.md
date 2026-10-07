# Verificação (somente leitura): o que iria junto numa publicação agora

Nada foi alterado nem publicado. Este card só registra o resultado; não há nada a implementar.

## Site publicado (mcfgestao.com)
Arquivo principal: `assets/index-CZfz7M0v.js`. As telas carregam em partes separadas, então baixei também as 313 partes ligadas a ele e procurei em todas.

| Edição | Texto procurado | Resultado |
|---|---|---|
| Admissão no CRM | (é só no servidor) | Já está no ar: funções do servidor publicam na hora |
| Meta SDR/RH | `metas_agendamento_por_sdr` | No ar (6 arquivos) |
| Reembolso de contrato (selo/Kanban/linha do tempo) | "Contrato reembolsado em", "Reembolso de contrato" | No ar (arquivo principal: 1 e 2) |
| Régua R1 na TV (versão das 18:04) | `semanas_restantes`, `grid-rows-[auto_auto_minmax(0,1fr)]` | No ar |
| Agenda completa só leitura / atribuição "Manual (gestão)" | `agenda_visao_completa_bus`, "Manual (gest" | No ar |
| Recompra manual + 4ª condição (22:38–22:43) | "Lançar recompra", `origem_attendee_id` | NÃO está no ar (0) |

## O que ainda não está no ar
- Recompra manual: botão "Lançar recompra" nas Tratadas, a proposta guarda a reunião de origem e a Produção Gerada passa a dar prioridade ao closer dessa reunião. A coluna nova no banco já existe (ela foi criada antes e fica vazia). A publicação não dispara nada fora do sistema; só um lançamento de venda feito depois gera o alerta de venda normal.

Commits depois de 18:04 são só desta conversa (recompra/4ª condição e atualizações deste card).

# Escritório Virtual 3D (/escritorio) — plano para aprovação

## Visão geral
Tela nova "Escritório" com cena 3D. Cada BU tem um agente numa mesa. Às 11h (São Paulo) o agente "levanta", anda até a mesa do CEO e entrega o quadro de capacidade R1 do dia. Início: Incorporador e Consórcio (líder Jéssica Bellini). Mesas vazias: Crédito e Pós-venda. Visual: grafite #101010, verde #B3F302, fonte Poppins, seguindo o protótipo HTML que será enviado.

## (a) O que será criado

### Tabelas novas (todas com GRANT + RLS)
1. `escritorio_agentes` — uma linha por BU: `bu`, `nome_agente`, `lider_user_id`, `ativo`, `capacidade_reunioes_por_closer` (Incorporador 6, Consórcio 7), `leads_por_reuniao` (3 e 1), `hora_entrega` (11:00), `hora_confirmacao` (10:45), `posicao_mesa`.
2. `escritorio_agente_pessoas` — inclusões/exclusões por BU: `bu`, `tipo` (closer|sdr), `closer_id`/`sdr_id`, `regra` (incluir|excluir), `motivo`. Seed: excluir Jéssica Bellini e Nicola Ricci nas duas BUs; excluir João Pedro Martins Vieira como closer do Consórcio. O cadastro de closers não é alterado.
3. `escritorio_presenca_correcoes` — `data`, `bu`, `tipo`, `pessoa_id`, `presente` (bool), `motivo`, `corrigido_por`, `corrigido_em`. Chave única (data, bu, tipo, pessoa_id). Só insere/atualiza as próprias linhas dela; nenhum dado existente é alterado.
4. `escritorio_entregas` — `data`, `bu`, `numeros` (jsonb com o quadro), `texto_leitura`, `entregue_em`, `origem` (automatica|manual). Chave única (data, bu): reprocessar o mesmo dia substitui a entrega.

### Funções novas no banco
- `escritorio_pode_ver(bu)` — CEO/admin vê tudo; líder vê só as BUs em que é `lider_user_id`.
- `escritorio_capacidade_dia(data, bu)` — somente leitura (STABLE, SECURITY DEFINER, verifica `escritorio_pode_ver`). Devolve: closers R1 ativos (`closers.bu`, meeting_type r1) menos exclusões; presença = acesso em `page_access_log` até 11h SP, sobrescrita por `escritorio_presenca_correcoes`; reuniões e leads possíveis = presentes × capacidade × leads; SDRs ativos da BU com meta (`sdr_metas_mes` do mês, senão `sdr.meta_diaria`) e presença; agendamentos possíveis = soma das metas dos presentes; reuniões R1 já na agenda do dia (`meeting_slots`) e agendamentos já feitos hoje (`meeting_slot_attendees` criados no dia).
- `escritorio_registrar_entrega(data, bu)` — chama a função acima e grava/substitui em `escritorio_entregas` (só tabela nova).
- Agendamento diário às 11:00 SP (pg_cron, 14:00 UTC, seg–sex) chamando `escritorio_registrar_entrega` para cada agente ativo. Sem rede, sem webhook.

### Telas e arquivos (frontend)
- `src/pages/escritorio/Escritorio.tsx` + rota `/escritorio` em `App.tsx` e item no menu (visível só para CEO/admin e líderes).
- `src/components/escritorio/EscritorioCena.tsx` — cena 3D com **@react-three/fiber 8.18 + drei 9.122** (o projeto usa React 18; R3F encaixa no padrão React do app e facilita clique nos agentes). Lógica da animação (posição, caminho até a mesa do CEO) em `src/lib/escritorio/` sem React, com testes.
- `src/components/escritorio/FichaBU.tsx` — ao clicar no agente: quadro do dia, nomes de presentes/ausentes e histórico das entregas.
- `src/pages/escritorio/ConfirmarPresenca.tsx` (`/escritorio/presenca`) — lista pré-preenchida pelo login; líder marca presente/ausente com motivo; grava em `escritorio_presenca_correcoes`. Banner aparece para a líder a partir das 10h45 dentro do próprio app.
- `src/hooks/useEscritorio.ts`, `src/lib/escritorio/capacidade.ts` + testes (regras: 6×3=18 no Incorporador, 7×1 no Consórcio, exclusões, presença corrigida).
- `AGENTS.md`: regra de que capacidade vem só de `escritorio_agentes` e entregas só por `escritorio_registrar_entrega`.
- Pacotes: `three`, `@react-three/fiber@^8.18`, `@react-three/drei@^9.122`, `@types/three`.

### Acesso (RLS)
- Leitura das 4 tabelas: `escritorio_pode_ver(bu)`.
- Configuração (agentes/pessoas): só admin edita.
- Correções de presença: líder da BU e admin gravam.
- Entregas: gravadas só pela função/cron; ninguém edita pela tela.

## (b) Riscos
- Presença por `page_access_log` só registra quem abriu o app; quem trabalha sem abrir até 11h aparece ausente até a líder corrigir. Se a líder não confirmar, a entrega das 11h sai só com o login.
- "Agendamentos já feitos" usa a data de criação do participante; remarcações podem contar no dia em que foram criadas originalmente.
- Closers sem `meeting_type` R1 bem preenchido (ex.: Thobson com tipo vazio no Consórcio) ficariam fora; listarei antes de ligar.
- Cena 3D pesa em computadores fracos; mantenho poucos objetos e versão simples se o aparelho não suportar.
- Jéssica é líder e excluída das contas ao mesmo tempo: ela vê a BU mas não conta.

## (c) O que dispara junto
- Nenhum aviso usa `user_notifications`. Conferido: essa tabela não tem gatilhos no banco; ela é só escrita por `hubla-webhook-handler`, `asaas-webhook-handler`, `webhook-make-contrato` e `webhook-make-parceria`. Mesmo assim o aviso das 10h45 será só um banner na tela, lendo as tabelas novas.
- As tabelas novas não terão gatilhos que chamem WhatsApp, e-mail, FinanceHub, MCF Pay, Asaas ou Meta.
- Só leitura em `meeting_slots`, `meeting_slot_attendees`, `sdr`, `sdr_metas_mes`, `closers`, `page_access_log` — os gatilhos dessas tabelas (ex.: MCF Pay, Meta CAPI em participantes) só disparam em gravação, então não disparam.
- **Publicação:** há alterações ainda não publicadas que iriam juntas: horários livres/travados da Agenda Pós-Venda, lista de gerentes restrita, e a aba Relatório da Cota com botão HARVEY. O banco (tabelas, funções, horários) já vale hoje; o que espera publicação é a parte de tela. Recomendo publicar essas antes ou confirmar com Thobson.

## (d) Estimativa
1. Banco: tabelas, funções, seed das exclusões, cron (1 etapa, com aprovação).
2. Conferência somente leitura da função para hoje nas duas BUs, com nomes (1 etapa).
3. Tela de confirmação de presença + ficha/histórico (1–2 etapas).
4. Cena 3D com base no protótipo (2–3 etapas, depende do HTML enviado).
5. Testes e ajustes visuais (1 etapa).
Total: cerca de 6 a 8 mensagens de construção.

## Pressupostos a confirmar
- "CEO" = papel admin (Grimaldo). Se for uma pessoa específica, cadastro na configuração.
- Entrega só seg–sex.
- Presença conta acesso entre 00:00 e 11:00 SP do dia.

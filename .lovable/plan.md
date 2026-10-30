# Presença do dia + capacidade para o FinanceHub

Substitui o plano do "Escritório". O 3D fica no FinanceHub; o Gestão só fornece a presença confirmada e a capacidade do dia, pela ponte external-query.

## (a) O que será criado ou alterado

### Banco (1 migração, tudo novo, nenhum dado existente é alterado)

1. **Tabela `presenca_config_bu`** (uma linha por BU: incorporador, consorcio)
   - líder (id do perfil), reuniões por closer/dia, leads por reunião, horário de corte (11:00), horário do aviso (10:45).
   - **`presenca_config_pessoas`** (BU, tipo closer/sdr, id da pessoa, incluir/excluir, observação). É aqui que ficam as exceções do CEO, sem mexer em cadastros:
     - Jéssica Bellini e Nicola Ricci: excluídos nas duas BUs.
     - João Pedro Martins Vieira: excluído no Consórcio (conta só no Incorporador).
     - Thobson: excluído no Consórcio.
   - Valores iniciais: Incorporador 6 × 3; Consórcio 7 × 1.
   - Acesso: leitura para admin e líder da BU; gravação só admin.
2. **Tabela `presenca_correcoes`**: data, BU, tipo (closer/sdr), pessoa, presente (sim/não), motivo (obrigatório), corrigido por, corrigido em. Uma linha por data+BU+pessoa (nova correção substitui a anterior da mesma pessoa no mesmo dia).
   - **`presenca_confirmacoes`**: data, BU, confirmado por, quando.
   - Acesso: líder da BU e admin leem e gravam só da própria BU; ninguém mais.
3. **Função `presenca_lista_dia(data, bu)`** (somente leitura, para a tela): pessoas ativas da BU com "acessou até 11h?" pelo `page_access_log` (horário de São Paulo) e a correção da líder, se houver.
4. **Função `capacidade_dia(data, bu)`** (somente leitura, segura): devolve um JSON com:
   - closers R1 ativos (`closers.is_active`, `meeting_type='r1'`, `bu`), menos exclusões; presentes com nome e origem ("pelo login" ou "corrigido pela líder" + motivo);
   - reuniões possíveis = presentes × reuniões/dia; leads possíveis = reuniões × leads/reunião;
   - SDRs ativos (`sdr.active`, `role_type='sdr'`, `squad` da BU), menos exclusões; presentes com nome e meta (`sdr_metas_mes` do mês, senão `sdr.meta_diaria`); agendamentos possíveis = soma das metas dos presentes;
   - reuniões R1 já na agenda do dia (`meeting_slots`, não canceladas, closers da BU);
   - agendamentos feitos no dia (`meeting_slot_attendees.booked_at` no dia, R1);
   - se a líder confirmou, quem e quando.
   - Executável só por admin, líder da BU ou a ponte (service_role).

### Edge Function

5. **`supabase/functions/external-query/index.ts`**: adicionar `capacidade_dia` à lista branca; valida `data` (AAAA-MM-DD, padrão hoje em São Paulo) e `bu` (incorporador|consorcio); chama a função; grava em `audit_logs` igual às outras ações (`external_query_capacidade_dia`). As 3 ações atuais ficam intactas.

### App

6. **`src/pages/PresencaDoDia.tsx`** (nova): escolha de BU, lista pré-preenchida (closers e SDRs), botões Presente/Ausente com motivo, botão "Confirmar presença", resumo da capacidade.
7. **`src/hooks/usePresencaDia.ts`** (novo): leitura das funções e gravação das correções/confirmação.
8. **`src/components/presenca/PresencaAvisoBanner.tsx`** (novo): a partir das 10h45 (São Paulo), para a líder/admin, enquanto o dia não estiver confirmado; lê só as tabelas novas.
9. **`src/App.tsx`**: rota `/presenca-do-dia` protegida; banner no layout principal (aparece só para líder/admin).
10. Item de menu (arquivo do menu lateral) visível só para líder/admin.
11. **`src/lib/presencaDia.ts` + teste**: contas de capacidade (6×3, 7×1, meta mensal antes da diária, exclusões).
12. **`AGENTS.md`**: uma regra sobre presença/capacidade.

## (b) Riscos

- **Duas contas da Jéssica Bellini** (jessica.bellini@ e jessica.bellini.r2@). Proposta: líder = a conta principal (jessica.bellini@). Confirmar.
- **Login não é presença**: `page_access_log` registra páginas abertas; quem não abrir o sistema até 11h aparece ausente até a líder corrigir.
- **BU dos SDRs** vem do campo `squad` (`incorporador`, `consorcio`); SDRs com squad diferente ficam fora. Closers duplicados por BU (mesma pessoa em linhas diferentes) são tratados pela linha da BU.
- **Consórcio sem disponibilidade cadastrada**: a capacidade usará a regra do CEO (7×1), não a agenda `closer_availability`; os números podem divergir da tela de agenda.
- Nenhum dado existente é alterado; nenhum gatilho existente é mexido.

## (c) O que dispara junto

- `audit_logs` e `page_access_log`: consultei e **não têm nenhum gatilho**.
- As tabelas novas terão só o gatilho de `updated_at` (próprio delas). Nada envia WhatsApp, e-mail, `user_notifications`, FinanceHub, MCF Pay ou Asaas.
- A função `capacidade_dia` só lê; não grava em `meeting_slots`, `closers` ou `sdr`.

## (d) Entra em vigor sem publicar x depende de publicar

- **Sem publicar:** tabelas, funções, configuração inicial e a ação `capacidade_dia` na external-query (o FinanceHub já pode chamar logo após a implantação).
- **Depende de publicar:** a tela "Presença do dia", o banner das 10h45 e o item de menu.

## (e) Alterações de outras pessoas que iriam junto numa publicação

Não consigo ver daqui qual versão está publicada em mcfgestao.com, então não dá para dar uma lista exata. A última informação registrada nesta conversa é que **ainda não foram publicadas**:
- Agenda Pós-Venda: horários livres/indisponíveis dos gerentes no Calendário e "Por Gerente", lista de gerentes restrita (pedidos do Thobson).
- Consórcio > Consultas > aba "Relatório da Cota", tipo de lance (Embutido/Livre/Fixo) na janela de lance e botão "Enviar ao HARVEY" (pedido do Thobson).
Antes de publicar, confirmo com quem pediu essas telas ou checo o histórico de versões no painel de publicação.

## (f) Etapas de construção

Cerca de 4 etapas: (1) migração; (2) ação na external-query + teste da chamada; (3) tela, banner e menu; (4) testes e conferência com dados reais de um dia.

## Pendências para aprovar

1. Qual conta da Jéssica é a líder?
2. Horário de corte: acessos até 11:00 inclusive?
3. "Agendamentos feitos no dia" = R1 marcadas no dia (pela data de marcação), mesmo que a reunião seja em outro dia — confirma?

## Objetivo

Criar a aba **"Meu Histórico"** dentro do CRM (ao lado de Contatos/Negócios/Agenda R1), exclusiva para SDRs, com tudo o que aconteceu pelas mãos dele — ligações, agendamentos, no-shows e reuniões perdidas — para que ele consiga retomar leads que pediram retorno, responder no WhatsApp ou recuperar agendamentos perdidos.

## O que a aba mostra

Uma página com 4 sub-abas (Tabs internos):

1. **Ligações** — todas as `calls` do SDR logado.
   - Colunas: data/hora, lead (nome + telefone), duração, status, resultado (`outcome`), follow-up (novo campo), resumo (novo campo), botão de player de gravação, link p/ abrir o lead.
   - Filtros: período (7/30/90 dias), follow-up (Retornar / WhatsApp / Sem interesse / Agendado), busca por nome/telefone.

2. **Agendamentos R1** — R1 marcadas pelo SDR (`agenda_r1.booked_by = me`), com status atual (Agendada / Realizada / No-Show / Contrato Pago).
   - Colunas: data agendada, lead, closer, status, link para o lead.

3. **No-Shows** — subset onde `attendee_status = 'no_show'`. Reaproveita a estrutura visual de `MeusNoShows`.

4. **Perdidas** — R1 que foram marcadas mas terminaram em `cancelled`/`refunded`/sem contrato após X dias. Mostra o motivo se disponível.

KPIs no topo: total de ligações, ligações com follow-up pendente (Retornar / WhatsApp), R1 marcadas no período, conversão R1 → Contrato.

## Novo campo de follow-up nas ligações

Migration adiciona em `public.calls`:
- `follow_up_action text` — enum livre: `retornar` | `whatsapp` | `sem_interesse` | `agendado` | `outro` | `null`
- `follow_up_at timestamptz` — quando o SDR pediu para retornar (opcional, usado no filtro "Retornos hoje")
- `summary text` — resumo escrito pelo SDR após a ligação

Edição inline na linha da Ligação (popover): seleciona ação + data opcional + escreve resumo. Persiste via `update calls`.

**Observação sobre IA:** hoje não há transcrição armazenada das gravações Twilio, então o resumo automático por IA não pode ser gerado de forma confiável. O campo `summary` será preenchido manualmente pelo SDR no primeiro release. Numa iteração futura podemos adicionar transcrição via Twilio + resumo via Lovable AI Gateway.

## Visibilidade

- SDR / Closer / Closer Sombra: vêem apenas o que é deles (`calls.user_id = auth.uid()`, `agenda_r1.booked_by = me_email`).
- Coordenador / Manager / Admin: ganha um filtro **"SDR"** no topo (dropdown com todos os SDRs ativos da BU). Sem filtro = vê todos.

RLS já existente em `calls` cobre o caso individual (Coordenador já consegue selecionar — `mem://security/crm-activity-visibility-coordenador`). Para os SDRs do filtro de gestor, usamos os emails do squad ativo.

## Onde encaixa

- Nova chave `meu-historico` em `BU_VISIBLE_TABS` para todas as BUs (incorporador, consorcio, credito, projetos, leilao).
- Tab adicionada em `BUCRMLayout.tsx` entre **Agenda R1** e **Meus No-Shows**, com ícone `History`.
- Liberada para sdr/closer/closer_sombra/coordenador/manager/admin (entra na lista `allowedTabs` para `isAgendaOnly`).
- Nova rota: `<bu>/crm/meu-historico` apontando para `MeuHistorico.tsx`.

## Arquivos

Novos:
- `src/pages/crm/MeuHistorico.tsx` — shell com Tabs e KPIs.
- `src/components/crm/historico/HistoricoLigacoesTab.tsx`
- `src/components/crm/historico/HistoricoR1Tab.tsx`
- `src/components/crm/historico/HistoricoNoShowsTab.tsx`
- `src/components/crm/historico/HistoricoPerdidasTab.tsx`
- `src/components/crm/historico/CallFollowUpPopover.tsx`
- `src/hooks/useMeuHistoricoCalls.ts`
- `src/hooks/useMeuHistoricoR1.ts`

Editados:
- `src/pages/crm/BUCRMLayout.tsx` — registrar a nova aba e liberar para SDR.
- `src/App.tsx` — registrar rota em cada BU CRM (`incorporador/crm`, `consorcio/crm`, `credito/crm`, etc.) e na rota legacy `/crm`.

Migration:
- Adiciona `follow_up_action`, `follow_up_at`, `summary` em `public.calls`.

Memória nova:
- `mem://features/sdr-meu-historico` documentando a aba, filtros e visibilidade.

## Validação

1. SDR (Caroline) entra em `/incorporador/crm/meu-historico` → vê só dela. Aba **Ligações** lista calls dela com filtros funcionando.
2. SDR marca uma call como **Retornar** → linha ganha badge laranja → filtro "Retornos pendentes" lista ela.
3. Aba **Agendamentos R1** lista R1 onde `booked_by = email da SDR` com status atual.
4. Aba **No-Shows** mostra reuniões em `no_show` (mesmo dataset de `MeusNoShows`).
5. Aba **Perdidas** mostra R1 marcadas que viraram cancelled/refunded.
6. Coordenador/Admin vê filtro "SDR" e consegue alternar para ver o histórico de outro SDR.
7. SDR de outra BU não vê aba indevida (filtra por BU).



## Plano: Forçar registro de desfecho da reunião pelo Closer Consórcio

### Problema central
A aba Pós-Reunião já tem botões "Proposta" e "Sem Sucesso", mas é **opcional** — o closer só aparece lá depois da R1 Realizada e pode simplesmente ignorar (em abril, 270 reuniões realizadas estão "Aguardando Ação", todas pendentes). Resultado: dashboards zerados.

### O que precisamos construir

Tornar o registro de desfecho **obrigatório e visível** para o closer logo após a reunião, em vez de uma aba que ele esquece de abrir.

### Solução em 3 camadas

**1. Notificação ativa no momento da reunião (push-based, não pull-based)**

Hoje o closer precisa LEMBRAR de abrir a aba Pós-Reunião. Inverter:
- Após uma R1 ser marcada como "Realizada" (na Agenda R1), abrir automaticamente um **modal de desfecho obrigatório** com 3 opções:
  - **Proposta Enviada** (abre `ProposalModal` existente)
  - **Sem Sucesso** (abre `SemSucessoModal` existente)
  - **Aguardar retorno do cliente** (registra "pendente" com prazo de 48h, conta como "em follow-up")
- Modal pode ser fechado, mas o card do deal fica destacado em vermelho na agenda até desfecho registrado

**2. Banner persistente "Reuniões sem desfecho" no dashboard do Closer**

Em `/closer/meu-desempenho` (Consórcio), adicionar banner no topo:
- Conta R1 Realizadas dele sem desfecho (sem `consorcio_proposals` nem `consorcio_sem_sucesso`)
- Mostra em vermelho com CTA "Registrar agora" → abre lista
- Bloqueia visualmente até reduzir para 0

**3. Lembrete automático após 24h sem desfecho**

Edge Function (cron diário) que:
- Busca R1 Realizadas com mais de 24h sem desfecho
- Cria notificação in-app (sino) para o closer
- Após 72h: notifica também o gestor (visibilidade cruzada)

### Mudanças técnicas

**Arquivos a modificar:**

| Arquivo | Mudança |
|---|---|
| `src/components/crm/R1MeetingDrawer.tsx` (ou onde marca "Realizada") | Após mutation success de status `completed`, se BU = consórcio, disparar `OutcomeRequiredModal` |
| `src/components/consorcio/OutcomeRequiredModal.tsx` (NOVO) | Modal com 3 cards: Proposta / Sem Sucesso / Aguardar. Reusa `ProposalModal` e `SemSucessoModal` existentes |
| `src/pages/closer/MeuDesempenhoCloser.tsx` (branch consórcio) | Adicionar `<PendingOutcomesBanner />` no topo |
| `src/components/closer/PendingOutcomesBanner.tsx` (NOVO) | Banner que conta reuniões sem desfecho do closer logado, com lista expansível e CTAs rápidos |
| `src/hooks/usePendingOutcomes.ts` (NOVO) | Query: R1 Realizadas do closer no período sem registro em `consorcio_proposals` nem em `consorcio_sem_sucesso` |
| `src/hooks/useConsorcioPostMeeting.ts` | Adicionar mutation `useMarcarAguardarRetorno` (insere registro com flag `aguardando_retorno = true`) |
| `supabase/functions/notify-pending-outcomes/index.ts` (NOVO Edge Function) | Cron diário 09h: verifica pendências >24h, cria notificações |

**Schema (1 alteração mínima):**

Adicionar coluna `aguardando_retorno boolean DEFAULT false` em `consorcio_proposals` (já que "aguardar" é um estado intermediário válido — proposta verbal feita, aguarda confirmação do cliente). Sem nova tabela.

### Como fica a UX do João Pedro

| Momento | O que acontece |
|---|---|
| Marca R1 como "Realizada" | Modal obrigatório aparece imediatamente: "Qual o desfecho?" |
| Clica "Proposta" | Abre `ProposalModal`, registra → vai pra dashboard |
| Clica "Sem Sucesso" | Abre `SemSucessoModal`, registra motivo → vai pra dashboard |
| Clica "Aguardar retorno" | Registra pendente, modal fecha, deal volta pra agenda com flag |
| Fecha modal sem ação | Banner vermelho aparece no `/meu-desempenho`: "Você tem 1 reunião sem desfecho" |
| 24h depois | Notificação no sino: "Registre o desfecho de [Cliente]" |
| 72h depois | Gestor vê na sua dashboard que João tem desfechos pendentes |

### Resultado esperado em 2 semanas

Hoje: 270 reuniões realizadas / 0 propostas registradas (0%)  
Meta: >90% das reuniões com desfecho registrado em até 24h

Aí sim os dashboards "Propostas Enviadas" passam a refletir a realidade — sem hack de contar `PRODUTOS FECHADOS` como proposta.

### Garantias

- Sem quebra do fluxo atual (aba Pós-Reunião continua funcionando)
- Modal obrigatório só aparece para BU Consórcio (não afeta Incorporador)
- Closer pode escolher "Aguardar retorno" — não força decisão prematura
- Banner é visual, não bloqueia operação
- Notificações usam sistema in-app existente (sino)


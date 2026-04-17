

## Diagnóstico real dos 22 Pendentes

Recebi sua planilha com a verdade-terreno. Os 22 casos se dividem em **4 padrões distintos**, e nenhum deles é "outside legítimo". Todos têm R1 realizada com SDR conhecido e contrato pago — só estão classificados errado.

### Categorização dos 22 casos

**Grupo A — R2 agendado para PRÓXIMA semana (6 casos)**  
Jackson O. Silva, Annie Veggi, Riolando, Carlos Simão, Vinicius Ornelas (pré-agendado), e parcialmente Rafael Albaneze.  
→ Pagaram contrato nesta semana, mas o R2 está marcado para 20/04 (semana seguinte). A RPC só traz R2 da semana atual, então caem como órfãos. **Hoje a RPC não os encontra porque o R2 está fora da janela.**

**Grupo B — Sem R2 agendado ainda, só R1+contrato (7 casos)**  
Willams Luiz, Erick Alves, Luis Fernando Exner, Moisés Elias, Ulisses Lamas, Edinei Pinto, Ailton Lins, Filipe Amaral.  
→ R1 realizada + contrato pago, mas ninguém marcou R2. **São genuinamente "pago sem R2 nesta semana"**, porém **R1 existe** — então não deveriam estar em "Pendente" sem mostrar R1+SDR. Hoje aparecem como linha vazia porque o merge é só com R2.

**Grupo C — R2 desta semana mas RPC pegou o errado (5 casos)**  
Wilde, Uislaine, Gustavo Almeida, Jaziel Alencar, Jackson Willians.  
→ Têm R2 Aprovado nesta semana mas a RPC retornou outro registro (refunded de outra pipeline, ou Próxima Semana). **Mesmo problema que corrigimos na última migração** — o `status_score` deve resolver, mas para os que têm `r2_status_name` = "Próxima Semana" precisamos verificar se o score está priorizando "Aprovado".

**Grupo D — Caso especial: 2 R2 na semana (1 caso)**  
Rafael Albaneze (R2 09/04 + R2 10/04, mesmo lead).  
→ Lead foi agendado 2x. RPC dedupa por telefone e mostra um só, mas o "outro" sumiu. Precisa decidir qual mostrar (provavelmente o mais recente Aprovado).

**Grupo E — Refund legítimo (1 caso)**  
Eduardo Queiroz (10/02 contrato pago, 13/04 R2 reembolso).  
→ Comprou em fevereiro mas o reembolso de 13/04 é desta semana. **A questão aqui:** o contrato pago é antigo (fora da semana), só o reembolso é desta semana. Precisa decidir se entra ou não no relatório desta safra.

**Grupo F — Pré-agendado oculto (1 caso)**  
Vinicius Ornelas — `status = pre_scheduled`, deliberadamente escondido das grades (memória `r2-pre-scheduled-confirmation-flow-v2`). **Isso é correto pelo design atual.**

### Causa-raiz real

O hook `useContractLifecycleReport` hoje:
1. Busca contratos Hubla da semana
2. Busca R2s da RPC `get_carrinho_r2_attendees` (só da semana)
3. Faz merge por telefone/email
4. Quando não encontra R2 → vira órfão "Pendente" com R1 vazio

**O que está faltando:**
- **(A)** Não busca R2s de **semanas futuras** vinculados ao mesmo telefone/email
- **(B)** Não busca **R1s** independentes (só pega R1 quando há R2 na semana, via JOIN dentro da RPC)
- **(C)** Pré-agendados são ocultados corretamente, mas isso causa "fantasmas" em Pendente

### Solução proposta

#### Mudança 1 — Buscar R2 futuros para órfãos
Após gerar `orphanRows`, fazer query adicional em `meeting_slot_attendees` (R2) para cada telefone órfão, **sem limite de semana**, pegando R2 mais próximo no futuro.
→ Resolve **Grupo A** (6 casos).

#### Mudança 2 — Buscar R1 + SDR para órfãos sem R2
Para órfãos que continuam sem R2 mesmo após Mudança 1, buscar a R1 mais recente do `deal_id` (ou por telefone se deal não bate). Mostrar R1, closer R1, SDR mesmo sem R2.
→ Resolve **Grupo B** (7 casos): coluna R1 deixa de ficar vazia, deixa claro que o lead está aguardando agendamento R2.

#### Mudança 3 — Garantir que "Aprovado" vence "Próxima Semana" no status_score
Ajustar o `status_score` na RPC para considerar também o `r2_status_id` (não só `attendee_status`). Hoje "Próxima Semana" e "Aprovado" têm o mesmo `attendee_status` (geralmente `scheduled`/`completed`), então o tiebreaker é `scheduled_at DESC` — pode pegar o errado.
→ Resolve **Grupo C** (5 casos).

#### Mudança 4 — Adicionar coluna "Status Real" / "Motivo"
Mostrar no relatório uma coluna que classifica cada Pendente em: 
- `R2 agendado próx. semana` (badge azul, mostra data)
- `Aguardando R2` (R1 ok, sem R2 ainda)
- `R2 Aprovado em outro deal` (badge verde — caso C antes da fix)
- `Reembolso recente` (caso E)

→ Cada um dos 22 fica com motivo claro, você decide o que filtrar.

#### Mudança 5 — Para Rafael Albaneze (Grupo D)
A RPC já dedupa por telefone. Após Mudança 3, o "Aprovado" mais recente vence. Resolvido naturalmente.

### Arquivos alterados

- `supabase/migrations/<nova>.sql` — ajustar `status_score` da RPC `get_carrinho_r2_attendees` para considerar `r2_status_id` (Aprovado > demais).
- `src/hooks/useContractLifecycleReport.ts` — adicionar buscas de R2 futuro e R1 fallback para órfãos; classificar `motivo_pendente`.
- `src/types/contractLifecycle.ts` (ou onde está `ContractLifecycleRow`) — adicionar `motivo_pendente`, `r2_proxima_semana_data`.
- `src/components/crm/R2ContractLifecyclePanel.tsx` — coluna "Motivo" com badges + preencher R1/R2 dos órfãos enriquecidos.

### Resultado esperado

Dos 22 Pendentes atuais:
- **6** vão deixar de ser pendentes ou ganhar badge "R2 próx. semana"
- **7** continuam pendentes mas mostram R1+SDR e badge "Aguardando R2"
- **5** vão para Realizadas/Aprovado (correção da RPC)
- **1** (Rafael) ganha 1 linha só com Aprovado correto
- **1** (Eduardo) ganha badge "Reembolso recente"
- **1** (Vinicius pré-agendado) continua oculto por design

Lista final de Pendentes "verdadeiros" deve cair para ~7-8 com motivo claro em cada linha.


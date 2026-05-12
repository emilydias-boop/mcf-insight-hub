# Badges de Canal + Marcação Especial em todas as listas R2/Carrinho

## Objetivo
Hoje o badge de Marcação Especial e o emoji de canal só aparecem no **Calendário** e no **Drawer** da Agenda R2. O usuário quer ver, em qualquer lugar que mostre um lead R2, dois chips ao lado do nome:
1. **Canal** — `A010` / `ANAMNESE` / `Outro` (sempre visível)
2. **Marcação Especial** — quando bater regra (ex.: "Anamnese Letícia")

## Componente reutilizável
Criar `src/components/crm/R2LeadBadges.tsx` recebendo:
- `email`, `phone` (para detectar A010 via `hubla_transactions`)
- `tags` (para detectar ANAMNESE)
- `r1CloserName`, `isContractPaid`, `scheduledAt`
- `size` ('sm' | 'md')

Renderiza:
- Chip de canal com cor/ícone padrão
- Chip da regra casada (usa `matchR2SpecialMarking` já existente)

## Hook unificado
Criar `src/hooks/useR2LeadsChannelMap.ts` que recebe lista de `{email, phone}` e retorna `Map<key, 'A010'|'ANAMNESE'|'Outro'>` aplicando as mesmas regras já documentadas em `mem://business-logic/agenda-r1-channel-classification` (lookup batched em `hubla_transactions`, window 30d, tag exata `ANAMNESE`). Reusa lógica de `MeetingsList.classifySimple` para garantir consistência.

## Telas a atualizar

### Agenda R2
- `R2PendingLeadsPanel.tsx` — Pendentes (lead Pago aguardando R2)
- `R2PreScheduledTab.tsx` — Pré-Agendados
- `R2NoShowsPanel.tsx` — No-Shows
- `R2SemSucessoPanel.tsx` — Sem Sucesso
- `R2ListViewTable.tsx` — aba Lista
- `R2AgendadasList.tsx` — aba Por Sócio (se houver lead listado)
- Aba **Relatório**: localizar arquivo (provavelmente `R2ReportLeadHistoryDialog` + a tabela principal de relatório) e adicionar coluna "Canal" + chip de marcação na coluna Lead.

### Carrinho R2
- `R2AprovadosList.tsx`
- `R2AccumulatedList.tsx`
- `R2ForaDoCarrinhoList.tsx`
- `R2VendasList.tsx`
- `R2AgendadasList.tsx` (já listado acima)
- `R2MetricsPanel.tsx` — só se listar leads
- Tabela "Todas R2s" do Carrinho — localizar componente e atualizar

## Dados necessários nos hooks
Verificar se cada hook já expõe `email`, `phone`, `tags`, `r1_closer_name`, `contract_paid_at`, `scheduled_at`. Se faltar tag, ampliar a query/RPC; se faltar r1_closer ou contract_paid_at, propagar a partir da fonte (Carrinho RPC já tem `r1_closer_name`, `r1_contract_paid_at`).

## Critérios de aceitação
- Em todas as listas acima, ao lado do nome do lead aparece chip "A010", "ANAMNESE" ou "Outro".
- Quando o lead casa com uma regra ativa de Marcação Especial (mesmo Closer R1, mesmo canal, dentro da vigência, contrato pago se exigido), aparece também o chip da regra com sua cor/ícone/label.
- Calendário e Drawer continuam funcionando como já estão (apenas usar o mesmo componente para consistência visual).
- Sem mudar lógica de negócio: classificação de canal segue exatamente as regras já existentes (`mem://business-logic/agenda-r1-channel-classification`).

## Riscos
- Cada hook tem shape diferente — vai exigir pequenos ajustes em ~10 arquivos.
- Lookup de A010 é por `hubla_transactions` em batch; com listas grandes pode pesar. Mitigação: 1 query única por tela com `.in('customer_email', emails)` + `.in()` de sufixos de telefone, cacheada por React Query com `staleTime` longo.

## Detalhes técnicos
- Reaproveitar `matchR2SpecialMarking` e `useActiveR2SpecialMarkings`.
- Para classificação de canal, extrair `classifyChannelWith30dRule` para `src/lib/channelClassifier.ts` (já existe arquivo) se ainda não estiver lá, e consumir nos dois lugares (MeetingsList + novo hook).
- Componente `R2LeadBadges` aceita `channel` já resolvido (pra quem quiser passar pronto) OU `email`+`phone` (faz lookup via hook).


Objetivo: fazer a seção **Intermediações de Contrato** (abaixo dos indicadores) mostrar os **nomes dos contratos que compõem o número do indicador** (ex.: 26), em vez de ficar vazia.

Resumo do diagnóstico (confirmado no banco):
- Para o payout `30c430c0-f538-45a8-a5c1-f4082b5ffba3`:
  - `sdr_month_kpi.intermediacoes_contrato = 26`
  - `sdr_intermediacoes` no mês = `0`
  - contratos pela Agenda (mesma lógica do KPI, por `contract_paid_at`) = `26`
- Causa: o indicador usa fonte Agenda/KPI, mas a lista `IntermediacoesList` lê apenas `sdr_intermediacoes` (tabela manual/legada).

Implementação proposta
1) Alinhar a fonte da lista com a fonte do indicador (SDR)
- Arquivo: `src/components/sdr-fechamento/IntermediacoesList.tsx`
- Para SDR (`isCloser = false`), buscar contratos diretamente da Agenda com a mesma regra do KPI:
  - `meeting_slot_attendees` + `meeting_slots` + `crm_deals` + `crm_contacts` + `profiles`
  - filtros:
    - `meeting_slots.meeting_type = 'r1'`
    - `msa.status != 'cancelled'`
    - `is_partner = false`
    - `booked_by` do attendee = email do SDR
    - `contract_paid_at` dentro do mês (`anoMes`)
- Renderizar nomes por linha:
  - principal: `contact_name` (fallback `deal_name`)
  - secundário: email/telefone (quando existir), data de pagamento (`contract_paid_at`)
- Total da seção passa a refletir essa lista (deve bater com os 26 do indicador).

2) Preservar compatibilidade com fluxo manual legado
- Manter consulta atual de `sdr_intermediacoes` como **fallback** (quando Agenda retornar 0).
- Exibir mensagem de origem, por exemplo:
  - “Mostrando contratos da Agenda (mesma base do indicador)” quando houver dados de Agenda.
  - “Mostrando registros manuais” no fallback.
- Botão “Adicionar”:
  - manter apenas no modo manual/fallback, para evitar confusão quando a fonte oficial já é Agenda.

3) Não alterar cálculo financeiro
- Não mexer em:
  - indicador dinâmico,
  - meta de contratos,
  - `useCalculatedVariavel`,
  - edge function de recálculo.
- Ajuste é de **rastreabilidade/visualização** da lista.

Detalhes técnicos (objetivos)
- Criar interface local para item da lista automática, ex.:
  - `id`, `leadName`, `dealName`, `contractPaidAt`, `status`, `contactEmail`, `contactPhone`.
- No mesmo componente (ou hook dedicado), derivar `start/end` do `anoMes`.
- Buscar email do SDR por `sdrId` antes da query principal.
- Ordenação: `contract_paid_at desc` (mais recente primeiro).

Validação após implementação
1) Abrir exatamente este fechamento (fev/2026 da Leticia).
2) Confirmar:
- Indicador continua em 26.
- Lista abaixo deixa de mostrar “Nenhuma intermediação...” e passa a listar ~26 nomes.
- Total no rodapé da lista = 26.
3) Testar mês sem contratos:
- lista deve cair para fallback manual sem quebrar UI.
4) Verificar que Closer não regressou (título/fluxo de “Vendas Parceria” permanece funcional).

Arquivos a alterar
- `src/components/sdr-fechamento/IntermediacoesList.tsx`
- (opcional, se separar responsabilidade) `src/hooks/useSdrContractsFromAgenda.ts`

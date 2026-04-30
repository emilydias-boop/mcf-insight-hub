---
name: SDR Listing Dual Role Policy
description: Em get_sdrs_for_squad_in_period, SDRs com role adicional de closer/closer_sombra continuam aparecendo. Apenas roles administrativas excluem.
type: business-logic
---
A função `get_sdrs_for_squad_in_period(p_squad, p_start, p_end)` é usada por `useSdrsForSquadInPeriod` e alimenta o filtro `validSdrEmails` em `useTeamMeetingsData` (tela /crm/reunioes-equipe).

**Regra:** Excluir do conjunto de SDRs apenas usuários com role administrativa pura em `user_roles`:
- admin
- manager
- coordenador
- assistente_administrativo

**NÃO excluir** quando a role adicional é operacional:
- closer
- closer_sombra
- viewer

Motivo: SDRs que acumulam função de closer (dupla função operacional, ex: Marcio Dantas) continuam gerando contratos como SDR no histórico (msa.booked_by). Excluí-los faria seus contratos sumirem do total da tela.

**Pré-requisito adicional:** O usuário precisa ter `sdr.role_type = 'sdr'`. Quem tem `role_type = 'closer'` na tabela `sdr` é considerado closer puro e fica fora da listagem mesmo que apareça como booker em algum attendee residual (ex: Jessica Martins).

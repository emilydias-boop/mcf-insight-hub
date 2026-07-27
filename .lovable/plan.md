## Objetivo

Remover a regra de replicação **"Incorporador R2 Realizada -> Consorcio Novo Lead"** para que leads de R2 Realizada não sejam mais espelhados no pipeline Consórcio → Novo Lead (Form).

## Mudança

Deletar a regra `ecec3a02-4c0c-405b-ba8c-d63f69c8b705` da tabela `deal_replication_rules` via `supabase--insert` (`DELETE`).

As outras duas regras permanecem ativas:
- R1 Realizada → Consórcio Novo Lead (com tag `R1 Realizada`)
- Sem Interesse → Consórcio Novo Lead (com tag `Sem interesse`)

Regras já replicadas até agora não são revertidas (só interrompemos o fluxo daqui pra frente, conforme combinado).
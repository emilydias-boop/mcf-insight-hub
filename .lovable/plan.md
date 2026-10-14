# Karen vê todos os clientes no Pós Venda e no Crédito Imobiliário

## Objetivo
Hoje uma SDR só vê, na aba Negócios, os clientes que estão no nome dela. Para a Karen, e somente para ela, essa regra deixa de valer nas duas pipelines:
- Pós Venda
- PIPELINE CRÉDITO IMOBILIÁRIO

Nelas, ela passa a ver todos os clientes para poder trabalhar.

## O que muda
1. **Liberação individual:** o cadastro de SDR ganha um campo novo, "pipelines com visão completa", que começa vazio para todo mundo. Vou preencher esse campo só para a Karen, com essas duas pipelines.
2. **Aba Negócios:** quando uma SDR abre uma pipeline que está na lista dela, a tela mostra todos os clientes (quadro, contagens e busca), sem o corte por responsável. Nas outras pipelines e para os outros SDRs, tudo continua como hoje.
3. **O que não muda:**
   - os cargos dela;
   - o que ela pode fazer em cada etapa;
   - as outras BUs;
   - as regras de Closer.

## Detalhes técnicos
- Migração: `ALTER TABLE public.sdr ADD COLUMN full_view_origin_ids uuid[] NOT NULL DEFAULT '{}'`. Os dados da Karen entram via `run_sql`: [POS_VENDA_ORIGIN_ID, 'c4ed1700-0000-4000-8000-000000000002'] em `sdr.id = 86880ed1-…139`.
- `useSDROriginOverride` passa a retornar também `full_view_origin_ids`.
- Em `src/pages/crm/Negocios.tsx`: `const visaoCompleta = isSdr && fullView.includes(dealsScopeId)`. Quando for verdadeiro, `ownerProfileId` e `restrictOwnerProfileId` não são enviados. O filtro local por e-mail do dono (`isRestrictedRole` no `useMemo` dos deals) é ignorado do mesmo jeito.
- O banco já permite que usuários logados leiam `crm_deals` (`USING true`), então não preciso mexer em permissões. A mudança é só na tela.
- Antes de concluir, conferir que as funções do quadro (`kanban_*`) não reaplicam o corte por responsável sozinhas, sem o parâmetro.

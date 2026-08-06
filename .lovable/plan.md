# Diagnóstico: filtro "Closer da Reunião (R1/R2)" mostra 1 negócio para Leticia

## Conclusão (causa raiz encontrada)

O filtro está correto. **A tela não está mostrando a PIPELINE INSIDE SALES** — está mostrando a pipeline **"PILOTO ANAMNESE / INDICAÇÃO"** (`7431cf4a-...`), e nela a Leticia tem **exatamente 1 negócio** como closer de reunião.

Distribuição real dos deals da Leticia (`r1_closer_email` ou `r2_closer_email`, ativos):

| Origem | Deals |
|---|---|
| PIPELINE INSIDE SALES (`e3c04f21`) | 550 |
| Efeito Alavanca + Clube | 6 |
| PILOTO ANAMNESE / INDICAÇÃO (`7431cf4a`) | **1** |

O "1" que a Jessica vê casa exatamente com a origem PILOTO ANAMNESE. Não é coincidência com o filtro de Responsável.

## Por que a tela cai nessa pipeline

Em `Negocios.tsx`, o default do seletor "Funil" (linhas 216-271) e o cálculo de `effectiveOriginId` (157-212) têm dois problemas:

1. `useBUPipelineMap` só usa o fallback `BU_DEFAULT_ORIGIN_MAP` quando **não existe nenhuma linha** em `bu_origin_mapping` para a BU. Para `incorporador` existem 2 linhas (`e3c04f21` e `7431cf4a`), ambas com `is_default = false` → `defaultOrigin = null` (useBUPipelineMap.ts:56).
2. Quando `activeBU` é `null` (usuário sem `profiles.squad` preenchido, acessando `/crm/negocios` global), o default cai no passo 5: procura um **grupo** chamado "PIPELINE INSIDE SALES"/"Inside Sales" na lista de `crm_groups`. Nenhum grupo tem esse nome (os grupos são "Perpétuo - X1", "BU - MCF CAPITAL", ...), então usa `pipelines[0]` — um **grupo**.
3. Com um grupo selecionado, `effectiveOriginId` vira `pipelineOrigins[0].id`, isto é, **apenas a primeira origem do grupo em ordem alfabética**. No grupo "Perpétuo - X1" a primeira é justamente **"PILOTO ANAMNESE /  INDICAÇÃO"** (P-I-L antes de P-I-P). A expansão de grupo → todas as origens filhas que existe em `useCRMDeals` (useCRMData.ts:398-418) nunca é acionada, porque o que chega no hook já é um `origin_id` único.

O perfil "Jessica Bellini R2" (`3f1435b1-...`) não tem nenhuma linha em `user_roles` e o `squad` não define BU incorporador — ou seja, ela cai exatamente nesse caminho de `activeBU = null`.

## Itens perguntados

1. **Outros filtros default**: não. `dateRange: undefined`, `dealStatus: 'all'`, `salesChannel: 'all'`, `temperature: 'all'`, `outsideFilter: 'all'`, tags/produtos vazios. Nenhum filtro implícito de período ou de "meus negócios" (o `ownerProfileId` no backend só se aplica a `sdr`/`closer` sem apoio R1 — não é o caso dela).
2. **Pipeline default**: **não** é PIPELINE INSIDE SALES nesse cenário. É um grupo cuja primeira origem é PILOTO ANAMNESE.
3. **Reprodução em navegador**: não foi possível autenticar — o projeto usa Supabase externo (`external_unmanaged`), sem sessão injetável. A reprodução foi feita por leitura de código + consulta ao banco, e o número 1 bate exatamente com a hipótese.
4. **Build em produção**: **está atualizada**. O chunk publicado `https://mcfgestao.com/assets/Negocios-DwdYG4oN.js` contém o rótulo "Closer da Reunião (R1/R2)" (versão com ícone/tooltip). Não é ambiente velho.

## Sem relação com o teto de 10.000

Dos 21.551 deals ativos de Inside Sales, os 550 da Leticia estão todos dentro das 10.000 mais recentes (checado). O teto não participa desse sintoma.

## O que eu proponho corrigir (depois da sua confirmação)

1. **Grupo selecionado deve carregar todas as origens do grupo**, não só a primeira: quando `selectedPipelineId` for um grupo, passar o próprio `group_id` para `useCRMDeals` (que já sabe expandir) em vez de colapsar em `pipelineOrigins[0]`.
2. **Default confiável para a BU Incorporador**: usar `BU_DEFAULT_ORIGIN_MAP` como fallback também quando existem linhas em `bu_origin_mapping` sem `is_default` — ou simplesmente marcar `is_default = true` para `e3c04f21` em `bu_origin_mapping` (correção de 1 linha, sem código).
3. **Deixar a pipeline ativa visível**: mostrar o nome da origem realmente em uso ao lado do seletor "Funil" (hoje o seletor pode exibir um grupo enquanto os dados vêm de uma única origem filha) — isso evita esse mesmo mal-entendido no futuro.

## Detalhes técnicos

- `src/pages/crm/Negocios.tsx:157-212` (`effectiveOriginId`), `216-271` (default do funil), `441-668` (filtros no cliente, `closerEmail` em 485-490).
- `src/hooks/useBUPipelineMap.ts:56,73` (defaultOrigin do banco vs fallback).
- `src/hooks/useCRMData.ts:398-418` (expansão grupo → origens filhas, não usada nesse fluxo).
- `src/components/auth/NegociosAccessGuard.tsx:54-62` (`BU_DEFAULT_ORIGIN_MAP`).

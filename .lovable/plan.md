# Diagnóstico: filtro "Closer (R1/R2)" ainda mostra 1 negócio para Leticia

## 1. Como o Kanban carrega os deals

`Negocios.tsx:293` chama `useCRMDeals({ originId, searchTerm, limit: 10000, ownerProfileId })`.

`useCRMData.ts:420-432` monta **uma única query** para toda a pipeline:

```
from crm_deals
where is_duplicate = false and archived_at is null and is_archived = false
  and origin_id in (...)
order by stage_moved_at desc nulls last
limit 10000
```

Não há paginação por estágio no servidor. Todo o resto (owner, closer, tags, produto, datas) é filtrado **no cliente**, em `filteredDeals` (`Negocios.tsx:438+`), e o Kanban ainda renderiza só as primeiras 50 por coluna (`DealKanbanBoard.tsx:54`, com botão de carregar mais) — mas o **badge de contagem** usa o total do estágio, não as 50.

Ou seja: existe um teto global de 10.000 deals por pipeline, aplicado **antes** dos filtros.

## 2. O teto explica o caso da Leticia? Não

Consultei o banco:

- PIPELINE INSIDE SALES tem **21.548 deals visíveis** — bem acima do `limit: 10000`. O teto é real: ~11,5 mil deals dessa pipeline nunca chegam ao navegador.
- Mas os deals da Leticia são recentes: dos **547** deals com `r1_closer_email = leticia.faustino@...` nessa pipeline, **547 estão dentro das 10.000 primeiras** por `stage_moved_at desc`. **0 ficam de fora.**

Distribuição por estágio (todos pertencentes à própria pipeline Inside Sales): Reunião 01 Realizada 380, Venda realizada 60, Reunião 02 Realizada 50, Contrato Pago 20, No-Show R2 10, Reunião 01 Agendada 10, No-Show 8, NOVO LEAD (FORM) 6, Sem Interesse 6, Em contato 3, R1 Realizada 1.

## 3. O filtro compara o email certo? Sim

- Em `crm_deals` existe **um único valor** para ela: `leticia.faustino@minhacasafinanciada.com` (40 chars, sem espaços, todo minúsculo) em `r1_closer_email`, 554 linhas. Nenhuma linha em `r2_closer_email`.
- Em `closers`, a opção ativa da BU incorporador é `73bf8108-...` / `Leticia Faustino C` / mesmo email — é esse email que vai como `value` do `<SelectItem>` (`useCloserFilterOptions.ts:37`).
- A comparação em `Negocios.tsx:483-489` faz `toLowerCase()` nos dois lados e casa `r1 OR r2`. Bate exatamente.

Conclusão: a lógica do filtro novo está correta e os dados estão presentes no conjunto carregado.

## 4. Causa mais provável do "ainda 1 negócio"

O resultado **1 negócio** é exatamente o número de deals em que ela é **owner** (`owner_profile_id = e89664d6-...`), que foi o sintoma original. Isso aponta para um destes dois, ambos do lado do uso/entrega e não da lógica:

1. **Dropdown errado**: os dois seletores ficam lado a lado e são parecidos. "Leticia Faustino C (CLOSER)" (com sufixo de role) é o filtro **Responsável**; o novo é "Leticia Faustino C" sem sufixo, sob o placeholder "Closer (R1/R2)". Se o filtro de Responsável continuou selecionado — sozinho ou junto com o novo (eles se combinam por AND) — o resultado cai para 1.
2. **Bundle antigo**: teste feito antes do reload da aplicação com o código novo.

## 5. O que proponho fazer (após sua confirmação)

Não alterei nada. Ordem sugerida:

1. **Confirmar em tela** (Playwright na preview) com o filtro novo aplicado e o de Responsável em "Todos", contando os deals por estágio — para provar se o problema é de uso ou de código.
2. **Tornar os dois filtros inconfundíveis**: rótulo/ícone explícito ("Responsável (dono)" vs "Closer da reunião (R1/R2)") e um chip visível dos filtros ativos, para o caso 1 não se repetir.
3. **Tratar o teto de 10.000** (bug latente, independente da Leticia): com 21,5 mil deals na Inside Sales, qualquer filtro por closer/owner de período mais antigo devolve números incompletos. Caminho: quando `closerEmail` estiver selecionado, empurrar o filtro para o servidor (`or(r1_closer_email.ilike...,r2_closer_email.ilike...)`) em vez de filtrar no cliente — assim o resultado não depende do recorte das 10.000 mais recentes.

## Detalhes técnicos

- Fetch: `src/hooks/useCRMData.ts:385-476` (`useCRMDeals`), sem paginação por estágio, `limit` default 5000 / 10000 no Kanban.
- Filtro cliente: `src/pages/crm/Negocios.tsx:438-600`.
- Render por coluna: `src/components/crm/DealKanbanBoard.tsx:54,272-275`.
- Opções do closer: `src/hooks/useCloserFilterOptions.ts` (dedupe por email, `is_active = true`, filtrado por BU).

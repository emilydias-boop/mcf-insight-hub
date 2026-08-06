# Diagnóstico: por que o `is_default` no banco não mudou nada

## 1. `useBUPipelineMap.ts:56` lê o `is_default`? Sim — mas seu update não muda nada na prática

A leitura está correta: `data.find(d => d.entity_type === 'origin' && d.is_default)?.entity_id` (linha 56). Confirmei no banco que a linha está gravada:

| entity_id | is_default |
|---|---|
| `7431cf4a` (PILOTO ANAMNESE / INDICAÇÃO) | false |
| `e3c04f21` (PIPELINE INSIDE SALES) | **true** (atualizada 06/08 17:59) |

Então agora `defaultOrigin = e3c04f21`, e `Negocios.tsx:227` usa isso como Prioridade 1.

**Só que o default já era esse antes.** Sem `is_default`, o fluxo caía no passo 4 (`Negocios.tsx:255`), que usa `BU_DEFAULT_ORIGIN_MAP['incorporador']` — e esse valor hardcoded **já é** `e3c04f21` (NegociosAccessGuard.tsx:56). Ou seja: a correção estava certa em intenção, mas era um no-op. **O default nunca foi a causa.** Minha hipótese anterior estava errada nesse ponto.

## 2. `localStorage`/cache guardando o funil? Não

- `selectedPipelineId` é `useState<string | null>(null)` (Negocios.tsx:70), sem persistência.
- Varredura em `src/`: o único `localStorage` relacionado a CRM é `crm-origin-favorites` (OriginsSidebar) — não influencia o funil selecionado.
- Não existe `persistQueryClient` — o cache do React Query morre no reload.

Logo, não há estado antigo sendo restaurado entre sessões.

## 3. O que realmente está segurando o valor errado

O **seletor "Funil" é o ponto de falha**, por dois defeitos que se somam:

**(a) O default nunca aparece selecionado no dropdown.** O default é um `origin_id` (`e3c04f21`), mas o `PipelineSelector` lista apenas `crm_groups`. Como o valor não casa com nenhum `<SelectItem>`, o campo aparece **vazio/placeholder** ("Selecione um funil"). O usuário naturalmente abre o dropdown e escolhe um funil — e é aí que quebra.

**(b) Escolher um grupo colapsa a query em UMA única origem.** `effectiveOriginId` (Negocios.tsx:190-201) pega `pipelineOrigins[0].id` — a **primeira origem em ordem alfabética** do grupo. No grupo "Perpétuo - X1" (`a6f3cbfc`), a ordem por nome é:

```text
1. PILOTO ANAMNESE /  INDICAÇÃO   <-- vira a origem efetiva
2. PIPELINE - EVENTO PRESENCIAL
3. PIPELINE - INSIDE SALES - VIVER DE ALUGUEL
...
   PIPELINE INSIDE SALES          <-- a que interessa, nunca é usada
```

E a Leticia tem **exatamente 1** negócio como closer em PILOTO ANAMNESE — o mesmo "1" que a Jessica vê. `useCRMDeals` até sabe expandir um `group_id` em todas as origens filhas (useCRMData.ts:398-406), mas nunca é acionado, porque o que chega já é um `origin_id` único.

### O que descartei com verificação direta

- **Dados**: 550 deals ativos da Leticia (`r1_closer_email`/`r2_closer_email`) em PIPELINE INSIDE SALES, todos com `stage_id` da própria origem, e todos dentro do `limit: 10000` (posições 9 a 7.916). Nada é cortado.
- **E-mail do filtro**: só existe uma opção ativa em `closers` para ela (`leticia.faustino@minhacasafinanciada.com`); a outra linha ("Leticia", `leticia@...`) está inativa e não entra no dropdown. Todos os 550 deals usam o e-mail da opção ativa.
- **Build em produção**: `assets/index-Don79DC5.js` → `Negocios-DwdYG4oN.js` contém o rótulo "Closer da Reunião (R1/R2)", os chips ("Limpar todos") e a comparação `r1_closer_email`/`r2_closer_email` com OR minificada. Ambiente está atualizado.
- **Filtro de owner interferindo**: a Jéssica é `admin` + `closer`, e `admin` tem prioridade 1 (AuthContext.tsx:12), então `isRestrictedRole` é falso e nenhum `ownerProfileId` é aplicado no backend. (Se fosse aplicado, o resultado seria 0, não 1 — ela não é dona de nenhum deal da Leticia.)

## Correções propostas (aguardando seu ok)

1. **Grupo selecionado deve consultar todas as origens do grupo**: quando `selectedPipelineId` for um `group_id`, passar o próprio grupo para `useCRMDeals` (que já expande) em vez de colapsar em `pipelineOrigins[0]`.
2. **Seletor "Funil" deve refletir a origem ativa**: incluir origens (não só grupos) nas opções, ou exibir ao lado o nome da origem realmente em uso, para o campo nunca aparecer vazio com um default aplicado por trás.
3. Opcional: reverter/manter o `is_default` no banco — é inofensivo e redundante com `BU_DEFAULT_ORIGIN_MAP`.

## Detalhes técnicos

- `src/hooks/useBUPipelineMap.ts:43-59` (fallback só quando não há linhas; `is_default` lido em 56).
- `src/pages/crm/Negocios.tsx:157-212` (`effectiveOriginId`), `216-271` (default), `485-490` (filtro closer).
- `src/components/crm/PipelineSelector.tsx:91-109` (lista apenas grupos).
- `src/hooks/useCRMOriginsByPipeline.ts:64-91` (`order('name')` → PILOTO primeiro).
- `src/hooks/useCRMData.ts:398-418` (expansão grupo → origens, não acionada).

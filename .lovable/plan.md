## Objetivo
Criar um **BI Comercial** para a BU Incorporador espelhando o BI Consórcio (mesma UI e Modo TV), com paleta diferenciada e usando os mesmos valores/regras do card **MCF Incorporador** do Painel Comercial (semana Sáb→Sex, mês corrente, ano corrente).

## Escopo funcional

1. Nova rota interna: `/crm/consorcio/bi-comercial` → página `BIComercial`
2. Nova rota pública (TV): `/bi/incorporador?k=<token>` → página `BIComercialPublic`
3. `mcfgestao.com/tv` continua abrindo o Consórcio; para rotacionar TVs, o usuário abre `/bi/incorporador?k=...` em outra tela/aba.

## Fonte de dados (mesma do Painel Comercial → Setor "MCF Incorporador")

- Vendas: `get_hubla_transactions_by_bu('incorporador', ...)` filtradas por `sale_date`, aplicando a mesma **deduplicação por cliente+produto** já usada em `useSetoresDashboard` (`get_first_transaction_ids` + `getDeduplicatedGross`).
- Metas: `team_targets` com `target_type` = `setor_incorporador_semana` / `_mes` / `_ano`.
- Semana Sáb→Sex (weekStartsOn = 6), Mês corrente (`startOfMonth`/`endOfMonth`), Ano corrente.
- Meta editável do BI **não** é criada — os valores de meta vêm de `team_targets` (mesmos do Painel Comercial). Edição continua sendo feita no cadastro de metas existente.

## Componentes visuais

- Reutilizar `BITVMode` extraindo cor em prop (`accent: "lime" | "orange"`).
    - Consórcio: `#bfff00` (verde neon) — mantém.
    - Incorporador: `#ff7a00` (laranja neon) + secundária magenta.
- Cabeçalho na TV do Incorporador: "MCF · BI Comercial ao vivo · Incorporador".
- Gauge central mostra % da **meta do mês**; KPIs à direita: Hoje, Dias corridos no mês, Semana atual; Ranking Semanal com 4-5 semanas Sáb→Sex do mês.

## Backend

Nova RPC pública `public.get_bi_public_incorporador(_token text)` (SECURITY DEFINER):
- Valida token em `bi_public_tokens` com `bu = 'incorporador'`.
- Retorna JSON com: `month_ref`, `meta_semana`, `meta_mes`, `meta_ano`, `apurado_semana`, `apurado_mes`, `apurado_ano`, `apurado_hoje`, e `daily` (array `{d, v}` do mês corrente já deduplicado).
- Deduplicação é feita reaproveitando `get_first_transaction_ids()` numa CTE e aplicando `installment_number > 1 → 0`, `gross_override` prioritário, `reference_price` senão `product_price`.

Semear token para `incorporador` em `bi_public_tokens`.

## Página interna `BIComercial`

- Cards: Meta do mês, Meta por dia corrido, Realizado no mês, Falta atingir.
- Semanas Sáb→Sex do mês com progresso e meta rateada (meta_mes/número de dias do mês × dias da semana).
- Botão "Modo TV" abre `BITVMode` com `accent="orange"`.
- Botão "Prévia Campanha" (reutiliza `CampaignCarousel`).
- Sem editor de meta e sem dias-úteis-override (para não conflitar com `team_targets`).

## Sidebar

Adicionar item "BI Comercial" no grupo BU Incorporador (visível só a admins/gestores, igual ao BI Consórcio).

## Detalhes técnicos

- `src/components/consorcio/BITVMode.tsx` → aceitar `accent?: "lime"|"orange"` e `title?: string`.
- `src/pages/crm/BIComercial.tsx` — nova página interna.
- `src/pages/public/BIComercialPublic.tsx` — nova página pública consumindo a nova RPC.
- `src/App.tsx` — adicionar as duas rotas.
- Migration: criar RPC + insert de token `bi_public_tokens`.
- Sem alteração no BI Consórcio.

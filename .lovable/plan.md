

# Filtros Completos no Dashboard de Campanhas

## Objetivo

Adicionar filtros por **Campanha**, **Bloco do Anuncio** e **Anuncio** alem dos filtros ja existentes (Periodo e Fonte/Canal). Isso permite cruzar dimensoes -- por exemplo, ver apenas os anuncios de uma campanha especifica.

## Como vai funcionar

A area de filtros tera 4 selects (alem do periodo):

| Filtro | Campo | Comportamento |
|---|---|---|
| Canal (Fonte) | `utm_source` | Ja existe. Filtra no backend (Supabase query) |
| Campanha | `utm_campaign` | Novo. Filtra no frontend sobre os dados carregados |
| Bloco do Anuncio | `utm_medium` | Novo. Filtra no frontend |
| Anuncio | `utm_content` | Novo. Filtra no frontend |

Os novos filtros sao aplicados no frontend (pos-query) porque os dados ja vem agrupados por todas as dimensoes. As opcoes de cada Select sao populadas dinamicamente a partir dos dados carregados, respeitando os filtros anteriores (cascata).

Tambem sera adicionado um botao "Limpar Filtros" para resetar tudo de uma vez.

## Layout dos Filtros

```text
+--------------------------------------------------------------+
| Periodo  [01/10/25 - 01/01/26]                               |
|                                                               |
| Canal       Campanha        Bloco do Anuncio    Anuncio       |
| [Todas v]   [Todas v]       [Todos v]           [Todos v]    |
|                                                               |
|                                      [Limpar Filtros]         |
+--------------------------------------------------------------+
```

## Alteracoes Tecnicas

### Arquivo: `src/pages/bu-marketing/CampanhasDashboard.tsx`

1. Adicionar 3 novos estados: `campaignFilter`, `mediumFilter`, `contentFilter`
2. Criar um `useMemo` chamado `filteredCampaigns` que aplica os filtros de campanha, medium e content sobre os dados retornados por `useCampaignBreakdown`
3. Extrair as opcoes unicas de cada dimensao a partir dos dados (respeitando filtros cascata)
4. Adicionar 3 novos `Select` na area de filtros
5. Adicionar botao "Limpar Filtros"
6. Atualizar todos os calculos (KPIs, tabs, tabela detalhada) para usar `filteredCampaigns` em vez de `campaigns`

### Arquivo: `src/hooks/useMarketingMetrics.ts`

Sem alteracoes necessarias -- a filtragem adicional sera feita no frontend.

## Fluxo de Dados

Os filtros funcionam em cascata:
1. **Periodo + Canal** -> query no Supabase retorna dados
2. **Campanha** -> filtra os dados no frontend; atualiza opcoes de Bloco e Anuncio
3. **Bloco do Anuncio** -> filtra mais; atualiza opcoes de Anuncio
4. **Anuncio** -> filtra final

Quando um filtro pai muda, os filtros filhos sao resetados para "Todos".

## Arquivos Alterados

| Arquivo | Alteracao |
|---|---|
| `src/pages/bu-marketing/CampanhasDashboard.tsx` | Novos filtros (Campanha, Bloco, Anuncio), cascata, botao limpar |


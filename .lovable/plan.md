
# Aquisicao A010 - Melhoria do Dashboard de Campanhas

## Contexto Atual

Os dados de A010 na `hubla_transactions` possuem:
- **UTM** (source, medium, campaign, content) - preenchido em ~30% dos registros
- **source** (hubla, kiwify, make, hubla_make_sync) - plataforma de pagamento
- **product_name** - nome do produto
- **Sem campo de "Oferta" ou "Origem/Parceria"** no banco

O desafio: nao existe hoje como saber se uma venda veio do "VSL", da "Pagina B", do "Social Seller" ou do "YouTube Organico" automaticamente. Precisamos criar essa classificacao.

## O que sera feito

### 1. Nova tabela: `a010_link_mappings`

Tabela de configuracao para mapear UTMs e fontes em dimensoes de negocio:

| Coluna | Tipo | Descricao |
|---|---|---|
| id | uuid | PK |
| name | text | Nome do mapeamento (ex: "VSL Facebook") |
| offer | text | Oferta (Principal, VSL, Pagina B, Instagram Story, Social Seller) |
| origin | text | Origem/Parceria (Trafego Pago, Manychat, Social Seller, YouTube Organico, Google Ads, Instagram Ads) |
| channel | text | Canal (Facebook, Instagram, Google, Organico, ManyChat) |
| match_utm_source | text | Regra: utm_source contem este valor (nullable) |
| match_utm_campaign | text | Regra: utm_campaign contem este valor (nullable) |
| match_utm_medium | text | Regra: utm_medium contem este valor (nullable) |
| match_source | text | Regra: campo source = valor (nullable) |
| priority | int | Prioridade (menor = mais prioritario, para desempate) |
| is_active | boolean | Ativo/Inativo |
| created_at | timestamptz | |

As regras funcionam como filtros: uma transacao "casa" com um mapeamento quando TODOS os campos preenchidos (nao nulos) do mapeamento sao encontrados na transacao.

### 2. Nova pagina: Configuracao de Links A010

Rota: `/bu-marketing/a010-links-config`

Interface CRUD simples para gerenciar os mapeamentos:
- Tabela listando todos os mapeamentos
- Botao "Adicionar Mapeamento"
- Dialog com formulario para editar: Nome, Oferta, Origem, Canal, e regras de match (utm_source, utm_campaign, etc.)
- Botao de excluir
- Opcoes pre-definidas nos selects de Oferta e Origem (mas permitindo texto livre)

### 3. Nova aba: "Aquisicao A010" no Dashboard de Campanhas

Adicionar uma nova aba no `CampanhasDashboard.tsx` (ou uma nova pagina separada acessivel via sidebar) com:

**KPI Cards:**

| Card | Calculo |
|---|---|
| Total de Leads | Transacoes A010 no periodo |
| Total de Vendas | Transacoes A010 com status paid/completed |
| Receita Total | Soma net_value das vendas |
| Ticket Medio | Receita / Vendas |

**Tabela Principal - Visao Cruzada:**

| Canal | Oferta | Origem | Leads | Vendas | Receita | Ticket Medio | % Conversao |
|---|---|---|---|---|---|---|---|
| Facebook | VSL | Trafego Pago | 450 | 120 | R$5.640 | R$47 | 26.7% |
| Instagram | Story | Manychat | 200 | 45 | R$2.115 | R$47 | 22.5% |

**Rankings Rapidos (tabs):**
- Por Canal
- Por Oferta
- Por Origem

**Filtros:** Canal, Oferta, Origem (selects cascata)

### 4. Insight de Escala (bloco automatico)

Card com analise simples baseada em regras:
- Identifica o canal/oferta com maior taxa de conversao
- Identifica o canal com maior receita
- Gera frase automatica tipo: "Canal Facebook com oferta VSL tem a maior taxa de conversao (26.7%) e maior receita. Considere escalar investimento."

### 5. Link no Sidebar

Adicionar ao menu BU Marketing:
- "Aquisicao A010" (nova pagina/aba)
- "Config Links A010" (pagina de configuracao)

## Alteracoes Tecnicas

| Arquivo | Alteracao |
|---|---|
| **SQL Migration** | Criar tabela `a010_link_mappings` + RLS + seed com mapeamentos iniciais |
| `src/hooks/useA010Acquisition.ts` | **Novo** - Hook que busca transacoes A010 + mapeamentos, classifica cada transacao e agrega por dimensao |
| `src/hooks/useA010LinkMappings.ts` | **Novo** - CRUD hook para a010_link_mappings |
| `src/pages/bu-marketing/A010AcquisitionDashboard.tsx` | **Novo** - Dashboard com KPIs, tabela cruzada, rankings por dimensao, insight de escala |
| `src/pages/bu-marketing/A010LinkMappingsConfig.tsx` | **Novo** - Pagina de configuracao dos mapeamentos |
| `src/components/layout/AppSidebar.tsx` | Adicionar itens "Aquisicao A010" e "Config Links" no menu Marketing |
| `src/App.tsx` | Novas rotas |

## Mapeamentos Iniciais (Seed)

Com base nos dados atuais do banco:

| Oferta | Origem | Canal | Regra |
|---|---|---|---|
| Principal | Trafego Pago | Facebook | utm_source = FB |
| Principal | Trafego Pago | Facebook | utm_source = fb |
| Principal | Instagram Organico | Instagram | utm_source = ig |
| Principal | Manychat | ManyChat | utm_source = manychat |
| Principal | Organico | Organico | utm_source = organic |
| Principal | Hubla Direto | Hubla | utm_source = hubla |

Transacoes sem UTM e sem match em nenhum mapeamento aparecem como "Nao Classificado" em todas as dimensoes.

## Fluxo de Dados

```text
hubla_transactions (A010)
        |
        v
a010_link_mappings (regras de match)
        |
        v
Classificacao: Canal + Oferta + Origem
        |
        v
Agregacao por dimensao
        |
        v
KPIs + Tabela Cruzada + Rankings + Insights
```

## Notas Importantes

- O dashboard atual de Campanhas NAO sera alterado, apenas receberao novos itens no sidebar
- As regras de mapeamento sao avaliadas por prioridade (menor numero = mais prioritario)
- Transacoes nao classificadas ficam visiveis como "Nao Classificado" para facilitar a criacao de novos mapeamentos
- A configuracao de mapeamentos e editavel sem codigo, via interface administrativa

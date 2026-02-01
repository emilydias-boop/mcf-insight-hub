
# Sistema de Premiações por BU

## Resumo

Sistema completo para criação e acompanhamento de campanhas de premiação por Business Unit, onde gestores podem definir metas competitivas, métricas de ranking e prazos, enquanto colaboradores visualizam seu progresso em tempo real.

---

## Funcionalidades

### Para Gestores de BU
- Criar novas premiações com nome, descrição e prêmio
- Selecionar BU e cargos elegíveis (SDR, Closer, Coordenador, etc.)
- Definir prazo de início e fim da campanha
- Escolher métricas de ranking (agendamentos, realizadas, contratos, tentativas, OTE)
- Configurar número de ganhadores (Top 1, Top 3, ou quantidade específica)
- Definir se é competição individual ou por equipe

### Para Colaboradores
- Visualizar premiações ativas da sua BU e cargo
- Ver ranking em tempo real com posição atual
- Acompanhar progresso vs meta
- Ver quem está na frente e atrás no ranking
- Histórico de premiações encerradas

---

## Estrutura de Telas

### 1. Página Principal de Premiações (`/premiacoes`)
- Lista de campanhas ativas separadas por status (Em andamento, Próximas, Encerradas)
- Cards com: nome, prêmio, prazo, participantes, sua posição no ranking
- Filtros por BU e status
- Botão "Nova Premiação" (visível para gestores)

### 2. Detalhes da Premiação (`/premiacoes/:id`)
- Header com informações da campanha e countdown para término
- Ranking completo em formato de tabela/leaderboard
- Destaque para Top 3 com indicadores visuais
- Gráfico de evolução do ranking ao longo do tempo
- Regras e critérios da premiação

### 3. Formulário de Nova Premiação (`/premiacoes/nova`)
- Campos organizados em steps ou accordion:
  - **Básico**: Nome, descrição, prêmio (texto ou valor)
  - **Participantes**: BU, cargos elegíveis, tipo (individual/equipe)
  - **Período**: Data início, data fim
  - **Métricas**: Seleção da métrica de ranking com opções:
    - R1 Agendadas
    - R1 Realizadas
    - Contratos Pagos
    - Tentativas de Ligação
    - Taxa de Conversão (%)
    - OTE Atingido (%)
    - Customizado (soma ponderada)
  - **Ganhadores**: Quantidade e descrição de prêmios por posição

---

## Métricas Disponíveis para Ranking

| Métrica | Fonte | Descrição |
|---------|-------|-----------|
| `agendamentos` | Agenda R1 | Total de reuniões agendadas |
| `realizadas` | Agenda R1 | Reuniões efetivamente realizadas |
| `contratos` | Agenda R1 | Contratos pagos atribuídos |
| `tentativas` | Twilio/CRM | Tentativas de ligação |
| `no_show_inverso` | Agenda R1 | Menor taxa de no-show = melhor |
| `taxa_conversao` | Calculado | contratos/realizadas × 100 |
| `ote_pct` | Fechamento | % de OTE atingido no mês |

---

## Seção Técnica

### Novas Tabelas no Supabase

#### `premiacoes`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `nome` | text | Nome da premiação |
| `descricao` | text | Descrição/regras |
| `premio_descricao` | text | Descrição do prêmio |
| `premio_valor` | numeric | Valor do prêmio (opcional) |
| `bu` | text | Business Unit alvo |
| `cargos_elegiveis` | text[] | Array de cargos participantes |
| `tipo_competicao` | text | 'individual' ou 'equipe' |
| `metrica_ranking` | text | Métrica usada para ordenar |
| `metrica_config` | jsonb | Configurações extras (peso, inversão) |
| `data_inicio` | date | Início da campanha |
| `data_fim` | date | Fim da campanha |
| `qtd_ganhadores` | int | Número de premiados |
| `status` | text | 'rascunho', 'ativa', 'encerrada', 'cancelada' |
| `created_by` | uuid | FK profiles |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

#### `premiacao_ganhadores`
| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid | PK |
| `premiacao_id` | uuid | FK premiacoes |
| `posicao` | int | 1º, 2º, 3º... |
| `employee_id` | uuid | FK employees (individual) |
| `squad` | text | Squad vencedor (equipe) |
| `valor_final` | numeric | Valor da métrica |
| `premio_recebido` | text | Descrição do prêmio |
| `created_at` | timestamptz | |

### Novos Arquivos

```text
src/
├── pages/
│   └── premiacoes/
│       ├── Index.tsx           # Lista de premiações
│       ├── Detail.tsx          # Detalhes e ranking
│       └── NovaPremiacao.tsx   # Formulário de criação
├── components/
│   └── premiacoes/
│       ├── PremiacaoCard.tsx           # Card resumo
│       ├── RankingLeaderboard.tsx      # Tabela de ranking
│       ├── RankingPosition.tsx         # Posição do usuário
│       ├── PremiacaoFormFields.tsx     # Campos do formulário
│       └── MetricaSelector.tsx         # Seletor de métrica
├── hooks/
│   └── usePremiacoes.ts        # Queries e mutations
└── types/
    └── premiacoes.ts           # Interfaces TypeScript
```

### Lógica de Cálculo do Ranking

O ranking será calculado em tempo real no frontend usando dados já disponíveis:

```typescript
// Exemplo de cálculo para métrica "agendamentos"
const calcularRanking = (premiacao, participantes, metricas) => {
  return participantes
    .map(p => ({
      ...p,
      valor: metricas[p.id]?.[premiacao.metrica_ranking] || 0
    }))
    .sort((a, b) => {
      // Métricas inversas (menor = melhor)
      if (premiacao.metrica_config?.inverso) {
        return a.valor - b.valor;
      }
      return b.valor - a.valor;
    })
    .map((p, index) => ({ ...p, posicao: index + 1 }));
};
```

### RLS Policies

```sql
-- Visualização: todos autenticados veem premiações da sua BU
CREATE POLICY "premiacoes_select" ON premiacoes
FOR SELECT TO authenticated
USING (
  bu IN (SELECT squad FROM profiles WHERE id = auth.uid())
  OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager'))
);

-- Criação/Edição: gestores da BU ou admins
CREATE POLICY "premiacoes_insert" ON premiacoes
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'coordenador'))
);
```

### Rotas a Adicionar

```typescript
// Em App.tsx
<Route path="premiacoes" element={<PremiacoesIndex />} />
<Route path="premiacoes/:id" element={<PremiacaoDetail />} />
<Route path="premiacoes/nova" element={<NovaPremiacao />} />
```

### Integração com Métricas Existentes

O sistema reutilizará hooks existentes para buscar dados:
- `useSdrPayouts` - para métricas de fechamento
- `useAgendaMetrics` - para métricas de agenda
- `useEmployees` - para lista de colaboradores por BU/cargo

---

## Fluxo de Uso

```text
1. Gestor acessa /premiacoes
2. Clica em "Nova Premiação"
3. Preenche dados: nome, BU, cargos, métrica, período, ganhadores
4. Publica a premiação (status: ativa)
5. Colaboradores elegíveis visualizam na lista
6. Ranking atualiza em tempo real conforme métricas mudam
7. Ao encerrar, sistema registra ganhadores automaticamente
```

---

## Próximos Passos da Implementação

1. Criar migração SQL com tabelas `premiacoes` e `premiacao_ganhadores`
2. Criar types TypeScript em `src/types/premiacoes.ts`
3. Criar hook `usePremiacoes.ts` com queries e mutations
4. Implementar página de listagem (`Index.tsx`)
5. Implementar página de detalhes com ranking (`Detail.tsx`)
6. Implementar formulário de criação (`NovaPremiacao.tsx`)
7. Adicionar rotas no `App.tsx`
8. Adicionar link no menu lateral

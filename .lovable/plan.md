
# Plano: Modulo Carteira de Gerentes de Conta

## Resumo Executivo

Criar um modulo completo para Gerentes de Conta (GRs) receberem e gerenciarem parceiros que pagaram parceria (A001, A009). O sistema funciona como um gerente de banco: cada GR tem visao 360 graus do cliente, com historico completo e capacidade de recomendar produtos (Consorcio, HE, IP, CP).

## Arquitetura de Dados

### Novas Tabelas no Banco de Dados

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         ESTRUTURA DE DADOS                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  gr_wallets (Carteiras)           gr_wallet_entries (Entradas)          │
│  ┌───────────────────┐            ┌────────────────────────┐            │
│  │ id (uuid)         │───────────>│ id (uuid)              │            │
│  │ gr_user_id (uuid) │            │ wallet_id (fk)         │            │
│  │ bu (text)         │            │ deal_id (fk)           │            │
│  │ is_open (bool)    │            │ contact_id (fk)        │            │
│  │ max_capacity (int)│            │ status (enum)          │            │
│  │ current_count     │            │ entry_source (text)    │            │
│  │ created_at        │            │ entry_date             │            │
│  └───────────────────┘            │ assigned_by            │            │
│                                   │ financial_profile      │            │
│  gr_distribution_rules            │ recommended_products   │            │
│  ┌───────────────────┐            │ notes                  │            │
│  │ id                │            │ last_contact_at        │            │
│  │ bu                │            │ next_action_date       │            │
│  │ mode (auto/manual)│            │ created_at             │            │
│  │ balance_type      │            └────────────────────────┘            │
│  │ manager_id        │                                                  │
│  └───────────────────┘            gr_actions (Acoes do GR)              │
│                                   ┌────────────────────────┐            │
│  gr_transfers_log (Auditoria)     │ id                     │            │
│  ┌───────────────────┐            │ entry_id (fk)          │            │
│  │ id                │            │ action_type (enum)     │            │
│  │ entry_id          │            │ description            │            │
│  │ from_wallet_id    │            │ metadata (jsonb)       │            │
│  │ to_wallet_id      │            │ performed_by           │            │
│  │ reason            │            │ created_at             │            │
│  │ transferred_by    │            └────────────────────────┘            │
│  │ created_at        │                                                  │
│  └───────────────────┘                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Enums para Status

```sql
-- Status do cliente na carteira
CREATE TYPE gr_entry_status AS ENUM (
  'ativo',           -- Em atendimento ativo
  'em_negociacao',   -- Negociando produto
  'em_pausa',        -- Pausado temporariamente
  'convertido',      -- Fechou produto
  'inativo',         -- Sem resposta/interesse
  'transferido'      -- Movido para outra carteira/BU
);

-- Tipos de acao do GR
CREATE TYPE gr_action_type AS ENUM (
  'reuniao_agendada',
  'reuniao_realizada',
  'diagnostico',
  'produto_sugerido',
  'produto_contratado',
  'nota',
  'encaminhamento_bu',
  'status_change',
  'contato_telefonico',
  'contato_whatsapp'
);

-- Adicionar role 'gr' ao enum app_role
ALTER TYPE app_role ADD VALUE 'gr';
```

## Estrutura de Arquivos Frontend

```text
src/
├── pages/
│   └── gerentes-conta/
│       ├── Index.tsx              # Layout principal com Outlet
│       ├── MinhaCarteira.tsx      # Visao do GR individual
│       ├── GestaoCarteiras.tsx    # Visao do Gestor (todas carteiras)
│       ├── ConfiguracaoGR.tsx     # Config de distribuicao
│       └── RelatoriosGR.tsx       # Dashboard metricas
├── components/
│   └── gr/
│       ├── GREntryCard.tsx        # Card de lead na carteira
│       ├── GREntryDrawer.tsx      # Drawer com detalhes do cliente
│       ├── GRTimeline.tsx         # Historico unificado (SDR->R1->R2->GR)
│       ├── GRActionModal.tsx      # Modal para registrar acoes
│       ├── GRDistributionPanel.tsx # Painel de distribuicao (gestor)
│       ├── GRWalletStats.tsx      # Estatisticas da carteira
│       ├── GRProductSuggestion.tsx # Sugestao de produtos
│       ├── GRTransferModal.tsx    # Modal transferencia entre GRs
│       ├── GRDiagnosticForm.tsx   # Formulario de diagnostico
│       └── GRFinancialProfile.tsx # Perfil financeiro do cliente
└── hooks/
    ├── useGRWallet.ts             # Dados da carteira do GR
    ├── useGREntries.ts            # Entradas na carteira
    ├── useGRActions.ts            # Acoes registradas
    ├── useGRDistribution.ts       # Regras de distribuicao
    ├── useGRTransfer.ts           # Transferencias
    └── useGRMetrics.ts            # Metricas/KPIs
```

## Fluxo de Entrada de Leads

```text
Carrinho (Sexta-feira)
        │
        │ Lead paga parceria (A001, A009)
        ▼
hubla_transactions
  (product_category = 'parceria')
        │
        │ Trigger ou Job
        ▼
┌───────────────────────────────────────────┐
│ Funcao: assign_partner_to_gr()            │
│                                           │
│ 1. Verificar se lead pagou parceria       │
│ 2. Buscar regras de distribuicao          │
│ 3. Encontrar GR com carteira aberta       │
│ 4. Balancear por capacidade/carga         │
│ 5. Criar entrada em gr_wallet_entries     │
│ 6. Notificar GR                           │
│ 7. Registrar log de auditoria             │
└───────────────────────────────────────────┘
        │
        ▼
GR recebe lead em sua carteira
```

## Tela: Minha Carteira (Visao GR)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  🎯 Minha Carteira                                    [+ Nova Acao]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │ ATIVOS  │  │NEGOCIAC.│  │PAUSADOS │  │CONVERT. │  │INATIVOS │       │
│  │   12    │  │    5    │  │    2    │  │    8    │  │    3    │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                                         │
│  Filtros: [Todos ▼] [Mais recentes ▼] [Buscar...]                      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 👤 João Silva                          Status: ATIVO            │   │
│  │ Entrada: 15/01/2026 • Origem: Inside Sales                      │   │
│  │ Produto: A009 - MCF INCORPORADOR + THE CLUB                     │   │
│  │ Ultima interacao: 3 dias atras                                  │   │
│  │ Proxima acao: Reuniao dia 20/01                                 │   │
│  │                                                                 │   │
│  │ [📞 Ligar] [💬 WhatsApp] [📅 Agendar] [📝 Diagnostico] [→ Ver] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 👤 Maria Santos                        Status: EM NEGOCIACAO    │   │
│  │ Entrada: 10/01/2026 • Origem: Sócios R2                         │   │
│  │ Produto sugerido: Consorcio 250k                                │   │
│  │ ...                                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Tela: Drawer de Detalhes do Cliente

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Voltar                                        [⚙️] [Transferir]      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  👤 JOÃO SILVA                                                          │
│  📧 joao@email.com • 📱 (11) 99999-9999                                 │
│  Status: [ATIVO ▼]                                                      │
│                                                                         │
├────────────────────────── TABS ─────────────────────────────────────────┤
│  [Timeline] [Dados] [Financeiro] [Produtos] [Notas]                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  📍 TIMELINE COMPLETA                                                   │
│  ─────────────────────────────────────────────────                      │
│                                                                         │
│  ⚫ 18/01/2026 - Reuniao com GR                                         │
│     GR: Maria - Diagnosticou interesse em HE                            │
│                                                                         │
│  ⚫ 15/01/2026 - Pagou parceria A009                                     │
│     Valor: R$ 19.500 - Fonte: Hubla                                     │
│                                                                         │
│  ⚫ 14/01/2026 - Aprovado na R2                                          │
│     Closer: Carlos - Status: Aprovado                                   │
│                                                                         │
│  ⚫ 10/01/2026 - R1 Realizada                                            │
│     Closer: Ana - Notas: Lead engajado...                               │
│                                                                         │
│  ⚫ 08/01/2026 - Qualificado pelo SDR                                    │
│     SDR: Pedro - Score: 85 - Ja constroi                                │
│                                                                         │
│  ⚫ 05/01/2026 - Primeiro contato                                        │
│     Origem: Google Ads - Tag: Inside Sales                              │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  ACOES RAPIDAS                                                          │
│  [📞 Ligar] [💬 WhatsApp] [📅 Agendar Reuniao] [📝 Registrar Nota]     │
│  [🎯 Sugerir Produto] [→ Encaminhar BU]                                 │
└─────────────────────────────────────────────────────────────────────────┘
```

## Tela: Gestao de Carteiras (Visao Gestor)

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  📊 Gestao de Carteiras                     [⚙️ Configurar Distribuicao]│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  METRICAS GERAIS                                                        │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │TOTAL    │  │ATIVOS   │  │CONVERSAO│  │TEMPO MED│  │RECEITA  │       │
│  │LEADS    │  │         │  │         │  │         │  │GERADA   │       │
│  │   47    │  │   32    │  │  17.5%  │  │ 12 dias │  │ R$450k  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                                         │
│  CARTEIRAS DOS GRs                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ GR              │ Status  │ Leads │ Ativos │ Conv. │ Acoes     │   │
│  ├─────────────────┼─────────┼───────┼────────┼───────┼───────────┤   │
│  │ Maria Silva     │ ABERTA  │  15   │   12   │ 20%   │ [Gerenc.] │   │
│  │ Carlos Santos   │ ABERTA  │  18   │   14   │ 15%   │ [Gerenc.] │   │
│  │ Ana Costa       │ FECHADA │  14   │    6   │ 18%   │ [Gerenc.] │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  LEADS PENDENTES DE DISTRIBUICAO: 3                                     │
│  [Distribuir Manualmente] [Distribuir Automatico]                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Integracao com Historico Existente

O sistema unifica dados de multiplas fontes em uma timeline unica:

```text
Fontes de dados para Timeline:

1. crm_deals + deal_activities
   └── Primeiro contato, qualificacao, movimentacoes de stage

2. meeting_slots + meeting_slot_attendees
   └── R1 agendada/realizada, R2 agendada/realizada, status R2

3. hubla_transactions
   └── Pagamento de parceria, valor, produto

4. gr_actions (NOVO)
   └── Reunioes com GR, diagnosticos, sugestoes de produto

5. Outras BUs (quando encaminhado)
   └── Contratos de consorcio, HE, IP, CP
```

## Rotas e Menu

```typescript
// Adicionar ao menuItems em AppSidebar.tsx
{
  title: "Gerentes de Conta",
  icon: Briefcase,
  requiredRoles: ["admin", "manager", "coordenador", "gr"],
  items: [
    { title: "Minha Carteira", url: "/gerentes-conta/minha-carteira", requiredRoles: ["gr"] },
    { title: "Gestao Carteiras", url: "/gerentes-conta/gestao", requiredRoles: ["admin", "manager", "coordenador"] },
    { title: "Configuracao", url: "/gerentes-conta/configuracao", requiredRoles: ["admin", "manager"] },
    { title: "Relatorios", url: "/gerentes-conta/relatorios", requiredRoles: ["admin", "manager", "coordenador"] },
  ],
}

// Adicionar rotas em App.tsx
<Route path="gerentes-conta" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador', 'gr']}><GerenciamentoGRIndex /></RoleGuard>}>
  <Route index element={<Navigate to="minha-carteira" />} />
  <Route path="minha-carteira" element={<MinhaCarteira />} />
  <Route path="gestao" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><GestaoCarteiras /></RoleGuard>} />
  <Route path="configuracao" element={<RoleGuard allowedRoles={['admin', 'manager']}><ConfiguracaoGR /></RoleGuard>} />
  <Route path="relatorios" element={<RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}><RelatoriosGR /></RoleGuard>} />
</Route>
```

## Funcoes do Gestor

1. **Distribuicao de Leads**
   - Automatica (balanceada por capacidade)
   - Manual (escolher GR especifico)
   - Redirecionar entre GRs

2. **Controle de Carteiras**
   - Abrir/Fechar carteira de um GR
   - Definir capacidade maxima por GR
   - Visualizar carga de trabalho

3. **Auditoria**
   - Log de todas as transferencias
   - Historico de alteracoes
   - Quem fez, quando, por que

## Produtos que o GR Pode Sugerir

```typescript
const GR_PRODUCTS = [
  { code: 'consorcio', name: 'Consorcio', bu: 'consorcio' },
  { code: 'he', name: 'Home Equity', bu: 'credito' },
  { code: 'ip', name: 'Incorporacao Propria', bu: 'incorporador' },
  { code: 'cp', name: 'Construcao Propria', bu: 'incorporador' },
  { code: 'clube', name: 'The Club', bu: 'incorporador' },
  { code: 'leilao', name: 'Leilao', bu: 'leilao' },
  { code: 'outro', name: 'Outro', bu: null },
];
```

## Etapas de Implementacao

### Fase 1: Banco de Dados (Migracao SQL)
- Adicionar role 'gr' ao enum app_role
- Criar tabelas gr_wallets, gr_wallet_entries, gr_actions, gr_transfers_log
- Criar enum gr_entry_status e gr_action_type
- Configurar RLS policies
- Criar funcao de distribuicao automatica

### Fase 2: Hooks e Tipos
- Criar types para GR (GREntry, GRAction, GRWallet)
- Implementar hooks de dados (useGRWallet, useGREntries, etc)
- Criar queries otimizadas com joins

### Fase 3: Componentes Base
- GREntryCard (card do lead na lista)
- GRTimeline (timeline unificada)
- GRActionModal (registrar acoes)
- GRWalletStats (estatisticas)

### Fase 4: Paginas
- MinhaCarteira (visao do GR)
- GestaoCarteiras (visao do gestor)
- ConfiguracaoGR (distribuicao)

### Fase 5: Integracao com Carrinho
- Trigger para mover leads que pagaram parceria
- Sincronizacao com hubla_transactions
- Job semanal (sexta-feira)

### Fase 6: Rotas e Menu
- Adicionar rotas em App.tsx
- Adicionar menu em AppSidebar.tsx
- Guards de permissao

## Resumo de Beneficios

| Beneficio | Descricao |
|-----------|-----------|
| Centralizacao | Tudo sobre o cliente em um lugar |
| Auditoria | Log completo de todas as acoes |
| Escalabilidade | Facil adicionar novos GRs |
| Gestao | Gestor controla distribuicao |
| Historico | Timeline desde SDR ate GR |
| Conversao | GR atua como consultor financeiro |

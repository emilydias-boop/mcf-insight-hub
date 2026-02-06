

# Plano: Pagina de Detalhe do Gerente de Conta (Visao 360 do GR)

## Resumo

Criar uma nova pagina de detalhe acessivel ao clicar em "Gerenciar" na tabela de GRs. Esta pagina fornece uma visao completa do desempenho, carteira, agenda, historico e financeiro de cada Gerente de Conta.

## Estado Atual

O modulo de GR ja possui:
- Tabelas: `gr_wallets`, `gr_wallet_entries`, `gr_actions`, `gr_transfers_log`, `gr_distribution_rules`
- Paginas: `GestaoCarteiras.tsx`, `MinhaCarteira.tsx`
- Componentes: `GRWalletStats`, `GREntryCard`, `GREntryDrawer`, `GRActionModal`, `CreateGRWalletDialog`, `GRDistributionPanel`
- Hooks: `useGRWallet`, `useGRActions`, `useGRMetrics`, `useGRTransfer`

## Estrutura da Nova Pagina

```text
/gerentes-conta/gestao/:walletId

┌─────────────────────────────────────────────────────────────────────────┐
│  CABECALHO DO GR                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐│
│  │ Avatar  NOME DO GR                   Status: [ABERTA v]             ││
│  │         email@empresa.com            Capacidade: 15/700             ││
│  │         BU: CREDITO                  [Ajustar Capacidade]           ││
│  │         Leads Ativos: 12             [Redistribuir Leads]           ││
│  │         Receita: R$ 450k                                            ││
│  └─────────────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  TABS: [Performance] [Parceiros] [Agenda] [Historico] [Financeiro] [Aud]│
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  TAB: PERFORMANCE (INDICADORES)                                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐       │
│  │TOTAL    │  │ATIVOS   │  │CONVERSAO│  │TEMPO MED│  │RECEITA  │       │
│  │LEADS    │  │         │  │         │  │         │  │GERADA   │       │
│  │   47    │  │   32    │  │  17.5%  │  │ 12 dias │  │ R$450k  │       │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘       │
│                                                                         │
│  DISTRIBUICAO POR PRODUTO                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Consorcio: 8 (25%)  │  HE: 5 (15%)  │  IP: 12 (37%)  │ ...      │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  TAB: PARCEIROS (FUNIL)                                                 │
│  Filtros: [Status v] [Produto v] [Periodo v] [Buscar...]               │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ Nome       │ Status  │ Ultima Int.│ Prox Acao │ Produto │ Valor │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ Joao Silva │ ATIVO   │ 3 dias     │ 20/01     │ HE      │ 250k  │   │
│  │ Maria S.   │ NEGOC.  │ 1 dia      │ 18/01     │ IP      │ 180k  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  TAB: AGENDA                                                            │
│  [Reunioes Agendadas: 5] [Reunioes Realizadas: 12] [Pendentes: 2]      │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 20/01 14:00 - Joao Silva - Diagnostico Inicial                  │   │
│  │ 21/01 10:00 - Maria Santos - Apresentacao HE                    │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  TAB: HISTORICO CONSOLIDADO                                             │
│  Timeline de todos os parceiros trabalhados (ativos, convertidos,       │
│  perdidos) com indicacao de destino (BU) e data de decisao             │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  TAB: FINANCEIRO                                                        │
│  Tabela: Cliente | Produto | Valor | Status Pag. | Data                │
│  Totais por produto e periodo                                          │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  TAB: AUDITORIA                                                         │
│  Log de distribuicoes, redistribuicoes, mudancas de status             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Criar

| Arquivo | Descricao |
|---------|-----------|
| `src/pages/gerentes-conta/GRDetail.tsx` | Pagina principal de detalhe do GR |
| `src/components/gr/GRDetailHeader.tsx` | Cabecalho com dados do GR e acoes |
| `src/components/gr/GRPerformanceTab.tsx` | Tab de metricas e distribuicao por produto |
| `src/components/gr/GRPartnersTab.tsx` | Tab com tabela de parceiros/clientes |
| `src/components/gr/GRAgendaTab.tsx` | Tab de agenda com reunioes |
| `src/components/gr/GRHistoryTab.tsx` | Tab de historico consolidado |
| `src/components/gr/GRFinancialTab.tsx` | Tab financeira com pagamentos |
| `src/components/gr/GRAuditTab.tsx` | Tab de auditoria e logs |
| `src/components/gr/GRCapacityDialog.tsx` | Dialog para ajustar capacidade |
| `src/components/gr/GRRedistributeDialog.tsx` | Dialog para redistribuir leads |

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/App.tsx` | Adicionar rota `/gerentes-conta/gestao/:walletId` |
| `src/pages/gerentes-conta/GestaoCarteiras.tsx` | Adicionar `useNavigate` ao botao "Gerenciar" |
| `src/hooks/useGRMetrics.ts` | Adicionar hook para metricas por produto |
| `src/types/gr-types.ts` | Adicionar tipos para metricas detalhadas |

## Novos Hooks Necessarios

```typescript
// useGRDetailMetrics.ts - Metricas detalhadas com distribuicao por produto
export const useGRDetailMetrics = (walletId: string) => {
  // Retorna:
  // - Metricas gerais (total, ativos, conversao, tempo medio)
  // - Distribuicao por produto (consorcio, he, ip, cp, projetos, outros)
  // - Origem dos leads (SDR, Closer, R2, Indicacao)
}

// useGRAgenda.ts - Reunioes agendadas do GR
export const useGRAgenda = (grUserId: string) => {
  // Busca reunioes de meeting_slots + gr_actions do tipo reuniao_agendada
}

// useGRAuditLog.ts - Log de auditoria
export const useGRAuditLog = (walletId: string) => {
  // Busca gr_transfers_log + mudancas de status
}
```

## Fluxo de Navegacao

```text
Gestao de Carteiras
        │
        │ Clique em "Gerenciar"
        ▼
/gerentes-conta/gestao/:walletId
        │
        │ Visualiza detalhes completos
        ▼
Acoes disponiveis:
  - Abrir/Fechar carteira
  - Ajustar capacidade
  - Redistribuir leads
  - Ver parceiros
  - Ver agenda
  - Ver financeiro
  - Ver auditoria
```

## Regras de Negocio

1. **Distribuicao por Produto**: Agrupa `gr_wallet_entries` por `recommended_products` e produtos contratados
2. **Origem dos Leads**: Usa campo `entry_source` da tabela `gr_wallet_entries`
3. **Destino dos Leads**: Quando status = 'transferido', registra BU de destino no `gr_actions.metadata`
4. **Financeiro**: Cruza `gr_wallet_entries` com `hubla_transactions` por `transaction_id` ou `customer_email`
5. **Auditoria**: Usa tabela `gr_transfers_log` para transferencias e `gr_actions` para mudancas de status

## Tipos de Produtos para Distribuicao

```typescript
const PRODUCT_DISTRIBUTION = [
  { code: 'consorcio', label: 'Consorcio', color: 'blue' },
  { code: 'he', label: 'Home Equity', color: 'green' },
  { code: 'ip', label: 'Incorporacao Propria', color: 'purple' },
  { code: 'cp', label: 'Construcao Propria', color: 'amber' },
  { code: 'projetos', label: 'Projetos', color: 'cyan' },
  { code: 'outros', label: 'Outros Creditos', color: 'gray' },
];
```

## Rota Nova

```typescript
// Em App.tsx, dentro das rotas de gerentes-conta:
<Route path="gestao/:walletId" element={
  <RoleGuard allowedRoles={['admin', 'manager', 'coordenador']}>
    <GRDetail />
  </RoleGuard>
} />
```

## Etapas de Implementacao

### Fase 1: Estrutura Base
1. Criar pagina `GRDetail.tsx` com layout de tabs
2. Adicionar rota no `App.tsx`
3. Modificar botao "Gerenciar" para navegar para a nova rota

### Fase 2: Cabecalho e Performance
4. Criar `GRDetailHeader.tsx` com dados do GR e acoes
5. Criar `GRPerformanceTab.tsx` com metricas e distribuicao
6. Criar hook `useGRDetailMetrics` para dados agregados

### Fase 3: Parceiros e Agenda
7. Criar `GRPartnersTab.tsx` com tabela filtrada
8. Criar `GRAgendaTab.tsx` com reunioes
9. Criar hook `useGRAgenda`

### Fase 4: Historico e Financeiro
10. Criar `GRHistoryTab.tsx` com timeline consolidada
11. Criar `GRFinancialTab.tsx` com tabela de pagamentos

### Fase 5: Auditoria e Dialogs
12. Criar `GRAuditTab.tsx` com logs
13. Criar `GRCapacityDialog.tsx` e `GRRedistributeDialog.tsx`

## Resultado Esperado

O gestor tera uma visao completa de cada GR, podendo:
- Ver performance detalhada com distribuicao por produto
- Acompanhar todos os parceiros e seus status
- Visualizar agenda de reunioes
- Analisar historico completo de leads trabalhados
- Controlar receita e pagamentos
- Auditar todas as acoes e transferencias
- Ajustar capacidade e redistribuir leads quando necessario




# Plano: Adicionar SDRs na Página de Fechamento do Consórcio

## Situação Atual

A página `/consorcio/fechamento` mostra apenas os **Closers do Consórcio** (4 pessoas), enquanto os **SDRs do Consórcio** (atualmente 1 - Cleiton Lima) são gerenciados separadamente na página `/fechamento-sdr` com filtro de BU.

O usuário deseja que **ambos** apareçam na mesma página de fechamento do Consórcio.

## Proposta de Solução

Adicionar **abas (tabs)** na página de Fechamento do Consórcio para separar:
- **Aba Closers**: Lista atual de closers com comissões (já implementado)
- **Aba SDRs**: Lista de SDRs do consórcio com métricas (novo)

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Fechamento - Consórcio                                [Fev 2026 ▼] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐ ┌──────────────┐                                  │
│  │   Closers    │ │    SDRs      │    (abas)                        │
│  └──────────────┘ └──────────────┘                                  │
│                                                                      │
│  [Recalcular Todos] [Exportar CSV] [Configurações]                  │
│                                                                      │
│  ... (conteúdo da aba selecionada) ...                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Alterações Técnicas

### 1. Atualizar página `Fechamento.tsx`

- Adicionar componente `Tabs` do Radix UI
- Criar duas tabs: "Closers" e "SDRs"
- Na aba SDRs, reutilizar o hook `useSdrPayouts` com filtro `squad: 'consorcio'`

### 2. Novo hook para SDRs do Consórcio

Criar função auxiliar no hook existente ou usar diretamente:
```typescript
// Buscar payouts de SDRs do consórcio
const { data: sdrPayouts } = useSdrPayouts(anoMes, {
  squad: 'consorcio',
});
```

### 3. Botão "Recalcular Todos" unificado

O botão irá:
1. Recalcular closers via `useRecalculateConsorcioPayouts`
2. Recalcular SDRs via edge function existente (com filtro de BU)

### 4. Totais separados por aba

Cada aba terá seus próprios cards de resumo (Total Fixo, Variável, Conta).

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/bu-consorcio/Fechamento.tsx` | Adicionar Tabs, importar hooks de SDR, criar seção de SDRs |
| `src/components/consorcio-fechamento/ConsorcioSdrTable.tsx` | Novo componente para tabela de SDRs (opcional, pode ser inline) |

## Implementação

### Estrutura de Tabs

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Na página:
<Tabs defaultValue="closers">
  <TabsList>
    <TabsTrigger value="closers">
      Closers ({payouts?.length || 0})
    </TabsTrigger>
    <TabsTrigger value="sdrs">
      SDRs ({sdrPayouts?.length || 0})
    </TabsTrigger>
  </TabsList>
  
  <TabsContent value="closers">
    {/* Cards de resumo dos Closers */}
    {/* Tabela de Closers existente */}
  </TabsContent>
  
  <TabsContent value="sdrs">
    {/* Cards de resumo dos SDRs */}
    {/* Tabela de SDRs */}
  </TabsContent>
</Tabs>
```

### Dados dos SDRs

```typescript
import { useSdrPayouts, useRecalculateAllPayouts } from '@/hooks/useSdrFechamento';

// No componente:
const { data: sdrPayouts, isLoading: sdrLoading } = useSdrPayouts(anoMes, {
  squad: 'consorcio',
});

// Totais dos SDRs
const sdrTotais = (sdrPayouts || []).reduce(
  (acc, p) => ({
    fixo: acc.fixo + (p.valor_fixo || 0),
    variavel: acc.variavel + (p.valor_variavel_total || 0),
    total: acc.total + (p.total_conta || 0),
    ifood: acc.ifood + (p.total_ifood || 0),
  }),
  { fixo: 0, variavel: 0, total: 0, ifood: 0 }
);
```

### Tabela de SDRs (similar à existente)

Incluir colunas: Nome, Cargo, Status, % Meta, Fixo, Variável, Total, iFood, Ação

### Navegação para Detalhe

Ao clicar no SDR, navegar para `/fechamento-sdr/{payoutId}` (reutiliza página existente)

## Resultado Final

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Fechamento - Consórcio                                [Fev 2026 ▼] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐ ┌──────────────────┐                          │
│  │  Closers (4)     │ │   SDRs (1)       │                          │
│  └──────────────────┘ └──────────────────┘                          │
│                                                                      │
│  [Recalcular Todos] [Exportar CSV] [Configurações]                  │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Total Fixo        │ Total Variável   │ Total Conta          │    │
│  │ R$ 14.000,00      │ R$ 600,00        │ R$ 14.600,00         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Nome                       │ Status    │ Fixo    │ ... │ Ação     │
│  ─────────────────────────────────────────────────────────────────  │
│  Victoria Paz               │ Rascunho  │ R$3.500 │ ... │ [👁]     │
│  Thobson                    │ Rascunho  │ R$3.500 │ ... │ [👁]     │
│  Luis Felipe de Souza       │ Rascunho  │ R$3.500 │ ... │ [👁]     │
│  João Pedro Martins Vieira  │ Rascunho  │ R$3.500 │ ... │ [👁]     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

Ao clicar na aba "SDRs":

```text
│  ┌──────────────────┐ ┌──────────────────┐                          │
│  │  Closers (4)     │ │ ▶ SDRs (1)       │                          │
│  └──────────────────┘ └──────────────────┘                          │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │ Total Fixo      │ Total Variável │ Total Conta │ Total iFood│    │
│  │ R$ 2.000,00     │ R$ 1.200,00    │ R$ 3.200,00 │ R$ 150,00  │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Nome          │ % Meta │ Status   │ Fixo    │ Var.   │ Total │ Ação│
│  ───────────────────────────────────────────────────────────────────│
│  Cleiton Lima  │ 85%    │ Rascunho │ R$2.000 │ R$1.200│ R$3.2k│ [👁]│
│                                                                      │
```

## Benefícios

1. **Experiência unificada**: Gestores do Consórcio veem toda a equipe em um só lugar
2. **Reutilização**: Aproveita hooks e tipos já existentes do sistema SDR
3. **Consistência**: Mesma interface visual para closers e SDRs
4. **Sem duplicação**: SDRs continuam usando a infraestrutura existente (`sdr_month_payout`)


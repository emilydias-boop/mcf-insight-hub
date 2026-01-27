
# Plano: Criar Seção de No-Shows para Reagendamento R2

## Visão Geral

Criar uma nova aba **"No-Shows"** dentro da Agenda R2, ao lado de "Pendentes", com todas as informações necessárias para a Yanca reagendar rapidamente os leads que faltaram às reuniões.

## Estrutura da Solução

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  Agenda R2                                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Lista] [Calendário] [Por Sócio] [Pendentes (30)] [No-Shows (5)]          │
│                                                        ↑ NOVA ABA           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filtros:  [Dia ▾] [Semana ▾] [Mês ▾] [Personalizado]  [Sócio R2 ▾]        │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ 🔴 Odesmar Martins da Silva                                            │ │
│  │    📞 (11) 99999-9999  |  📧 email@teste.com                           │ │
│  │    📅 R2 era: 27/01 às 13:00 com Claudia                               │ │
│  │    👤 SDR: Jessica  |  🎯 Closer R1: Julio                             │ │
│  │    💰 Perfil: Lead A  |  🏗️ Já constrói: Sim                           │ │
│  │    📋 Nota SDR: "Cliente interessado em construir..."                  │ │
│  │                                                   [📅 Reagendar R2]    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Funcionalidades

| Funcionalidade | Descrição |
|----------------|-----------|
| **Aba No-Shows** | Nova aba com badge contador |
| **Filtro de Data** | Dia, Semana, Mês, Personalizado |
| **Filtro por Sócio R2** | Filtrar pelo closer R2 responsável |
| **Informações Completas** | Nome, telefone, email, data original, closer, SDR, perfil, notas |
| **Ação Rápida** | Botão "Reagendar R2" abre modal de reagendamento |
| **Redirecionamento do Carrinho** | Link do carrinho direciona para esta aba |

## Arquivos a Criar

### 1. Componente: R2NoShowsPanel

**Arquivo:** `src/components/crm/R2NoShowsPanel.tsx`

Painel com:
- Filtros de data (próprios, não usa os globais da página)
- Filtro por sócio R2
- Lista de cards com leads no-show
- Cada card com todas as informações relevantes
- Botão de reagendar que abre o modal R2RescheduleModal

### 2. Hook: useR2NoShowLeads

**Arquivo:** `src/hooks/useR2NoShowLeads.ts`

Hook dedicado para buscar no-shows com todas as informações necessárias:
- Dados do attendee (nome, telefone, deal)
- Data/hora original da R2
- Closer R2 responsável
- SDR que agendou
- Closer R1 que fez a primeira reunião
- Notas de qualificação
- Perfil do lead
- Custom fields do deal

## Arquivos a Modificar

### 1. AgendaR2.tsx

Adicionar:
- Nova aba "No-Shows" no TabsList
- Hook para contar no-shows no período
- Tratamento do parâmetro URL `?filter=no_show` para abrir nesta aba
- Nova TabsContent com o R2NoShowsPanel

### 2. R2MetricsPanel.tsx

Alterar redirecionamento do botão "Reagendar" para:
- De: `window.location.href = '/crm/agenda-r2?filter=no_show'`
- Para: `window.location.href = '/crm/agenda-r2?tab=noshows'`

## Detalhes Técnicos

### Hook useR2NoShowLeads

```typescript
// Buscar attendees com status 'no_show' de reuniões R2
// Filtrar por período e opcionalmente por closer_id
// Enriquecer com dados de SDR, R1 closer, notas e custom_fields
interface R2NoShowLead {
  id: string;                    // attendee id
  name: string;
  phone: string | null;
  email: string | null;
  
  // R2 original
  meeting_id: string;
  scheduled_at: string;          // data/hora original do no-show
  closer_id: string;
  closer_name: string;
  closer_color: string | null;
  
  // Histórico do funil
  sdr_name: string | null;
  r1_closer_name: string | null;
  r1_date: string | null;
  
  // Qualificação
  lead_profile: string | null;
  already_builds: boolean | null;
  r1_qualification_note: string | null;
  
  // Deal info
  deal_id: string | null;
  deal?: {
    custom_fields: Record<string, unknown>;
    origin_name: string | null;
  };
}
```

### Componente R2NoShowsPanel

Props:
- `closers`: Lista de closers R2 ativos para o filtro

Estado interno:
- `dateFilter`: 'day' | 'week' | 'month' | 'custom'
- `selectedDate`: Date
- `customRange`: { start: Date, end: Date }
- `closerFilter`: string | 'all'
- `rescheduleModalOpen`: boolean
- `selectedLead`: R2NoShowLead | null

### Parâmetro URL

Usar `useSearchParams` do react-router-dom para:
1. Ler `?tab=noshows` e definir aba ativa
2. Permitir navegar via URL

## Fluxo de Implementação

```text
1. Criar hook useR2NoShowLeads
          ↓
2. Criar componente R2NoShowsPanel
          ↓
3. Adicionar hook useR2NoShowsCount para badge
          ↓
4. Modificar AgendaR2.tsx:
   - Adicionar aba no-shows
   - Ler parâmetro URL
   - Integrar modal de reagendamento
          ↓
5. Atualizar R2MetricsPanel para usar nova URL
          ↓
6. Testar fluxo completo: Carrinho → Aba → Reagendar
```

## Detalhes de UI

### Card de No-Show

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🔴 Nome do Lead                                    [Reagendar] │
│    📞 (11) 99999-9999  |  📧 email@exemplo.com                  │
├─────────────────────────────────────────────────────────────────┤
│ 📅 R2: 27/01 às 13:00                                          │
│ 👤 Sócio R2: Claudia Carielo                                    │
├─────────────────────────────────────────────────────────────────┤
│ 📌 SDR: Jessica Bellini                                         │
│ 🎯 Closer R1: Julio Cesar (18/01 às 10:00)                     │
├─────────────────────────────────────────────────────────────────┤
│ 💡 Perfil: Lead A  |  🏗️ Já constrói: Sim  |  📍 São Paulo     │
│ 📋 "Cliente com terreno próprio, interessado em construir..."  │
└─────────────────────────────────────────────────────────────────┘
```

### Filtros

```text
┌────────────────────────────────────────────────────────────────┐
│  Período: [Dia] [Semana] [Mês] [📅 Personalizado]              │
│                                                                 │
│  Sócio R2: [Todos os sócios ▾]                                 │
│                                                                 │
│  Mostrando 5 leads com no-show de 20/01 a 27/01                │
└────────────────────────────────────────────────────────────────┘
```

## Benefícios

1. **Agilidade**: Yanca vê tudo que precisa em uma tela
2. **Contexto Completo**: Histórico do funil (SDR → R1 → R2)
3. **Ação Rápida**: Um clique para reagendar
4. **Filtros Flexíveis**: Encontra no-shows por data ou sócio
5. **Integração**: Carrinho direciona automaticamente para esta aba

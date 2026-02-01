
# Página Principal Pós-Login: Visão das 4 Luas

## Resumo

Criar uma nova página de boas-vindas que será a primeira tela após o login, exibindo 4 indicadores visuais em formato de "lua" (progresso circular) representando cada Business Unit principal: **Incorporador**, **Consórcio**, **Crédito** e **Leilão**. Cada lua mostrará a Ultrameta da BU e o progresso real em tempo real, permitindo que todo o time visualize o desempenho das equipes.

---

## Arquitetura da Solução

```text
┌─────────────────────────────────────────────────────────────────┐
│                        /home (Nova Rota)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  🌙 INCORP  │  │  🌙 CONS.   │  │  🌙 CRÉDITO │  │  🌙 LEILÃO  │ │
│  │   R$ 450k   │  │   R$ 120k   │  │   R$ 80k    │  │   R$ 35k    │ │
│  │   ━━━━○━━   │  │   ━━○━━━━   │  │   ━━━○━━━  │  │   ━○━━━━━   │ │
│  │  Meta: 600k │  │  Meta: 200k │  │  Meta: 100k │  │  Meta: 50k  │ │
│  │    75%      │  │    60%      │  │    80%      │  │    70%      │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
│                                                                     │
│                    ▶ Ir para minha área                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## O Que Será Criado

### 1. Componente MoonProgress (Lua Circular)

Um componente visual de progresso circular usando SVG que simula uma "lua" preenchendo conforme o progresso:

- Círculo SVG com animação suave de preenchimento
- Cores distintas por BU (azul para Incorporador, verde para Consórcio, etc.)
- Efeito de brilho/glow quando atinge 100%
- Animação de entrada ao carregar a página

### 2. Nova Página `/home`

- Título de boas-vindas personalizado com nome do usuário
- Grid responsivo com as 4 luas (2x2 em mobile, 4x1 em desktop)
- Cada lua mostrando:
  - Nome da BU
  - Valor apurado atual (em tempo real)
  - Meta Ultrameta
  - Percentual de progresso
- Botão para ir para a área específica do usuário
- Acesso permitido a **todos os usuários** (sem restrição de role)

### 3. Hook `useUltrametaByBU`

Novo hook que busca os dados de Ultrameta de cada Business Unit:

| BU | Fonte de Dados | Métrica |
|---|---|---|
| Incorporador | `hubla_transactions` (product_category = 'incorporador') | Faturamento Bruto Semanal |
| Consórcio | `consortium_payments` | Soma de `valor_comissao` |
| Crédito | `consortium_payments` | Soma de `valor_comissao` |
| Leilão | `hubla_transactions` (product_category = 'clube_arremate') | Faturamento Bruto Semanal |

As metas virão da tabela `team_targets` com novos registros:
- `ultrameta_incorporador`
- `ultrameta_consorcio`
- `ultrameta_credito`
- `ultrameta_leilao`

### 4. Alteração no Fluxo de Login

Modificar o `AuthContext.tsx` para redirecionar todos os usuários para `/home` após o login (mantendo exceção de SDRs para `/sdr/minhas-reunioes`).

---

## Fluxo de Navegação

```text
Login → /home (Luas) → Clica em "Ir para minha área" → Redireciona baseado na BU/Role
                    ↘
                      Clica em uma Lua → Vai para o dashboard daquela BU
```

---

## Design Visual das Luas

Cada lua terá:

1. **Círculo de fundo** (cinza escuro/claro dependendo do tema)
2. **Arco de progresso** (cor da BU) que preenche de 0° a 360°
3. **Ícone da BU** no centro (Building2, TrendingUp, CreditCard, Gavel)
4. **Valor atual** em destaque
5. **Meta e percentual** abaixo
6. **Cores por BU**:
   - Incorporador: `hsl(220, 90%, 56%)` (Azul)
   - Consórcio: `hsl(142, 76%, 36%)` (Verde)
   - Crédito: `hsl(200, 80%, 50%)` (Ciano)
   - Leilão: `hsl(45, 93%, 47%)` (Amarelo/Dourado)

---

## Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/home/MoonProgress.tsx` | **Criar** | Componente SVG de lua circular animada |
| `src/components/home/BUMoonCard.tsx` | **Criar** | Card wrapper com a lua e informações da BU |
| `src/pages/Home.tsx` | **Criar** | Nova página principal com as 4 luas |
| `src/hooks/useUltrametaByBU.ts` | **Criar** | Hook para buscar métricas de cada BU |
| `src/App.tsx` | **Modificar** | Adicionar rota `/home` e ajustar rota index |
| `src/contexts/AuthContext.tsx` | **Modificar** | Redirecionar para `/home` após login |

---

## Responsividade

- **Mobile (< 640px)**: Grid 1x4 (uma lua por linha)
- **Tablet (640px - 1024px)**: Grid 2x2
- **Desktop (> 1024px)**: Grid 4x1 (todas lado a lado)

---

## Seção Técnica

### Estrutura do Componente MoonProgress

```typescript
interface MoonProgressProps {
  value: number;      // Valor atual
  max: number;        // Meta
  color: string;      // Cor HSL da BU
  size?: number;      // Tamanho em pixels (default: 180)
  strokeWidth?: number; // Espessura do arco (default: 12)
  animate?: boolean;  // Animar ao montar (default: true)
}
```

### Cálculo do Arco SVG

O progresso será calculado usando `stroke-dasharray` e `stroke-dashoffset`:

```typescript
const circumference = 2 * Math.PI * radius;
const progress = Math.min((value / max) * 100, 100);
const offset = circumference - (progress / 100) * circumference;
```

### Query de Dados

O hook `useUltrametaByBU` fará consultas paralelas:

```typescript
const [incorporador, consorcio, credito, leilao, targets] = await Promise.all([
  // Incorporador: usar useIncorporadorGrossMetrics existente
  // Consórcio: consortium_payments
  // Crédito: consortium_payments
  // Leilão: hubla_transactions com product_category = 'clube_arremate'
  // Targets: team_targets com tipo ultrameta_*
]);
```

### Metas Padrão

Caso não existam metas configuradas, usar valores padrão:
- Incorporador: R$ 500.000
- Consórcio: R$ 150.000
- Crédito: R$ 100.000
- Leilão: R$ 50.000

### Animação CSS

```css
@keyframes moon-fill {
  from { stroke-dashoffset: circumference; }
  to { stroke-dashoffset: calculated-offset; }
}

.moon-progress {
  animation: moon-fill 1.5s ease-out forwards;
}
```

---

## Próximos Passos (Após Implementação)

1. Configurar metas de Ultrameta por BU na interface de admin
2. Adicionar sparkline de evolução semanal abaixo de cada lua (opcional)
3. Adicionar notificações quando uma BU bater a meta

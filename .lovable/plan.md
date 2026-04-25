# Drill-down clicável no Funil por Canal

## Objetivo
Validar **lead por lead, número por número, venda por venda**: ao clicar em qualquer célula numérica da tabela "Funil por Canal", abrir um modal listando exatamente os deals/transações que compõem aquele valor — com email, nome, telefone, data e link pro CRM.

Isso transforma a tabela de "confiar nos números" em "auditar os números".

## Como vai funcionar (UX)

- Cada célula numérica vira um botão sutil (mesmo visual atual, mas com `cursor: pointer` e hover discreto).
- Clicar em "94" na linha A010 / coluna R1 Agendada → abre modal:
  - **Título**: `R1 Agendada — A010 (94 deals)`
  - **Subtítulo**: explica a regra (ex: "Deals únicos com R1 cujo `scheduled_at` cai entre 10/04 e 11/04, BU Incorporador, status ≠ cancelled/rescheduled").
  - **Tabela**: Nome do lead | Email | Telefone | Data do evento | Status | Canal classificado | botão "Abrir no CRM".
  - **Busca** + ordenação por coluna.
  - Botão **Exportar CSV** dos itens.
- Clicar em "Total" da mesma coluna → mesma modal mas sem filtro de canal (todos os 3 canais juntos).
- Células de **conversão** (%), de **canal/label** e de **valores monetários** não são clicáveis (não fazem sentido drill).
- Faturamento Bruto/Líquido → drill mostra as 17 transações com produto, valor bruto vs líquido (somam o total).

## Métricas que terão drill-down

| Coluna | O que aparece no modal |
|---|---|
| Entradas | Deals criados na janela (id, nome, email, data criação, tags, canal) |
| R1 Agend. | Deals únicos com R1 marcada na janela (status final do attendee) |
| R1 Realiz. | Idem, status `completed` |
| No-Show | Idem, status `no_show` |
| Contrato Pago | Deals com `contract_paid_at` na janela |
| R2 Agend./Realiz./Aprovados/Reprovados/Próx. Semana | Deals únicos do carrinho com aquele status |
| Venda Final | Emails únicos com vendas de parceria (mostra produto + valor) |
| Fat. Bruto/Líquido | Mesmas vendas, com breakdown bruto vs líquido |

## Implementação técnica

### 1. Expor as listas brutas no `useChannelFunnelReport`
Atualmente o hook retorna apenas os agregados. Vou adicionar ao retorno uma estrutura `details` indexada por `[canal][métrica]` contendo a lista dos itens que entraram naquela contagem:

```ts
type DetailItem = {
  id: string;          // deal_id ou transaction_id
  name: string | null;
  email: string | null;
  phone: string | null;
  date: string;        // sale_date / scheduled_at / contract_paid_at / created_at
  extra?: Record<string, any>; // produto, valor, status, etc.
};

type DetailsByMetric = Record<string, DetailItem[]>;
type DetailsByChannel = Record<'A010'|'ANAMNESE'|'OUTROS'|'TOTAL', DetailsByMetric>;
```

A coleta dos detalhes acompanha a agregação (loops já existentes em `useMemo` da seção 6). Custo: nenhuma query nova — estamos só guardando os mesmos itens que já são contados.

Uma única query nova: nome/telefone do contato pra exibir no modal. Vou fazer um lookup leve de `crm_contacts (id, name, phone)` para os deal_ids envolvidos, em chunks (mesmo padrão dos outros queries).

### 2. Componente novo: `FunnelCellDrillModal`
Arquivo: `src/components/relatorios/FunnelCellDrillModal.tsx`

- `<Dialog>` com `<DialogContent className="max-w-4xl">`.
- Props: `{ open, onOpenChange, title, subtitle, items: DetailItem[], columns: ColumnDef[] }`.
- Tabela com busca client-side, ordenação, e botão "Exportar CSV" (gera blob no browser).
- Cada linha tem botão "Abrir no CRM" → `window.open('/crm/leads/{deal_id}')` quando aplicável.
- Vazio: "Nenhum item compõe esta contagem" (não deveria acontecer, mas defensivo).

### 3. Tornar células clicáveis em `ChannelFunnelTable`
- Substituir `<TableCell>` numéricas por um wrapper `<ClickableCell value={n} onClick={() => openDrill(...)} />`.
- Estilo: mantém visual atual + `hover:bg-muted/50 cursor-pointer rounded`. Se valor for 0, **não clicável** (cinza muted).
- Estado local: `const [drillState, setDrillState] = useState<{channel, metric} | null>(null)`.
- Resolve título/subtítulo/items com base em `drillState` + tabela de configuração de métricas.

### 4. Configuração centralizada de métricas
Arquivo: `src/components/relatorios/funnelMetricsConfig.ts`

```ts
export const FUNNEL_METRICS_CONFIG = {
  entradas:      { label: 'Entradas',      rule: 'Deals criados na janela…' },
  r1Agendada:    { label: 'R1 Agendada',   rule: 'Deals únicos com R1…' },
  // … etc
};
```

Reaproveita os textos dos tooltips que já estão na tabela. Single source of truth.

## Arquivos a modificar/criar

1. **`src/hooks/useChannelFunnelReport.ts`** — adicionar coleta de `details` + lookup de nome/telefone, retornar no objeto.
2. **`src/components/relatorios/FunnelCellDrillModal.tsx`** *(novo)* — modal genérico de drill-down.
3. **`src/components/relatorios/funnelMetricsConfig.ts`** *(novo)* — labels/regras das métricas.
4. **`src/components/relatorios/ChannelFunnelTable.tsx`** — células clicáveis + state do modal.

## Validação esperada (caso 10/04–11/04)

- Clicar em **Venda Final → Total (17)**: modal lista os **17 emails** confirmados pela auditoria SQL, somando R$ 133.792,78 — bate com a UI.
- Clicar em **R1 Agendada → Total (94)**: modal lista 94 deals únicos (sem repetir reagendamentos).
- Clicar em **Contrato Pago → Total (20)**: modal lista 20 deals com `contract_paid_at` na janela.
- Clicar em qualquer célula de canal específico: lista filtrada, e a soma das 3 linhas (A010+ANAMNESE+OUTROS) bate com a do Total.

## Out of scope (próxima rodada se quiser)
- Persistir filtros do drill na URL (deep-link).
- Comparar dois períodos lado a lado.
- Drill-down nas células de % de conversão (mostrar numerador + denominador).

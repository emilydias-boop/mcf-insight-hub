
# Plano: Conectar Meta de Contratos e Fonte de Dados da Agenda

## Resumo das Questões do Usuário

1. **"Contrato vem a partir da Agenda também"** - Correto! Contratos são contados via `meeting_slot_attendees` com status `contract_paid`. A Hubla confirma, mas a Agenda é a fonte primária.

2. **"Onde mudo a meta de contrato por dia do Closer?"** - Na aba **"Métricas Ativas"** (`/fechamento-sdr` → aba "Métricas") você configura a **Meta** para a métrica "Contratos Pagos" por cargo/mês.

---

## Problemas Identificados

### 1. Meta de contratos não está sendo passada ao KpiEditForm
No `Detail.tsx` linha 447-459, a chamada do `KpiEditForm` não passa `metaContratosDiaria`:

```typescript
<KpiEditForm
  kpi={kpi || null}
  compPlan={compPlan || null}
  // ...
  roleType={(payout.sdr as any)?.role_type || 'sdr'}
  // ⚠️ FALTA: metaContratosDiaria={...}
  // ⚠️ FALTA: vendasParceria={...}
/>
```

Resultado: O formulário usa o valor padrão `metaContratosDiaria = 1` sempre.

### 2. Contratos mostram "(calculado da Hubla)" mas deveriam vir da Agenda
O campo de "Contratos Pagos" no `KpiEditForm` deveria mostrar dados da **Agenda** (attendees com status `contract_paid`), não da tabela `sdr_intermediacoes`.

### 3. Vendas Parceria não está sendo contada
O campo `vendasParceria` não está sendo calculado e passado ao `KpiEditForm`.

---

## Solução

### A) Buscar meta de contratos das métricas ativas

**Arquivo:** `src/pages/fechamento-sdr/Detail.tsx`

Adicionar busca de métricas ativas para obter `meta_valor` da métrica "contratos":

```typescript
// Buscar métricas ativas para este SDR/mês
const { metricas } = useActiveMetricsForSdr(payout?.sdr_id, payout?.ano_mes || '');

// Extrair meta de contratos das métricas configuradas
const metricaContratos = metricas.find(m => m.nome_metrica === 'contratos');
const metaContratosDiaria = metricaContratos?.meta_valor || 1;

// Passar ao KpiEditForm
<KpiEditForm
  ...
  metaContratosDiaria={metaContratosDiaria}
/>
```

### B) Usar dados de contratos da Agenda (não só Hubla)

O `intermediacoes` atualmente vem de `sdr_intermediacoes`. Para Closers, "Contratos Pagos" deveria usar a contagem de `meeting_slot_attendees` com `status = 'contract_paid'` onde o Closer é o responsável.

**Arquivo:** `src/pages/fechamento-sdr/Detail.tsx`

Já existe `agendaMetrics.data?.contract_paid` no hook `useSdrAgendaMetricsBySdrId`. Precisamos:

1. Verificar se o hook retorna contrato pago
2. Usar esse valor em vez de `intermediacaoCount` para Closers

### C) Calcular Vendas Parceria

Vendas Parceria são transações da Hubla/Agenda marcadas como parceria. Precisamos criar um hook ou query para contar essas vendas por Closer/mês.

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/fechamento-sdr/Detail.tsx` | Buscar meta de contratos das métricas ativas e passar ao KpiEditForm |
| `src/pages/fechamento-sdr/Detail.tsx` | Usar `contract_paid` da agenda como fonte primária de contratos para Closers |
| `src/hooks/useSdrAgendaMetricsBySdrId.ts` | Verificar se retorna `contract_paid` |
| `src/components/sdr-fechamento/KpiEditForm.tsx` | Atualizar label para mostrar "Auto (Agenda)" em vez de "Auto (Hubla)" para contratos |

---

## Onde Configurar Meta de Contrato por Dia

**Localização:** `/fechamento-sdr` → Aba "Métricas Ativas"

1. Selecione o **Cargo** (ex: "Closer Inside N1")
2. Ative a métrica **"Contratos Pagos"**
3. No campo **"Meta"**, digite o valor diário (ex: `1` para 1 contrato/dia)
4. Clique em **Salvar**

O sistema calcula: `Meta Mensal = Meta Diária × Dias Úteis`

Exemplo: Meta = 1/dia × 20 dias = **20 contratos/mês**

---

## Fluxo Corrigido

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ANTES (desconectado)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Métricas Ativas: Contratos = Meta: 20 (configurado)                        │
│                                                                             │
│  KpiEditForm: metaContratosDiaria = 1 (default hardcoded)                   │
│             → Mostra "Meta: 20 (1/dia × 20 dias)" - errado                  │
│                                                                             │
│  Fonte: sdr_intermediacoes (manual/Hubla)                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              DEPOIS (conectado)                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Métricas Ativas: Contratos = Meta: 1 (por dia)                             │
│                                                                             │
│  Detail.tsx busca métricas → Encontra meta_valor = 1 para "contratos"       │
│                                                                             │
│  KpiEditForm: metaContratosDiaria = 1 (das métricas ativas)                 │
│             → Mostra "Meta: 20 (1/dia × 20 dias)" - correto                 │
│                                                                             │
│  Fonte: meeting_slot_attendees.status = 'contract_paid' (Agenda)            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Resultado Esperado

1. **Meta de contratos configurável**: Na aba "Métricas Ativas", configure a meta diária para a métrica "Contratos"
2. **KpiEditForm mostra meta correta**: "Meta: 20 (1/dia × 20 dias)" reflete a configuração
3. **Contratos da Agenda**: Fonte primária é `meeting_slot_attendees` com status `contract_paid`
4. **Label atualizado**: Mostra "Auto (Agenda)" em vez de "Auto (Hubla)"

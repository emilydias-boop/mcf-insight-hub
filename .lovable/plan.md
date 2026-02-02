
# Plano: Corrigir Sistema de Fechamento para Closers e Metas Individuais

## Resumo dos Problemas

O sistema de fechamento apresenta inconsistências para colaboradores do tipo Closer:

1. **Julio (Closer Inside)** está sendo exibido com métricas de SDR (Agendadas, Tentativas, Organização)
2. **Aba "Planos OTE"** mostra apenas valores do catálogo de cargos (zerados para Closers), ignorando planos individuais
3. **Não existe forma de editar metas individuais** por colaborador
4. **Métricas Ativas configuradas** não são consumidas pelo sistema de cálculo

---

## Solução em 3 Partes

### Parte 1: Adaptar Tela de Detalhe para Closers

Modificar `src/pages/fechamento-sdr/Detail.tsx` para exibir indicadores diferentes baseado no `role_type`:

| SDR | Closer |
|-----|--------|
| Reuniões Agendadas | R1 Realizadas |
| Reuniões Realizadas | Contratos Pagos |
| Tentativas de Ligação | Taxa de Conversão |
| Organização | No-Show (inverso) |
| No-Show | R2 Agendadas |
| - | Outside Sales |

**Lógica:**
```typescript
const isCloser = (payout.sdr as any)?.role_type === 'closer';

// Exibir indicadores diferentes
{isCloser ? (
  <CloserIndicators kpi={kpi} payout={payout} compPlan={compPlan} />
) : (
  <SdrIndicators kpi={kpi} payout={payout} compPlan={compPlan} />
)}
```

---

### Parte 2: Aba "Planos OTE" com Edição Individual

Transformar a aba "Planos OTE" para:

1. **Exibir valores do plano individual** (`sdr_comp_plan`) quando existir, com fallback para catálogo
2. **Permitir edição inline** dos valores OTE por colaborador
3. **Indicar visualmente** se o valor vem do catálogo ou foi personalizado

**Estrutura da Tabela:**
| Colaborador | Cargo | OTE Total | Fixo | Variável | Meta Diária | Ações |
|-------------|-------|-----------|------|----------|-------------|-------|
| Julio Caetano | Closer Inside | R$ 4.000 ✏️ | R$ 2.800 | R$ 1.200 | 6 | Editar |

**Arquivos:**
- `src/components/fechamento/PlansOteTab.tsx` - Adicionar integração com `sdr_comp_plan`
- Criar dialog de edição inline

---

### Parte 3: Conectar Métricas Ativas ao Cálculo

Atualizar a edge function para consumir as métricas configuradas em `fechamento_metricas_mes`:

```typescript
// Buscar métricas ativas para o cargo/BU
const { data: metricasAtivas } = await supabase
  .from('fechamento_metricas_mes')
  .select('*')
  .eq('ano_mes', anoMes)
  .eq('cargo_catalogo_id', employee.cargo_catalogo_id)
  .eq('squad', sdr.squad)
  .eq('ativo', true);

// Calcular payout baseado nas métricas ativas
// em vez de usar lógica fixa SDR vs Closer
```

**Impacto:** O sistema usará as métricas que você configurou na aba "Métricas Ativas" para determinar o cálculo do variável.

---

## Fluxo Visual Proposto

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUXO DE CONFIGURAÇÃO                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Aba "Métricas Ativas"                                       │
│     ├── Selecionar Cargo: Closer Inside                         │
│     ├── Selecionar BU: Incorporador                             │
│     └── Ativar: R1 Realizadas, Contratos, R2 Agendadas...      │
│                                                                 │
│  2. Aba "Planos OTE"                                            │
│     ├── Ver colaboradores com cargo Closer Inside               │
│     ├── Editar OTE individual de cada um                        │
│     └── Definir meta diária individual                          │
│                                                                 │
│  3. Fechamento (recálculo)                                      │
│     ├── Buscar métricas ativas do cargo/BU                      │
│     ├── Aplicar pesos configurados                              │
│     └── Calcular variável proporcionalmente                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Alterações Técnicas

### Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/fechamento-sdr/Detail.tsx` | Exibir indicadores diferentes para Closer vs SDR |
| `src/components/fechamento/PlansOteTab.tsx` | Integrar com `sdr_comp_plan`, permitir edição inline |
| `supabase/functions/recalculate-sdr-payout/index.ts` | Consumir `fechamento_metricas_mes` no cálculo |
| `src/types/sdr-fechamento.ts` | Adicionar tipos para métricas dinâmicas |

### Novos Componentes

| Componente | Propósito |
|------------|-----------|
| `CloserKpiEditForm.tsx` | Form de edição de KPIs específico para Closers |
| `EditIndividualPlanDialog.tsx` | Dialog para editar plano OTE individual |

---

## Dados a Corrigir

Para o Julio e outros Closers funcionarem corretamente agora:

1. **Atualizar `cargos_catalogo`** com valores padrão para Closers:
   ```sql
   UPDATE cargos_catalogo 
   SET ote_total = 4000, fixo_valor = 2800, variavel_valor = 1200
   WHERE nome_exibicao = 'Closer Inside';
   ```

2. Ou manter os valores individuais em `sdr_comp_plan` e adaptar a aba para lê-los

---

## Priorização Sugerida

**Fase 1 (Crítico):** Adaptar tela de detalhe para mostrar métricas corretas de Closer
**Fase 2 (Importante):** Permitir edição individual na aba Planos OTE
**Fase 3 (Melhoria):** Conectar Métricas Ativas ao cálculo do payout

Deseja que eu implemente todas as fases ou prefere começar pela Fase 1?

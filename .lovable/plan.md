
# Suporte a Domingo na Agenda + Dia Flexivel do Carrinho

## Contexto

Atualmente, o sistema exclui Domingo em varios pontos:
- A grade da Agenda (semana) pula de Sabado direto para Segunda
- As configs de disponibilidade (R1 e R2) nao listam Domingo como opcao
- O hook de sugestao de horarios pula Domingo
- O Carrinho R2 sempre usa semana Sabado-Sexta fixa

Para situacoes esporadicas (pos-feriado), e necessario:
1. Poder agendar reunioes no Domingo
2. Poder ajustar o dia do Carrinho (ex: de segunda para terca)

---

## Solucao

### Parte 1: Suporte a Domingo na Agenda

**Abordagem**: Usar o sistema de **Daily Slots** (que ja existe para R2) como mecanismo para habilitar Domingo. Quando um closer tem slots configurados para um Domingo especifico, esse dia aparece automaticamente na agenda.

#### 1.1 Adicionar Domingo nas configs de disponibilidade

**Arquivos**: `src/components/crm/CloserAvailabilityConfig.tsx`, `src/components/crm/R2CloserAvailabilityConfig.tsx`

Adicionar `{ value: 0, label: 'Domingo' }` ao array `DAYS_OF_WEEK` em ambos os arquivos. Isso permite configurar horarios recorrentes para Domingo (caso necessario) ou usar os Daily Slots para datas especificas.

#### 1.2 Mostrar Domingo na grade da Agenda quando houver slots/reunioes

**Arquivo**: `src/components/crm/AgendaCalendar.tsx`

- No `daysOfWeekInView`: incluir Domingo (0) na lista de dias da semana
- No `viewDays`: incluir o Domingo (addDays(weekStart, 1)) na lista de dias exibidos
- A grade passara a exibir 7 dias: Sab, Dom, Seg, Ter, Qua, Qui, Sex

Alternativa mais conservadora: mostrar Domingo apenas quando existirem reunioes ou slots configurados para aquele Domingo. Porem, para simplificar, a abordagem recomendada e sempre incluir para manter a grade consistente.

#### 1.3 Remover bloqueio de Domingo no hook de sugestoes

**Arquivo**: `src/hooks/useMeetingSuggestion.ts`

Remover a linha `if (dayOfWeek === 0) continue;` para que o sistema tambem sugira horarios de Domingo quando houver disponibilidade configurada.

---

### Parte 2: Dia Flexivel do Carrinho

**Abordagem**: Criar uma configuracao simples na tabela `settings` que permite definir, por semana, se o carrinho deve usar um dia diferente. Isso sera uma "excecao semanal" que pode ser configurada pela interface.

#### 2.1 Criar config de excecao do Carrinho

**Tabela**: `settings` (ja existe, esta vazia)

Usar a chave `carrinho_week_override` com valor JSON contendo a data de inicio e fim da semana customizada:

```text
key: "carrinho_week_override"
value: {"start": "2026-02-24", "end": "2026-03-01", "label": "Semana pos-feriado"}
```

Quando essa config existe e a data atual esta dentro do range, o carrinho usa esse range em vez do padrao Sab-Sexta.

#### 2.2 Adicionar UI de configuracao no Carrinho

**Arquivo**: `src/pages/crm/R2Carrinho.tsx`

Adicionar um botao de "Ajustar Semana" (icone de calendario com engrenagem) ao lado da navegacao semanal. Ao clicar, abre um dialog simples com:
- Date picker para "Inicio da semana"
- Date picker para "Fim da semana"
- Campo de motivo (ex: "Feriado de Carnaval")
- Botao "Salvar Excecao"
- Botao "Remover Excecao" (volta ao padrao)

#### 2.3 Hook para ler a excecao

**Novo arquivo**: `src/hooks/useCarrinhoWeekOverride.ts`

Hook que consulta `settings` pela chave `carrinho_week_override` e retorna o range customizado (se existir e for valido para a semana atual) ou `null`.

#### 2.4 Integrar no R2Carrinho

**Arquivo**: `src/pages/crm/R2Carrinho.tsx`

O `weekStart` e `weekEnd` passarao a considerar o override:
- Se houver override ativo para a semana, usa as datas customizadas
- Caso contrario, usa o padrao `getCustomWeekStart/getCustomWeekEnd`

---

## Arquivos Afetados

| Arquivo | Acao |
|---------|------|
| `src/components/crm/CloserAvailabilityConfig.tsx` | Adicionar Domingo ao DAYS_OF_WEEK |
| `src/components/crm/R2CloserAvailabilityConfig.tsx` | Adicionar Domingo ao DAYS_OF_WEEK |
| `src/components/crm/AgendaCalendar.tsx` | Incluir Domingo na grade semanal |
| `src/hooks/useMeetingSuggestion.ts` | Remover bloqueio de Domingo |
| `src/hooks/useCarrinhoWeekOverride.ts` | Novo hook para excecao semanal |
| `src/pages/crm/R2Carrinho.tsx` | Botao de ajuste + integracao com override |

## Fluxo de Uso

```text
Situacao: Feriado na segunda, carrinho movido para terca

1. Admin vai ao Carrinho R2
2. Clica em "Ajustar Semana"  
3. Define inicio: Terca 24/02, fim: Sexta 28/02
4. Motivo: "Feriado de Carnaval"
5. Salva

Resultado: KPIs e listas do Carrinho usam Ter-Sex em vez de Sab-Sex

---

Situacao: Reunioes no Domingo pos-feriado

1. Admin vai em Configuracoes > Disponibilidade do Closer
2. Configura slots para Domingo (via Daily Slots ou config semanal)
3. A grade da Agenda exibe o Domingo com os horarios disponiveis
4. SDR pode agendar reunioes normalmente nesse Domingo
```

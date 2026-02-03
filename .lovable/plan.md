
# Plano: Configurações de Fechamento do Consórcio com Mesma Estrutura do Incorporador

## Situação Atual

A página de configurações do Consórcio (`/consorcio/fechamento/configuracoes`) possui apenas:
- Card de estrutura de compensação padrão (OTE, Fixo, Variável)
- Lista de closers do consórcio
- Tabela de multiplicadores

A página de configurações do Incorporador (`/fechamento-sdr/configuracoes`) possui:
- Aba **Equipe**: Lista completa de colaboradores comerciais (SDRs e Closers) por BU
- Aba **Planos OTE**: Configuração individual de planos por colaborador
- Aba **Métricas Ativas**: Configuração de métricas dinâmicas por mês/cargo/BU
- Aba **Dias Úteis**: Calendário de dias úteis e iFood

## Solução Proposta

Reescrever a página `FechamentoConfig.tsx` do Consórcio para usar a **mesma estrutura de abas**, reutilizando os componentes existentes com o filtro de BU = "consorcio" aplicado.

```text
┌─────────────────────────────────────────────────────────────────────┐
│  Configurações - Fechamento Consórcio                               │
│  Gerencie equipe, planos de compensação e métricas                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────┐ ┌───────────┐ ┌────────────────┐ ┌───────────┐         │
│  │ Equipe  │ │ Planos OTE│ │ Métricas Ativas│ │ Dias Úteis│         │
│  └─────────┘ └───────────┘ └────────────────┘ └───────────┘         │
│                                                                      │
│  ... conteúdo da aba selecionada filtrado por BU = consorcio ...   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Alterações Técnicas

### 1. Atualizar `src/pages/bu-consorcio/FechamentoConfig.tsx`

Transformar a página para ter:

1. **Aba Equipe**: 
   - Filtrar colaboradores por `departamento = 'BU - Consórcio'`
   - Mostrar SDRs e Closers do consórcio
   - Mesma tabela usada no Incorporador (Nome, Departamento, Cargo, Nível, Status, Admissão, Ações)

2. **Aba Planos OTE**:
   - Reutilizar componente `PlansOteTab` existente
   - Aplicar filtro fixo `BU = consorcio`
   - Os colaboradores já são filtrados por departamento no componente

3. **Aba Métricas Ativas**:
   - Reutilizar componente `ActiveMetricsTab` existente
   - Aplicar filtro fixo `squad = consorcio`
   - Permite configurar métricas específicas para SDRs/Closers do Consórcio

4. **Aba Dias Úteis**:
   - Reutilizar componente `WorkingDaysCalendar` existente
   - O calendário é compartilhado entre todas as BUs

### 2. Modificar Componentes Existentes para Aceitar Filtro de BU

Os componentes `PlansOteTab` e `ActiveMetricsTab` já possuem filtro de BU interno. Precisamos criar versões que aceitem uma prop para **pré-selecionar** e **fixar** a BU:

**Opção A (Recomendada)**: Adicionar prop `defaultBU` e `lockBU` aos componentes
- Quando `lockBU=true`, o select de BU fica oculto/desabilitado
- O filtro usa a BU passada via prop

**Opção B**: Criar componente wrapper que passa filtro pré-definido

### 3. Estrutura de Abas

```typescript
<Tabs defaultValue="equipe">
  <TabsList>
    <TabsTrigger value="equipe">
      <Users /> Equipe
    </TabsTrigger>
    <TabsTrigger value="plans">
      <FileText /> Planos OTE
    </TabsTrigger>
    <TabsTrigger value="metricas">
      <Target /> Métricas Ativas
    </TabsTrigger>
    <TabsTrigger value="calendar">
      <Calendar /> Dias Úteis
    </TabsTrigger>
  </TabsList>

  <TabsContent value="equipe">
    {/* Lista de colaboradores do consórcio */}
  </TabsContent>

  <TabsContent value="plans">
    <PlansOteTab defaultBU="consorcio" lockBU />
  </TabsContent>

  <TabsContent value="metricas">
    <ActiveMetricsTab defaultBU="consorcio" lockBU />
  </TabsContent>

  <TabsContent value="calendar">
    <WorkingDaysCalendar />
  </TabsContent>
</Tabs>
```

## Arquivos a Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/pages/bu-consorcio/FechamentoConfig.tsx` | Reescrever | Implementar estrutura completa de abas |
| `src/components/fechamento/PlansOteTab.tsx` | Modificar | Adicionar props `defaultBU` e `lockBU` opcionais |
| `src/components/fechamento/ActiveMetricsTab.tsx` | Modificar | Adicionar props `defaultBU` e `lockBU` opcionais |

## Detalhes da Aba Equipe (Consórcio)

A aba mostrará apenas colaboradores do Consórcio com as colunas:
- Nome Completo
- Departamento (badge mostrando "Consórcio")
- Cargo (do catálogo)
- Nível (N1, N2, etc)
- Status (Ativo/Inativo)
- Data de Admissão
- Ações (link para editar no RH)

Filtro aplicado:
```typescript
employees.filter(emp => 
  emp.departamento === 'BU - Consórcio'
)
```

## Resultado Esperado

Após a implementação, a página `/consorcio/fechamento/configuracoes` terá:

1. **Mesma aparência** da página de configurações do Incorporador
2. **Dados filtrados** para a BU Consórcio apenas
3. **Métricas configuráveis** específicas para cada cargo do Consórcio
4. **Planos OTE individuais** para cada colaborador do Consórcio
5. **Calendário de dias úteis** compartilhado

Isso permite que cada BU tenha suas próprias configurações de métricas e pesos, mantendo flexibilidade para diferentes estruturas de compensação.

## Resumo da Implementação

1. **FechamentoConfig.tsx**: Reescrever com Tabs completas e aba Equipe filtrada por BU = Consórcio
2. **PlansOteTab.tsx**: Adicionar props opcionais para fixar BU
3. **ActiveMetricsTab.tsx**: Adicionar props opcionais para fixar BU

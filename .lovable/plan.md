
# Plano: CRM Dedicado para Cada Business Unit

## Objetivo

Replicar a estrutura completa do CRM (atualmente em `/crm`) para cada Business Unit, de forma que cada BU tenha seu próprio módulo CRM com:

- Visão Geral
- Contatos
- Negócios (Kanban)
- Atendimentos  
- Agenda R1
- Agenda R2
- Carrinho R2
- Órfãos
- Duplicados
- Auditoria
- Configurações

---

## Situação Atual

```text
📁 /crm (CRM centralizado - atualmente usado pela BU Incorporador)
   ├── Visão Geral
   ├── Contatos
   ├── Negócios
   ├── Atendimentos
   ├── Agenda R1
   ├── Agenda R2
   ├── Carrinho R2
   ├── Órfãos
   ├── Duplicados
   ├── Auditoria
   └── Configurações

📁 /consorcio
   ├── Fechamento
   ├── CRM ← placeholder "Em Desenvolvimento"
   ├── Painel Equipe
   ├── Vendas
   ├── Controle Consorcio
   └── Importar
```

---

## Abordagem: CRM Unificado com Contexto de BU

Em vez de duplicar todo o código do CRM para cada BU (que criaria manutenção exponencial), a solução é criar um **CRM genérico parametrizado por BU**.

### Arquitetura Proposta

```text
📁 /crm                          → CRM da BU Incorporador (mantido como está)
📁 /consorcio/crm/*              → CRM da BU Consórcio (novo)
📁 /bu-credito/crm/*             → CRM da BU Crédito (novo)
📁 /bu-projetos/crm/*            → CRM da BU Projetos (novo)
📁 /leilao/crm/*                 → CRM da BU Leilão (novo)
```

Cada rota `/bu-X/crm` usará o **mesmo conjunto de componentes** do CRM existente, mas com um **contexto de BU** que:

1. Filtra automaticamente os pipelines/origens para aquela BU
2. Filtra as reuniões (Agenda) para closers daquela BU
3. Filtra o carrinho R2 para negócios daquela BU

---

## Implementação Detalhada

### Fase 1: Criar Componente CRM Genérico com Contexto de BU

**Novo arquivo**: `src/contexts/BUContext.tsx`

```typescript
// Contexto que define qual BU está ativa na rota atual
export const BUContext = createContext<{
  activeBU: BusinessUnit | null;
  isGlobalCRM: boolean; // true se for /crm (vê tudo)
}>({ activeBU: null, isGlobalCRM: true });
```

### Fase 2: Criar Layout CRM Parametrizado

**Novo arquivo**: `src/pages/crm/BUCRMLayout.tsx`

Este componente será um wrapper que:
- Recebe a BU como prop
- Configura o contexto
- Renderiza as mesmas tabs do CRM atual

```typescript
interface BUCRMLayoutProps {
  bu: BusinessUnit;
  basePath: string; // ex: "/consorcio/crm"
}
```

### Fase 3: Configurar Rotas para Cada BU

**Arquivo**: `src/App.tsx`

Adicionar rotas para cada BU apontando para o mesmo conjunto de componentes:

```typescript
// BU Consórcio CRM
<Route path="consorcio/crm" element={<BUCRMLayout bu="consorcio" basePath="/consorcio/crm" />}>
  <Route index element={<CRMOverview />} />
  <Route path="contatos" element={<Contatos />} />
  <Route path="negocios" element={<Negocios />} />
  <Route path="agenda" element={<Agenda />} />
  <Route path="agenda-r2" element={<AgendaR2 />} />
  <Route path="r2-carrinho" element={<R2Carrinho />} />
  {/* ... demais rotas */}
</Route>
```

### Fase 4: Adaptar Componentes para Usar Contexto de BU

Os componentes que precisam de adaptação:

| Componente | Adaptação Necessária |
|------------|---------------------|
| `Negocios.tsx` | Já usa `useMyBU()` - precisa respeitar contexto forçado |
| `Agenda.tsx` | Filtrar closers por BU |
| `AgendaR2.tsx` | Filtrar closers R2 por BU |
| `R2Carrinho.tsx` | Filtrar carrinho por BU |
| `Overview.tsx` | Filtrar estatísticas por BU |

A adaptação será adicionar um hook:

```typescript
// Hook que retorna a BU ativa (do contexto ou do usuário)
function useActiveBU() {
  const contextBU = useContext(BUContext);
  const { data: userBU } = useMyBU();
  
  // Se estiver em rota de BU específica, usar essa
  // Senão, usar a BU do usuário
  return contextBU.activeBU || userBU;
}
```

### Fase 5: Adicionar Associação Closer x BU

Para filtrar reuniões por BU, precisamos saber qual closer pertence a qual BU.

**Alteração no banco**: Adicionar coluna `bu` na tabela `closers`

```sql
ALTER TABLE closers ADD COLUMN bu TEXT;
-- Valores: 'incorporador', 'consorcio', 'credito', 'projetos', 'leilao'
```

Isso permitirá que as Agendas R1/R2 filtrem:
- `/crm/agenda` → Mostra closers da BU Incorporador
- `/consorcio/crm/agenda` → Mostra closers da BU Consórcio

---

## Resumo de Arquivos a Criar/Modificar

### Novos Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `src/contexts/BUContext.tsx` | Contexto de BU ativa |
| `src/pages/crm/BUCRMLayout.tsx` | Layout CRM genérico parametrizado |
| `src/hooks/useActiveBU.ts` | Hook para obter BU ativa |

### Arquivos a Modificar

| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Adicionar rotas CRM para cada BU |
| `src/components/layout/AppSidebar.tsx` | Atualizar links do menu |
| `src/pages/crm/Negocios.tsx` | Usar `useActiveBU` |
| `src/pages/crm/Agenda.tsx` | Filtrar closers por BU |
| `src/pages/crm/AgendaR2.tsx` | Filtrar closers R2 por BU |
| `src/pages/crm/R2Carrinho.tsx` | Filtrar por BU |
| `src/pages/crm/Overview.tsx` | Filtrar estatísticas por BU |

### Migração de Banco

```sql
-- Adicionar coluna BU aos closers
ALTER TABLE closers ADD COLUMN IF NOT EXISTS bu TEXT;

-- Opcional: Popular baseado em padrões existentes
UPDATE closers SET bu = 'incorporador' WHERE bu IS NULL;
```

---

## Cronograma de Implementação

| Etapa | Descrição | Complexidade |
|-------|-----------|--------------|
| 1 | Criar BUContext e useActiveBU | Baixa |
| 2 | Criar BUCRMLayout | Média |
| 3 | Configurar rotas no App.tsx | Baixa |
| 4 | Adaptar Negocios.tsx | Baixa |
| 5 | Adaptar Agenda.tsx e AgendaR2.tsx | Média |
| 6 | Adaptar R2Carrinho.tsx | Média |
| 7 | Adaptar Overview.tsx | Baixa |
| 8 | Atualizar sidebar com novos links | Baixa |
| 9 | Migração banco (closers.bu) | Baixa |

---

## Resultado Final

Após implementação, cada BU terá seu CRM completo:

```text
/consorcio/crm              → Visão Geral (filtrada)
/consorcio/crm/contatos     → Contatos (filtrados por origem)
/consorcio/crm/negocios     → Kanban (pipelines do consórcio)
/consorcio/crm/agenda       → Agenda R1 (closers do consórcio)
/consorcio/crm/agenda-r2    → Agenda R2 (closers R2 do consórcio)
/consorcio/crm/r2-carrinho  → Carrinho R2 (negócios do consórcio)
...

/leilao/crm                 → CRM da BU Leilão
/bu-credito/crm             → CRM da BU Crédito
/bu-projetos/crm            → CRM da BU Projetos
```

---

## Próximos Passos

Confirme se deseja prosseguir com esta abordagem e posso começar a implementação fase por fase, começando pelo contexto de BU e layout genérico.

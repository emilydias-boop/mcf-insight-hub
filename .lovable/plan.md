# CRM Dedicado por Business Unit - IMPLEMENTADO ✅

## Status: Concluído

Cada Business Unit (Consórcio, Crédito, Projetos, Leilão) agora possui seu próprio CRM completo, com as mesmas funcionalidades do CRM principal (Incorporador).

---

## Arquitetura Implementada

### Estrutura de Rotas

```text
📁 /crm                          → CRM da BU Incorporador (original)
📁 /consorcio/crm/*              → CRM da BU Consórcio ✅
📁 /bu-credito/crm/*             → CRM da BU Crédito ✅
📁 /bu-projetos/crm/*            → CRM da BU Projetos ✅
📁 /leilao/crm/*                 → CRM da BU Leilão ✅
```

### Componentes Criados

| Arquivo | Descrição |
|---------|-----------|
| `src/contexts/BUContext.tsx` | Contexto que define a BU ativa na rota |
| `src/hooks/useActiveBU.ts` | Hook para obter a BU ativa (contexto ou perfil) |
| `src/pages/crm/BUCRMLayout.tsx` | Layout wrapper para CRMs de BU específica |

### Arquivos Modificados

| Arquivo | Modificação |
|---------|-------------|
| `src/App.tsx` | Rotas CRM para cada BU com sub-rotas aninhadas |
| `src/components/layout/AppSidebar.tsx` | Links CRM nas BUs de Crédito, Projetos e Leilão |
| `src/hooks/useMyBU.ts` | Tipo BusinessUnit inclui 'leilao' |
| `src/hooks/useGestorClosers.ts` | Filtro por BU ativa |
| `src/hooks/useAgendaData.ts` | `useClosersWithAvailability(buFilter)` |
| `src/hooks/useR2Closers.ts` | `useActiveR2Closers(buFilter)` e `useR2ClosersList(buFilter)` |
| `src/pages/crm/Agenda.tsx` | Usa `useActiveBU()` para filtrar closers |
| `src/pages/crm/AgendaR2.tsx` | Usa `useActiveBU()` para filtrar closers R2 |
| `src/pages/crm/R2Carrinho.tsx` | Importa `useActiveBU` (preparado para filtros futuros) |

### Migração de Banco

```sql
ALTER TABLE closers ADD COLUMN IF NOT EXISTS bu TEXT;
COMMENT ON COLUMN closers.bu IS 'Business Unit: incorporador, consorcio, credito, projetos, leilao';
UPDATE closers SET bu = 'incorporador' WHERE bu IS NULL;
```

---

## Como Funciona

1. **Navegação**: Cada BU no sidebar tem um link "CRM" que leva ao seu CRM dedicado
2. **Contexto**: O `BUCRMLayout` envolve as rotas e injeta a BU no contexto
3. **Filtragem**: Os hooks de closers e agendas usam `useActiveBU()` para filtrar dados
4. **Componentes Reutilizados**: Os mesmos componentes CRM são usados, apenas com filtros diferentes

---

## Próximos Passos (Opcionais)

- [ ] Atribuir closers existentes às suas respectivas BUs via interface admin
- [ ] Filtrar reuniões por BU na agenda (além de filtrar closers)
- [ ] Filtrar deals/negócios por BU automaticamente
- [ ] Criar dashboard de métricas por BU

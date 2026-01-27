
# Plano: Corrigir Layout das Linhas com Order Bumps

## Problema Identificado

As transações com order bumps (badge `+1 bump`, `+2 bumps`) aparecem com layout **diferente e desalinhado** das demais linhas porque:

1. O componente `Collapsible` do Radix UI é inserido entre `<tbody>` e `<tr>`, quebrando a semântica HTML de tabelas
2. O `CollapsibleTrigger asChild` adiciona propriedades e comportamentos extras ao `TableRow`
3. O `CollapsibleContent` não renderiza corretamente como parte da tabela

**Resultado visual:** Colunas desalinhadas e aparência inconsistente entre linhas com/sem bumps.

## Solução Proposta

Remover o uso do `Collapsible` e implementar a expansão de forma **nativa com estado local**, garantindo que todos os elementos sejam `<tr>` diretos dentro do `<tbody>`.

## Alterações Técnicas

### Arquivo: `src/components/incorporador/TransactionGroupRow.tsx`

**Mudança principal:** Substituir o `Collapsible/CollapsibleTrigger/CollapsibleContent` por renderização condicional direta.

**Antes (problemático):**
```tsx
return (
  <Collapsible open={isOpen} onOpenChange={setIsOpen}>
    <CollapsibleTrigger asChild>
      <MainRow />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <ExpandedRows />
    </CollapsibleContent>
  </Collapsible>
);
```

**Depois (corrigido):**
```tsx
return (
  <>
    <MainRow />
    {isOpen && <ExpandedRows />}
  </>
);
```

### Detalhes da Implementação

1. **Remover imports do Collapsible:**
   - Remover: `import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';`

2. **Simplificar o retorno do componente:**
   - Usar React Fragment (`<>...</>`) para retornar múltiplos `TableRow`
   - Renderizar `ExpandedRows` condicionalmente com `{isOpen && <ExpandedRows />}`

3. **Manter a interação de clique:**
   - O `onClick` no `MainRow` já alterna `isOpen` via `setIsOpen(!isOpen)`
   - Nenhuma mudança necessária no comportamento

## Código Final Simplificado

```tsx
// Remover este import
// import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// ... resto do código permanece igual ...

// Alterar apenas o return final (linhas 320-333):
if (!hasOrderBumps) {
  return <MainRow />;
}

return (
  <>
    <MainRow />
    {isOpen && <ExpandedRows />}
  </>
);
```

## Resultado Esperado

| Antes | Depois |
|-------|--------|
| Linhas com bumps desalinhadas | Todas as linhas com layout uniforme |
| Collapsible quebra semântica HTML | Tabela semanticamente correta |
| Transição/animação inconsistente | Expansão instantânea e limpa |

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/incorporador/TransactionGroupRow.tsx` | Substituir Collapsible por renderização condicional |

## Impacto

- **Zero impacto na lógica de negócio** - apenas mudança visual/estrutural
- **Comportamento mantido** - clique ainda expande/colapsa os bumps
- **Performance igual ou melhor** - sem overhead do Radix Collapsible

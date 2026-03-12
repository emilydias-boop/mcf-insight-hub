

## Tornar o card "Faturamento por Closer" expansível/colapsável

O card inteiro será colapsável usando o componente `Collapsible` já existente no projeto. O header ficará sempre visível (com título + um resumo compacto tipo "12 transações · R$ 450.000") e ao clicar expande/colapsa a tabela completa.

### Mudanças em `src/components/relatorios/CloserRevenueSummaryTable.tsx`

1. Importar `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` de `@/components/ui/collapsible`
2. Importar `ChevronDown` de `lucide-react`
3. Adicionar state `isOpen` (default `false` para começar colapsado)
4. Envolver o `<Card>` com `<Collapsible open={isOpen} onOpenChange={setIsOpen}>`
5. O `<CardHeader>` vira o `<CollapsibleTrigger>` — clicável, com:
   - Título "Faturamento por Closer"
   - Badge resumo: total de transações + faturamento bruto total (visível mesmo colapsado)
   - Ícone chevron que rotaciona ao expandir
6. O `<CardContent>` (com a tabela) fica dentro do `<CollapsibleContent>`
7. O dialog de detalhes continua funcionando normalmente quando expandido

Resultado: o usuário vê o resumo rápido no header e expande só quando precisa ver o detalhe por closer.


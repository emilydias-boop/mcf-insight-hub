
# Plano: Incluir Reembolsos nas Listas de Vendas com Badge de Alerta

## Problema Atual

As funções RPC de transações filtram **somente** `sale_status = 'completed'`, o que **remove completamente** as vendas reembolsadas das listas:

```sql
-- Filtro atual nas RPCs (excluindo reembolsos)
WHERE ht.sale_status = 'completed'
```

Isso faz com que uma venda que entrou no dia, mas depois foi reembolsada, simplesmente **desapareça** da lista.

## Comportamento Desejado

- **Manter** transações reembolsadas na lista (não remover)
- **Alertar visualmente** com um badge vermelho ou destacar a linha
- Seguir o padrão já existente na página `A010.tsx` (Receita):
  - Badge vermelho "Reembolso" ao lado do nome
  - Linha com fundo levemente vermelho

## Solução

### 1. Atualizar Funções RPC (SQL)

Modificar ambas as funções para incluir `refunded`:

**Arquivo:** `supabase/migrations/XXXXXXXX_include_refunded_in_transactions.sql`

```sql
-- get_all_hubla_transactions
WHERE ht.sale_status IN ('completed', 'refunded')

-- get_hubla_transactions_by_bu
WHERE ht.sale_status IN ('completed', 'refunded')
```

### 2. Atualizar Página BU Incorporador

**Arquivo:** `src/pages/bu-incorporador/TransacoesIncorp.tsx`

Adicionar na coluna "Cliente":
- Badge vermelho "Reembolso" quando `sale_status === 'refunded'`
- Estilo visual na linha (fundo avermelhado)

```tsx
<TableRow 
  key={t.id}
  className={t.sale_status === 'refunded' ? 'bg-destructive/10' : ''}
>
  <TableCell>
    <div className="max-w-[180px]">
      <div className="flex items-center gap-2">
        <span className="truncate font-medium">{t.customer_name || '-'}</span>
        {t.sale_status === 'refunded' && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            Reembolso
          </Badge>
        )}
      </div>
      <div className="truncate text-xs text-muted-foreground">
        {t.customer_email || '-'}
      </div>
    </div>
  </TableCell>
</TableRow>
```

### 3. Atualizar Páginas das Outras BUs

Aplicar a mesma lógica em:

| BU | Arquivo |
|----|---------|
| Consórcio | `src/pages/bu-consorcio/Vendas.tsx` |
| Crédito | `src/pages/bu-credito/Vendas.tsx` |
| Projetos | `src/pages/bu-projetos/Vendas.tsx` (se existir) |
| Outros | `src/pages/bu-outros/Vendas.tsx` (se existir) |

### 4. Atualizar Interface do HublaTransaction

**Arquivo:** `src/hooks/useAllHublaTransactions.ts`

O campo `sale_status` já existe na interface, apenas garantir que está sendo utilizado.

## Resultado Visual Esperado

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ Data          │ Produto        │ Cliente                    │ Bruto     │
├──────────────────────────────────────────────────────────────────────────┤
│ 27/01/26 10:22│ A010 - Consul..│ Andrei Vinnicius da Silva  │ R$ 47,00  │
│ 27/01/26 09:27│ A010 - Consul..│ Marilene Maura vieira      │ R$ 47,00  │
│ 27/01/26 08:56│ A010 - Consul..│ Thayná Ferreira [Reembolso]│ R$ 47,00  │ ← Linha vermelha claro
│ 27/01/26 08:39│ A010 - Consul..│ Suzi Kenne                 │ R$ 47,00  │
└──────────────────────────────────────────────────────────────────────────┘
```

## Arquivos a Modificar

| Arquivo | Tipo | Descrição |
|---------|------|-----------|
| Nova migration SQL | Criar | Atualizar RPCs para incluir `refunded` |
| `src/pages/bu-incorporador/TransacoesIncorp.tsx` | Modificar | Adicionar badge e estilo de linha |
| `src/pages/bu-consorcio/Vendas.tsx` | Modificar | Adicionar badge e estilo de linha |
| `src/pages/bu-credito/Vendas.tsx` | Modificar | Adicionar badge e estilo de linha |

## Impacto nos KPIs

- Os **totais bruto/líquido** continuarão somando os valores (inclusive reembolsos)
- Se desejar, podemos ajustar para:
  - Subtrair reembolsos do bruto
  - Manter linha separada "Reembolsados: X transações (R$ Y)"
- Por enquanto, mantemos a exibição simples com badge

## Considerações

1. **Não remove** da lista - apenas alerta visualmente
2. **Padrão consistente** com a página A010.tsx que já funciona assim
3. **Badge discreto** ao lado do nome, não ocupa coluna extra
4. **Exportação** continuará incluindo essas transações (com status visível)



# Simplificar Ações da Tabela de Pagamentos Consórcio

## Mudanças

### `src/components/consorcio/pagamentos/PagamentosTable.tsx`

1. **Linha clicável**: Adicionar `onClick={() => onViewDetail(row)}` e `cursor-pointer` no `TableRow` para abrir o drawer de detalhes ao clicar em qualquer célula da linha.

2. **Remover dropdown (3 pontos)**: Eliminar completamente o `DropdownMenu` com `MoreHorizontal`. O botão de "Marcar como paga" (CheckCircle) já existe isolado e é suficiente. A coluna "Ações" passa a ter apenas esse botão.

3. **Boleto clicável**: Na coluna "Boleto", quando há boleto (`boletoInstallmentIds.has(row.id)`), transformar o ícone `FileText` em um botão clicável que abre o PDF do boleto diretamente. Para isso:
   - Criar um mapa `boletosByInstallment` (installment_id → boleto) a partir dos boletos carregados
   - Usar `useBoletoSignedUrl` não é viável por boleto individual (muitos hooks). Em vez disso, ao clicar no ícone de boleto, abrir o drawer de detalhes (mesmo `onViewDetail`) onde o PDF já está acessível via `BoletoSection`.
   - **Alternativa mais prática**: Fazer o ícone de boleto buscar o `storage_path` do boleto correspondente e gerar a URL assinada on-click via `supabase.storage.from('consorcio-boletos').createSignedUrl(path, 300)` para abrir em nova aba.

4. **Prevenir conflito de clique**: Nos botões de ação (CheckCircle e Boleto), usar `e.stopPropagation()` para que o clique no botão não dispare o `onViewDetail` da linha.

### Resultado
- Clicar na linha → abre drawer de detalhes
- Clicar no ícone de boleto → abre PDF em nova aba
- Clicar no CheckCircle → marca como paga
- Dropdown de 3 pontos removido (redundante)



# Tornar a linha inteira clicavel na tabela Pos-Reuniao

## Resumo
Mudar o comportamento das 3 tabelas (Realizadas, Propostas, Sem Sucesso) para que clicar em qualquer lugar da linha (exceto nos botoes de acao) abra o drawer com os detalhes do lead.

## O que muda

### Arquivo: `src/pages/crm/PosReuniao.tsx`

Em cada uma das 3 tabs:

1. Remover o `<Button variant="link">` que envolve o nome do contato - o nome volta a ser texto simples
2. Adicionar `onClick={() => setSelectedDealId(deal_id)}` e `className="cursor-pointer hover:bg-muted/50"` no `<TableRow>`
3. Na celula de acoes, adicionar `e.stopPropagation()` nos botoes para que clicar neles nao abra o drawer

Resultado: a linha inteira fica clicavel e com efeito hover, mas os botoes de acao continuam funcionando normalmente.

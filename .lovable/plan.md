
# Restringir visibilidade do Fechamento para SDRs

## Problema

Dois problemas identificados:

1. **Detail page sem restrição**: A página `/fechamento-sdr/:id` exibe o fechamento completo para qualquer usuário, incluindo SDRs. Um SDR pode acessar diretamente a URL e ver payouts em DRAFT (não aprovados). A variável `isReadOnly` existe mas só esconde botões de ação — não bloqueia a visualização dos dados.

2. **MeuFechamento não preserva mês**: Quando o SDR seleciona janeiro, clica "Ver Detalhes" e volta, o `selectedMonth` reseta para o mês atual porque é state local sem persistência na URL.

## Solução

### Arquivo 1: `src/pages/fechamento-sdr/Detail.tsx`

Adicionar bloqueio para SDRs tentando ver payouts DRAFT:

- Após a verificação `if (!payout)`, adicionar uma checagem: se `isReadOnly && payout.status === 'DRAFT'`, renderizar mensagem "Fechamento ainda não disponível" com botão de voltar
- SDRs só podem ver payouts com status APPROVED ou LOCKED

### Arquivo 2: `src/pages/fechamento-sdr/MeuFechamento.tsx`

Preservar o mês selecionado na navegação:

1. Importar `useSearchParams`
2. Inicializar `selectedMonth` a partir de `searchParams.get('month')` (com fallback para mês atual)
3. No `handleViewDetails`, navegar com `?from=${selectedMonth}` para o Detail saber de onde veio
4. Ao voltar do Detail, usar o parâmetro `from` para restaurar o mês (isso já funciona no Detail → lista de equipe, mas precisa funcionar no Detail → MeuFechamento)

Como o MeuFechamento não recebe `from` de volta (o botão voltar do Detail vai para `/fechamento-sdr`, não `/meu-fechamento`), a solução mais simples é usar `searchParams` na URL do MeuFechamento para persistir o mês:
- Trocar `useState(currentMonth)` por sincronização com `?month=` na URL
- `handleViewDetails` passa `?from=${selectedMonth}&source=meu-fechamento` para o Detail
- No Detail, o botão voltar detecta `source=meu-fechamento` e navega para `/meu-fechamento?month=${fromMonth}`

## Resultado esperado
- SDR seleciona março (DRAFT): vê "Fechamento ainda não disponível"
- SDR seleciona janeiro (APPROVED): vê normalmente, clica "Ver Detalhes", volta e continua em janeiro
- Admin/Manager: sem alteração de comportamento

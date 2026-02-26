

## Corrigir rota do botão Voltar

O botão "Voltar" navega para `/fechamento-sdr/equipe`, mas essa rota não existe. A rota correta é `/fechamento-sdr`. O texto "equipe" está sendo capturado pelo parâmetro `:payoutId`, resultando em "Fechamento não encontrado".

### Correção
Em `src/pages/fechamento-sdr/Configuracoes.tsx`, alterar o `navigate('/fechamento-sdr/equipe')` para `navigate('/fechamento-sdr')`.


# Meta de Cobrança em aba própria + abertura em Modo TV

## O que muda para o usuário
- Nova aba **Meta de Cobrança**, primeira da lista, antes de **Cobranças Regulares**. Todo o painel de meta (cartões, barra de ritmo, semanas, ranking de cobradores, Configurar meta e botão Modo TV) sai do topo da página e passa a ficar só nessa aba.
- Ao entrar em Financeiro > A receber, a tela abre direto no **Modo TV** com a meta da área.
- Ao fechar o Modo TV (botão fechar ou Esc), o usuário cai em **Cobranças Regulares**.
- O botão Modo TV dentro da aba continua funcionando; fechá-lo ali mantém o usuário na aba Meta de Cobrança.
- O Modo TV automático abre uma vez por entrada na página (não reabre ao trocar de aba).

## Detalhes técnicos
- `AReceber.tsx`: adicionar `['meta', 'Meta de Cobrança']` no início de `ABAS`; remover `<MetaCobrancaPainel>` do topo e renderizá-lo em `<TabsContent value="meta">`. `aba` inicia em `'listagem'`.
- `MetaCobrancaPainel`: novas props opcionais `tvInicial?: boolean` e `onFecharTv?: () => void`. Estado `tv` inicia com `tvInicial`; no fechar chama `setTv(false)` e `onFecharTv?.()`.
- Para abrir o TV já na entrada sem depender da aba montada, `AReceber` mantém `tvEntrada` (true ao montar) e monta o painel em modo TV fora das abas enquanto `tvEntrada` for true; ao fechar: `tvEntrada=false` e `setAba('listagem')`.
- Sem mudanças em banco, cálculos ou outras abas.



## Alerta de atualização do sistema

### Abordagem

Criar um componente global que periodicamente (a cada 60s) faz um `HEAD` request para `/index.html` comparando o `ETag` ou `Last-Modified` header. Quando detecta mudança, exibe um banner fixo no topo da tela informando que há uma nova versão disponível, com botão para recarregar a página.

### Alterações

**1. Novo arquivo `src/components/layout/UpdateNotifier.tsx`**
- Hook `useUpdateChecker` que a cada 60 segundos faz `fetch('/index.html', { cache: 'no-store' })` e compara o `ETag` ou o tamanho/conteúdo do response
- Na primeira execução, salva o valor inicial como referência
- Quando detecta diferença, seta `updateAvailable = true`
- Renderiza um banner fixo (z-50, top-0) com mensagem "Nova versão disponível" e botão "Atualizar" que faz `window.location.reload()`

**2. `src/App.tsx`**
- Importar e renderizar `<UpdateNotifier />` dentro do layout principal, junto com `<Toaster />` e `<Sonner />`

### Resultado

Quando um novo deploy é feito, os usuários com a aba aberta verão um banner discreto no topo da tela pedindo para atualizar, sem perder o contexto do que estavam fazendo.


# Canal de entrada no kanban

## Implementação
- Trocar apenas o seletor legado de canal pelo catálogo retornado pelo banco, preservando todos os demais filtros.
- Enviar `canalEntrada` às RPCs e carregar as opções com contagens pela nova RPC.
- Inicializar, limpar e exibir o filtro ativo na página de negócios.
- Mostrar nos cartões o rótulo e a cor de entrada fornecidos pelo servidor, mantendo o badge legado como fallback.
- Repassar os novos campos da página da coluna ao cartão.

## Validação
- Confirmar por diff que somente os cinco arquivos solicitados mudaram.
- Rodar typecheck e build.
- Conferir que os filtros listados e `getChannelBadge` permaneceram intactos.

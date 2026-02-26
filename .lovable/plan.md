

## Plano: Alinhar layout do Efeito Alavanca com os demais setores

### Problema atual
O card "Efeito Alavanca" no Painel do Diretor usa um layout diferente (apenas "Total em Cartas" e "Comissão Total" sem barra de progresso), enquanto o card "BU Consórcio" no Painel Equipe mostra o formato padrão com barra de progresso, Apurado/Meta e percentual.

### Correção

**Arquivo: `src/components/dashboard/EfeitoAlavancaRow.tsx`**

Refatorar o componente para seguir o mesmo padrão visual do `SetorRow`:
- Adicionar barra de progresso (`Progress`) com cores por nível (verde ≥80%, amarelo ≥50%, vermelho <50%)
- Mostrar Apurado (valor em cartas) vs Meta com percentual
- Manter a linha de "Comissão Total" abaixo de cada período como informação complementar
- Receber props de `metaSemanal`, `metaMensal`, `metaAnual` (já vêm do hook via `setor.metaSemanal` etc.)

**Arquivo: `src/pages/Dashboard.tsx`**

Passar as props de meta para o `EfeitoAlavancaRow`:
- `metaSemanal={setor.metaSemanal}`
- `metaMensal={setor.metaMensal}`
- `metaAnual={setor.metaAnual}`

As metas já compartilham o prefixo `setor_efeito_alavanca` em ambos os painéis, então editar em um atualiza o outro automaticamente.


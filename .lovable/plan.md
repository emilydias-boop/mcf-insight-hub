

## Adicionar botão "Voltar" na página de Configurações

### Problema
A página de Configurações de Fechamento (`/fechamento-sdr/configuracoes`) não tem um botão para voltar à tela de Fechamento Equipe.

### Implementação
No header da página (`Configuracoes.tsx`), adicionar um botão com ícone de seta à esquerda do título que navega para `/fechamento-sdr/equipe`:

- Importar `ArrowLeft` do lucide-react
- Adicionar `<Button variant="ghost" onClick={() => navigate('/fechamento-sdr/equipe')}>` com ícone `ArrowLeft` antes do título "Configurações de Fechamento"

Alteração em 1 arquivo: `src/pages/fechamento-sdr/Configuracoes.tsx`


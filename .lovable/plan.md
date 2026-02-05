
# Ocultar Fechamentos em Rascunho

## Objetivo
Impedir que SDRs e Closers vejam seu fechamento quando ele ainda está em status "Rascunho" (DRAFT). O fechamento só será visível quando o gestor aprovar (status APPROVED ou LOCKED).

## O que será alterado

### Arquivo: `src/pages/fechamento-sdr/MeuFechamento.tsx`

A lógica atual mostra o payout independente do status. Vamos criar uma variável que só considera o payout como "visível" se ele não estiver em DRAFT:

```text
ANTES:
{!payout ? (
  <Card> Nenhum fechamento encontrado </Card>
) : (
  // Mostra o fechamento completo
)}

DEPOIS:
// Filtrar: só mostra se NÃO for DRAFT
const visiblePayout = payout?.status !== 'DRAFT' ? payout : null;

{!visiblePayout ? (
  <Card> Nenhum fechamento encontrado </Card>
) : (
  // Mostra o fechamento completo
)}
```

## Comportamento Esperado

| Status do Payout | Comportamento na tela "Meu Fechamento" |
|------------------|----------------------------------------|
| **DRAFT** (Rascunho) | Mostra "Nenhum fechamento encontrado para [mês]" |
| **APPROVED** (Aprovado) | Mostra o fechamento completo + opção de enviar NFSe |
| **LOCKED** (Travado) | Mostra o fechamento completo |

## Impacto
- **SDRs e Closers**: Não verão mais fechamentos em rascunho
- **Gestores/Admins**: Continuam podendo editar e aprovar os fechamentos normalmente via `/fechamento-sdr`
- **Página de detalhes**: A navegação direta para `/fechamento-sdr/:id` ainda funcionará (para gestores), mas o botão "Ver Detalhes" não aparecerá para o próprio usuário enquanto estiver em DRAFT

## Detalhes Técnicos
- Apenas uma variável derivada será adicionada: `const visiblePayout = payout?.status !== 'DRAFT' ? payout : null;`
- Todas as referências a `payout` no render serão substituídas por `visiblePayout`
- O modal de NFSe também usará `visiblePayout` para garantir consistência

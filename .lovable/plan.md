

# Corrigir Seleção por Quantidade de Leads

## Problema

Ao digitar uma quantidade (ex: 20) no input de um estágio, a função não funciona corretamente porque o handler `handleSelectByCountInStage` apenas **adiciona** os primeiros N deals ao conjunto de selecionados, sem **remover** os deals do estágio que já estavam selecionados antes.

Exemplo: se 97 leads estão selecionados e o usuário digita 20, o resultado continua sendo 97 porque os 20 são adicionados a um Set que já contém os 97.

## Solução

Modificar o handler para primeiro **limpar** todos os deals daquele estágio do Set, e depois adicionar apenas os primeiros N.

## Seção Técnica

### Arquivo a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/pages/crm/Negocios.tsx` | Corrigir `handleSelectByCountInStage` (linhas 323-330) |

### Código Atual (com bug)

```text
const handleSelectByCountInStage = (dealIds: string[], count: number) => {
  setSelectedDealIds(prev => {
    const newSet = new Set(prev);
    dealIds.slice(0, count).forEach(id => newSet.add(id));
    return newSet;
  });
};
```

### Código Corrigido

```text
const handleSelectByCountInStage = (dealIds: string[], count: number) => {
  setSelectedDealIds(prev => {
    const newSet = new Set(prev);
    // Primeiro: remover todos os deals deste estágio
    dealIds.forEach(id => newSet.delete(id));
    // Depois: adicionar apenas os primeiros N
    dealIds.slice(0, count).forEach(id => newSet.add(id));
    return newSet;
  });
};
```

### Resultado Esperado

Ao digitar 20 no input do estágio "VENDA REALIZADA 50K" e pressionar Enter, exatamente 20 leads serão selecionados naquele estágio (os mais antigos, conforme a ordenação por `stage_moved_at`).


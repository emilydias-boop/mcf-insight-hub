

## Plano: Corrigir "Pendentes Hoje" para filtrar pela BU correta

### Causa raiz

A rota `/crm/reunioes-equipe` esta fora do `BUProvider` que define `bu="incorporador"`. O `useActiveBU()` retorna o squad do usuario logado (ex: `"outro"` para Emily), e o hook `useMeetingsPendentesHoje` filtra closers com esse squad — que nao retorna nenhum resultado.

### Alteracao

**`src/pages/crm/ReunioesEquipe.tsx`** (linha 295)

Passar `'incorporador'` diretamente ao hook:

```ts
// De:
const { data: pendentesHoje } = useMeetingsPendentesHoje(activeBU || 'incorporador');

// Para:
const { data: pendentesHoje } = useMeetingsPendentesHoje('incorporador');
```

Esta pagina opera exclusivamente no contexto do incorporador (rota `/crm`), entao o filtro deve ser explicito.


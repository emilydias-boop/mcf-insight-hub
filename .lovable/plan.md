

## Fix: Tags exibindo IDs em vez de nomes no Controle Diego

### Problema
As tags em `crm_contacts.tags` são um array `text[]` onde alguns elementos são strings puras (ex: `"A010 Hubla"`) e outros são **JSON stringificado** (ex: `'{"id":"00596262...","name":"pastor","color":"#2196f3"}'`). O código atual tenta `t?.name`, mas como são strings e não objetos, o fallback retorna a string crua — mostrando o JSON inteiro com o ID.

### Solução
Corrigir a extração de tags em **2 arquivos** para parsear JSON quando necessário:

**1. `src/hooks/useContractReport.ts` (linha ~293-294)**
Substituir a lógica de extração de `contactTags`:
```ts
const contactTags: string[] = Array.isArray(contact?.tags)
  ? contact.tags.map((t: any) => {
      if (typeof t === 'string') {
        try {
          const parsed = JSON.parse(t);
          return parsed?.name || t;
        } catch { return t; }
      }
      return t?.name || String(t);
    }).filter(Boolean)
  : [];
```

**2. `src/hooks/useUniqueDealTags.ts` (linha ~51-53)**
Adicionar a mesma lógica de parsing no `flatMap` para garantir consistência caso deals também tenham JSON stringificado no futuro. (Baixo risco, já que deal tags são strings limpas hoje.)

**3. `src/components/crm/TagFilterPopover.tsx`** — sem alteração necessária, o componente exibe o que recebe.

### Resultado
Tags vão exibir nomes legíveis como "pastor", "A010 Hubla" em vez de `{id:"00596262-47f8..."}`.


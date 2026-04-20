

## Restringir o canal ANAMNESE apenas a leads com tag exata "ANAMNESE" via webhook

### O que muda

Hoje o classificador `classifyChannel` marca como ANAMNESE qualquer deal cuja tag/origem/lead_channel **contenha** a substring "ANAMNESE" (inclusive "ANAMNESE-INSTA", "Anamnese Incompleta", origem com nome contendo "anamnese", etc.). Você quer que, no funil, o canal ANAMNESE conte **apenas** leads que:

1. Vieram via webhook (`crm_deals.data_source = 'webhook'`), e
2. Possuem a tag **exatamente igual a `"ANAMNESE"`** (case-insensitive, sem prefixo/sufixo, sem "INSTA", sem "Incompleta").

### Onde aplicar

Apenas no `useBUFunnelComplete` (não mexer no `classifyChannel` global, que é usado em outros relatórios e tem semântica mais permissiva). Adicionar uma função local `classifyChannelStrict(deal)` que:

- Retorna `'ANAMNESE'` **somente se** `data_source === 'webhook'` E existe alguma tag cujo valor normalizado (`trim().toUpperCase()`, e se for JSON `{name}` extrair o name) seja **exatamente** `"ANAMNESE"`.
- Retorna `'ANAMNESE-INSTA'` se houver tag exata `"ANAMNESE-INSTA"` (mantendo separação clara).
- Para os demais canais (A010, LIVE, etc.), continua delegando ao `classifyChannel` atual.
- Leads que hoje caíam em ANAMNESE por matching frouxo (ex.: tag "Anamnese Incompleta", origem "ANAMNESE / INDICAÇÃO" sem a tag exata) deixam de ser ANAMNESE — vão para o canal que o classificador genérico devolver, ou para `OUTRO` se nenhum critério bater.

### Mudanças

**Arquivo único: `src/hooks/useBUFunnelComplete.ts`** (~+25 linhas)

1. Adicionar helper local:
   ```ts
   function classifyChannelStrict(deal): string {
     const tagsNorm = (deal.tags || []).map(normalizeTag); // extrai .name de JSON, trim, upper
     if (deal.data_source === 'webhook' && tagsNorm.includes('ANAMNESE')) return 'ANAMNESE';
     if (tagsNorm.includes('ANAMNESE-INSTA')) return 'ANAMNESE-INSTA';
     return classifyChannel({...}); // fallback para os demais canais
   }
   ```
2. Substituir a chamada atual de `classifyChannel` por `classifyChannelStrict` no ponto onde os deals do universo são classificados.
3. Garantir que a query de `crm_deals` já traz `data_source` e `tags` (verificar select).

### Impacto esperado

- A coluna/tab **ANAMNESE** do funil vai cair (provavelmente bastante) — vai mostrar só os leads "puros" do webhook ANAMNESE.
- "Anamnese Incompleta", "ANAMNESE-INSTA" e leads com origem ANAMNESE mas sem a tag exata deixam de inflar o canal.
- Nenhum outro relatório/tela é afetado (mudança isolada no hook do funil).

### Escopo

- 1 arquivo, ~25 linhas, 0 migration.

### Confirmar antes de implementar

1. **"ANAMNESE-INSTA" deve aparecer como canal separado** (recomendado, já existe na lista) ou também deve ser ignorado/agrupado em "OUTRO"?
2. **Leads com tag exata "ANAMNESE" mas `data_source != 'webhook'`** (ex.: criados manualmente, importados via CSV) — devem entrar como ANAMNESE também, ou só os de webhook valem?


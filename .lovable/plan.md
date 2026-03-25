
## Diagnóstico do Problema

### O que está errado

O `SpreadsheetCompareDialog` recebe `originId` via prop — que é o `effectiveOriginId` da página `Negocios.tsx`. Esse `originId` já é correto (é a pipeline selecionada dentro da BU ativa).

**O problema real:** na tela de resultados (Step 3), o dialog tem um **seletor de Estágio** que busca estágios usando `originId` (correto). Mas há outro ponto crítico: o dialog **não tem seletor de pipeline de destino** — a pipeline é sempre a que foi passada via `originId`. Então o usuário já está dentro do Consórcio e importa sempre para a pipeline da BU atual. Isso **já está correto conceitualmente**.

**Mas o verdadeiro gap** é na `Configuracoes.tsx` / `ImportarNegocios.tsx`: lá existe um **Select de pipeline** que mostra as origens filtradas pela BU ativa via `bu_origin_mapping`. Com o fix aplicado anteriormente (`useActiveBU()`), isso deveria funcionar.

### O que ainda está incompleto

Ao inspecionar o fluxo completo:

1. `SpreadsheetCompareDialog` recebe `originId={effectiveOriginId}` de `Negocios.tsx` — esta é a pipeline **selecionada na OriginsSidebar/PipelineSelector** da página de Negócios. Se o usuário não selecionou nenhuma pipeline, `effectiveOriginId` pode ser `undefined`, e o dialog não funcionará.

2. `ImportarNegocios.tsx` (via Configurações) agora usa `useActiveBU()` para filtrar as origens — OK, mas precisa verificar se o filtro está realmente funcionando, pois `buKey = activeBU || 'incorporador'` pode resultar em `'incorporador'` se `activeBU` for `null` (quando acessado fora do contexto BU).

3. **O ponto que o usuário está reclamando**: quando clica em "Importar Planilha" no Consórcio, a pipeline de destino mostrada nos resultados é a pipeline que estava selecionada — o usuário quer garantia que **apenas pipelines do Consórcio** aparecem como destino, não pipelines de outras BUs.

### Análise da raiz

O `SpreadsheetCompareDialog` **não tem um seletor de pipeline de destino** na interface — a pipeline é fixada pelo `originId` que chega como prop. O problema relatado deve ser que `effectiveOriginId` às vezes resolve para um origin ID de outra BU quando não há pipeline selecionada explicitamente, ou o `ImportarNegocios` ainda mostra pipelines de outras BUs.

Preciso verificar se há algo na `Configuracoes.tsx` que passa o `ImportarNegocios`.

## Arquivos Relevantes a Verificar

Antes de apresentar o plano final, preciso ler `Configuracoes.tsx` para entender como o `ImportarNegocios` é montado dentro da BU-Consórcio.

---

## Plano

### Problema confirmado

O `ImportarNegocios.tsx` usa:
```ts
const activeBU = useActiveBU();
const buKey = activeBU || 'incorporador';
```

Quando o componente é renderizado dentro de `/consorcio/crm/configuracoes`, o `BUProvider` está ativo com `bu="consorcio"`, então `useActiveBU()` retorna `'consorcio'`. Isso está correto.

**Porém o problema real:** o `buKey` só filtra a query `bu_origin_mapping`. Se a BU `'consorcio'` não tem entradas na tabela `bu_origin_mapping`, a query retorna vazio, e a lógica de fallback (`getFallbackMapping`) usa `BU_PIPELINE_MAP['consorcio']` — que pode estar mapeando origens incorretas ou vazias.

**E no `SpreadsheetCompareDialog`:** ele recebe `originId` como prop, então a pipeline de destino é sempre a que estava selecionada na sidebar — não há seletor dentro do dialog. O usuário provavelmente está vendo que no passo de resultados **não aparece um seletor de pipeline** para confirmar/alterar o destino.

### O que realmente fazer

**A solução correta é:** adicionar ao `SpreadsheetCompareDialog` um **seletor de pipeline de destino** no passo de resultados, filtrado pela BU ativa, para que o usuário possa:
1. Ver claramente para qual pipeline os leads vão entrar
2. Confirmar que só aparece pipeline da BU atual

Além disso, garantir que `ImportarNegocios` mostre apenas pipelines da BU correta.

---

## Mudanças

### 1. `src/components/crm/SpreadsheetCompareDialog.tsx`

Adicionar:
- Prop `activeBU?: BusinessUnit | null` além de `originId`
- No passo "results", adicionar um seletor "Pipeline de destino" filtrado pela BU ativa via `bu_origin_mapping`
- Usar o `originId` selecionado no dialog em vez do passado via prop (com fallback para o prop quando não há seleção)

```tsx
// Nova prop
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: any[];
  originId?: string;
  activeBU?: BusinessUnit | null;  // ← novo
}

// No step results, antes do seletor de Estágio:
<div className="space-y-1">
  <label>Pipeline de destino</label>
  <Select value={selectedDestinationOriginId || originId || ''} onValueChange={setSelectedDestinationOriginId}>
    {/* Só pipelines da BU ativa */}
  </Select>
</div>
```

### 2. `src/pages/crm/Negocios.tsx`

Passar `activeBU` para o dialog:
```tsx
<SpreadsheetCompareDialog
  open={spreadsheetDialogOpen}
  onOpenChange={setSpreadsheetDialogOpen}
  deals={dealsData || []}
  originId={effectiveOriginId}
  activeBU={activeBU}   // ← novo
/>
```

### 3. `src/pages/crm/ImportarNegocios.tsx`

Já foi corrigido com `useActiveBU()`. Verificar se o filtro funciona ao confirmar que `buKey` é sempre `'consorcio'` dentro da BU-Consórcio. **Não precisa de mudança adicional** — o fix anterior já está correto.

---

## Resumo das Mudanças

| Arquivo | Mudança |
|---|---|
| `SpreadsheetCompareDialog.tsx` | Adicionar seletor de pipeline de destino filtrado pela BU ativa (prop `activeBU`) no passo de resultados |
| `Negocios.tsx` | Passar `activeBU` para `SpreadsheetCompareDialog` |

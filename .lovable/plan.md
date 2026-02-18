
# Fix: Erro no Select de Campanhas

## Problema

O componente `<SelectItem value="">Todas</SelectItem>` na linha 98 de `CampanhasDashboard.tsx` usa `value=""` (string vazia), o que o Radix UI Select proibe.

## Solucao

**Arquivo: `src/pages/bu-marketing/CampanhasDashboard.tsx`**

1. Trocar `<SelectItem value="">Todas</SelectItem>` para `<SelectItem value="all">Todas</SelectItem>`
2. Ajustar o `onValueChange` para converter "all" de volta para string vazia no state:
   ```typescript
   onValueChange={(val) => setSourceFilter(val === "all" ? "" : val)}
   ```
3. Ajustar o `value` do Select para converter string vazia para "all":
   ```typescript
   value={sourceFilter || "all"}
   ```

Isso resolve o erro sem alterar a logica de filtragem (o hook continua recebendo `""` ou `undefined` para "todas as fontes").

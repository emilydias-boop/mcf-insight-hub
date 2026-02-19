
# Corrigir filtro de BU no relatório de Vendas (Faturamento por Closer)

## Problema
Victoria Paz e Joao Pedro (closers da BU Consorcio) estao aparecendo no relatorio de Vendas do Incorporador. Isso acontece porque a pagina `/bu-incorporador/relatorios` nao usa o `BUProvider`, entao o hook `useGestorClosers` nao consegue identificar a BU ativa e retorna closers de todas as BUs.

## Causa raiz
1. `IncorporadorRelatorios` passa `bu="incorporador"` para `BUReportCenter`
2. `BUReportCenter` passa `bu` para `SalesReportPanel`
3. `SalesReportPanel` recebe `bu` mas chama `useGestorClosers('r1')` sem informar a BU
4. `useGestorClosers` usa `useActiveBU()` que, sem `BUProvider`, retorna null ou a BU do perfil do usuario
5. Para admin, `activeBU` pode ser null, entao nenhum filtro de BU e aplicado e closers de todas as BUs sao retornados

## Solucao
Envolver o conteudo do `BUReportCenter` com o `BUProvider` para que todos os hooks filhos (incluindo `useGestorClosers`) identifiquem automaticamente a BU ativa.

## Detalhes tecnicos

### Arquivo: `src/components/relatorios/BUReportCenter.tsx`

Adicionar o `BUProvider` envolvendo todo o conteudo do componente:

```tsx
import { BUProvider } from '@/contexts/BUContext';

export function BUReportCenter({ bu, availableReports }: BUReportCenterProps) {
  return (
    <BUProvider bu={bu} basePath={`/bu-${bu}/relatorios`}>
      {/* conteudo existente */}
    </BUProvider>
  );
}
```

Isso garante que:
- `useActiveBU()` retorne `"incorporador"` dentro de todos os paineis de relatorio
- `useGestorClosers` filtre automaticamente por `bu = 'incorporador'`
- Victoria Paz e Joao Pedro (bu = consorcio) sejam excluidos
- Funciona para todas as BUs, nao apenas Incorporador

### Nenhuma outra mudanca necessaria
O `useGestorClosers` ja tem a logica de filtro por BU (linha 36-38). So falta o contexto ser fornecido corretamente.

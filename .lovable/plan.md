
# Adicionar Paginacao ao Relatorio de Vendas

## Objetivo
Adicionar controles de paginacao na tabela de transacoes do `SalesReportPanel.tsx` com opcoes de 25, 50 e 100 itens por pagina, alem de navegacao entre paginas.

## Situacao Atual

O componente `SalesReportPanel.tsx` atualmente:
- Usa `.slice(0, 100)` fixo para limitar transacoes exibidas
- Mostra mensagem "Mostrando 100 de X transacoes" quando ha mais de 100
- Nao possui controles de paginacao

## Solucao

Seguir o padrao existente no projeto (usado em `TransacoesIncorp.tsx`, `Vendas.tsx`, etc.) que inclui:

### Estados a Adicionar
```javascript
const [currentPage, setCurrentPage] = useState(1);
const [itemsPerPage, setItemsPerPage] = useState(25);
```

### Constante de Opcoes
```javascript
const PAGE_SIZE_OPTIONS = [25, 50, 100];
```

### Logica de Paginacao
```javascript
const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
const paginatedTransactions = useMemo(() => {
  const start = (currentPage - 1) * itemsPerPage;
  return filteredTransactions.slice(start, start + itemsPerPage);
}, [filteredTransactions, currentPage, itemsPerPage]);
```

### Handler para Mudanca de Tamanho
```javascript
const handlePageSizeChange = (value: string) => {
  setItemsPerPage(Number(value));
  setCurrentPage(1); // Reset para primeira pagina
};
```

### Reset ao Mudar Filtros
Resetar para pagina 1 quando filtros mudarem (incluir `currentPage` reset no `useEffect` ou adicionar dependencia nos filtros).

## Interface de Paginacao

Adicionar no rodape da tabela (substituir o texto atual "Mostrando 100 de..."):

```
+-------------------------------------------------------+
| Mostrar [25 v]  |  Mostrando 1-25 de 500 transacoes   |
|                                                       |
|        [<<] [<]  Pagina 1 de 20  [>] [>>]            |
+-------------------------------------------------------+
```

Componentes:
1. **Select de itens por pagina**: 25, 50, 100
2. **Contador**: "Mostrando X a Y de Z transacoes"
3. **Navegacao de paginas**: Primeira, Anterior, Texto, Proxima, Ultima

## Arquivos a Modificar

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/relatorios/SalesReportPanel.tsx` | Adicionar paginacao completa |

## Resultado Esperado

- Exibicao controlada de 25/50/100 transacoes por pagina
- Navegacao fluida entre paginas (botoes <<, <, >, >>)
- Contador mostrando intervalo atual e total
- Reset automatico para pagina 1 ao mudar filtros ou tamanho
- UX consistente com outras paginas do sistema

---

## Detalhes Tecnicos

### Imports Adicionais
```javascript
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
```

### Estrutura do JSX de Paginacao

Substituir o bloco atual (linhas 471-475):
```jsx
{filteredTransactions.length > 100 && (
  <p className="text-sm text-muted-foreground text-center py-4">
    Mostrando 100 de {filteredTransactions.length} transações. Exporte para ver todas.
  </p>
)}
```

Por controles de paginacao completos com:
- Flex container responsivo
- Select para tamanho de pagina
- Contador de itens
- Botoes de navegacao (desabilitados quando na primeira/ultima pagina)

### Mudanca na Tabela

Alterar linha 427:
```jsx
// De:
{filteredTransactions.slice(0, 100).map((row, index) => { ... })}

// Para:
{paginatedTransactions.map((row, index) => { ... })}
```

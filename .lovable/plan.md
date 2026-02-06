
# Persistir Mês Selecionado na Navegação do Fechamento de Equipe

## Problema Identificado

Quando o usuário:
1. Seleciona um mês diferente (ex: Janeiro 2026)
2. Clica em um SDR para ver detalhes
3. Clica em "Voltar" para retornar à lista

A página volta ao **mês atual** em vez de manter o **mês selecionado anteriormente**.

## Causa Raiz

O estado `selectedMonth` é armazenado em `useState` local no componente `Index.tsx`:

```javascript
// Linha 37 - Index.tsx
const [selectedMonth, setSelectedMonth] = useState(currentMonth);
```

Quando o usuário navega para outra página e volta, o componente é remontado e o estado reinicializa para o mês atual.

## Solução

Usar **URL Search Parameters** para persistir o mês selecionado. Essa é a abordagem já utilizada em outras partes do sistema (ex: `ReunioesEquipe.tsx`, `AgendaR2.tsx`).

## Arquivos a Modificar

### 1. `src/pages/fechamento-sdr/Index.tsx`

**Alterações:**
- Importar `useSearchParams` do react-router-dom
- Inicializar `selectedMonth` a partir do URL param `?month=`
- Atualizar URL quando o mês for alterado
- Incluir o mês ao navegar para detalhes

```javascript
// Antes
import { useNavigate } from "react-router-dom";
const [selectedMonth, setSelectedMonth] = useState(currentMonth);

// Depois  
import { useNavigate, useSearchParams } from "react-router-dom";
const [searchParams, setSearchParams] = useSearchParams();
const [selectedMonth, setSelectedMonth] = useState(
  searchParams.get('month') || currentMonth
);

// Atualizar URL ao mudar mês
const handleMonthChange = (month: string) => {
  setSelectedMonth(month);
  setSearchParams({ month });
};

// Navegar mantendo o mês
navigate(`/fechamento-sdr/${payout.id}?from=${selectedMonth}`)
```

### 2. `src/pages/fechamento-sdr/Detail.tsx`

**Alterações:**
- Importar `useSearchParams`
- Ler o parâmetro `from` para saber de qual mês veio
- Navegar de volta preservando o mês

```javascript
// Antes
onClick={() => navigate(-1)}

// Depois
const [searchParams] = useSearchParams();
const fromMonth = searchParams.get('from');

onClick={() => navigate(fromMonth ? `/fechamento-sdr?month=${fromMonth}` : '/fechamento-sdr')}
```

## Fluxo Após Correção

```text
/fechamento-sdr?month=2026-01
        ↓ (clica em SDR)
/fechamento-sdr/abc123?from=2026-01
        ↓ (clica em Voltar)
/fechamento-sdr?month=2026-01  ← Mês preservado!
```

## Resultado Esperado

- O mês selecionado persiste na URL
- Navegação de volta mantém a seleção anterior
- Compartilhar link da página já abre no mês correto
- Padrão consistente com outras páginas do sistema (`ReunioesEquipe`, `AgendaR2`)

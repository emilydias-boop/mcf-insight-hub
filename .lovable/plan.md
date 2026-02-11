
# Persistir Dados da Comparacao no Leads em Limbo

## Problema
Ao sair da página `/crm/leads-limbo` e voltar, todos os resultados da comparação são perdidos porque estão armazenados apenas em estado React (`useState`), que é resetado quando o componente desmonta.

## Solução
Implementar persistência automática usando `sessionStorage` do navegador. Os dados permanecem salvos enquanto a aba está aberta e são limpidos automaticamente ao fechar a aba do navegador (mantendo a segurança).

## O que será persistido
1. `results` - Array com todos os LimboRow da comparação
2. `step` - Etapa atual (upload, mapping, results)
3. `statusFilter`, `stageFilter`, `ownerFilter` - Filtros ativos
4. `page`, `pageSize` - Posição na paginação
5. `columnMapping` - Mapeamento de colunas usado na comparação
6. `savedAt` - Timestamp para validação de expiração

## O que NÃO será persistido (por performance/segurança)
- `rawData` e `headers` - Dados brutos da planilha (muito grandes)
- `selectedIds`, `selectCount`, `assignSdrEmail` - Dados temporários de atribuição
- `selectedLead` - Popup aberto temporariamente

## Implementação Técnica

### Arquivo: `src/pages/crm/LeadsLimbo.tsx`

#### 1. Criar funções helper de persistência
```typescript
// No topo do arquivo, fora do componente
const STORAGE_KEY = 'limbo-comparison-data';
const STORAGE_EXPIRY_HOURS = 24;

interface PersistenceData {
  results: LimboRow[];
  step: Step;
  statusFilter: StatusFilter;
  stageFilter: string;
  ownerFilter: string;
  page: number;
  pageSize: number;
  columnMapping: Record<ColumnKey, string>;
  savedAt: string;
}

function saveToStorage(data: PersistenceData) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save to sessionStorage', e);
  }
}

function loadFromStorage(): PersistenceData | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const data = JSON.parse(stored) as PersistenceData;
    const savedTime = new Date(data.savedAt);
    const now = new Date();
    const hoursDiff = (now.getTime() - savedTime.getTime()) / (1000 * 60 * 60);
    
    // Se passou de 24h, descartar
    if (hoursDiff > STORAGE_EXPIRY_HOURS) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return data;
  } catch (e) {
    console.warn('Failed to load from sessionStorage', e);
    return null;
  }
}

function clearStorage() {
  sessionStorage.removeItem(STORAGE_KEY);
}
```

#### 2. Inicializar estados com lazy initialization
Alterar os `useState` para ler do storage na inicialização:

```typescript
// Em vez de:
// const [results, setResults] = useState<LimboRow[]>([]);

// Fazer assim:
const [results, setResults] = useState<LimboRow[]>(() => {
  const stored = loadFromStorage();
  return stored?.results || [];
});

const [step, setStep] = useState<Step>(() => {
  const stored = loadFromStorage();
  return stored?.step || 'upload';
});

const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
  const stored = loadFromStorage();
  return stored?.statusFilter || 'todos';
});

const [stageFilter, setStageFilter] = useState<string>(() => {
  const stored = loadFromStorage();
  return stored?.stageFilter || 'todos';
});

const [ownerFilter, setOwnerFilter] = useState<string>(() => {
  const stored = loadFromStorage();
  return stored?.ownerFilter || 'todos';
});

const [page, setPage] = useState<number>(() => {
  const stored = loadFromStorage();
  return stored?.page || 0;
});

const [pageSize, setPageSize] = useState<number>(() => {
  const stored = loadFromStorage();
  return stored?.pageSize || 50;
});

const [columnMapping, setColumnMapping] = useState<Record<ColumnKey, string>>(() => {
  const stored = loadFromStorage();
  return stored?.columnMapping || { name: '', email: '', phone: '', stage: '', value: '', owner: '' };
});
```

#### 3. Adicionar useEffect para salvar após comparação
Após `runComparison`, salvar os resultados automaticamente:

```typescript
useEffect(() => {
  if (step === 'results' && results.length > 0) {
    saveToStorage({
      results,
      step,
      statusFilter,
      stageFilter,
      ownerFilter,
      page,
      pageSize,
      columnMapping,
      savedAt: new Date().toISOString(),
    });
  }
}, [results, step, statusFilter, stageFilter, ownerFilter, page, pageSize, columnMapping]);
```

#### 4. Salvar ao filtro mudar (opcional, mas recomendado)
```typescript
useEffect(() => {
  if (step === 'results' && results.length > 0) {
    saveToStorage({
      results,
      step,
      statusFilter,
      stageFilter,
      ownerFilter,
      page,
      pageSize,
      columnMapping,
      savedAt: new Date().toISOString(),
    });
  }
}, [statusFilter, stageFilter, ownerFilter, page, pageSize]);
```

#### 5. Limpar ao clicar "Nova Comparação"
Modificar o botão "Nova Comparação" (linha ~440):

```typescript
<Button 
  variant="outline" 
  size="sm" 
  onClick={() => { 
    clearStorage();  // Adicionar esta linha
    setStep('upload'); 
    setResults([]); 
    setColumnMapping({ name: '', email: '', phone: '', stage: '', value: '', owner: '' });
    setStatusFilter('todos');
    setStageFilter('todos');
    setOwnerFilter('todos');
    setPage(0);
  }}
>
  Nova Comparação
</Button>
```

#### 6. Adicionar botão "Limpar Dados Salvos" (opcional)
Pode ser adicionado na seção de botões do topo (linha ~431-443):

```typescript
<div className="flex gap-2">
  <Button 
    variant="ghost" 
    size="sm" 
    onClick={() => {
      clearStorage();
      setResults([]);
      setStep('upload');
      toast.success('Dados salvos foram limpos');
    }}
  >
    Limpar Cache
  </Button>
  {/* ... outros botões ... */}
</div>
```

## Fluxo do usuário final

1. **Upload + Mapeamento + Comparação**: Dados são salvos no sessionStorage após a comparação
2. **Navegação**: Usuário sai da página para outra seção (ex: CRM > Negócios)
3. **Retorno**: Volta para `/crm/leads-limbo`
4. **Restauração Automática**: Resultados e filtros aparecem imediatamente (pula upload/mapping)
5. **Nova Comparação**: Clica "Nova Comparação" e storage é limpo, voltando ao upload

## Benefícios

- ✅ Dados persistem mesmo saindo da página
- ✅ Seguro: apenas sessionStorage (limpa ao fechar a aba)
- ✅ Expiração automática após 24h
- ✅ Performance: sem requisições desnecessárias
- ✅ UX: não precisa re-fazer a comparação
- ✅ Limpo ao clicar "Nova Comparação"

## Arquivos modificados
- `src/pages/crm/LeadsLimbo.tsx` - Adicionar helper functions, lazy init dos estados, useEffect de sincronização, e modificar botão "Nova Comparação"


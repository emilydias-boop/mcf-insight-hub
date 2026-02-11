

# Melhorias na Tabela de Resultados - Leads em Limbo

## Resumo das mudancas

Adicionar filtros avancados, busca por telefone, substituir coluna "Valor" por "Tags", popup de detalhes do lead, e controle de quantidade de itens por pagina.

## Mudancas no arquivo `src/pages/crm/LeadsLimbo.tsx`

### 1. Novos filtros no topo da tabela
- **Filtro por Estagio**: Select que lista todos os estagios unicos extraidos dos resultados (excelStage). Permite filtrar por estagio especifico.
- **Filtro por Dono**: Select que lista todos os donos unicos (excelOwner/localOwner). Permite filtrar por dono especifico.
- **Controle de quantidade por pagina**: Select com opcoes 25, 50, 100, "Todos". Substitui o PAGE_SIZE fixo.

### 2. Busca expandida
- Atualizar o campo de busca para tambem buscar por telefone (excelPhone), alem de nome e email.
- Placeholder atualizado para "Buscar por nome, email ou telefone..."

### 3. Substituir coluna "Valor" por "Tags"
- Remover a coluna "Valor" da tabela
- Adicionar coluna "Tags" que mostra badges coloridos baseados no estagio do lead:
  - "Contrato Pago" -> badge verde
  - "Lead Qualificado" -> badge azul
  - "Sem Interesse" -> badge cinza
  - "Novo Lead" -> badge amarelo
  - Outros estagios -> badge default com o nome do estagio
- Cada tag sera um Badge compacto com cores distintas

### 4. Popup de detalhes do lead
- Ao clicar em qualquer linha da tabela, abre um Dialog/Sheet com informacoes completas:
  - **Dados do Clint**: Nome, Email, Telefone, Estagio, Valor, Dono no Clint
  - **Dados Locais** (se encontrado): Deal ID, Nome do deal, Contato local (nome, email, telefone), Owner local
  - **Status** do matching (com badge colorido)
  - **Acoes**: Botao para atribuir SDR (se sem dono), botao para vincular closer (se contrato pago)

### 5. Selecao de quantidade
- Adicionar select "Mostrar: 25 | 50 | 100 | Todos" ao lado da paginacao
- Estado `pageSize` substitui constante `PAGE_SIZE`

## Detalhes tecnicos

### Novos estados no componente
```typescript
const [stageFilter, setStageFilter] = useState<string>('todos');
const [ownerFilter, setOwnerFilter] = useState<string>('todos');
const [pageSize, setPageSize] = useState<number>(50);
const [selectedLead, setSelectedLead] = useState<LimboRow | null>(null);
```

### Listas unicas para filtros (useMemo)
```typescript
const uniqueStages = useMemo(() => {
  const stages = new Set(results.map(r => r.excelStage).filter(Boolean));
  return Array.from(stages).sort();
}, [results]);

const uniqueOwners = useMemo(() => {
  const owners = new Set(results.map(r => r.excelOwner || r.localOwner).filter(Boolean));
  return Array.from(owners).sort();
}, [results]);
```

### Filtro atualizado
O `filtered` useMemo sera expandido para incluir stageFilter e ownerFilter alem dos existentes.

### Dialog de detalhes
Usa o componente Dialog do shadcn/ui ja disponivel no projeto. Abre ao clicar na linha. Mostra os dados organizados em secoes com labels e valores.

### Mapeamento de tags por estagio
```typescript
const STAGE_TAG_CONFIG: Record<string, { color: string; label: string }> = {
  'contrato pago': { color: 'bg-emerald-500/20 text-emerald-700', label: 'Contrato Pago' },
  'lead qualificado': { color: 'bg-blue-500/20 text-blue-700', label: 'Lead Qualificado' },
  'sem interesse': { color: 'bg-gray-500/20 text-gray-700', label: 'Sem Interesse' },
  'novo lead': { color: 'bg-yellow-500/20 text-yellow-700', label: 'Novo Lead' },
  // fallback: badge default com o texto do estagio
};
```

## Arquivos modificados
- `src/pages/crm/LeadsLimbo.tsx` - Todas as mudancas acima (filtros, tags, dialog, paginacao)

## Nenhum arquivo novo necessario
Todos os componentes UI ja existem no projeto (Dialog, Select, Badge, etc).



# Plano: Filtrar Closers R1 e Adicionar Canal de Venda

## Problemas Identificados

### 1. Closers Errados no Filtro
O filtro de Closer está mostrando **todos os closers** (incluindo R2), mas o relatório de Contratos do BU Incorporador deveria mostrar apenas **closers R1** (Cristiane, Julio, Thayna).

**Causa**: O hook `useGestorClosers` não filtra por `meeting_type`.

| Closer | meeting_type | Deveria aparecer? |
|--------|--------------|-------------------|
| Cristiane Gomes | r1 | ✅ Sim |
| Julio | r1 | ✅ Sim |
| Thayna | r1 | ✅ Sim |
| Jessica Bellini | r2 | ❌ Não |
| Jessica Martins | r2 | ❌ Não |
| Claudia Carielo | r2 | ❌ Não |

### 2. Falta Canal de Venda
O relatório não mostra o canal de venda (A010, BIO ou LIVE), que é importante para análise comercial.

**Lógica de classificação:**
- **A010**: Lead comprou produto A010 na Hubla (email confirmado em `hubla_transactions`)
- **BIO**: Lead tem tag "bio" ou "instagram" no CRM
- **LIVE**: Padrão (leads gratuitos de lives)

---

## Arquivos a Modificar

| Arquivo | Ação |
|---------|------|
| `src/hooks/useGestorClosers.ts` | **Modificar** - Adicionar filtro por `meeting_type` (opcional) |
| `src/hooks/useContractReport.ts` | **Modificar** - Adicionar lógica de detecção de sales channel e filtro |
| `src/components/relatorios/ContractReportPanel.tsx` | **Modificar** - Adicionar filtro de canal e coluna na tabela |

---

## Alterações Detalhadas

### 1. useGestorClosers.ts - Adicionar filtro por meeting_type

Adicionar parâmetro opcional para filtrar closers por tipo:

```typescript
export const useGestorClosers = (meetingType?: 'r1' | 'r2') => {
  // Nas queries, adicionar:
  if (meetingType) {
    query = query.eq('meeting_type', meetingType);
  }
}
```

### 2. ContractReportPanel.tsx - Usar apenas closers R1

```typescript
// Mudar de:
const { data: closers = [] } = useGestorClosers();

// Para:
const { data: closers = [] } = useGestorClosers('r1');
```

### 3. useContractReport.ts - Adicionar sales_channel ao retorno

**Novo campo na interface:**
```typescript
interface ContractReportRow {
  // ... campos existentes
  salesChannel: 'a010' | 'bio' | 'live';
  contactEmail: string | null;  // Para cálculo do canal
  contactTags: string[];        // Para cálculo do canal
}
```

**Nova lógica no hook:**
1. Buscar também `crm_contacts.email` e `crm_contacts.tags` no join
2. Coletar todos os emails do resultado
3. Buscar emails A010 em `hubla_transactions`
4. Usar função `detectSalesChannel()` existente para classificar cada lead

### 4. ContractReportPanel.tsx - Adicionar filtro e coluna

**Novo filtro de Canal:**
```tsx
<Select value={selectedChannel} onValueChange={setSelectedChannel}>
  <SelectContent>
    <SelectItem value="all">Todos os Canais</SelectItem>
    <SelectItem value="a010">A010</SelectItem>
    <SelectItem value="bio">BIO</SelectItem>
    <SelectItem value="live">LIVE</SelectItem>
  </SelectContent>
</Select>
```

**Nova coluna na tabela:**
```tsx
<TableHead>Canal</TableHead>
// ...
<TableCell>
  <Badge variant={row.salesChannel === 'a010' ? 'default' : 'outline'}>
    {row.salesChannel.toUpperCase()}
  </Badge>
</TableCell>
```

**Filtro no render:**
```typescript
const displayData = filteredReportData.filter(row => 
  selectedChannel === 'all' || row.salesChannel === selectedChannel
);
```

---

## Fluxo de Dados

```text
1. ContractReportPanel carrega
   └── useGestorClosers('r1') → Retorna apenas Cristiane, Julio, Thayna

2. Usuário seleciona filtros
   └── useContractReport busca dados
       ├── Join com crm_contacts para email e tags
       ├── Busca emails A010 em hubla_transactions
       └── Calcula salesChannel para cada row

3. Renderiza tabela com nova coluna "Canal"
   └── Badge colorido: A010 (azul), BIO (verde), LIVE (cinza)
```

---

## Visual Final

**Filtros:**
```
[Período: Jan 2026] [Closer: Todos (R1)] [Pipeline: Todas] [Canal: Todos] [Exportar]
```

**Tabela:**
| Closer | Data | Lead | Telefone | SDR | Pipeline | Canal | Estado |
|--------|------|------|----------|-----|----------|-------|--------|
| Julio | 28/01 | Maria | 11999... | Julia | Inside Sales | **A010** | SP |
| Cristiane | 27/01 | João | 21888... | Antony | Inside Sales | **LIVE** | RJ |
| Thayna | 26/01 | Ana | 31777... | Caroline | Inside Sales | **BIO** | MG |

---

## Impacto

- **Filtro de Closer**: Mostrará apenas 3 closers R1 em vez de 7+
- **Nova coluna Canal**: Classificação visual A010/BIO/LIVE
- **Filtro de Canal**: Permite análise segmentada
- **Exportação Excel**: Incluirá nova coluna "Canal"

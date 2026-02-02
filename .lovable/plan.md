

# Plano: Adicionar Seleção de Pipeline na Importação de Negócios

## Problema Identificado

O sistema de importação CSV atual não define o `origin_id` dos deals. O CSV enviado tem a coluna `origin` vazia, então os deals seriam importados sem associação a nenhuma pipeline.

## Solução

Adicionar um seletor de Pipeline/Origin na interface de importação, permitindo que o usuário escolha para qual pipeline os deals serão importados.

---

## Alterações Necessárias

### 1) Frontend - Adicionar seletor de origin

**Arquivo:** `src/pages/crm/ImportarNegocios.tsx`

Adicionar:
- Estado para `selectedOriginId`
- Componente `Select` com lista de origens disponíveis
- Passar o `origin_id` selecionado na requisição de importação

```typescript
// Novo estado
const [selectedOriginId, setSelectedOriginId] = useState<string | null>(null);

// Buscar origens disponíveis
const { data: origins } = useQuery({
  queryKey: ['import-origins'],
  queryFn: async () => {
    const { data } = await supabase
      .from('crm_origins')
      .select('id, name, display_name')
      .order('name');
    return data || [];
  }
});

// Na requisição de importação
formData.append('origin_id', selectedOriginId);
```

### 2) Edge Function - Receber e aplicar origin_id

**Arquivo:** `supabase/functions/import-deals-csv/index.ts`

Modificar para:
- Receber `origin_id` do FormData
- Salvar no metadata do job

### 3) Edge Function - Aplicar origin_id aos deals

**Arquivo:** `supabase/functions/process-csv-imports/index.ts`

Modificar `convertToDBFormat` para usar o `origin_id` do job:

```typescript
// Dentro do loop de processamento
const originId = job.metadata.origin_id;

// Na conversão
if (originId) {
  dbDeal.origin_id = originId;
}
```

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/ImportarNegocios.tsx` | Adicionar Select de pipeline e enviar origin_id |
| `supabase/functions/import-deals-csv/index.ts` | Receber origin_id e salvar no metadata |
| `supabase/functions/process-csv-imports/index.ts` | Aplicar origin_id do job a cada deal |

---

## Interface Atualizada

O formulário de importação terá:
1. **Seletor de Pipeline** (obrigatório) - Ex: "Efeito Alavanca + Clube"
2. **Upload do CSV** (já existe)
3. **Botão Importar** (já existe)

---

## Resultado Esperado

1. Usuário seleciona "Efeito Alavanca + Clube" no dropdown
2. Faz upload do CSV com 3.693 deals
3. Todos os deals são criados com `origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'`
4. Deals aparecem corretamente no Kanban da pipeline


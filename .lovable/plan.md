
# Plano: Adicionar Seletor de SDR na Importação de Negócios

## Objetivo

Permitir que ao importar um CSV de leads, você possa selecionar um SDR específico para receber **todos** os deals dessa importação automaticamente.

## Alterações

### 1. Frontend - `src/pages/crm/ImportarNegocios.tsx`

**Adicionar seletor de "Atribuir a" (SDR):**

- Novo estado: `selectedOwnerId` (email do SDR) e `selectedOwnerProfileId` (UUID)
- Novo componente Select para escolher o SDR da lista de usuários ativos
- Passar `owner_email` e `owner_profile_id` no FormData junto com `origin_id`

```typescript
// Novos estados
const [selectedOwnerEmail, setSelectedOwnerEmail] = useState<string | null>(null);
const [selectedOwnerProfileId, setSelectedOwnerProfileId] = useState<string | null>(null);

// Nova query para buscar usuários ativos (SDRs + Closers)
const { data: activeUsers } = useQuery({
  queryKey: ['active-users-for-import'],
  queryFn: async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, name')
      .order('name');
    return data || [];
  }
});

// No handleImport, enviar os dados do owner
formData.append('owner_email', selectedOwnerEmail);
formData.append('owner_profile_id', selectedOwnerProfileId);
```

### 2. Edge Function - `supabase/functions/import-deals-csv/index.ts`

**Receber e armazenar o owner no job metadata:**

```typescript
const ownerEmail = formData.get('owner_email') as string | null;
const ownerProfileId = formData.get('owner_profile_id') as string | null;

// No metadata do job
metadata: {
  // ...existente
  owner_email: ownerEmail || null,
  owner_profile_id: ownerProfileId || null,
}
```

### 3. Edge Function - `supabase/functions/process-csv-imports/index.ts`

**Aplicar o owner a todos os deals:**

```typescript
// Linha ~144, junto com originId
const ownerEmail = job.metadata.owner_email;
const ownerProfileId = job.metadata.owner_profile_id;

// Na conversão (linha ~350-352), priorizar owner do job se existir
if (ownerEmail) {
  dbDeal.owner_id = ownerEmail;
  dbDeal.owner_profile_id = ownerProfileId;
} else if (csvDeal.owner) {
  dbDeal.owner_id = csvDeal.owner.trim();
}
```

---

## Fluxo do Usuário

1. Acessa **CRM > Configurações > Importar Negócios**
2. Seleciona a **Pipeline de destino**
3. Seleciona o **SDR** no novo campo "Atribuir a" (opcional)
4. Faz upload do CSV
5. Todos os deals são criados já com o owner correto

---

## Arquivos a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/crm/ImportarNegocios.tsx` | Adicionar seletor de SDR e enviar no FormData |
| `supabase/functions/import-deals-csv/index.ts` | Receber owner_email e owner_profile_id |
| `supabase/functions/process-csv-imports/index.ts` | Aplicar owner a todos os deals importados |

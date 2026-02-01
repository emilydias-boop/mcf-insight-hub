

# Distribuição de Leads da Lista com Tag "Lead-Lançamento"

## Resumo

| Métrica | Valor |
|---------|-------|
| Leads da lista para distribuir | ~503 |
| SDRs para distribuição | 8 |
| Leads por SDR | ~63 cada |
| Tag a ser adicionada | `Lead-Lançamento` |

## 8 SDRs que Receberão os Leads

| SDR | Email | Profile ID |
|-----|-------|------------|
| Julia Caroline | julia.caroline@minhacasafinanciada.com | 794a2257-422c-4b38-9014-3135d9e26361 |
| Caroline Souza | caroline.souza@minhacasafinanciada.com | 4c947a4c-80c1-4439-bd31-2b38e3a3f1d0 |
| Caroline Corrêa | carol.correa@minhacasafinanciada.com | c7005c87-76fc-43a9-8bfa-e1b41f48a9b7 |
| Juliana Rodrigues | juliana.rodrigues@minhacasafinanciada.com | baa6047c-6b41-42ef-bfd0-248eef9b560a |
| Leticia Nunes | leticia.nunes@minhacasafinanciada.com | c1ede6ed-e3ae-465f-91dd-a708200a85fc |
| Antony Elias | antony.elias@minhacasafinanciada.com | 70113bef-a779-414c-8ab4-ce8b13229d3a |
| Jessica Martins | jessica.martins@minhacasafinanciada.com | b0ea004d-ca72-4190-ab69-a9685b34bd06 |
| Alex Dias | alex.dias@minhacasafinanciada.com | 16c5d025-9cda-45fa-ae2f-7170bfb8dee8 |

## O que será feito em cada Deal

| Campo | Valor |
|-------|-------|
| `owner_id` | Email do SDR atribuído |
| `owner_profile_id` | UUID do perfil do SDR |
| `tags` | Adiciona `Lead-Lançamento` às tags existentes |
| `updated_at` | Timestamp atual |

## Resultado Esperado

Após a execução:
- ~503 leads distribuídos igualmente entre 8 SDRs
- Todos os leads terão a tag **"Lead-Lançamento"** para fácil identificação
- Cada deal terá registro de atividade para auditoria

---

## Seção Técnica

### Arquivo a Criar

| Arquivo | Ação |
|---------|------|
| `supabase/functions/distribute-leads-list/index.ts` | Criar nova Edge Function |

### Estrutura da Edge Function

```text
1. Lista fixa dos ~500 emails fornecidos
2. Buscar contatos por email (LOWER para case insensitive)
3. Buscar deals desses contatos que ainda não têm owner
4. Embaralhar deals aleatoriamente
5. Distribuir em round-robin entre os 8 SDRs
6. Para cada deal:
   - Atualizar owner_id e owner_profile_id
   - Adicionar tag "Lead-Lançamento" ao array de tags
   - Registrar activity_type: 'owner_change'
```

### Lógica de Adição da Tag

```typescript
// Manter tags existentes + adicionar "Lead-Lançamento"
const newTags = deal.tags 
  ? (deal.tags.includes('Lead-Lançamento') ? deal.tags : [...deal.tags, 'Lead-Lançamento'])
  : ['Lead-Lançamento'];
```

### Activity Log

```json
{
  "deal_id": "uuid",
  "activity_type": "owner_change",
  "description": "Atribuído para [Nome SDR] via distribuição de lista específica",
  "metadata": {
    "new_owner": "email@...",
    "new_owner_name": "Nome SDR",
    "new_owner_profile_id": "uuid",
    "tag_added": "Lead-Lançamento",
    "batch_operation": "specific-list-distribution",
    "distributed_at": "2026-02-01T..."
  }
}
```

### Retorno da Função

```json
{
  "success": true,
  "message": "Distributed 503 deals to 8 SDRs equally",
  "updated": 503,
  "activities_created": 503,
  "distribution": [
    { "name": "Julia Caroline", "email": "julia.caroline@...", "assigned": 63 },
    { "name": "Caroline Souza", "email": "caroline.souza@...", "assigned": 63 },
    ...
  ]
}
```


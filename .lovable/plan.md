

## Plano: Corrigir parser de CSV para suportar TAB e mapear "Cliente"

### Causa raiz

A planilha `clientes_20260320_1035.csv` usa **TAB como delimitador** e tem colunas:
```
Cliente | Cliente | Telefone | Estado/Cidade | Profissão | ...
```

O parser em `process-csv-imports/index.ts` só detecta `;` ou `,` como delimitador — **TAB não é reconhecido**. Resultado: a linha inteira vira um único campo ou se quebra errado nos dados que contêm vírgulas (ex: `4,99998E+11` no telefone), fazendo com que pedaços de telefone ou texto aleatório caiam no campo `name`.

Além disso, o `convertToDBFormat` só aceita `csvDeal.name` — a coluna `cliente` nunca é mapeada como nome do deal.

### Alterações

| Arquivo | O que muda |
|---------|-----------|
| `supabase/functions/process-csv-imports/index.ts` | (1) Detectar TAB como delimitador. (2) Mapear `cliente` → `name`. (3) Lidar com colunas duplicadas (renomear segunda como `cliente_2`). (4) Validar que `name` não é apenas números/telefone. |

### Detalhes

**1. Detecção de TAB na `parseCSV`**
```typescript
// Antes:
const delimiter = headerLine.includes(';') ? ';' : ','
// Depois:
const delimiter = headerLine.includes('\t') ? '\t' 
                : headerLine.includes(';') ? ';' 
                : ','
```

**2. Colunas duplicadas — renomear automaticamente**

Na `parseCSV`, ao montar os headers, se já existe um header com mesmo nome, adicionar sufixo `_2`, `_3`, etc:
```typescript
const seen = new Map<string, number>()
const headers = rawHeaders.map(h => {
  const key = h.toLowerCase().trim()
  const count = (seen.get(key) || 0) + 1
  seen.set(key, count)
  return count > 1 ? `${key}_${count}` : key
})
```
Assim: `Cliente, Cliente` → `cliente, cliente_2`

**3. Mapear `cliente` → `name` no `convertToDBFormat`**
```typescript
const name = csvDeal.name?.trim() 
  || csvDeal.cliente?.trim() 
  || csvDeal.consorciado?.trim() 
  || ''
```

**4. Mapear `cliente_2` como contato no `extractContactData`**
```typescript
const name = csvDeal.contact?.trim() 
  || csvDeal.cliente_2?.trim()  // segundo "Cliente" = SDR/contato
  || csvDeal.name?.trim() 
  || ''
```

Também mapear `gerente` → `owner`:
```typescript
const csvOwnerEmail = csvDeal.owner?.trim() 
  || csvDeal.dono?.trim() 
  || csvDeal.gerente?.trim()  // coluna Gerente da planilha
  || csvDeal.user_email?.trim()
```

**5. Validação: rejeitar nomes que são apenas números**

No `convertToDBFormat`, após resolver o `name`:
```typescript
if (!name || /^\(?[\d\s\-\(\)\+,.E]+$/.test(name)) {
  console.warn(`⚠️ Nome inválido (parece telefone): "${name}"`)
  return null  // skip este registro
}
```

Isso previne que telefones como `19994788056` ou `4,99998E+11` sejam aceitos como nome.

### Mapeamento completo da planilha

| Coluna CSV | Campo no sistema |
|-----------|-----------------|
| Cliente (1º) | `deal.name` (nome do consorciado) |
| Cliente (2º) | `contact.name` (SDR/contato) |
| Telefone | `contact.phone` |
| Estado/Cidade | `custom_fields.estado_cidade` |
| Profissão | `custom_fields.profissao` |
| Empresário | `custom_fields.empresario` |
| Score | `custom_fields.score` |
| Nível | `custom_fields.nivel` (ou stage mapping) |
| Imóvel Quitado | `custom_fields.imovel_quitado` |
| Terreno | `custom_fields.terreno` |
| Badges | `tags[]` (split por vírgula) |
| Gerente | `owner_id` (buscar email no profiles) |

### Após o deploy

O usuário poderá reimportar a mesma planilha pela página de importação. Desta vez, "Kerlo Roberto Closs" irá para o nome do deal (não o telefone), e a validação rejeitará qualquer registro que tente usar número como nome.


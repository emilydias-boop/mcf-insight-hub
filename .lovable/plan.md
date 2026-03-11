

## Correção: Distribuição Round-Robin — IDs errados e Luis Felipe incluído indevidamente

### Problemas encontrados

**Dados do banco (`sdr` table, squad=consorcio, active=true, role_type=sdr):**
- Cleiton Lima — sdr.id: `11111111-...0006`, profiles.id: `16828627-...`
- Ithaline Clara — sdr.id: `3aa83069-...`, profiles.id: `411e4b5d-...`
- Luis Felipe — sdr.id: `17fdd964-...`, profiles.id: `e459627e-...`
- Ygor Ferreira — sdr.id: `929e60c5-...`, profiles.id: `d523e03f-...`

**Problema 1**: Luis Felipe está com `role_type = 'sdr'` na tabela `sdr`, mas o usuário diz que ele não é SDR. Precisa mudar para `closer`.

**Problema 2**: O código na linha 306 usa `s.id` (ID da tabela `sdr`), mas o CRM precisa do `profiles.id` para `owner_profile_id`. Os IDs são completamente diferentes, causando falhas na atribuição.

### Correções

#### 1. Banco de dados — Mudar Luis Felipe para closer
```sql
UPDATE sdr SET role_type = 'closer' WHERE email = 'luis.felipe@minhacasafinanciada.com';
```

#### 2. `SpreadsheetCompareDialog.tsx` — Resolver profile IDs reais

Na linha 301-306, após obter `consorcioSdrs`, buscar os `profiles.id` reais pelo email:

```typescript
if (assignMode === 'distribute') {
  const emails = consorcioSdrs.filter(s => s.email).map(s => s.email!);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, email, full_name')
    .in('email', emails);

  sdrList = (profiles || []).map(p => ({
    email: p.email,
    id: p.id,  // UUID real do profiles
    name: p.full_name || p.email,
  }));
}
```

### Resultado esperado
Apenas Cleiton, Ithaline e Ygor receberão leads no round-robin, com os `owner_profile_id` corretos.

### Arquivos modificados
- SQL: `UPDATE sdr` para corrigir Luis Felipe
- `src/components/crm/SpreadsheetCompareDialog.tsx` — resolver profile IDs reais


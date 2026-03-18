

## Diagnóstico: Hellen, Marcio e Mayara não aparecem no dropdown de SDRs

### Causa raiz

Os 3 SDRs estão cadastrados na tabela `sdr` com `squad = 'credito'`, mas a Agenda R1 usa `activeBU = 'incorporador'`. O hook `useSdrsByBU` filtra por `.eq('squad', bu)`, então eles ficam invisíveis.

```text
sdr table:
  Hellen Costa   → squad: credito  ← deveria ser incorporador
  Marcio Dantas  → squad: credito  ← deveria ser incorporador
  Mayara Souza   → squad: credito  ← deveria ser incorporador

employees table:
  Hellen Costa   → departamento: Inside
  Marcio Dantas  → departamento: (vazio)
  Mayara Souza   → departamento: Inside
```

O trigger `trg_auto_link_employee_sdr` mapeia departamento → squad. "Inside" não está no mapeamento (que espera "BU - Incorporador 50K", "BU - Consorcio", etc.), então caiu no default "credito".

### Solução

Uma migration simples para corrigir o squad dos 3 SDRs:

**Arquivo:** `supabase/migrations/[timestamp]_fix_sdr_squad_hellen_marcio_mayara.sql`

```sql
UPDATE sdr SET squad = 'incorporador'
WHERE email IN (
  'hellen.costa@minhacasafinanciada.com',
  'marcio.dantas@minhacasafinanciada.com',
  'mayara.souza@minhacasafinanciada.com'
);
```

Opcionalmente, também corrigir o `departamento` dos employees para evitar reincidência se o trigger rodar novamente:

```sql
UPDATE employees SET departamento = 'BU - Incorporador 50K'
WHERE id IN (
  '87b21ce1-e9c7-4b7c-8b3c-8f29ba179ed7',
  '47f20a2a-c4e9-41a5-bf91-23ce0149b079',
  '40f66bf5-63c7-40d5-b4c7-3eca5fed1113'
);
```

### Impacto

Após a correção, Hellen, Marcio e Mayara aparecem imediatamente no dropdown "SDR Responsável" da Agenda R1 e em todos os dashboards que filtram por `squad = 'incorporador'`.

### Prevenção futura (opcional)

Adicionar "Inside" ao mapeamento do trigger `trg_auto_link_employee_sdr` para que novos colaboradores com departamento "Inside" sejam mapeados automaticamente para `squad = 'incorporador'`.


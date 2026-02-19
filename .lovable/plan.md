

# Corrigir role_type de Luis Felipe na tabela SDR

## Problema

Luis Felipe (`luis.felipe@minhacasafinanciada.com`) aparece na tabela de SDRs porque seu `role_type` esta como `'sdr'` na tabela `sdr`. Ele e Supervisor e faz R1 ocasionalmente.

## Solucao

Atualizar o registro dele na tabela `sdr` de `role_type = 'sdr'` para `role_type = 'closer'`.

Isso fara com que:
- Ele **saia** da tabela de SDRs (que filtra por `role_type = 'sdr'`)
- Ele **apareca** na tabela de Closers (onde suas R1 realizadas serao contabilizadas)

## Detalhes tecnicos

Executar UPDATE na tabela `sdr`:

```sql
UPDATE sdr
SET role_type = 'closer'
WHERE email = 'luis.felipe@minhacasafinanciada.com';
```

Nenhuma alteracao de codigo e necessaria. O hook `useSdrsFromSquad` ja filtra por `role_type = 'sdr'`, entao ao mudar para `'closer'` ele automaticamente deixa de aparecer como SDR.


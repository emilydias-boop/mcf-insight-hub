

# Atualizar role_type de Luis Felipe para "closer"

## Problema

Luis Felipe continua aparecendo como SDR porque a alteracao no banco de dados ainda nao foi executada. Ele e Supervisor e faz R1 ocasionalmente.

## Solucao

Executar uma migracao SQL para alterar o `role_type` de `'sdr'` para `'closer'` na tabela `sdr`.

## Detalhes tecnicos

Migracao SQL:

```sql
UPDATE sdr
SET role_type = 'closer'
WHERE email = 'luis.felipe@minhacasafinanciada.com';
```

Nenhuma alteracao de codigo e necessaria. O hook `useSdrsFromSquad` filtra por `role_type = 'sdr'`, entao ao mudar para `'closer'` ele sai automaticamente da tabela de SDRs e passa a aparecer na tabela de Closers.


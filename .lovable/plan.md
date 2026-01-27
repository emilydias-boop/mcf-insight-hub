
# Plano: Completar Transferencia de Ownership dos Leads com Contrato Pago

## Problema Identificado

A migracao SQL que corrigiu o status dos 5 leads para `contract_paid` nao executou a logica de transferencia de ownership. Resultado:

| Lead | Closer R1 | Owner Atual | Deveria Ser |
|------|-----------|-------------|-------------|
| Lorena das Graca | Julio | rangel.vinicius@ | julio.caetano@ |
| CAIS ENGENHARIA | Julio | julia.caroline@ | julio.caetano@ |
| Ana luzia maranini | Julio | NULL | julio.caetano@ |
| Robson Moreira | Thayna | jessica.martins@ | thaynar.tavares@ |
| Mauricio Albuquerque | Cristiane | alex.dias@ | cristiane.gomes@ |

Por isso a Lorena nao aparece para o Julio no Kanban - o filtro de "Meus Negocios" usa `owner_id`, que ainda aponta para o SDR original.

## Solucao Proposta

Executar uma migracao SQL para:
1. Preservar o SDR original em `original_sdr_email`
2. Salvar o closer da R1 em `r1_closer_email`
3. Transferir `owner_id` para o email do closer

### Migracao SQL

```sql
-- Correcao retroativa: Transferir ownership para os closers da R1
-- e preservar a cadeia de ownership

-- 1. Lorena das Graca -> Julio
UPDATE crm_deals SET 
  original_sdr_email = COALESCE(original_sdr_email, owner_id),
  r1_closer_email = 'julio.caetano@minhacasafinanciada.com',
  owner_id = 'julio.caetano@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = '685a245d-49f7-404e-922e-1d194f82632a';

-- 2. CAIS ENGENHARIA -> Julio
UPDATE crm_deals SET 
  original_sdr_email = COALESCE(original_sdr_email, owner_id),
  r1_closer_email = 'julio.caetano@minhacasafinanciada.com',
  owner_id = 'julio.caetano@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = '6354770e-29f3-4a28-8c60-5ea044d98fcf';

-- 3. Ana luzia maranini -> Julio
UPDATE crm_deals SET 
  r1_closer_email = 'julio.caetano@minhacasafinanciada.com',
  owner_id = 'julio.caetano@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = 'cfd65eeb-2c24-4dd3-a8bb-21ce29a3ff6b';

-- 4. Robson Moreira -> Thayna
UPDATE crm_deals SET 
  original_sdr_email = COALESCE(original_sdr_email, owner_id),
  r1_closer_email = 'thaynar.tavares@minhacasafinanciada.com',
  owner_id = 'thaynar.tavares@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = '4202201f-400e-4109-a16a-34fc61df746f';

-- 5. Mauricio Albuquerque -> Cristiane
UPDATE crm_deals SET 
  original_sdr_email = COALESCE(original_sdr_email, owner_id),
  r1_closer_email = 'cristiane.gomes@minhacasafinanciada.com',
  owner_id = 'cristiane.gomes@minhacasafinanciada.com',
  updated_at = NOW()
WHERE id = 'aea3b827-bbb8-4baa-8305-ecedd23bd5d1';
```

## Resultado Esperado

Apos a migracao:

| Metrica | Antes | Depois |
|---------|-------|--------|
| Lorena no Kanban do Julio | Nao aparece | Aparece em "Contrato Pago" |
| CAIS ENGENHARIA no Kanban do Julio | Nao aparece | Aparece em "Contrato Pago" |
| Ana luzia no Kanban do Julio | Nao aparece | Aparece em "Contrato Pago" |
| Contratos do Julio no "Meu Desempenho" | 1 | 4 |

## Observacoes

- A Lorena **nao eh "Outside"** - ela comprou o contrato **APOS** a reuniao R1 (reuniao 16:30, compra 17:19)
- O sistema esta correto, apenas a migracao manual nao executou toda a logica
- Futuras marcacoes de contrato pago via interface funcionarao automaticamente

## Arquivo a Modificar

Nenhum arquivo de codigo sera modificado - apenas uma migracao SQL sera executada.

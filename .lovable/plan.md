

# Auto-vincular employees com tabela SDR por email

## Problema atual
Quando um colaborador e cadastrado no RH (employees) e tem um usuario do sistema (profile), o vinculo com a tabela `sdr` (necessario para metas, fechamento, dashboard) precisa ser feito manualmente. Isso causa colaboradores "fantasmas" sem metas configuradas.

## Solucao: Trigger automatico no banco de dados

Criar um trigger na tabela `employees` que, ao detectar um `profile_id` preenchido (novo insert ou update), automaticamente:

1. Busca o email do profile na tabela `profiles`
2. Procura um registro existente na tabela `sdr` com o mesmo email
3. Se encontrar: atualiza `employees.sdr_id` com o ID encontrado
4. Se nao encontrar: cria um novo registro na `sdr` com:
   - `name`: nome do employee
   - `email`: email do profile
   - `squad`: derivado do departamento (mapeamento interno)
   - `role_type`: derivado do cargo_catalogo.role_sistema (se disponivel) ou 'sdr' como padrao
   - `active`: true
   - `meta_diaria`: 7 (padrao)
   - `user_id`: o profile_id do employee

Isso elimina qualquer passo manual: basta cadastrar o colaborador no RH e vincular ao usuario do sistema.

## Tambem atualizar o edge function `create-user`

O edge function `create-user` ja cria employee e profile, mas nao cria o registro `sdr`. Adicionar essa logica apos a criacao do employee, usando os mesmos criterios do trigger.

## Correcao imediata dos dados existentes

Executar uma query de correcao para vincular os employees que ja possuem profile mas estao sem `sdr_id`:
- Alexsandro, Claudia e Thobson: ja possuem registros na `sdr` com emails correspondentes, so precisam do `sdr_id` atualizado
- Mateus Macedo e outros com profile mas sem `sdr`: criar registros automaticamente

## Secao tecnica

### 1. Migration SQL - Trigger `auto_link_sdr_on_profile`

```text
Funcao: auto_link_employee_sdr()
Trigger: BEFORE INSERT OR UPDATE OF profile_id ON employees

Logica:
  IF NEW.profile_id IS NOT NULL AND (OLD.profile_id IS NULL OR NEW.profile_id != OLD.profile_id) THEN
    1. Buscar email do profile
    2. Buscar sdr existente por email
    3. Se encontrar -> NEW.sdr_id = sdr.id
    4. Se nao encontrar -> INSERT na sdr, NEW.sdr_id = novo ID
    5. Mapear departamento para squad:
       'BU - Incorporador 50K' -> 'incorporador'
       'BU - Consorcio' -> 'consorcio'
       'BU - Credito' -> 'credito'
       'BU - Leilao' -> 'leilao'
    6. Buscar role_sistema do cargo_catalogo se disponivel
  END IF
```

### 2. Migration SQL - Correcao dos dados existentes

```text
UPDATE employees e
SET sdr_id = s.id
FROM profiles p
JOIN sdr s ON LOWER(s.email) = LOWER(p.email)
WHERE e.profile_id = p.id
  AND e.sdr_id IS NULL
  AND e.status = 'ativo'
```

Para employees com profile mas sem registro na `sdr`, criar os registros e vincular.

### 3. Edge function `create-user` - Adicionar criacao do SDR

Apos criar o employee (linha ~172), adicionar logica para criar registro na `sdr`:

```text
- Mapear squad do departamento do cargo
- Determinar role_type do cargo.role_sistema
- Inserir na sdr com name, email, squad, role_type, active, meta_diaria, user_id
- Atualizar employees.sdr_id com o novo ID
```

### Arquivos afetados
- 1 nova migration SQL (trigger + correcao de dados)
- `supabase/functions/create-user/index.ts` (adicionar criacao do SDR)

Nenhuma alteracao no frontend necessaria - o vinculo sera automatico.

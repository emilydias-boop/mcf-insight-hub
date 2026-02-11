

# Corrigir employees sem profile_id e auto-vincular SDR

## Problema
6 colaboradores ativos no RH possuem usuarios no sistema (profiles), mas o campo `profile_id` na tabela `employees` esta vazio. Sem esse vinculo, o trigger automatico nao dispara e o SDR nao e vinculado.

## Solucao

### 1. Correcao imediata dos dados
Atualizar o `profile_id` dos 6 employees com base no email do profile. Isso vai disparar o trigger `trg_auto_link_employee_sdr` que ja existe e automaticamente vincular ou criar os registros na tabela `sdr`.

Mapeamento:
```text
Evellyn Vieira dos Santos     -> profile 5ac53d91 (evellyn.santos@...)
Robert Roger Santos Gusmao    -> profile f12d079b (robert.gusmao@...)
Juliana de Oliveira Cavalheiro -> profile 5646fafc (juliana.oliveira@...)
Mari Dias                     -> profile ed0ce5b6 (mari.dias@...)
Matheus William Alves Elpidio -> profile d27c71c8 (matheus.alves@...)
Stephany Martins Vieira Soares-> profile fe247e45 (stephany.soares@...)
```

### 2. Trigger adicional para auto-preencher profile_id
Criar um segundo trigger na tabela `employees` que, ao inserir um novo colaborador, busca automaticamente um profile com email correspondente e preenche o `profile_id`. Assim, o fluxo completo fica:

```text
Cadastro no RH (insert employee)
  -> Trigger 1: busca profile por email -> preenche profile_id
    -> Trigger 2 (ja existe): detecta profile_id -> vincula/cria SDR
```

Tambem criar um trigger na tabela `profiles` que, ao criar um novo profile, busca employees sem profile_id com email correspondente e faz o vinculo automatico. Isso cobre o cenario inverso (usuario criado antes do cadastro no RH).

### Secao tecnica

**Migration SQL**:

1. Update dos 6 employees com profile_id correto (dispara trigger existente)

2. Funcao `auto_match_employee_profile()`: trigger BEFORE INSERT on employees
   - Busca na tabela profiles por email correspondente ao campo employees.email (derivado do nome ou do cargo)
   - Na verdade, como employees nao tem campo email, buscar pelo nome (`full_name` no profile vs `nome_completo` no employee) usando ILIKE

3. Funcao `auto_match_profile_to_employee()`: trigger AFTER INSERT on profiles
   - Busca employees sem profile_id com nome correspondente
   - Atualiza profile_id, o que dispara o trigger de SDR

**Nenhuma alteracao no frontend** - tudo resolvido via banco de dados.


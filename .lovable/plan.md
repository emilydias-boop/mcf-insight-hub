
# Vincular SDRs e Closers do Consorcio

## Situacao atual

A tabela `sdr` tem registros do consorcio mas com **emails nulos** e **duplicatas**. Sem email, o painel nao consegue vincular metricas da agenda.

### Registros atuais vs dados corretos (do profiles)

| Nome | sdr.id (correto) | Email (falta preencher) | Duplicata a remover |
|------|-------------------|------------------------|---------------------|
| Ithaline Clara dos Santos | `3aa83069...` | ithaline.clara@minhacasafinanciada.com | `12803e3a...` (remover) |
| Cleiton Lima | `11111111...` | ja tem email OK | -- |
| Luis Felipe | `17fdd964...` | luis.felipe@minhacasafinanciada.com | -- |
| Ygor Ferreira | `929e60c5...` | ygor.ferreira@minhacasafinanciada.com | `eee8e90e...` (remover) |
| Joao Pedro (Closer) | `1c6c4acd...` | joao.pedro@minhacasafinanciada.com | -- |
| Victoria Paz (Closer) | `131c9863...` | victoria.paz@minhacasafinanciada.com | -- |

## Acoes

### 1. Atualizar emails nos 5 registros que estao nulos
Preencher o campo `email` na tabela `sdr` para cada pessoa usando o email do sistema (tabela `profiles`).

### 2. Remover 2 registros duplicados
- `12803e3a-c98e-49a3-85c7-eacd3d6965a3` (Ithaline duplicada, sem vinculo no employees)
- `eee8e90e-db40-40e9-beda-7b30bab86151` (Ygor duplicado, sem vinculo no employees)

### 3. Atualizar profile_id nos registros que faltam
Vincular o `profile_id` correto para que permissoes e filtros por usuario funcionem.

## Resultado esperado
Apos essas correcoes de dados, o painel do Consorcio exibira automaticamente todos os SDRs e Closers com suas respectivas metricas da agenda (agendamentos, realizadas, no-shows, contratos).

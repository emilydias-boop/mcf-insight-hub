
# Plano: Remover CHECK Constraint Restritiva do Campo "Origem"

## Problema Identificado

O erro ocorre porque existe uma **CHECK constraint no banco de dados** que restringe os valores do campo `origem`:

```sql
CHECK ((origem = ANY (ARRAY['socio', 'gr', 'indicacao', 'outros'])))
```

Essa constraint **não inclui** os valores:
- `reverter` (que você está tentando usar)
- `clube_arremate` (também cadastrado)

## Diagnóstico

| Origem | Na tabela `consorcio_origem_options` | Permitida pela constraint |
|--------|-------------------------------------|---------------------------|
| socio | Sim | Sim |
| gr | Sim | Sim |
| indicacao | Sim | Sim |
| outros | Sim | Sim |
| **clube_arremate** | **Sim** | **Nao** |
| **reverter** | **Sim** | **Nao** |

## Solucao Proposta

**Remover a CHECK constraint** da coluna `origem`, permitindo que qualquer valor seja inserido. A validacao passa a ser feita apenas pelo dropdown (que mostra opcoes do banco) e pelo Zod no frontend.

Essa abordagem eh consistente com o design atual: as opcoes sao dinamicas e vem da tabela `consorcio_origem_options`.

## Alteracao Tecnica

### Migration SQL

```sql
-- Remove a CHECK constraint restritiva do campo origem
ALTER TABLE consortium_cards 
DROP CONSTRAINT consortium_cards_origem_check;
```

## Por que Remover em vez de Atualizar?

| Opcao | Problema |
|-------|----------|
| Atualizar constraint com novos valores | Precisaria alterar toda vez que criar nova origem |
| Remover constraint | Flexivel - novas origens funcionam automaticamente |

Como as origens sao gerenciadas dinamicamente pela tabela `consorcio_origem_options`, faz sentido **remover a constraint** e confiar na validacao da aplicacao.

## Resultado Esperado

Apos a migracao:
- Salvar cartas com origem "Reverter" funcionara normalmente
- Salvar cartas com origem "Clube do Arremate" tambem funcionara
- Novas origens adicionadas no futuro funcionarao sem alteracoes no banco

## Arquivos a Modificar

| Tipo | Arquivo | Alteracao |
|------|---------|-----------|
| Migration | `supabase/migrations/[timestamp]_remove_origem_check.sql` | DROP CONSTRAINT |

# Exportar contatos da BU - Incorporador MCF (XLSX)

Gerar um arquivo `.xlsx` com todos os contatos vinculados à BU Incorporador MCF e disponibilizá-lo como artefato para download.

## Escopo

- **Fonte**: `crm_contacts` unido a `crm_deals` filtrado por `origin_id` presente em `bu_origin_mapping` (bu = `incorporador`, entity_type = `origin`).
- **Universo estimado**: ~22.753 contatos distintos.
- **Colunas** (todas de `crm_contacts`):
  - id, clint_id, name, email, phone, origin_id, organization_name, tags, custom_fields, created_at, updated_at, notes, merged_into_contact_id, merged_at, is_archived
- Adicionalmente incluirei uma coluna `origin_name` (resolvida via `crm_origins`) para facilitar a leitura.

## Passos

1. Consultar via `supabase--read_query` os contatos distintos com deal em origem Incorporador, trazendo todas as colunas + `origin_name`.
2. Paginar (LIMIT/OFFSET de 1000) até cobrir os ~22.753 registros.
3. Montar DataFrame pandas e salvar em `/mnt/documents/contatos_bu_incorporador.xlsx`.
4. Entregar via `<presentation-artifact>` para download.

## Observações

- `tags` e `custom_fields` são serializados como JSON string nas células.
- Contatos arquivados (`is_archived = true`) serão incluídos — avise se quiser filtrar.

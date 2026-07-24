## Exportar TODOS os contatos CRM (122.185) com coluna Etapa — XLSX

### Escopo
- **Universo**: `crm_contacts` onde `is_archived IS NOT TRUE` → 122.185 linhas.
- **Todas as BUs**: sem filtro por `bu_origin_mapping`.
- **Inclui contatos sem deal** (colunas de deal ficam vazias).

### Colunas do XLSX
Todas as colunas de `crm_contacts`:
`id, clint_id, name, email, phone, origin_id, organization_name, tags, custom_fields, created_at, updated_at, notes, merged_into_contact_id, merged_at, is_archived`

Colunas adicionais enriquecidas a partir do **deal mais recente do contato** (por `created_at` desc, qualquer BU):
- `origin_name` (via `crm_origins`)
- `bu` (via `bu_origin_mapping.bu` do origin do deal)
- **`etapa`** (via `crm_stages.stage_name` do `stage_id` do deal mais recente) ← faltava antes
- `etapa_color`
- `deal_id`, `deal_created_at`, `deal_stage_moved_at`

### Passos
1. Rodar query paginada (LIMIT 5000) em `crm_contacts` não-arquivados com LEFT JOIN LATERAL no deal mais recente + joins em `crm_stages`, `crm_origins`, `bu_origin_mapping`.
2. Iterar até cobrir 122.185 e serializar `tags`/`custom_fields` como JSON string.
3. Montar DataFrame pandas e salvar em `/mnt/documents/contatos_crm_todos_v2.xlsx` com auto-fit básico de colunas.
4. Entregar via `<presentation-artifact>`.

### Observações
- Arquivados (fusões/duplicatas) excluídos.
- Um contato = uma linha; se tiver múltiplos deals em BUs diferentes, prevalece o mais recente para preencher `bu`/`etapa`.
- Arquivo pode ficar ~40–60 MB pelo volume; se preferir CSV avise.

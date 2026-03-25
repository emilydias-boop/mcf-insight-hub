

## Fix: Consórcio BU Pipeline Mapping (Data Issue)

### Root cause

The `bu_origin_mapping` table for `consorcio` was overwritten (likely via the admin config at `/admin/configuracao-bu`) and now contains incorrect entries. The mapping points to a Leilão group (`f8a2b3c4-...`) with display_name "BU - Consorcio" instead of the actual consorcio pipeline groups.

**Current mapping (wrong):**
| entity_type | entity_id | name | is_default |
|---|---|---|---|
| group | f8a2b3c4-... | BU - LEILÃO (display: BU - Consorcio) | true |
| origin | 7d7b1cb5-... | Efeito Alavanca + Clube | false |

**Correct mapping (needs to be restored):**
| entity_type | entity_id | name | is_default |
|---|---|---|---|
| group | b98e3746-... | Perpétuo - Construa para Alugar | true |
| group | 267905ec-... | Hubla - Viver de Aluguel | false |
| group | a6f3cbfc-... | Perpétuo - X1 | false |
| origin | 57013597-... | PIPE LINE - INSIDE SALES | true |
| origin | 4e2b810a-... | INSIDE SALES - VIVER DE ALUGUEL | false |

### What this affects

Ygor (SDR, squad: consorcio) can't see his pipeline because:
1. The code uses `buMapping.groups` + `buMapping.origins` to filter the sidebar
2. The wrong mapping excludes all actual consorcio groups/origins
3. `SDR_ORIGIN_BY_BU['consorcio']` = `57013597-...` exists but isn't in the authorized list

### Fix

Create a migration to delete the incorrect entries and re-insert the correct consorcio mapping:

**File: new migration**
- DELETE from `bu_origin_mapping` WHERE `bu = 'consorcio'`
- INSERT the 5 correct rows (3 groups + 2 origins) with proper `is_default` flags

This is purely a data fix — no code changes needed.


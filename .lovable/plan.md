

## Plano: Atualizar níveis no banco e inserir backfill de eventos históricos

### Situação atual no banco

| SDR | sdr.nivel (atual) | Deveria ser | sdr.meta_diaria | employee.nivel |
|---|---|---|---|---|
| Antony Elias | 1 | **2** | 9 ✓ | 1 → **2** |
| Carol Souza | 1 | **2** | 9 ✓ | 1 → **2** |
| Julia Caroline | 1 | **2** | 9 ✓ | 1 → **2** |
| Leticia Nunes | 1 | **2** | 9 ✓ | 1 → **2** |
| Carol Correa | 2 | **3** | 10 ✓ | 2 → **3** |

- `meta_diaria` já está correta para todos
- `sdr.nivel` e `employees.nivel` ainda estão nos valores antigos
- Comp plans de março já refletem os novos valores (fixo/variavel corretos)
- Nenhum evento de promoção existe no histórico

### Ação: Migration SQL

Uma única migration que faz 3 coisas:

1. **Atualizar `sdr.nivel`** para os 5 SDRs
2. **Atualizar `employees.nivel`** para os 5 colaboradores vinculados
3. **Inserir eventos de backfill** em `employee_events`:
   - 5 eventos de **promoção de nível** (data: 2026-03-01)
   - 1 evento de **ajuste de meta** para Carol Correa (meta 9→10)
   - Eventos para Antony/Carol Souza/Leticia com meta anterior diferente (Feb: 119/17≈7 → Mar: 9)

Mapeamento dos IDs:

| Nome | sdr_id | employee_id |
|---|---|---|
| Antony Elias | 11111111-0001-0001-0001-000000000005 | 7ce46aa0-... |
| Carol Souza | 11111111-0001-0001-0001-000000000004 | 50a576c9-... |
| Julia Caroline | 11111111-0001-0001-0001-000000000001 | 9bd46a2a-... |
| Leticia Nunes | 11111111-0001-0001-0001-000000000003 | 3b38f437-... |
| Carol Correa | 11111111-0001-0001-0001-000000000002 | ff9072be-... |

### Nenhuma alteração de código
Apenas dados via migration SQL. O auto-logging já implementado capturará mudanças futuras.


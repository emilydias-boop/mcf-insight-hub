
## Plano: Mover 3 encaixes para semana anterior

### Registros a corrigir

| Lead | attendee_id | carrinho_week_start atual | Novo valor |
|------|------------|--------------------------|------------|
| Guilherme José Palhari | `7fba3539-732c-499d-8fc4-881bc7e74934` | 2026-04-09 | **2026-04-02** |
| João Marcos zenni | `01a20ce0-f4a2-48d4-b94f-44bc7798bce3` | 2026-04-09 | **2026-04-02** |
| Marratma Gandhi R. Barreto | `65ec4eb4-6aae-4b7c-b52f-98b4988a91a6` | 2026-04-09 | **2026-04-02** |

Nota: Márcio Barros (4° registro com carrinho_week_start=2026-04-09) **não será alterado** pois sua reunião é de 10/04, pertencendo à safra atual.

### Ação
Executar um UPDATE via insert tool nos 3 attendees, setando `carrinho_week_start = '2026-04-02'`.

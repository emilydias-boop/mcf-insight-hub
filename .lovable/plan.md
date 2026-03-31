

## Resultado dos Testes — Todos os 3 Fluxos OK

| Fluxo | Resultado | Detalhes |
|-------|-----------|----------|
| **1. Incompleto (entrada)** | OK | Owner = Antony, tag = `ANAMNESE-INCOMPLETA`, deal `ad9d54d0` |
| **2. Incompleto → Completo** | OK | Owner = Antony (preservado), tags merged, estágio moveu para **Lead Gratuito** (`d346320a`), action = `anamnese_completed` |
| **3. Completo direto** | OK | Owner = Mayara (distribuição equitativa), tag = `ANAMNESE`, estágio = Lead Gratuito |

O bug da coluna `.ilike('stage_name', 'Lead Gratuito')` foi confirmado como corrigido — o fluxo 2 agora move corretamente o deal para o estágio "Lead Gratuito" mantendo o owner Antony.

### Limpeza necessária

Deletar os dados de teste criados:
- **Deals**: `ad9d54d0-ee73-4382-9400-2986966adc1a`, `88dba8b8-33ac-4863-bfa7-2f1519b76580`
- **Contacts**: `9e85b49d-9722-4ca2-a0a1-4725b9def478`, `c55de77f-b04c-4091-bc2f-29d01fdc5f0b`
- **Deal activities** e **lead_profiles** associados

Executar migration SQL com DELETEs para limpar.


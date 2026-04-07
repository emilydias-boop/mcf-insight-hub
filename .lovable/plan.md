

# Corrigir deals A010 recuperados na pipeline errada

## Problema
Os 12 deals A010 recuperados no script anterior foram criados na pipeline **"PIPELINE - INSIDE SALES - VIVER DE ALUGUEL"** (`4e2b810a`) em vez da pipeline correta **"PIPELINE INSIDE SALES"** (`e3c04f21`) que pertence a BU Incorporador.

O webhook em si esta correto (linha 328 converte "A010 Hubla" → "PIPELINE INSIDE SALES"). O erro foi no script de recuperacao que usou a origin errada.

## Solucao

### 1. Corrigir os 12 deals existentes
Executar um UPDATE para mover os 12 deals recuperados para a origin correta:
- **De**: `4e2b810a-6782-4ce9-9c0d-10d04c018636` (PIPELINE - INSIDE SALES - VIVER DE ALUGUEL)
- **Para**: `e3c04f21-ba2c-4c66-84f8-b4341c826b1c` (PIPELINE INSIDE SALES)
- Tambem atualizar o `stage_id` para o estagio "NOVO LEAD" da pipeline correta
- Filtro: deals com tag `recuperado` criados em 2026-04-07

### 2. Verificar stage_id correto
Buscar o stage "NOVO LEAD" da origin `e3c04f21` e atualizar os deals.

### Detalhes tecnicos
- Migration SQL para UPDATE dos 12 deals
- Nenhuma alteracao de codigo necessaria (o webhook ja roteia corretamente para "PIPELINE INSIDE SALES")

| Acao | Detalhe |
|------|---------|
| Migration SQL | UPDATE 12 deals: origin_id e stage_id para a pipeline correta do Incorporador |


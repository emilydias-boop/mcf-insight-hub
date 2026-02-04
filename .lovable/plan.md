
# Plano: Testar Automação de Replicação Cross-Pipeline

## Objetivo

Mover um deal de teste para a etapa "Venda realizada" no Inside Sales e verificar se o trigger de replicação funciona corretamente.

## Deal Selecionado para Teste

| Campo | Valor |
|-------|-------|
| Deal ID | `39a6d3c2-cb62-4ba3-ba50-7063765493bc` |
| Nome | Roberta Buarque |
| Pipeline | PIPELINE INSIDE SALES |
| Estágio Atual | Lead Gratuito |
| Estágio Destino | Venda realizada |

## Regra de Replicação Ativa

| Config | Valor |
|--------|-------|
| Nome | Parceria -> Consorcio |
| Origem | PIPELINE INSIDE SALES → "Venda realizada" |
| Destino | Efeito Alavanca + Clube → "VENDA REALIZADA 50K" |
| Condição | Nenhuma (replica todos os deals) |

## Ações a Executar

1. **Atualizar o deal** para o estágio "Venda realizada"
   ```sql
   UPDATE crm_deals 
   SET stage_id = '3a2776e2-a536-4a2a-bb7b-a2f53c8941df'
   WHERE id = '39a6d3c2-cb62-4ba3-ba50-7063765493bc';
   ```

2. **Verificar fila de replicação** para confirmar que o trigger funcionou
   ```sql
   SELECT * FROM deal_replication_queue 
   WHERE deal_id = '39a6d3c2-cb62-4ba3-ba50-7063765493bc';
   ```

3. **Processar a fila** chamando a Edge Function `process-deal-replication`

4. **Verificar deal replicado** no pipeline destino
   ```sql
   SELECT * FROM crm_deals 
   WHERE replicated_from_deal_id = '39a6d3c2-cb62-4ba3-ba50-7063765493bc';
   ```

## Resultado Esperado

- Deal aparece na fila `deal_replication_queue` com status "pending"
- Após processar, novo deal criado em "Efeito Alavanca + Clube"
- Log registrado em `deal_replication_logs`
- Atividades criadas em ambos os deals

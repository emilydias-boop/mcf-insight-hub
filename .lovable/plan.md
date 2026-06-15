## Plano: Migração corretiva A017/A010 — Opção 1 (Listar → Revisar → Mover)

### Etapa 1 — Gerar CSV de auditoria (sem alterar nada)

Consultar `crm_deals` filtrando por `stage_id = '8a0b84d0-7b7a-479a-8c8e-e1067f1a3fda'` (A017 - Novo Lead) e exportar para `/mnt/documents/a017_migracao_auditoria.csv` com as colunas:

- `deal_id`
- `nome_cliente` (via join em `crm_contacts`)
- `email`, `telefone`
- `valor`
- `created_at`
- `tags` (para identificar A010 vs A017)
- `origem_id` / `pipeline`
- `stage_atual`
- `stage_sugerido` (A010 → "Novo Lead" do pipeline A010 `cf4a369c-c4a6-4299-933d-5ae3dcc39d4b`; A017 → permanece)
- `acao_sugerida` (MOVER / MANTER)

Entrega: artifact CSV para você revisar.

### Etapa 2 — Sua revisão

Você responde com uma das opções:
- "Pode mover todos" → seguimos para etapa 3 com a lista completa de MOVER
- "Exclui esses IDs: X, Y, Z" → removemos da migração
- "Cancela" → nenhuma alteração é feita

### Etapa 3 — Executar migração (somente após sua aprovação explícita)

UPDATE em `crm_deals` apenas nos IDs aprovados, alterando `stage_id` para o destino correto. Tudo dentro de uma transação para garantir rollback em caso de erro.

### Etapa 4 — CSV de confirmação "depois"

Novo export mostrando os deals movidos com `stage_id` atualizado, para você arquivar como prova da migração.

### Riscos mitigados

- Nenhuma escrita na etapa 1 — risco zero
- Sua aprovação explícita antes da etapa 3
- Transação atômica no UPDATE
- Trilha de auditoria (CSV antes + CSV depois)
- Sem efeito em automações: mudança de `stage_id` apenas dispara o fluxo normal de pipeline; não afeta Hubla, fechamento, ou pagamentos

### O que NÃO faz parte deste plano

- Não altera o código do webhook (já corrigido na entrega anterior)
- Não mexe em deals fora do stage `8a0b84d0-...`
- Não exclui nenhum deal — apenas reposiciona

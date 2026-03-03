

## Diagnóstico — Deals Duplicados na Pipeline Inside Sales

Encontrei **16 grupos** de contatos com deals duplicados **dentro da mesma pipeline** (Inside Sales). Padrão: o webhook do Clint cria um novo deal em vez de atualizar o existente.

### Casos identificados (16 contatos, 18 deals a deletar):

| Lead | Deal a MANTER (stage) | Deal(s) a DELETAR (stage) |
|------|----------------------|--------------------------|
| Ulysses Silva | `1e8c6429` Contrato Pago (3 ativ.) | `28d99693` Lead Gratuito (0) + `9baf28a4` Novo Lead (0) |
| Clayton Dias | `20247f2b` Novo Lead (3 ativ.) | `f1d48db3` Novo Lead (0) |
| Daniel Muniz | `3c3514c5` R2 Realizada (3 ativ.) | `5faf3662` Sem Interesse (1) |
| David Linhares | `9e7b7999` R1 Realizada (3 ativ.) | `4ad4aa4d` Novo Lead (0) |
| Juventino | `93b1b6b0` R1 Realizada (2 ativ.) | `34c2d85d` Novo Lead (0) |
| Fernando César | `191c7425` Lead Instagram (2 ativ.) | `3cd7cb88` Novo Lead (0) |
| Gunther Dantas | `5ba5acbf` Novo Lead (4 ativ.) | `8dfab1e8` Novo Lead (0) |
| Ismael Freitas | `731ec438` R2 Realizada (7 ativ.) | `5d8211c9` Contrato Pago (6) |
| Gabriel Castillo | `1d395c58` Novo Lead (6 ativ.) | `582e3c8f` No-Show (5) |
| Kauan Moraes | `297ed7c6` Novo Lead (3 ativ.) | `3fa2af94` Novo Lead (3) |
| Lorran Pinho | `8f60cb57` Sem Interesse (6 ativ.) | `727879b9` Novo Lead (0) |
| Lúcia Napolitano | `ea12fbfe` Sem Interesse (2 ativ.) | `0616624d` Novo Lead (0) |
| Macelo Araujo | `5e375e71` No-Show (3 ativ.) | deal duplicado |
| Ulysses (3 deals) | — | 2 duplicados |
| + mais 3 casos | — | — |

### Plano

**1. Migration SQL** — Deletar os ~18 deals duplicados identificados (mantendo sempre o deal com mais atividades/histórico)

**2. Prevenção no `clint-webhook-handler`** — Antes de criar um novo deal, buscar se já existe um deal na mesma `origin_id` para o mesmo `contact_id`. Se existir, atualizar o estágio do deal existente em vez de criar um novo. Isso complementa a proteção de race condition de contatos já implementada.

Mudança no webhook (~linhas de criação de deal):
- Adicionar: `SELECT id FROM crm_deals WHERE contact_id = ? AND origin_id = ? LIMIT 1`
- Se encontrar, fazer `UPDATE` no stage em vez de `INSERT`

### Resultado
- Ulysses e os outros 15 leads aparecerão com apenas 1 deal cada no Kanban
- Futuros webhooks reutilizarão o deal existente do contato na mesma pipeline


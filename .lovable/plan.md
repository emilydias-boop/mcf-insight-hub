

## Correção do Relatório v4 — Excluir TODOS os compradores A010

### Problema identificado
O v3 deveria ter excluído 6 leads (compra A010 antes do deal), mas só excluiu 1 (José Walter). Motivo: vários leads têm `email = NULL` no contato, e o matching por telefone falhou no script Python.

Além disso, há 8 leads que compraram A010 **depois** de entrar pela ANAMNESE. Estes são tecnicamente compradores A010 também.

### Decisão necessária
Preciso confirmar com o usuário: excluir **todos os 14 leads** que compraram A010 (antes ou depois), ou apenas os 6 que compraram **antes**?

### Ação proposta
Regenerar o PDF v4 com:
1. **Matching robusto**: usar phone suffix matching correto mesmo quando email é nulo
2. **Excluir todos os 14 compradores A010** (ou apenas os 6 "before", conforme decisão)
3. **Seção nova**: lista dos leads excluídos por compra A010 com detalhes (nome, data compra, data deal, timing)
4. **Total esperado**: 96 - 14 = **82 leads** (se excluir todos) ou 96 - 6 = **90 leads** (se só before)

### Dados dos 14 leads A010
**BEFORE (compraram antes do deal ANAMNESE)**:
- Aline Letícia Soares de Melo (8s antes)
- Felipe Rodrigues - A010 (1m54s antes)
- José Walter do Nascimento Mota jr (16 dias antes)
- Júlio Gil Simões Freire (1m08s antes)
- Luiz Valentin Morello Filho (55 dias antes)
- Matheus de Lima Silva (52s antes)

**AFTER (compraram depois do deal ANAMNESE)**:
- Alexandre Bonetto de Almeida (+2 dias)
- Andresa Vaz (+7 min)
- Caio (+10 min)
- HENRIQUE FARIA (+37 min)
- Lucne Serina Ferrari Miyamoto (+7 min)
- Renato Amante Chidiquimo (+4 min)
- Victor farias marques (+49 min)
- Vinícius Carvalho dos Santos (+2 dias)

### Implementação
- Script Python em `/tmp/`, output em `/mnt/documents/relatorio-leads-anamnese-incorporador-v4.pdf`
- QA visual obrigatória


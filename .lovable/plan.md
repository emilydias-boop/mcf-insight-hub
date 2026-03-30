

## Regenerar PDF — Excluir leads que compraram A010 antes da tag ANAMNESE

### Lógica de exclusão
Para cada lead com tag "ANAMNESE" na BU Incorporador:
1. Buscar compras A010 em `hubla_transactions` (por email ou telefone) com `product_category = 'a010'` e `sale_status = 'completed'`
2. Comparar a `sale_date` da compra A010 com o `created_at` do deal com tag ANAMNESE
3. Se a compra A010 ocorreu **antes** do deal ANAMNESE ser criado → **excluir** esse lead do relatório

### Impacto esperado
- Dos 97 leads atuais, serão removidos os que já eram compradores A010 antes de entrar pelo funil ANAMNESE
- O relatório mostrará apenas leads que chegaram "puros" pelo canal ANAMNESE (sem histórico A010 prévio)

### Output
- Script Python em `/tmp/` que:
  1. Puxa os 97 leads ANAMNESE da BU Incorporador
  2. Cruza com `hubla_transactions` por email/telefone
  3. Remove quem tinha A010 antes do deal ANAMNESE
  4. Regenera o PDF com as mesmas seções (KPIs, estágios, lista completa, exclusivos, origem dos duplicados)
- PDF: `/mnt/documents/relatorio-leads-anamnese-incorporador-v3.pdf`
- QA visual obrigatória

### Arquivos
- `/tmp/gen_anamnese_v3.py` (temporário)
- `/mnt/documents/relatorio-leads-anamnese-incorporador-v3.pdf` (entregável)


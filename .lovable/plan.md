

## Relatório PDF Final: Leads A010 Limpos SEM Duplicatas — Março 2026

### Problema identificado
O filtro anterior verificava duplicatas apenas pelo `contact_id` (mesmo registro de contato). Porém, a importação CSV de 3 de março criou **novos registros de contato** para pessoas que já existiam no CRM (ex: Ellen Bertella, Caio Rainho). O cruzamento precisa ser feito por **email e telefone (9 dígitos)**, não por `contact_id`.

### Números reais
- **362** leads "puros A010" (sem parceria/contrato/renovação)
- **75** são duplicatas — já têm deal com dono no CRM (mesmo email ou telefone)
- **287** são verdadeiramente limpos e precisam de distribuição

### Execução

1. **Query SQL** com cruzamento forçado por email e sufixo de 9 dígitos do telefone contra TODOS os deals com dono no CRM (não apenas mesmo `contact_id` ou mesma pipeline)
2. **Excluir** os 75 leads que já aparecem com dono em qualquer deal
3. **Gerar PDF** com os 287 leads restantes:
   - Resumo: funil de limpeza (2013 → 362 A010 puros → 287 sem duplicata)
   - Tabela: Nome, Email, Telefone, Produto A010, Data Compra, Valor, Estágio Atual
   - Ordenado por data de compra (mais antigos primeiro)
4. **QA visual** e salvar em `/mnt/documents/`

### Detalhes técnicos
- Cruzamento global: `LOWER(email)` e `RIGHT(phone_digits, 9)` contra todos os deals com `owner_id IS NOT NULL`
- Mantém exclusão de categorias avançadas (contrato, renovacao, parceria, etc.)
- PDF landscape via reportlab


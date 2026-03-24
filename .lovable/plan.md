

## Plano: Gerar relatório PDF do backfill A010

### Dados já levantados

| Métrica | Valor |
|---------|-------|
| Compradores A010 offer (120d) | 1.105 |
| Já no PIS por email | 1.060 (96%) |
| Já no PIS por telefone | 17 |
| Parceiros filtrados | 95 |
| Deals criados pelo backfill | 329 |
| Removidos por email (cross-contact) | 235 |
| Removidos por telefone (cross-contact) | 58 |
| **Deals legítimos restantes** | **36** |
| Leads perdidos por webhook | 0 |

### Causa raiz confirmada

A função `backfill-a010-offer-leads` verificava duplicatas usando **apenas o `contact_id` específico** encontrado na busca. Porém, muitos leads tinham **contatos duplicados** no CRM (mesmo email, `contact_id` diferente). A função encontrava o contato A (sem deal), mas o deal real estava no contato B. Resultado: 293 falsos positivos de 329 deals criados.

### O que será gerado

Um **PDF** em `/mnt/documents/relatorio-backfill-a010.pdf` com:

1. **Resumo executivo** — o que aconteceu e por quê
2. **Números consolidados** — tabela com os 1.105 compradores e como cada grupo foi categorizado
3. **Causa raiz técnica** — explicação do bug de dedup por `contact_id` vs cross-contact
4. **Timeline** — cada etapa desde a criação até a limpeza final
5. **Breakdown numérico** — 329 → -235 → -58 → 36
6. **Auditoria de webhooks** — 541 + 22 + 56 eventos verificados, zero perdas
7. **Pendências** — 4 deals faltantes + 3 duplicatas internas + correção da função

### Implementação

Script Python com `reportlab` gerando PDF formatado com tabelas e seções.


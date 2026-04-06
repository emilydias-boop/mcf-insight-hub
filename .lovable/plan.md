

# Filtrar leads ja resolvidos da aba Acumulados

## Problema

A aba "Acumulados" mostra 100 leads, mas muitos ja foram resolvidos:
- **Dercio Maurilio Frai**: tem R2 Aprovada (01/04) e comprou A001 (02/04), mas aparece como "Sem R2" porque o codigo so olha a PRIMEIRA R2 apos o contrato (que nao tem status), ignorando a segunda R2 que esta aprovada
- Dos 54 contratos da safra 26/03, 20 ja tem R2 aprovada e 17 ja compraram parceria — esses nao deveriam estar na lista

## Causa raiz

No `useR2AccumulatedLeads.ts`, a logica pega apenas `validR2s[0]` (primeira R2 apos sale_date). Se essa primeira R2 nao tem status, classifica como "sem_r2" sem verificar se existe outra R2 posterior aprovada ou se o lead ja comprou produtos.

## Solucao

### Alteracao: `src/hooks/useR2AccumulatedLeads.ts`

1. **Verificar TODAS as R2s do contato**, nao so a primeira:
   - Se QUALQUER R2 apos sale_date tem status "Aprovado" → excluir (ja resolvido)
   - Se QUALQUER R2 tem status definitivo (Reembolso, Desistente, Reprovado, Cancelado) → excluir (ja tratado no "Fora do Carrinho")
   - Se a primeira R2 tem status "Proxima Semana" mas existe outra R2 posterior aprovada → excluir

2. **Verificar compra de parceria**: Antes de marcar como "sem_r2", verificar se o email tem transacao de parceria/incorporador (excluindo A000/contrato) com status completed. Se sim → excluir

3. **Implementacao**:
   - Apos coletar todos os emails da safra, fazer uma query extra buscando transacoes de parceria desses emails
   - Criar set `resolvedEmails` com emails que tem parceria comprada
   - Na iteracao de R2s por contato: verificar se alguma R2 (nao so a primeira) tem status aprovado ou definitivo
   - So incluir no resultado se nao estiver resolvido por nenhum dos criterios

## Resultado esperado
- Dercio e outros leads ja aprovados/parceiros saem da lista
- Lista mostra apenas leads genuinamente pendentes que precisam de atencao
- Numero deve cair significativamente de 100

## Arquivo alterado
1. `src/hooks/useR2AccumulatedLeads.ts`


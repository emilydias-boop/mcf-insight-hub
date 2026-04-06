

# Otimizar Backfill: Priorizar Órfãos Verdadeiros

## Problema

O backfill encontra 1053 "orphans" mas a maioria são **contatos duplicados** cujo irmão já tem deal. A função gasta todo o `limit` arquivando duplicatas e nunca chega nos **135 órfãos verdadeiros** (como o Orlando).

## Solução

### Arquivo: `supabase/functions/backfill-orphan-a010-deals/index.ts`

Reestruturar a lógica em 2 fases separadas:

**Fase 1 — Criar deals para órfãos verdadeiros** (emails sem nenhum deal):
- Após buscar todos os emails A010 compradores, verificar quais emails já têm algum deal na pipeline (via qualquer contato)
- Filtrar apenas emails sem deal nenhum
- Para cada email, pegar o contato mais antigo (não arquivado), criar o deal e distribuir
- Arquivar contatos duplicados do mesmo email (mantendo o que recebeu o deal)

**Fase 2 — Limpar duplicatas restantes** (emails com deal mas contatos extras):
- Processar os contatos órfãos cujo email já tem deal via outro contato
- Apenas arquivar e vincular ao contato principal (sem criar deal)

A mudança principal é na **ordem de processamento**: primeiro cria deals para quem precisa, depois limpa duplicatas. Hoje faz tudo misturado e as duplicatas consomem o `limit`.

### Mudanças específicas no loop (linhas 122-233)

1. Separar `orphans` em dois grupos:
   - `trueOrphans`: contatos cujo email não tem nenhum deal (nenhum contato com esse email tem deal)
   - `duplicateOrphans`: contatos cujo email já tem deal via outro contato

2. Processar `trueOrphans` primeiro (criar deal + distribuir)
3. Processar `duplicateOrphans` depois (apenas arquivar)
4. O `limit` se aplica ao total das duas fases

### Performance
- A pré-classificação é feita na query existente de `contactsWithDeal` — basta agrupar por email em vez de por contact_id
- Sem queries adicionais ao banco

## Resultado esperado
- Orlando e os 135 órfãos verdadeiros são processados primeiro
- Com `limit=50`, cria ~50 deals novos em vez de 0
- Duplicatas são limpas só depois, no espaço que sobrar do limit


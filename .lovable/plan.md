

## Corrigir propostas aceitas sem cadastro pendente

### Diagnostico

As 2 propostas (Joao Ferreira - R$ 240.000 e Kleber Donizetti - R$ 500.000) estao com `status = 'aceita'` na tabela `consorcio_proposals`, porem a tabela `consorcio_pending_registrations` esta completamente vazia. Isso indica que o INSERT do registro pendente falhou silenciosamente (provavelmente por RLS) enquanto a proposta ja foi marcada como aceita.

**Causa raiz:** A politica RLS de INSERT na tabela `consorcio_pending_registrations` exige `auth.uid() = created_by`. Se por algum motivo o `user?.id` estava null ou diferente, o INSERT falha e o erro deveria impedir a atualizacao da proposta. No entanto, o problema ja ocorreu e os dados estao inconsistentes.

### Solucao em 2 partes

**Parte 1: Corrigir os dados existentes**

Inserir manualmente os 2 registros pendentes para as propostas aceitas que ficaram orfas, usando os dados dos deals associados.

Executar SQL:
```text
INSERT INTO consorcio_pending_registrations (proposal_id, deal_id, tipo_pessoa, status, created_by)
SELECT 
  p.id as proposal_id,
  p.deal_id,
  'pf' as tipo_pessoa,
  'aguardando_abertura' as status,
  p.created_by
FROM consorcio_proposals p
WHERE p.status = 'aceita' 
  AND p.consortium_card_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM consorcio_pending_registrations r WHERE r.proposal_id = p.id
  );
```

Isso criara os registros que faltam e eles aparecerao em "Cadastros Pendentes". Os dados do cliente (nome, CPF, etc.) ficarao vazios, mas o gestor podera preencher ao abrir a cota, ou o closer podera reabrir o modal "Cadastrar Cota" para completar.

**Parte 2: Evitar que isso aconteca novamente**

No `useCreatePendingRegistration` (`src/hooks/useConsorcioPendingRegistrations.ts`), inverter a ordem das operacoes: primeiro atualizar a proposta para 'aceita', e so depois inserir o registro pendente. Assim, se o INSERT falhar, a proposta ja esta aceita e o botao "Cadastrar Cota" permite retentar. Alem disso, adicionar um `try/catch` mais robusto e verificar que `user?.id` existe antes de prosseguir.

Alteracoes no arquivo `src/hooks/useConsorcioPendingRegistrations.ts`:
1. Adicionar validacao: se `user?.id` for null, lancar erro claro
2. Garantir que o registro pendente e criado com `created_by` preenchido
3. Adicionar log de erro mais claro caso o INSERT falhe

### Resultado

Os 2 cadastros pendentes aparecerao na aba "Cadastros Pendentes" do Controle Consorcio. O gestor podera clicar em "Abrir Cadastro" para completar os dados da cota. Futuros aceites terao protecao contra falhas silenciosas.



# Tornar "Responsavel pelo agendamento R2" dinamico via flag no perfil

## Problema

A lista de responsaveis por agendar R2 e hardcoded em `R2_BOOKERS_LIST` com 6 nomes fixos. Quando alguem novo precisa agendar R2 (ou sai da equipe), e necessario alterar o codigo. O usuario quer que essa configuracao esteja acessivel na area de usuarios.

## Solucao

Adicionar uma coluna `can_book_r2` (boolean) na tabela `profiles` e usar essa flag para montar a lista dinamicamente. Na tela de gerenciamento de usuarios, adicionar um toggle para ativar/desativar essa permissao.

## Secao Tecnica

### 1. Migracao SQL

Adicionar coluna `can_book_r2` na tabela `profiles` com default `false`, e setar `true` para os 6 usuarios atuais (Yanca, Julio, Cristiane, Thayna, Jessica Bellini, Leticia Rodrigues) baseando-se nos IDs ja presentes no `R2_BOOKERS_LIST`.

```text
ALTER TABLE public.profiles ADD COLUMN can_book_r2 boolean DEFAULT false;

UPDATE public.profiles SET can_book_r2 = true
WHERE id IN (
  '04bb4045-701d-443c-b2c9-aee74e7f58d9',  -- Yanca
  'dd76c153-a4a5-432e-ab4c-0b48f6141659',  -- Julio
  'c8fd2b83-2aee-41a4-9154-e812f492bc5f',  -- Cristiane
  '6bb81a27-fd8f-4af8-bce0-377f3576124f',  -- Thayna
  '6cb06155-26dd-4be9-87ce-53e60a59a4e7',  -- Leticia Rodrigues
  'a6802c50-1b85-4646-b20e-f40ae89c3157'   -- Jessica Bellini
);
```

### 2. Hook para buscar bookers R2

**Novo arquivo**: `src/hooks/useR2Bookers.ts`

Query simples que busca profiles com `can_book_r2 = true`:

```text
SELECT id, full_name FROM profiles
WHERE can_book_r2 = true
ORDER BY full_name
```

### 3. R2QuickScheduleModal.tsx

- Remover import de `R2_BOOKERS_LIST`
- Usar o novo hook `useR2Bookers` para popular o dropdown
- Manter a mesma UX (Select com nomes)

### 4. UserDetailsDrawer.tsx — Aba Configuracoes

Adicionar um toggle/switch "Pode agendar R2" na aba de configuracoes do usuario, que atualiza `profiles.can_book_r2`. Visivel apenas para admins/managers.

### 5. Tipos Supabase

Atualizar `src/integrations/supabase/types.ts` para incluir `can_book_r2` na interface de `profiles`.

## Resultado

- Admins podem ativar/desativar "Pode agendar R2" diretamente no painel de usuarios
- O dropdown de agendamento R2 reflete automaticamente quem tem a flag ativa
- Nenhuma lista hardcoded precisa ser mantida no codigo


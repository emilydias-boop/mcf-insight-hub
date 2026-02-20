
# Corrigir vinculacao do perfil na pagina "Meus Equipamentos"

## Problema

A pagina `MyEquipmentPage.tsx` tenta encontrar o colaborador buscando pela coluna `email_corporativo` na tabela `employees`, mas essa coluna **nao existe**. A tabela `employees` possui `email_pessoal` e, mais importante, uma coluna `profile_id` que ja vincula diretamente o colaborador ao perfil do usuario.

O resultado e que nenhum colaborador e encontrado e a pagina exibe "Seu perfil nao esta vinculado a um colaborador."

## Solucao

Alterar a logica de busca para usar `profile_id` em vez de tentar buscar por email. Isso e mais confiavel e direto:

### Arquivo: `src/pages/patrimonio/MyEquipmentPage.tsx`

Simplificar o `useEffect` de carregamento:

```text
Antes (incorreto):
1. Busca user -> busca profile.email -> busca employees.email_corporativo

Depois (correto):
1. Busca user -> busca employees.profile_id = user.id
```

Isso elimina a etapa intermediaria de buscar o email no profiles e usa a relacao direta que ja existe no banco de dados. O `profile_id` da Emily (`3e91331b-...`) ja esta corretamente preenchido no registro de employee dela.

Alteracao de apenas 1 arquivo, correcao de ~5 linhas.

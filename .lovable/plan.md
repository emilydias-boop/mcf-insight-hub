
## Plano atualizado: corrigir o falso “Viewer” e o bloqueio no CRM Consórcio

### Diagnóstico confirmado

O problema não é mais o banco nem o JWT stale.

Há **dois bugs diferentes ao mesmo tempo**:

1. **O badge do usuário está enganando**
   - Em `src/components/layout/AppSidebar.tsx`, a função `getRoleLabel()` só trata `admin`, `manager`, `coordenador`, `sdr`, `closer`, `rh` e `financeiro`.
   - Qualquer role fora dessa lista cai no fallback `"Viewer"`.
   - Então `assistente_administrativo` está sendo **exibido como Viewer**, mesmo quando a role real já foi carregada corretamente.

2. **O guard de permissão do CRM está resolvendo errado**
   - `ResourceGuard` usa `useResourcePermission`.
   - `useResourcePermission` faz:
     - filtro por `role + resource`
     - `maybeSingle()`
     - **não considera BU**
   - Para `assistente_administrativo` no recurso `crm` existem **duas permissões válidas**:
     - global: `view`
     - BU consórcio: `full`
   - Como há mais de uma linha, essa estratégia com `maybeSingle()` é frágil e pode derrubar a resolução da permissão, resultando em **Acesso Negado**.

### Evidência que confirma isso

- No banco, Antony está com role `assistente_administrativo`.
- Os logs de auth mostram logout/login recentes e hook executando com sucesso.
- No menu lateral da screenshot aparecem itens como:
  - `Vendas`
  - `Controle Consorcio`
  - `Importar`
  - `Relatórios`
  - `Documentos Estratégicos`
- Esses itens já exigem `assistente_administrativo` no sidebar.
- Ou seja: **a role funcionalmente já está chegando**, mas:
  - o badge mostra “Viewer” por erro de label;
  - a tela do CRM nega acesso por erro de resolução de permissão.

### O que vou implementar

#### Passo 1 — Corrigir a exibição da role no sidebar
Atualizar `AppSidebar.tsx` para parar de usar labels hardcoded incompletos.

Preferência:
- usar o mapa central `ROLE_LABELS` de `src/types/user-management.ts`

Resultado:
- `assistente_administrativo` aparecerá como **Assistente Administrativo**
- elimina o falso diagnóstico de “continua Viewer”

#### Passo 2 — Corrigir o motor de permissão do `ResourceGuard`
Substituir a lógica atual baseada em `useResourcePermission` por uma abordagem compatível com BU.

Melhor caminho:
- fazer `ResourceGuard` usar `useMyPermissions`, que já:
  - lê todas as permissões da role
  - aplica override por BU ativa
  - faz fallback para permissão global

Alternativa equivalente:
- refatorar `useResourcePermission` para buscar múltiplas linhas e resolver:
  1. permissão da BU ativa
  2. fallback global
  3. default `none`

### Resultado esperado após a correção

Para Antony em `/consorcio/crm`:

- badge deixa de mostrar “Viewer”
- passa a mostrar **Assistente Administrativo**
- `ResourceGuard` deixa de cair em falso negativo
- acesso ao CRM Consórcio passa a funcionar com a permissão correta

### Arquivos a ajustar

- `src/components/layout/AppSidebar.tsx`
- `src/components/auth/ResourceGuard.tsx`
- `src/hooks/useResourcePermission.ts` ou remoção do uso dele nesse fluxo
- possivelmente reaproveitar `src/hooks/useMyPermissions.ts`

### Validação final

Vou validar este fluxo:

1. login com usuário de role `assistente_administrativo`
2. conferir badge no rodapé/sidebar
3. abrir `/consorcio/crm`
4. confirmar que o alerta “Acesso Negado” não aparece
5. conferir que o comportamento continua correto para:
   - admin
   - manager
   - coordenador
   - viewer

### Observação técnica importante

Não vejo necessidade de migration nem ajuste no Supabase para esta correção.  
O banco já está coerente; o erro está na **camada frontend de leitura/exibição de permissões**.

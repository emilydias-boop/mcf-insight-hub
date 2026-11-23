# Manual de Conduta MCF Capital: aviso obrigatório, aceite registrado e Documentos Internos

## O que o usuário vai ver
1. **Aviso obrigatório**: ao entrar no sistema, todo usuário que ainda não aceitou vê uma janela fixa (não fecha com X, clique fora ou Esc) com link para abrir o manual e a caixa **"Li e entendi o manual de conduta da MCF CAPITAL"**. O botão **Confirmar** só libera após marcar a caixa. A janela volta em todo acesso até o aceite.
2. **Documentos Internos**: novo item no menu lateral, visível para todos os usuários logados, listando o Manual de Conduta (abrir/baixar). Admin e RH podem publicar novos documentos ali; os demais apenas leem.
3. **RH > cadastro do colaborador**: nova aba **"Termos e aceites"** mostrando, por documento: data/hora do aceite (horário de São Paulo), versão do documento, usuário que aceitou, navegador/dispositivo. Também aparece na tela de Colaboradores um indicador de quem ainda não aceitou.

## Regras
- O aceite é por versão do documento: se o RH publicar uma nova versão do manual marcada como "exige aceite", o aviso volta para todos.
- O aceite é imutável (não pode ser editado nem apagado), servindo como log de assinatura.
- O registro é ligado ao usuário e ao cadastro do colaborador (vínculo pelo login do colaborador); usuários sem cadastro de RH também aceitam, e o registro aparece quando o cadastro for vinculado.

## Detalhes técnicos
- Arquivo enviado sobe para um bucket privado `documentos-internos`; leitura liberada a qualquer autenticado, escrita só admin/rh.
- Tabelas novas: `documentos_internos` (titulo, descricao, arquivo_path, versao, exige_aceite, ativo, publicado_por) e `documentos_internos_aceites` (documento_id, versao, user_id, employee_id, aceito_em, user_agent, texto_confirmado), com UNIQUE(documento_id, versao, user_id). GRANTs + RLS: leitura de documentos para authenticated; aceite inserível só pelo próprio usuário via RPC `registrar_aceite_documento`, sem UPDATE/DELETE; leitura dos aceites pelo próprio usuário, admin e rh.
- RPC `documentos_pendentes_aceite()` alimenta o aviso; componente montado no layout principal, uma consulta por sessão.
- Página `/documentos-internos`, item no AppSidebar sem requiredRoles; aba nova em EmployeeDrawer/ColaboradorProfile.
- Registro da decisão de arquitetura no AGENTS.md.

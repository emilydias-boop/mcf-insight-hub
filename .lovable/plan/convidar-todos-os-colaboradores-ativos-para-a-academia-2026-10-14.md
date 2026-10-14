# Convidar todos os colaboradores ativos para a Academia

## O que muda
1. **Convite em massa (dado, uma vez):** os colaboradores ativos do cadastro do RH que têm login no app e ainda não estão na Academia (hoje 26 de 40) passam a constar no Admin RH, com:
   - Nome, e-mail e cargo vindos do cadastro do RH.
   - **Frente** pela BU do RH: Consórcio → Consórcio imobiliário; Crédito → Crédito imobiliário; Solar → Energia solar. Inside, Incorporador, Diretoria, TI, Marketing e Projetos ficam sem frente (ajustável depois).
   - **Gestor**: o gestor do cadastro do RH (15 têm); quem não tem fica sem gestor.
   - **Padrinho**: Thobson para todos os novos.
   - Notificação de boas-vindas da Academia para cada novo convidado.
2. **Data de início = 14/10/2026 para todos** os perfis da Academia, inclusive os 13 que já estavam (a contagem "Dia X de 90" deles recomeça).
3. **Texto:** o campo "Data de início" no formulário de convite passa a se chamar **"Data de Início na Academia"**, e a lista mostra "início na Academia".

## Antes de aplicar
- Backup dos 13 perfis atuais (id e data de início antiga) numa tabela de backup restrita a admin, para poder desfazer.
- Conferência depois: total na Academia = 40 e todas as datas = 14/10/2026.

## Detalhes técnicos
- Dados via SQL (sem mudar estrutura): INSERT em `academia_perfis` a partir de `employees` (status='ativo', `coalesce(user_id, profile_id)` não nulo, sem perfil existente, `ON CONFLICT DO NOTHING`), frente por `departamento ILIKE`, gestor = login do `employees.gestor_id`, padrinho = profile Thobson; INSERT em `academia_notifications`; UPDATE `academia_perfis SET data_inicio = '2026-10-14'`.
- Front: só os rótulos em `src/pages/academia/Admin.tsx`. Nenhuma outra tela ou BU é afetada.

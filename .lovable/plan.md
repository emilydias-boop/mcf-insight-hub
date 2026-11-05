# Estrutura Organizacional (antes das Fases 4–6)

Nova tela em RH > **Estrutura Organizacional** (`/rh/estrutura`): um fluxograma interativo de setores, cargos e pessoas, montado com os cadastros da Fase 1. Nenhuma estrutura paralela será criada.

## O que o usuário verá
- **Indicadores** no topo: setores, cargos, pessoas ativas, cargos vagos e requisições em andamento.
- **Três modos** de visualização: Setores, Cargos (agrupados dentro do setor) e Pessoas (organograma clássico).
- **Cards** que usam o design do app, com faixa na cor do setor e destaque maior para os níveis altos. Selos: "Vago" (borda tracejada), "Interino", "Vaga em aprovação"/"Em recrutamento" e uma estrela para o responsável do setor.
- **Navegação:** zoom, arrastar, "Ajustar à tela", minimapa e ramos que abrem e fecham. Os dois primeiros níveis já começam abertos.
- **Busca:** centraliza o resultado e destaca o caminho até o topo, esmaecendo o resto. Ao passar o mouse, aparecem as conexões diretas.
- **Filtros:** setor, nível e "apenas vagos".
- **Painel lateral** ao clicar num card:
  - Setor: responsável, setor pai, subsetores, cargos, pessoas e indicadores.
  - Cargo: descrição, nível, a quem reporta, ocupante atual, histórico de ocupantes, faixa salarial (só RH) e requisições.
  - Pessoa: cargo, setor, superior, cadeia até o topo, subordinados e link para perfil/dossiê (conforme permissão).
- **"Ver estrutura em: [data]"**: monta o organograma a partir do histórico de cargos.
- **Exportar** em PNG e PDF.
- **Celular/tablet:** também uma "Visão em lista", em árvore recolhível.
- Telas de carregamento, aviso de estrutura vazia com atalho para Configurações > Governança, e temas claro e escuro.

## Modo edição (só RH/admin)
- Criar e editar setor e cargo no painel lateral.
- Arrastar um card para outro pai abre uma confirmação com antes, depois e impacto (quantos cargos e pessoas são afetados).
- Atribuir ou encerrar o cargo de uma pessoa, com datas de início e fim. O histórico é preservado.
- O banco bloqueia ciclos e cargos sem setor. Toda alteração fica no log de auditoria.

## Permissões
- Todo usuário logado vê a estrutura.
- Faixa salarial, requisições e dossiê seguem as regras atuais.
- Edição só para RH/admin, conferida no banco.

## Detalhes técnicos
- Bibliotecas novas: `@xyflow/react`, `@dagrejs/dagre` (layout de cima para baixo, recalculado a cada mudança) e `html-to-image`. O `jspdf` já está instalado.
- Leitura com React Query: `departamentos`, `cargos_catalogo`, `employees`, `employee_cargo_historico`, `gov_requisicoes_contratacao` (RLS atual) e as funções `gov_superior_imediato`, `gov_responsavel_setor` e `gov_ocupante_cargo`.
- Uma migration nova com:
  - Função de leitura `gov_estrutura_em(p_data)`: devolve setores, cargos, vínculos e superiores numa data, em uma única consulta, sem salário para quem não é RH.
  - Gatilhos de validação contra ciclo, tanto em `cargos_catalogo.reporta_a` quanto em `departamentos.pai`.
  - Gravação de cada alteração em `audit_logs`.
  - Funções de escrita `gov_estrutura_mover` e `gov_vinculo_atribuir`/`encerrar`, todas checando `gov_is_rh_admin`.
- Antes de exibir o selo "Interino", vou checar se o histórico de cargos já marca interinidade. Se não marcar, acrescento um campo opcional nessa tabela (sem nova tabela).
- Arquivos: `src/pages/rh/EstruturaOrganizacional.tsx` e componentes em `src/components/hr/estrutura/` (nós, painel, toolbar, lista, layout), além da rota e do link no menu. Testes para o layout e a detecção de ciclos.
- A tela antiga `/admin/organograma` continua como está.
- Não publico sem pedido.

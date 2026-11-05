# Governança de Contratação e Desligamento — Plano

## O que já existe (confirmado no banco e no código)
- **Colaboradores**: `employees` (com `gestor_id`, `departamento`, `squad`, `cargo_catalogo_id`, `user_id`, `profile_id`, `data_admissao/demissao`, `status`, `salario_base`, `tipo_contrato`). Telas em RH > Colaboradores, perfil do colaborador e Configurações.
- **Setores**: `departamentos` (nome, código, BU) e `squads` (ligados ao departamento); `areas_catalogo`.
- **Cargos**: `cargos_catalogo` (área, nível, fixo/variável/OTE, descrição, competências) — serve como faixa de referência.
- **Organograma**: `organograma` (cargo → cargo pai, por squad/departamento).
- **Histórico de gestão parcial**: `employee_notes` (com nota privada), `employee_pdi` + comentários, `employee_events`, `user_flags` (red/yellow/green por usuário).
- **Papéis**: `user_roles` com `admin`, `rh`, `manager`, `coordenador` etc.

Nada disso será duplicado nem alterado de forma destrutiva; o módulo novo se apoia nessas tabelas.

## Fase 1 — Estrutura hierárquica e alçadas
- Acrescentar a `departamentos`: responsável pelo setor e setor pai.
- Acrescentar a `cargos_catalogo`: setor, cargo ao qual reporta e faixa salarial (mín./máx.).
- Nova tabela de **vínculo colaborador ↔ cargo com histórico** (início/fim), preenchida a partir do cargo atual de cada colaborador (somente leitura do atual, sem mudar `employees`).
- Funções: superior imediato, responsável do setor, cadeia hierárquica, ocupante atual de um cargo (prioridade: vínculo histórico → `gestor_id`).
- Tabela de **regras de alçada** (condição: tipo de movimento, aumento de quadro, salário acima de valor, tipo de desligamento; aprovador: cargo, setor ou papel; ordem).
- Tela RH > Configurações > Governança (organograma de setores/cargos, faixas, alçadas, prazos) — só RH e admin.

## Fase 2 — Requisição de contratação
- Tabela de requisições com todos os campos pedidos (job description estruturada, regime, remuneração, modelo de trabalho, justificativa).
- Justificativa obrigatória quando aumento de quadro, salário fora da faixa ou alçada exigir.
- Status: Rascunho → Em aprovação → Aprovada / Reprovada / Devolvida → Em recrutamento → Concluída (vinculada ao colaborador = ficha de admissão) → Cancelada.
- Tela RH > Requisições (lista com filtros status/setor/regime + formulário).

## Fase 3 — Dossiê do colaborador
- Tabela única de registros: 1:1, feedback, yellow flag, red flag, PDI; anexos em armazenamento privado; ciência/recusa e comentário do colaborador; marcação confidencial.
- Imutável 24h após criação (regra no banco); depois só adendos ligados ao original.
- Painel resumo 3/6/12 meses, flags abertas, última 1:1.
- As tabelas antigas (`employee_notes`, `employee_pdi`, `user_flags`) continuam funcionando; aparecem na linha do tempo como "registros anteriores" somente leitura.
- Aba "Dossiê" no perfil do colaborador.

## Fase 4 — Solicitação de desligamento
- Tabela de desligamentos com tipo, motivo, data, justificativa e registros do dossiê selecionados.
- Aviso (não bloqueia) sem flags/feedbacks construtivos em 6 meses → justificativa reforçada.
- Signatários sugeridos: solicitante, superior, atores da requisição original (ou ocupante atual marcado "substituto"), RH, alçadas. Adicionar livre; remover exige justificativa + validação do RH.
- O próprio colaborador nunca vê. Tela RH > Desligamentos + botão no perfil.

## Fase 5 — Assinatura digital interna (compartilhada)
- Ao enviar: snapshot JSON + hash SHA-256 gerado no servidor; versões guardadas.
- Fluxo sequencial configurável; pendência em **Minhas aprovações** (badge no menu), aviso no sistema e por e-mail (via envio já existente e protegido).
- Aprovar e assinar (checkbox + redigitar senha), Reprovar ou Devolver (comentário obrigatório).
- Registro: usuário, nome, cargo e setor no momento, papel, horário do servidor, IP, navegador, hash.
- Edição após envio invalida assinaturas e reinicia, mantendo histórico.
- Prazo por etapa com lembrete automático diário; delegação temporária registrada.
- Página de verificação com resumo, hash e trilha, exportável em PDF.

## Fase 6 — Segurança e auditoria
- Regras de acesso em todas as tabelas novas conforme pedido (solicitante, signatários, cadeia acima, RH; desligamento sem acesso do colaborador; dossiê sem confidenciais para o colaborador).
- Log de auditoria só de inclusão (sem alteração/exclusão), incluindo visualização de dossiê.
- Anexos em bucket privado com links temporários.
- Indicadores do RH: requisições por status, tempo médio por etapa, desligamentos por tipo/setor, flags abertas por setor.

## Pontos para confirmar
1. **Setor = `departamentos`** (não squads). Squads seguem como subdivisão.
2. **Superior imediato**: usar o histórico de cargos/organograma e, quando faltar, `employees.gestor_id`.
3. **Senha na assinatura**: funciona só para quem entra com e-mail e senha; quem entra só com Google precisaria de outro método (ex.: código por e-mail).
4. Cada fase será entregue e conferida antes da próxima; nada será publicado sem seu pedido.

## Detalhes técnicos
- Migrations com GRANT + RLS; funções `security definer` com `search_path=public`; checagens de papel via `has_role`.
- Imutabilidade 24h e auditoria append-only por gatilhos; hash e reautenticação em edge function (`signInWithPassword` no servidor, IP/user agent dos cabeçalhos).
- Lembretes de SLA por cron chamando edge function; e-mails via `brevo-send` com chave de serviço.
- PDF gerado no navegador a partir da página de verificação.
- Registrar regras estruturais no AGENTS.md ao implementar.

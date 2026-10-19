ALTER TABLE public.processo_materiais DROP CONSTRAINT processo_materiais_status_check;
ALTER TABLE public.processo_materiais ADD CONSTRAINT processo_materiais_status_check
  CHECK (status = ANY (ARRAY['falta_fazer','rascunho','em_teste','a_confirmar','falta_anexar','pronto']));

UPDATE public.processo_materiais m
SET status = 'falta_anexar',
    observacao = v.obs,
    link_url = CASE WHEN v.limpa_link THEN NULL ELSE m.link_url END
FROM (VALUES
 ('geral','Playbook dos gerentes da trilha Incorporar para vender','Não está anexado aqui. Não encontrei o arquivo em MCF Capital/Relatorios nem no Playbook do Gestão (lá só existe um PDF de teste). Falta anexar o arquivo.',false),
 ('r1v','Canva da R1 atual (venda da caução)','Existe, mas não está anexado nem com o conteúdo aqui. Falta anexar (PDF exportado do Canva).',false),
 ('r1','Cadastro no Harvey','O Harvey existe, mas não há nada dele registrado aqui (nem acesso, nem material de como cadastrar). Os cards guardam harvey_crm_id, harvey_cliente_id e stage_harvey.',false),
 ('r1','Formulário de anamnese','O formulário fica no Harvey e não está registrado aqui (sem acesso nem cópia das perguntas). O Gestão recebe as respostas pela função pos-venda-anamnese, e a ficha aparece dentro do card do negócio.',true),
 ('alav','Apresentação da aula de alavancagem usada na reunião (existe)','A apresentação existe, mas não está anexada aqui. Falta anexar.',false),
 ('vender-0','Roteiro do GR (playbook dos gerentes)','Faz parte do Playbook dos Gerentes, que ainda não está anexado aqui (ver o item Playbook em Geral).',false),
 ('vender-0','IA de condomínios','Não existe tela no Gestão e não há acesso registrado aqui. Falta registrar.',false),
 ('vender-1','Roteiro e script de apresentação (playbook dos gerentes)','Faz parte do Playbook dos Gerentes, que ainda não está anexado aqui (ver o item Playbook em Geral).',false),
 ('vender-2','Roteiro do GR (playbook dos gerentes)','Faz parte do Playbook dos Gerentes, que ainda não está anexado aqui (ver o item Playbook em Geral).',false),
 ('vender-3','Roteiro do GR (playbook dos gerentes)','Faz parte do Playbook dos Gerentes, que ainda não está anexado aqui (ver o item Playbook em Geral).',false)
) AS v(etapa_chave, titulo, obs, limpa_link), public.processo_etapas e, public.processos p
WHERE e.id = m.etapa_id AND p.id = m.processo_id AND p.chave = 'pos-venda'
  AND e.chave = v.etapa_chave AND m.titulo = v.titulo AND m.ativo;

ALTER TABLE public.processo_materiais ADD CONSTRAINT processo_materiais_pronto_registrado
  CHECK (status <> 'pronto' OR arquivo_path IS NOT NULL OR length(coalesce(conteudo,'')) > 0
         OR (tipo = 'sistema' AND link_url LIKE 'https://mcfgestao.com/%'));
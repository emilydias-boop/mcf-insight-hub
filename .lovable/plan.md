# Pesquisa de Clima no Admin RH

## O que muda para o usuário
1. **Nova aba "Pesquisa de Clima"** no Admin RH (ao lado de Quizzes e Relatórios), visível só para admin e RH.
   - Lista de pesquisas com botão **Nova pesquisa**, editar, duplicar e **Habilitar/Desabilitar**.
   - Editor de perguntas: tipo **Medidor 0 a 10** ou **Discursiva**, com ordem e obrigatoriedade.
   - Só uma pesquisa fica habilitada por vez; respostas são uma por colaborador por pesquisa.
2. **Pesquisa pronta** já cadastrada ("Pesquisa de Clima — Padrão", desabilitada até você ligar):
   - P1 Você se sente confortável e satisfeito com o cargo/função que exerce na MCF? — medidor 0 a 10
   - P2 Você tem a intenção de realizar alguma outra função dentro do quadro de cargos e oportunidades da MCF? Se sim, qual área e por quê? — medidor 0 a 10 + campo opcional de texto para área/motivo
   - P3 Trajetória e como gostaria de estar em 6 meses e 1 ano (função, remuneração, conquistas) — discursiva
3. **Tela inicial da trilha (Minha Trilha):** quando há pesquisa habilitada e o colaborador ainda não respondeu, aparece um cartão "Pesquisa de Clima" no topo com botão Responder (formulário com régua 0–10 e campo de texto). Depois de enviar, o cartão some.
4. **Resultados (dentro da aba):**
   - **Gráfico individual** por colaborador: barras das notas de cada pergunta de medidor e a média, com emoji: 😄 feliz (média ≥ 7), 😐 entediado (4 a 6,9), 😢 triste (< 4).
   - **Relatório por nível de satisfação:** filtro Feliz / Entediado / Triste, contagem e % de cada nível, tabela com colaborador, cargo, área, média, emoji e respostas discursivas; exportar CSV.

## Pontos a confirmar
- Faixas do emoji (≥7 / 4–6,9 / <4) — ajustável.
- Resultados identificados por nome (não anônimos), visíveis só para admin/RH.

## Detalhes técnicos
- Migração com 3 tabelas novas, com GRANTs e RLS: `clima_pesquisas` (titulo, descricao, ativa), `clima_perguntas` (pesquisa_id, ordem, enunciado, tipo 'escala_0_10'|'texto', permite_comentario), `clima_respostas` (pesquisa_id, user_id, respostas jsonb, unique pesquisa_id+user_id).
- RLS: admin/rh (via `has_role`) gerenciam tudo e leem respostas; autenticados leem pesquisa ativa e suas perguntas, e inserem/leem só a própria resposta.
- Trigger garante só uma pesquisa ativa. Seed da pesquisa padrão na mesma migração.
- Front: nova aba em `src/pages/academia/Admin.tsx` (componente próprio em `src/components/academia/clima/`), cartão em `MinhaTrilha.tsx`, gráficos com recharts já existente.
- Nada de outras BUs, trilhas ou quizzes é alterado. Teste pequeno para a regra do emoji por média.

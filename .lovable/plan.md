

## Validar se os 3.193 grupos são realmente duplicados antes de mesclar

### Por que essa pergunta é crítica

O critério atual de "duplicado" é: **mesmo sufixo de 9 dígitos do telefone**. Isso pega a maioria dos casos reais (Stéphanne, Alexandre, etc.), mas também produz **falsos positivos** quando:

- Telefone é genérico/placeholder (`(11) 99999-9999`, `(00) 00000-0000`, números de teste).
- Telefone vazio ou só com DDD (sufixo virou `000000000` ou similar).
- Diferentes pessoas com telefones realmente parecidos nos últimos 9 dígitos (raro, mas possível com números corporativos truncados).
- Importações antigas em massa que preencheram telefone com o mesmo número fictício.

A média de **~11 contatos por grupo** que apareceu no dry-run é o sinal de alerta: contatos reais duplicados normalmente vêm em grupos de 2-3, não 11. Grupos enormes geralmente são contaminação por placeholder.

### O que precisa ser feito antes de qualquer merge em massa

**1. Diagnosticar a composição dos 3.193 grupos**

Rodar queries SQL de leitura para responder:

- Distribuição de tamanho dos grupos: quantos grupos têm 2, 3, 4-10, 11+ contatos
- Top 20 sufixos mais frequentes (provavelmente placeholders): listar `phone_suffix`, `count`, exemplos de nomes/emails
- Quantos grupos têm **emails completamente diferentes** entre si (sinal forte de falso positivo)
- Quantos grupos têm **nomes completamente diferentes** entre si
- Quantos grupos têm sufixo composto só de zeros, noves repetidos, ou padrões suspeitos (`000000000`, `999999999`, `123456789`)

**2. Apresentar amostragem para revisão humana**

Listar 30 grupos aleatórios com nomes, emails e telefones lado a lado, separados em três categorias:

- **Provável duplicação real** (mesmo nome OU mesmo email + sufixo igual)
- **Suspeito** (nomes diferentes, emails diferentes, mas sufixo igual)
- **Quase certo falso positivo** (sufixo placeholder, nomes/emails completamente distintos)

Você revisa a amostra e confirma se o critério está coerente.

**3. Refinar critério de merge**

Com base no diagnóstico, ajustar a função `get_merge_groups` para excluir falsos positivos. Opções de filtro adicionais a aplicar **em conjunto** com o sufixo de telefone:

- Sufixos placeholder na blacklist (`000000000`, `999999999`, `111111111`, `123456789`, sufixos com 7+ dígitos repetidos)
- Exigir **pelo menos uma similaridade adicional**: mesmo email lowercase OU primeiro nome igual (ignorando acentos/case)
- Limitar tamanho máximo de grupo (ex.: grupos com 8+ contatos são marcados para revisão manual, não merge automático)

**4. Re-rodar o dry-run com critério refinado**

Aplicar a função ajustada e gerar relatório novo. Comparar números antes/depois para confirmar que reduziu falsos positivos sem deixar de fora os duplicados reais já confirmados (Stéphanne, Alexandre, Fábio, Clerismar).

**5. Só então executar o merge em massa**

Com o critério validado, rodar a RPC consolidada SQL (proposta na resposta anterior) ou continuar pela edge function em lotes, conforme volume final.

### Entregável desta etapa

Um relatório em chat com:

- Tabela de distribuição de tamanho dos grupos
- Top sufixos suspeitos com contagem
- 30 grupos amostrados com classificação manual
- Recomendação final: critério ajustado + estimativa de quantos grupos sobram após filtro

Você decide se aprova o critério refinado antes de qualquer escrita no banco.

### Arquivos/recursos envolvidos

- Apenas **leituras** nesta etapa: queries SQL via `supabase--read_query`.
- Caso o critério refinado seja aprovado, depois ajustar:
  - `get_merge_groups` (RPC SQL no Postgres) — adicionar filtros de blacklist + similaridade adicional
  - `supabase/functions/merge-duplicate-contacts/index.ts` — sem mudanças, continua consumindo a RPC
- Nenhuma escrita no banco até você aprovar a amostragem.

### Reversibilidade

Como ainda não houve nenhum merge real (só dry-run e 35 grupos confirmados como duplicados óbvios), pausar agora não causa nenhum dano. Os 345 contatos já mesclados nas 7 batches podem ser auditados individualmente via `merged_into_contact_id` se necessário.


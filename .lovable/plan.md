
Diagnóstico confirmado:

- A lead Mirian Cristina Signori já existe no CRM:
  - contato: `d622018a-2a53-4926-bf00-d56779d9b161`
  - deal: `5d201e1b-bac7-4bce-a5ad-bd9cd449a022`
  - pipeline: `PIPELINE INSIDE SALES`
  - owner atual: `mayara.souza@minhacasafinanciada.com`
- Porém o último snapshot salvo em `limbo_uploads.comparison_results` ainda marca a Mirian como `nao_encontrado`.

O problema real não é a ausência do deal. O problema é a revalidação atual:

1. carrega o snapshot antigo do Limbo;
2. tenta revalidar tudo no cliente;
3. faz busca global de forma sequencial, com até 2 requests por lead não resolvido;
4. no cenário atual isso significa processar cerca de 17 mil leads pendentes;
5. a UI só atualiza no final de toda a revalidação.

Resultado: mesmo que a Mirian já exista, ela continua aparecendo porque a tela segue exibindo o snapshot antigo até terminar esse processamento enorme, e a persistência corrigida nunca chega a acontecer em tempo útil.

Plano de correção:

1. Reescrever a revalidação para ser batelada, não sequencial
- Em `src/hooks/useLimboLeads.ts`
- Trocar o loop “email por email” por consultas em lote:
  - coletar emails, telefones e nomes dos leads pendentes;
  - buscar contatos em lotes usando `.in()` para email e matching por telefone/nome em blocos;
  - buscar deals desses contatos também em lotes.
- Seguir o padrão já usado no projeto de consultas bateladas.

2. Passar a considerar telefone além de email/nome
- Hoje o Limbo usa só email e nome na comparação principal.
- Vou incluir normalização de telefone (últimos 9 dígitos), porque vários leads podem ter email vazio ou divergente.

3. Escolher o deal correto quando houver múltiplos registros
- Em vez de `.limit(1)` sem critério, montar a escolha em memória:
  - priorizar deal da Inside Sales;
  - priorizar deal com `owner_id` preenchido;
  - depois o mais recente por `updated_at`.
- Isso evita falso negativo e também evita pegar um deal órfão antigo quando já existe um deal atribuído.

4. Atualizar a UI assim que a revalidação terminar rápido
- Em `src/pages/crm/LeadsLimbo.tsx`
- Manter o `useEffect`, mas chamando a nova função batelada.
- Ao detectar mudanças:
  - atualizar `results`;
  - persistir em `limbo_uploads`;
  - refletir imediatamente a remoção da Mirian dos filtros de `nao_encontrado/sem_dono`.

5. Adicionar estado visível de revalidação
- Mostrar algo como “Sincronizando com CRM atual...”.
- Isso evita parecer que a lista está definitiva enquanto ainda está sendo corrigida.

Arquivos a editar:

- `src/hooks/useLimboLeads.ts`
  - adicionar helper de telefone
  - reescrever `compareExcelWithLocal`
  - reescrever `revalidateLimboResults` com batelamento e priorização de deals
- `src/pages/crm/LeadsLimbo.tsx`
  - ajustar fluxo de carregamento/revalidação
  - adicionar feedback visual durante sincronização

Resultado esperado:

- Mirian Cristina Signori deixa de aparecer como `Não Encontrado`.
- Leads já transferidos para Mayara ou qualquer outro dono deixam de permanecer no Limbo por causa de snapshot velho.
- A correção passa a acontecer em segundos/minutos curtos, e não em milhares de requests sequenciais no navegador.

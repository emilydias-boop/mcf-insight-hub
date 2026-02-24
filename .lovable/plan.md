

## Corrigir fluxo de propostas aceitas sem cadastro pendente

### Diagnostico

As 2 propostas (Joao Ferreira dos Santos - R$ 240.000 e Kleber Donizetti Teixeira - R$ 500.000) estao com `status = 'aceita'` na tabela `consorcio_proposals`, porem **nenhum registro** foi criado na tabela `consorcio_pending_registrations` (esta vazia). Isso indica que o aceite foi feito por um caminho que so atualizou o status da proposta sem passar pelo modal de cadastro completo (`AcceptProposalModal`).

Alem disso, o botao "Cadastrar Cota" que aparece para propostas aceitas direciona para `/consorcio?prefill_deal=...&prefill_proposal=...`, mas esses parametros nao sao consumidos pela pagina de Consorcio, entao o botao nao faz nada util.

### Solucao

Alterar o botao "Cadastrar Cota" para reabrir o `AcceptProposalModal` (que cria o cadastro pendente) em vez de redirecionar para uma URL que nao funciona.

### Alteracoes

**`src/pages/crm/PosReuniao.tsx`**

1. Trocar o botao "Cadastrar Cota" (que era um link `<a>`) por um botao que abre o `AcceptProposalModal` com os dados da proposta aceita
2. Na secao de acoes da tabela (linhas 357-362), substituir:

```
// ANTES: link que nao funciona
{p.status === 'aceita' && !p.consortium_card_id && (
  <Button size="sm" variant="outline" asChild>
    <a href={`/consorcio?prefill_deal=...`}>
      Cadastrar Cota
    </a>
  </Button>
)}
```

```
// DEPOIS: reabrir o modal de cadastro
{p.status === 'aceita' && !p.consortium_card_id && (
  <Button size="sm" variant="outline" onClick={() => setAcceptTarget(p)}>
    Cadastrar Cota
  </Button>
)}
```

Isso permite que o usuario clique em "Cadastrar Cota", preencha os dados do cliente e documentos no modal, e o sistema crie corretamente o registro em `consorcio_pending_registrations`.

### Resultado

As 2 propostas aceitas vao exibir o botao "Cadastrar Cota" que abre o mesmo modal de aceite, permitindo preencher os dados e gerar o cadastro pendente que aparecera na aba "Cadastros Pendentes" do Controle Consorcio.

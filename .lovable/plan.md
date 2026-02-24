

## Duas melhorias no fluxo de cadastro de cota

### Problema 1: Dados do AcceptProposalModal nao aparecem no OpenCotaModal

O fluxo ja esta correto no codigo: quando o closer preenche o AcceptProposalModal, os dados sao salvos na tabela `consorcio_pending_registrations` e o OpenCotaModal le dessa mesma tabela. O problema das 2 propostas especificas (Joao Ferreira e Kleber Donizetti) foi que elas foram inseridas manualmente sem os dados do cliente.

Para futuros cadastros, o fluxo funciona corretamente. Porem, ha um campo que falta no OpenCotaModal: o campo `cpf_conjuge` nao esta sendo exibido. Vou adiciona-lo.

### Problema 2: Funcao de auto-preenchimento por texto (checklist)

Adicionar um botao "Colar Check-list" no AcceptProposalModal que abre um campo de texto. O usuario cola o texto padrao de check-list e o sistema extrai automaticamente os dados usando regex, preenchendo os campos do formulario.

Formato suportado:
```text
Nome Completo: Evandro Moreira da Silva
RG: 1.956.525 - SSP/ES
CPF: 096.559.837-30
CPF Conjuge (se casado): 022.569.441-74
Endereco Residencial: SHTN, trecho 2, ...
CEP: 70.800-230
Telefone: 61 99644-7743
E-mail: evandroms7744@gmail.com
Profissao: Servidor Publico
Renda: R$ 47.000,00
Patrimonio: R$ 3.800.000,00
Chave Pix: 096.559.837-30
```

### Alteracoes

**`src/components/consorcio/AcceptProposalModal.tsx`**

1. Adicionar um botao "Colar Check-list" no topo da secao PF (ao lado de "Dados Pessoais")
2. Ao clicar, mostrar um `Textarea` com placeholder explicando o formato esperado
3. Ao colar/digitar e clicar "Preencher", executar uma funcao `parseChecklist(text)` que:
   - Busca cada campo por regex (ex: `/Nome Completo:\s*(.+)/i`)
   - Parseia valores monetarios (R$ 47.000,00 -> 47000)
   - Formata CPF, telefone e CEP automaticamente
   - Preenche os campos do formulario via `form.setValue()`
4. Apos preencher, esconder o textarea automaticamente

Campos mapeados:
- "Nome Completo" -> `nome_completo`
- "RG" -> `rg`
- "CPF" -> `cpf` (formata com pontos/traco)
- "CPF Conjuge" / "CPF Cônjuge" -> `cpf_conjuge`
- "Endereco" / "Endereço Residencial" -> `endereco_completo`
- "CEP" -> `endereco_cep` (formata com traco)
- "Telefone" -> `telefone` (formata com parenteses)
- "E-mail" / "Email" -> `email`
- "Profissao" / "Profissão" -> `profissao`
- "Renda" -> `renda` (converte de R$ para numero)
- "Patrimonio" / "Patrimônio" -> `patrimonio` (converte de R$ para numero)
- "Chave Pix" / "PIX" -> `pix`

**`src/components/consorcio/OpenCotaModal.tsx`**

5. Adicionar campo `cliente_cpf_conjuge` ao formulario
6. Adicionar o mesmo botao "Colar Check-list" no OpenCotaModal (reutilizando a mesma funcao de parsing)

### Detalhes tecnicos

A funcao de parsing sera criada como um utilitario reutilizavel:

```text
src/lib/checklistParser.ts

export function parseChecklistPF(text: string): Partial<PFData> {
  const extract = (pattern: RegExp): string => {
    const match = text.match(pattern);
    return match?.[1]?.trim() || '';
  };
  
  const parseMoney = (value: string): number => {
    return parseFloat(value.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  };

  return {
    nome_completo: extract(/nome\s*completo:\s*(.+)/i),
    rg: extract(/rg:\s*(.+)/i),
    cpf: extract(/cpf:\s*(.+)/i),        // linha que NAO contem "conjuge"
    cpf_conjuge: extract(/cpf\s*c[oô]njuge[^:]*:\s*(.+)/i),
    endereco_completo: extract(/endere[cç]o[^:]*:\s*(.+)/i),
    endereco_cep: extract(/cep:\s*(.+)/i),
    telefone: extract(/telefone:\s*(.+)/i),
    email: extract(/e-?mail:\s*(.+)/i),
    profissao: extract(/profiss[aã]o:\s*(.+)/i),
    renda: parseMoney(extract(/renda:\s*(.+)/i)),
    patrimonio: parseMoney(extract(/patrim[oô]nio:\s*(.+)/i)),
    pix: extract(/(?:chave\s*)?pix:\s*(.+)/i),
  };
}
```

O regex de CPF sera tratado com cuidado para nao capturar a linha do conjuge quando buscando o CPF principal (usara negative lookahead ou processamento por linhas).


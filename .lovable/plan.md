

## Adicionar "Colar Check-list" para Pessoa Juridica

### O que sera feito

Adicionar o mesmo botao "Colar Check-list" que ja existe na secao PF, agora tambem na secao PJ do AcceptProposalModal (e do OpenCotaModal). Ao colar o texto padrao de check-list PJ, o sistema extrai automaticamente os dados e preenche os campos do formulario.

### Formato suportado

```text
Razao Social: PJ MANDALA PARTICIPACOES LTDA
CNPJ: 60.386.616/0001-74
Natureza Juridica: Sociedade Empresaria Limitada
Inscricao Estadual: (vazio)
Data de Fundacao: 14/04/2025
CPF dos socios: 994.850.521-20, 016.498.241-81
Endereco Comercial: Rua Buarque de Macedo, 1057
CEP: 13073-010
Telefone Comercial: (19)99957-7420
E-mail comercial: pablo7420@yahoo.com.br
Faturamento medio: R$50.000,00
Numero de funcionarios: 0
Renda dos socios: R$70.000,00
```

### Campos mapeados

| Texto do check-list | Campo do formulario |
|---|---|
| Razao Social | razao_social |
| CNPJ | cnpj |
| Natureza Juridica | natureza_juridica |
| Inscricao Estadual | inscricao_estadual |
| Data de Fundacao | data_fundacao (converte dd/mm/yyyy para yyyy-mm-dd) |
| CPF dos socios | socios[] (separa por virgula, cria 1 socio por CPF) |
| Endereco Comercial | endereco_comercial |
| CEP | endereco_comercial_cep |
| Telefone Comercial | telefone_comercial |
| E-mail comercial | email_comercial |
| Faturamento medio | faturamento_mensal (converte R$ para numero) |
| Numero de funcionarios | num_funcionarios |
| Renda dos socios | renda de cada socio (divide igualmente) |

### Alteracoes por arquivo

**`src/lib/checklistParser.ts`**

- Adicionar interface `ChecklistPJData` com os campos PJ
- Adicionar funcao `parseChecklistPJ(text)` com regex para cada campo PJ
- Tratamento especial para "CPF dos socios": separa por virgula e retorna array
- Tratamento especial para "Data de Fundacao": converte de dd/mm/yyyy para yyyy-mm-dd (formato do input date)
- Tratamento especial para "Renda dos socios": valor unico que sera dividido igualmente entre os socios

**`src/components/consorcio/AcceptProposalModal.tsx`**

- Adicionar botao "Colar Check-list" ao lado de "Dados da Empresa" (linha 419), identico ao que ja existe na secao PF
- Adicionar estado `showChecklistPJ` e `checklistTextPJ`
- No clique de "Preencher Campos", chamar `parseChecklistPJ()` e fazer `form.setValue()` para cada campo PJ
- Para os socios: limpar os socios existentes e adicionar um por CPF encontrado, com a renda dividida

**`src/components/consorcio/OpenCotaModal.tsx`**

- Adicionar o mesmo botao "Colar Check-list PJ" na secao PJ do OpenCotaModal (se houver secao PJ editavel)

### Detalhes tecnicos

A funcao `parseChecklistPJ` seguira o mesmo padrao da `parseChecklistPF` existente, processando linha a linha:

```text
parseChecklistPJ(text) retorna:
{
  razao_social: "PJ MANDALA PARTICIPACOES LTDA",
  cnpj: "60.386.616/0001-74",
  natureza_juridica: "Sociedade Empresaria Limitada",
  inscricao_estadual: "",
  data_fundacao: "2025-04-14",  // convertido de 14/04/2025
  socios_cpfs: ["994.850.521-20", "016.498.241-81"],
  endereco_comercial: "Rua Buarque de Macedo, 1057",
  endereco_comercial_cep: "13073-010",
  telefone_comercial: "(19)99957-7420",
  email_comercial: "pablo7420@yahoo.com.br",
  faturamento_mensal: 50000,
  num_funcionarios: 0,
  renda_socios: 70000
}
```

Para os socios, a logica sera: se houver 2 CPFs e renda de R$70.000, cada socio recebe R$35.000. Se o usuario quiser valores diferentes, pode ajustar manualmente apos o preenchimento automatico.

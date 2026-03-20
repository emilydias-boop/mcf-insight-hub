

## Plano: Remover 12 deals corrompidos + contatos órfãos

### Situação

A última importação (16:42) criou 12 deals cujos contatos têm encoding quebrado (ex: "S�" em vez de "Sá") e telefone preenchido com cidade/UF (ex: "SP São Paulo", "MG - Contagem"). Isso inclui o "Ailton Aparecido de S�" que aparece como duplicata.

Registros identificados:

| Nome corrompido | Phone (errado) |
|----------------|----------------|
| Ailton Aparecido de S� | SP S�o Paulo |
| C�cero Avelino Mateus | S�o Paulo/ S�o Paulo |
| Jo�o Pedro Gabriel de Oliveira | MG - Vespasiano |
| Ademilson Lopes Magalh�es | SP/Atibaia |
| Fl�vio Felix de Souza | MG - Contagem |
| Ricardo Eidt Gon�alves de Almeida | Santa Rita do Passa Quatro |
| Jos� Vilson Alvarenga Junior | RJ/Maric� |
| Michel Reskalla Brando | MG - Ub� |
| Raimundo Nonato da Silva Monteiro | PI/ Regenera��o |
| Romulo Fernandes de Oliveira | Mossor� RN |
| Getulio Augusto | SP-Cabreuva |
| Tatiane Gisleine Lopes de Souza | SP- Sorocaba |

### Ação — Migration SQL

```sql
-- 1. Deletar os 12 deals corrompidos (contatos com phone não-numérico)
DELETE FROM crm_deals
WHERE id IN (
  SELECT d.id FROM crm_deals d
  JOIN crm_contacts c ON c.id = d.contact_id
  WHERE d.origin_id = '7d7b1cb5-2a44-4552-9eff-c3b798646b78'
    AND d.created_at >= '2026-03-20 16:40:00+00'
    AND c.clint_id LIKE 'spreadsheet_import_%'
    AND coalesce(c.email, '') = ''
    AND coalesce(c.phone, '') !~ '^[0-9+()\-\s]+$'
);

-- 2. Deletar contatos órfãos dessas importações
DELETE FROM crm_contacts
WHERE clint_id LIKE 'spreadsheet_import_%'
  AND created_at >= '2026-03-20 14:00:00+00'
  AND (email IS NULL OR email = '')
  AND coalesce(phone, '') !~ '^[0-9+()\-\s]+$'
  AND id NOT IN (SELECT contact_id FROM crm_deals WHERE contact_id IS NOT NULL);
```

### Resultado esperado

- **12 deals corrompidos** removidos (incluindo o "Ailton" duplicado)
- **27 deals legítimos** da importação preservados
- Contatos-lixo sem email e com "cidade" no campo telefone removidos
- O "Ailton Aparecido de Sá" original (Fev/26) permanece intacto no LEAD SCORE

### Correção futura recomendada

Corrigir o encoding UTF-8 no `process-csv-imports` e no `import-spreadsheet-leads` para evitar que caracteres acentuados sejam corrompidos em futuras importações.


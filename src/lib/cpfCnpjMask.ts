/**
 * Máscara de CPF/CNPJ compartilhada — a mesma formatação usada no CRM, para que
 * a página pública de assinatura e o certificado gravem o documento no mesmo
 * padrão (111.444.777-35 / 11.222.333/0001-44) em vez de dígitos soltos.
 */
export function formatCpfCnpj(value?: string | null): string {
  const d = String(value ?? '').replace(/\D/g, '').slice(0, 14);
  if (!d) return '';
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

/** Só os dígitos — para comparação/validação. */
export function apenasDigitos(value?: string | null): string {
  return String(value ?? '').replace(/\D/g, '');
}

/**
 * Valor canônico para GRAVAR: sempre só os dígitos.
 *
 * Guardar formatado criaria duas gramáticas na mesma coluna (registros antigos
 * com dígitos crus, novos com pontuação) e quebraria comparação, busca e JOIN
 * por `assinante_cpf`. A pontuação é assunto de exibição — use
 * `formatCpfCnpj()` na tela.
 */
export function documentoCanonico(value?: string | null): string {
  return apenasDigitos(value);
}

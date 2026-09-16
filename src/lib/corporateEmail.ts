/**
 * Regras de e-mail corporativo (login do colaborador).
 *
 * Contexto: um colaborador foi cadastrado com typo no e-mail
 * (`elnatahn.goncalves@` em vez de `elnathan.goncalves@`). Como o e-mail estava
 * errado, ele nunca recebeu o link de acesso e o login falhava — e o painel
 * ainda dizia "criado com sucesso". Este módulo centraliza sugestão,
 * normalização e validação para eliminar essa classe de erro, e é compartilhado
 * entre CreateUserDialog (Usuários) e EmployeeFormDialog (RH).
 */

export const CORPORATE_EMAIL_DOMAIN = "minhacasafinanciada.com";

/** Partículas ignoradas ao escolher o sobrenome. */
const NAME_PARTICLES = new Set(["de", "da", "do", "dos", "das", "e"]);

/** Remove acentos, baixa para minúsculas e tira o que não é alfanumérico. */
function slugifyNamePart(part: string): string {
  return part
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Gera o e-mail corporativo sugerido a partir do nome completo:
 * primeiro nome + último sobrenome (ignorando partículas).
 * Ex: "ELNATHAN GONÇALVES DO NASCIMENTO" -> elnathan.nascimento@minhacasafinanciada.com
 */
export function suggestCorporateEmail(fullName: string): string {
  const parts = (fullName || "")
    .trim()
    .split(/\s+/)
    .map(slugifyNamePart)
    .filter(Boolean);

  if (parts.length === 0) return "";

  const first = parts[0];
  const rest = parts.slice(1).filter((p) => !NAME_PARTICLES.has(p));
  const last = rest.length > 0 ? rest[rest.length - 1] : "";

  const local = last ? `${first}.${last}` : first;
  return `${local}@${CORPORATE_EMAIL_DOMAIN}`;
}

/** Normalização obrigatória antes de validar e antes de enviar ao backend. */
export function normalizeEmail(email: string): string {
  return (email || "").trim().toLowerCase();
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isCorporateDomain(email: string): boolean {
  return normalizeEmail(email).endsWith(`@${CORPORATE_EMAIL_DOMAIN}`);
}

export interface EmailValidationResult {
  /** true quando o e-mail pode ser enviado ao backend. */
  valid: boolean;
  /** Mensagem de erro bloqueante. */
  error?: string;
  /** Normalizado (trim + lowercase). */
  normalized: string;
}

/**
 * Valida o e-mail de acesso. Domínio externo só passa com confirmação
 * explícita do admin (`allowExternalDomain`).
 */
export function validateAccessEmail(
  email: string,
  options?: { allowExternalDomain?: boolean }
): EmailValidationResult {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return { valid: false, error: "Informe o e-mail de acesso", normalized };
  }
  if (!EMAIL_REGEX.test(normalized)) {
    return { valid: false, error: "E-mail inválido", normalized };
  }
  if (!isCorporateDomain(normalized) && !options?.allowExternalDomain) {
    return {
      valid: false,
      error: `O e-mail de acesso deve terminar em @${CORPORATE_EMAIL_DOMAIN}. Para usar outro domínio, marque "usar email de outro domínio".`,
      normalized,
    };
  }
  return { valid: true, normalized };
}

/**
 * Aviso não bloqueante quando o e-mail digitado não bate com o sugerido pelo
 * nome completo — é isso que pega o typo.
 */
export function buildEmailMismatchWarning(fullName: string, email: string): string | null {
  const suggestion = suggestCorporateEmail(fullName);
  const typed = normalizeEmail(email);
  if (!suggestion || !typed) return null;
  if (suggestion === typed) return null;
  return `Confere? Pelo nome, o esperado seria ${suggestion}`;
}

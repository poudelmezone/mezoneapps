/** Thrown by validators; API routes turn it into a 400 with the message. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function asString(value: FormDataEntryValue | null | undefined): string {
  return typeof value === 'string' ? value : '';
}

/** Collapse control characters and stray whitespace. */
export function clean(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

/**
 * Descriptions are authored by the admin only, but we still strip anything that
 * looks like markup so a compromised account cannot persist stored XSS.
 */
export function stripMarkup(value: string): string {
  return clean(
    value
      .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/javascript:/gi, ''),
  );
}

export function requiredString(
  value: FormDataEntryValue | null | undefined,
  field: string,
  { min = 1, max = 5000 }: { min?: number; max?: number } = {},
): string {
  const text = stripMarkup(asString(value));
  if (text.length < min) throw new ValidationError(`${field} is required.`);
  if (text.length > max) throw new ValidationError(`${field} must be under ${max} characters.`);
  return text;
}

export function optionalString(
  value: FormDataEntryValue | null | undefined,
  field: string,
  { max = 5000 }: { max?: number } = {},
): string {
  const text = stripMarkup(asString(value));
  if (text.length > max) throw new ValidationError(`${field} must be under ${max} characters.`);
  return text;
}

export function boolFrom(value: FormDataEntryValue | null | undefined): boolean {
  const text = asString(value);
  return text === 'true' || text === 'on' || text === '1';
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function validateSlug(input: string): string {
  const slug = slugify(input);
  if (slug.length < 2) throw new ValidationError('Slug must be at least 2 characters (a-z, 0-9, dashes).');
  return slug;
}

export function intFrom(value: FormDataEntryValue | null | undefined, fallback = 0): number {
  const parsed = Number.parseInt(asString(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function fileFrom(value: FormDataEntryValue | null | undefined): File | null {
  if (value && typeof value === 'object' && 'arrayBuffer' in value && (value as File).size > 0) {
    return value as File;
  }
  return null;
}

import { boolFrom, optionalString, requiredString, slugify, validateSlug, ValidationError } from '@/lib/validation';
import { storeImage } from '@/lib/uploads';
import { slugTaken, type AppInput } from '@/lib/apps';
import type { AppRow } from '@/lib/types';

export { CATEGORIES } from './categories';

/**
 * Parses and validates the shared create/update form payload.
 * Everything that reaches the database goes through here.
 */
export async function parseAppForm(
  form: FormData,
  options: { appId?: string; existing?: AppRow | null } = {},
): Promise<AppInput> {
  const existing = options.existing ?? null;

  const name = requiredString(form.get('name'), 'App name', { max: 80 });
  const slugRaw = optionalString(form.get('slug'), 'Slug', { max: 80 }) || slugify(name);
  const slug = validateSlug(slugRaw);

  if (slugTaken(slug, options.appId)) {
    throw new ValidationError(`The slug "${slug}" is already used by another app.`);
  }

  const shortDescription = requiredString(form.get('shortDescription'), 'Short description', { max: 160 });
  const description = optionalString(form.get('description'), 'Description', { max: 20000 });
  const changelog = optionalString(form.get('changelog'), 'Changelog', { max: 10000 });
  const category = optionalString(form.get('category'), 'Category', { max: 40 }) || 'Other';

  const releasedRaw = optionalString(form.get('releasedAt'), 'Release date', { max: 32 });
  let releasedAt: number | null = existing?.released_at ?? null;
  if (releasedRaw) {
    const parsed = new Date(`${releasedRaw}T12:00:00Z`).getTime();
    if (Number.isNaN(parsed)) throw new ValidationError('Release date is not a valid date.');
    releasedAt = parsed;
  }

  let iconMediaId = existing?.icon_media_id ?? null;
  const iconFile = form.get('icon');
  if (iconFile && typeof iconFile === 'object' && 'arrayBuffer' in iconFile && (iconFile as File).size > 0) {
    const stored = await storeImage(iconFile as File);
    iconMediaId = stored.id;
  }

  return {
    name,
    slug,
    shortDescription,
    description,
    category,
    changelog,
    releasedAt,
    published: boolFrom(form.get('published')),
    featured: boolFrom(form.get('featured')),
    iconMediaId,
  };
}

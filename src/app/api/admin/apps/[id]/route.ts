import { getSession, verifyCsrf, verifyOrigin } from '@/lib/auth';
import { deleteApp, getAppById, updateApp } from '@/lib/apps';
import { parseAppForm } from '@/lib/app-form';
import { fail, handleError } from '@/lib/http';
import { assertUploadRef, readRequest } from '@/lib/payload';
import { registerImage } from '@/lib/uploads';
import { boolFrom, ValidationError } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** PATCH /api/admin/apps/[id] — full edit, or a partial publish/feature toggle. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail('Unauthorized.', 401);
    if (!verifyOrigin(req)) return fail('Cross-origin request blocked.', 403);
    if (!verifyCsrf(req, session)) return fail('Invalid CSRF token.', 403);

    const { id } = await params;
    const app = await getAppById(id);
    if (!app) return fail('App not found.', 404);

    const { form, icon } = await readRequest(req);

    // Toggle-only requests send just `published` / `featured`.
    if (!form.has('name')) {
      const published = form.has('published') ? boolFrom(form.get('published')) : Boolean(app.published);
      if (published && app.releases.length === 0) {
        throw new ValidationError('Upload an APK before publishing this app.');
      }
      const featured = form.has('featured') ? boolFrom(form.get('featured')) : Boolean(app.featured);

      await updateApp(id, {
        name: app.name,
        slug: app.slug,
        shortDescription: app.short_description,
        description: app.description,
        category: app.category,
        changelog: app.changelog,
        releasedAt: app.released_at,
        published,
        featured,
        iconMediaId: app.icon_media_id,
      });
      return Response.json({ ok: true, published, featured });
    }

    const input = await parseAppForm(form, { appId: id, existing: app });

    if (icon) {
      assertUploadRef(icon, ['png', 'jpg', 'jpeg', 'webp']);
      const stored = await registerImage({ url: icon.url, name: icon.name, size: icon.size });
      input.iconMediaId = stored.id;
    }

    if (input.published && app.releases.length === 0) {
      throw new ValidationError('Upload an APK before publishing this app.');
    }

    await updateApp(id, input);
    return Response.json({ ok: true, slug: input.slug });
  } catch (error) {
    return handleError(error);
  }
}

/** DELETE /api/admin/apps/[id] — removes the app and every file it owns. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail('Unauthorized.', 401);
    if (!verifyOrigin(req)) return fail('Cross-origin request blocked.', 403);
    if (!verifyCsrf(req, session)) return fail('Invalid CSRF token.', 403);

    const { id } = await params;
    if (!(await getAppById(id))) return fail('App not found.', 404);

    await deleteApp(id);
    return Response.json({ ok: true });
  } catch (error) {
    return handleError(error);
  }
}

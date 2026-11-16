import { ValidationError } from './validation';

export type UploadRef = {
  url: string;
  name: string;
  size: number;
  sha256?: string;
};

export type ParsedRequest = {
  form: FormData;
  icon: UploadRef | null;
  screenshots: UploadRef[];
  apk: UploadRef | null;
};

/**
 * Admin forms post multipart/form-data locally (files go through the function)
 * and JSON when uploads went straight to object storage (Vercel), because
 * serverless request bodies are capped at 4.5 MB. Both normalise to FormData
 * plus a set of remote upload references.
 */
export async function readRequest(req: Request): Promise<ParsedRequest> {
  const type = req.headers.get('content-type') ?? '';

  if (type.includes('application/json')) {
    const data = (await req.json().catch(() => ({}))) as {
      fields?: Record<string, unknown>;
      icon?: UploadRef | null;
      screenshots?: UploadRef[];
      apk?: UploadRef | null;
    };

    const form = new FormData();
    for (const [key, value] of Object.entries(data.fields ?? {})) {
      if (value === undefined || value === null) continue;
      if (typeof value === 'boolean') {
        if (value) form.set(key, 'true');
      } else {
        form.set(key, String(value));
      }
    }

    return {
      form,
      icon: data.icon ?? null,
      screenshots: Array.isArray(data.screenshots) ? data.screenshots : [],
      apk: data.apk ?? null,
    };
  }

  return { form: await req.formData(), icon: null, screenshots: [], apk: null };
}

/** Rejects references that are not an https URL from our own blob store. */
export function assertUploadRef(ref: UploadRef, allowed: string | string[]): UploadRef {
  const extensions = (Array.isArray(allowed) ? allowed : [allowed]).map((value) => `.${value.toLowerCase()}`);
  let url: URL;
  try {
    url = new URL(ref.url);
  } catch {
    throw new ValidationError('Unrecognised upload reference.');
  }

  if (url.protocol !== 'https:') throw new ValidationError('Unrecognised upload reference.');

  if (process.env.BLOB_READ_WRITE_TOKEN && !url.hostname.endsWith('blob.vercel-storage.com')) {
    throw new ValidationError('Uploads must come from this site\u2019s storage bucket.');
  }

  if (!extensions.some((extension) => url.pathname.toLowerCase().endsWith(extension))) {
    throw new ValidationError(`Expected a ${extensions.join(' or ')} upload.`);
  }

  if (!Number.isFinite(ref.size) || ref.size <= 0) {
    throw new ValidationError('Upload size is missing.');
  }

  return ref;
}

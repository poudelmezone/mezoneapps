import { NextResponse } from 'next/server';
import { ValidationError } from './validation';

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(error: unknown) {
  if (error instanceof ValidationError) {
    return fail(error.message, 400);
  }
  console.error('[api]', error);
  return fail('Something went wrong on the server.', 500);
}

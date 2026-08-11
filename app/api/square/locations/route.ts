/**
 * GET /api/square/locations
 *
 * Returns every Square location on the connected account (PAD Thai Food,
 * Maruay Thai, MR, etc). The frontend lets the user pick one — we never
 * hardcode a single location here since the same Square account serves
 * multiple restaurants.
 *
 * SQUARE_ACCESS_TOKEN is read server-side only (via process.env, populated
 * by Vercel env vars / `infisical run` locally) and never sent to the client.
 */
import { NextResponse } from 'next/server';

const SQUARE_VERSION = '2024-06-20';

export async function GET() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'SQUARE_ACCESS_TOKEN is not configured on the server.' },
      { status: 500 }
    );
  }

  try {
    const res = await fetch('https://connect.squareup.com/v2/locations', {
      method: 'GET',
      headers: {
        'Square-Version': SQUARE_VERSION,
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      const message =
        data?.errors?.map((e: { detail?: string }) => e.detail).join('; ') ||
        `Square API returned ${res.status}`;
      return NextResponse.json({ error: message }, { status: res.status });
    }

    const locations = (data.locations || []).map((loc: { id: string; name: string }) => ({
      id: loc.id,
      name: loc.name,
    }));

    return NextResponse.json({ locations });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error contacting Square';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * POST /api/square/orders
 *
 * Body: { locationId: string, startDate: string (YYYY-MM-DD), endDate: string (YYYY-MM-DD) }
 *
 * Searches Square Orders for the given location + date range (closed_at,
 * COMPLETED only), paginating on `cursor` until exhausted, then filters down
 * to the confirmed Quest-chargeback signal:
 *   order.tenders[].type === 'OTHER' AND tender.note (trimmed, case-insensitive)
 *   contains "quest"
 *
 * This mirrors the manual check that found exactly 3 matching orders for
 * PAD Thai Food, 1-31 July 2026 (18/07 $72.60, 21/07 $22.80, 27/07 $37.60).
 *
 * SQUARE_ACCESS_TOKEN never reaches the client — this route runs server-side
 * only. Errors from Square are surfaced to the caller, never swallowed.
 */
import { NextRequest, NextResponse } from 'next/server';

const SQUARE_VERSION = '2024-06-20';
const SQUARE_ORDERS_SEARCH_URL = 'https://connect.squareup.com/v2/orders/search';
const MAX_PAGES = 20; // safety cap — 20 * 500 = 10,000 orders, far beyond a monthly range

interface SquareTender {
  type: string;
  note?: string;
}

interface SquareMoney {
  amount: number;
  currency: string;
}

interface SquareOrder {
  id: string;
  closed_at?: string;
  ticket_name?: string;
  total_money?: SquareMoney;
  tenders?: SquareTender[];
}

interface SquareOrdersSearchResponse {
  orders?: SquareOrder[];
  cursor?: string;
  errors?: { detail?: string }[];
}

export interface QuestOrderMatch {
  orderId: string;
  date: string; // YYYY-MM-DD, derived from closed_at
  description: string;
  amount: number;
}

export async function POST(req: NextRequest) {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'SQUARE_ACCESS_TOKEN is not configured on the server.' },
      { status: 500 }
    );
  }

  let body: { locationId?: string; startDate?: string; endDate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { locationId, startDate, endDate } = body;
  if (!locationId || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'locationId, startDate and endDate are all required.' },
      { status: 400 }
    );
  }

  const startAt = `${startDate}T00:00:00Z`;
  const endAt = `${endDate}T23:59:59Z`;

  try {
    const allOrders: SquareOrder[] = [];
    let cursor: string | undefined;
    let page = 0;

    do {
      const res = await fetch(SQUARE_ORDERS_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Square-Version': SQUARE_VERSION,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location_ids: [locationId],
          query: {
            filter: {
              date_time_filter: { closed_at: { start_at: startAt, end_at: endAt } },
              state_filter: { states: ['COMPLETED'] },
            },
            sort: { sort_field: 'CLOSED_AT', sort_order: 'ASC' },
          },
          limit: 500,
          ...(cursor ? { cursor } : {}),
        }),
      });

      const data: SquareOrdersSearchResponse = await res.json();

      if (!res.ok) {
        const message =
          data?.errors?.map((e) => e.detail).join('; ') || `Square API returned ${res.status}`;
        return NextResponse.json({ error: message }, { status: res.status });
      }

      if (data.orders) allOrders.push(...data.orders);
      cursor = data.cursor;
      page += 1;
    } while (cursor && page < MAX_PAGES);

    const matches: QuestOrderMatch[] = allOrders
      .filter((order) =>
        (order.tenders || []).some(
          (t) => t.type === 'OTHER' && !!t.note && t.note.trim().toLowerCase().includes('quest')
        )
      )
      .map((order) => ({
        orderId: order.id,
        date: (order.closed_at || '').split('T')[0],
        description: order.ticket_name || 'Chargeback',
        amount: (order.total_money?.amount || 0) / 100,
      }));

    return NextResponse.json({
      matches,
      ordersScanned: allOrders.length,
      locationId,
      startDate,
      endDate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error contacting Square';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

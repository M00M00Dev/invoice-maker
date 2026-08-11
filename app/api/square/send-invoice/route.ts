/**
 * POST /api/square/send-invoice
 *
 * Body: { to: string, subject: string, pdfBase64: string, filename: string }
 * (pdfBase64 is the raw PDF bytes, base64-encoded, no data: prefix)
 *
 * Emails the generated invoice PDF as an attachment via the Gmail API,
 * sending as admin@aroi.au using the org's existing OAuth credential
 * (Infisical access-general/aroi-general, key
 * GOOGLE_WORKSPACE_OAUTH_ADMIN_AROI_AU_B64 — base64 JSON with
 * refresh_token/client_id/client_secret/scopes).
 *
 * This route NEVER fires on its own — the frontend requires an explicit
 * confirm-dialog click before calling it. There is no scheduling/cron path
 * to this endpoint.
 *
 * If the credential doesn't carry a usable refresh_token or the
 * gmail.send scope, we fail loudly with a clear error rather than
 * guessing at a new OAuth flow.
 */
import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

export const runtime = 'nodejs';

const REQUIRED_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
const FROM_ADDRESS = 'admin@aroi.au';

interface GoogleOAuthCredential {
  refresh_token?: string;
  client_id?: string;
  client_secret?: string;
  token_uri?: string;
  scopes?: string[];
}

function buildMimeMessage(opts: {
  to: string;
  from: string;
  subject: string;
  bodyText: string;
  filename: string;
  pdfBase64: string;
}): string {
  const boundary = `invoice_boundary_${Date.now()}`;
  const lines = [
    `To: ${opts.to}`,
    `From: ${opts.from}`,
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    opts.bodyText,
    '',
    `--${boundary}`,
    `Content-Type: application/pdf; name="${opts.filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${opts.filename}"`,
    '',
    opts.pdfBase64,
    '',
    `--${boundary}--`,
  ];
  return lines.join('\r\n');
}

function toBase64Url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function POST(req: NextRequest) {
  let body: { to?: string; subject?: string; pdfBase64?: string; filename?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { to, subject, pdfBase64, filename } = body;
  if (!to || !subject || !pdfBase64 || !filename) {
    return NextResponse.json(
      { error: 'to, subject, pdfBase64 and filename are all required.' },
      { status: 400 }
    );
  }

  const credB64 = process.env.GOOGLE_WORKSPACE_OAUTH_ADMIN_AROI_AU_B64;
  if (!credB64) {
    return NextResponse.json(
      { error: 'GOOGLE_WORKSPACE_OAUTH_ADMIN_AROI_AU_B64 is not configured on the server.' },
      { status: 500 }
    );
  }

  let credential: GoogleOAuthCredential;
  try {
    credential = JSON.parse(Buffer.from(credB64, 'base64').toString('utf-8'));
  } catch {
    return NextResponse.json(
      { error: 'GOOGLE_WORKSPACE_OAUTH_ADMIN_AROI_AU_B64 could not be parsed as base64 JSON.' },
      { status: 500 }
    );
  }

  if (!credential.refresh_token || !credential.client_id || !credential.client_secret) {
    return NextResponse.json(
      {
        error:
          'Gmail credential is missing refresh_token/client_id/client_secret — cannot send from this serverless function. Chai needs to re-authorize admin@aroi.au with a usable refresh token.',
      },
      { status: 501 }
    );
  }

  if (credential.scopes && !credential.scopes.includes(REQUIRED_SCOPE)) {
    return NextResponse.json(
      {
        error: `Gmail credential does not carry the ${REQUIRED_SCOPE} scope — cannot send mail from this serverless function. Chai needs to re-authorize admin@aroi.au with gmail.send included.`,
      },
      { status: 501 }
    );
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(credential.client_id, credential.client_secret);
    oAuth2Client.setCredentials({ refresh_token: credential.refresh_token });

    const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

    const raw = toBase64Url(
      buildMimeMessage({
        to,
        from: FROM_ADDRESS,
        subject,
        bodyText: 'Hi Kayla,\n\nPlease see the attached invoice.\n\nRegards,\nChai',
        filename,
        pdfBase64,
      })
    );

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw },
    });

    return NextResponse.json({ sent: true, messageId: result.data.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error sending via Gmail API';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

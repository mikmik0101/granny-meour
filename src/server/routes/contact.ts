import { Router, type IRouter, type Request, type Response } from 'express';
import { Resend } from 'resend';
import { z } from 'zod/v4';
import { db } from '../../../shared/db/index.js';
import { settingsTable } from '../../../shared/db/schema/index.js';

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Validation (zod/v4, matching existing project conventions)
// ---------------------------------------------------------------------------
const ContactBodySchema = z.strictObject({
  name: z.string().trim().min(1, 'Please share your name.').max(120, 'Name is too long.'),
  email: z.email('Please share a valid email address.').trim().max(254, 'Email address is too long.'),
  message: z.string().trim().min(1, 'Please write a short note.').max(5000, 'Message is too long.'),
  // Honeypot: must be absent or empty. Real users never see this field.
  company: z.literal('', { error: 'Rejected.' }).optional(),
});
type ContactBody = z.infer<typeof ContactBodySchema>;

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const resendApiKey = process.env.RESEND_API_KEY;

const resend = resendApiKey
  ? new Resend(resendApiKey)
  : null;

// Destination precedence: explicit CONTACT_EMAIL override, then the enabled
// email entry in site settings (admin-managed), then nothing (503).
function configuredContactEmail(): string | null {
  const override = process.env.CONTACT_EMAIL?.trim();
  if (override) return override;
  return null;
}

async function settingsContactEmail(): Promise<string | null> {
  try {
    const rows = await db.select({ contactMethods: settingsTable.contactMethods })
      .from(settingsTable)
      .limit(1);
    const raw = rows[0]?.contactMethods;
    if (!raw) return null;
    const methods = JSON.parse(raw) as Array<{
      platform?: string;
      value?: string;
      enabled?: boolean;
    }>;
    const entry = methods.find(
      (m) => m.platform === 'email' && m.enabled !== false && typeof m.value === 'string' && m.value.includes('@'),
    );
    return entry?.value ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Lightweight in-memory rate limiting (per IP). Fits this deployment: a
// single-process function instance with low traffic; no new infrastructure.
// Vercel functions may run multiple instances, which only makes this limit
// MORE permissive, never less — acceptable for spam throttling, not auth.
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX = 5; // messages per window
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    // Opportunistic cleanup so the map cannot grow unbounded across requests.
    if (rateBuckets.size > 1000) {
      for (const [key, b] of rateBuckets) {
        if (now - b.windowStart >= RATE_LIMIT_WINDOW_MS) rateBuckets.delete(key);
      }
    }
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX;
}

function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return first || req.socket.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------
router.post('/contact', async (req: Request, res: Response) => {
  // Honeypot: automated scripts that fill hidden fields are rejected as
  // successful-looking no-ops so bots do not learn they were caught.
  if (typeof req.body === 'object' && req.body !== null && (req.body as Record<string, unknown>).company) {
    res.status(200).json({ sent: true });
    return;
  }

  if (rateLimited(clientIp(req))) {
    res.status(429).json({ error: 'Too many notes sent. Please try again a little later.' });
    return;
  }

  const parsed = ContactBodySchema.safeParse(req.body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    res.status(400).json({ error: first?.message ?? 'Please check the form and try again.' });
    return;
  }
  const { name, email, message } = parsed.data as ContactBody;

  const destination = configuredContactEmail() ?? (await settingsContactEmail());
  if (!destination) {
    res.status(503).json({ error: 'The contact form is not quite ready. Please reach out another way for now.' });
    return;
  }

  if (!resend) {
    res.status(503).json({ error: 'The contact form is not quite ready. Please reach out another way for now.' });
    return;
  }

  try {
    // Only fixed server-side header values: From/To are controlled entirely
    // by the server; the visitor's email goes into Reply-To only, and name/
    // message are only ever interpolated into the text/html body.
    const result = await resend.emails.send({
      from: 'Granny Meour Contact <onboarding@resend.dev>',
      to: destination,
      replyTo: email,
      subject: 'Granny Meour Contact Inquiry',
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: [
        '<div style="font-family: sans-serif; max-width: 560px;">',
        `<p><strong>Name:</strong> ${escapeHtml(name)}</p>`,
        `<p><strong>Email:</strong> ${escapeHtml(email)}</p>`,
        `<p><strong>Message:</strong></p>`,
        `<p style="white-space: pre-wrap;">${escapeHtml(message)}</p>`,
        '</div>',
      ].join(''),
    });

    if (result.error) {
      req.log.error(
        { err: { name: result.error.name, message: result.error.message?.slice(0, 200) } },
        'Contact email delivery error',
      );
      res.status(502).json({ error: 'Your note could not be delivered. Please try again, or reach out another way.' });
      return;
    }

    // Server confirmed Resend accepted the message for delivery.
    res.json({ sent: true });
  } catch (error) {
    req.log.error({ err: error }, 'Contact email send error');
    res.status(502).json({ error: 'Your note could not be delivered. Please try again, or reach out another way.' });
  }
});

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export default router;

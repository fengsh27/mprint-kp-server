import { NextRequest, NextResponse } from 'next/server';
import appPool from '../../libs/database/appdb';
import { withRateLimit, feedbackRateLimiter, feedbackGlobalLimiter } from '../../libs/middleware/rateLimiter';
import {
  addSecurityHeaders,
  validateRequestSize,
  sanitizeInput,
  logSecurityEvent,
} from '../../libs/middleware/security';

const MAX_FIELD_LENGTH = 2000;

// Feedback is free-form prose — validate length and strip HTML/JS only.
// The strict ALLOWED_CHARS whitelist in InputValidator rejects apostrophes and
// other legitimate punctuation that users naturally type in feedback text.
function validateFeedbackField(value: string, key: string): { valid: boolean; error?: string } {
  if (value.length > MAX_FIELD_LENGTH) {
    return { valid: false, error: `Field ${key} exceeds maximum length of ${MAX_FIELD_LENGTH} characters` };
  }
  // Block null bytes and ASCII control characters (except tab/newline which are normal in prose)
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(value)) {
    return { valid: false, error: `Field ${key} contains invalid characters` };
  }
  return { valid: true };
}

function getClientIP(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

async function feedbackHandler(req: NextRequest) {
  const sizeCheck = validateRequestSize(req, 1);
  if (!sizeCheck.valid) {
    logSecurityEvent(req, 'REQUEST_SIZE_EXCEEDED', { size: req.headers.get('content-length') });
    return NextResponse.json({ error: 'Request too large' }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;

  // Honeypot: bots auto-fill this hidden field; humans never see it.
  // Checked before rate limiters so bots cannot exhaust the global quota
  // by deliberately triggering the honeypot path on every request.
  if (raw.website) {
    return NextResponse.json({ success: true }, { status: 200 });
  }

  // Rate limiters run after the honeypot so only real submissions count
  const globalCheck = feedbackGlobalLimiter.check();
  if (!globalCheck.allowed) {
    logSecurityEvent(req, 'GLOBAL_RATE_LIMIT_EXCEEDED', {});
    return NextResponse.json(
      { error: 'Rate Limit Exceeded', message: feedbackGlobalLimiter.config.message },
      {
        status: 429,
        headers: { 'Retry-After': Math.ceil((globalCheck.resetTime - Date.now()) / 1000).toString() },
      }
    );
  }

  const fields = {
    additional_data:           raw.additional_data,
    exclude_data:              raw.exclude_data,
    recommended_publications:  raw.recommended_publications,
    additional_comments:       raw.additional_comments,
  };

  // At least one field must be non-empty
  const hasContent = Object.values(fields).some(
    v => typeof v === 'string' && v.trim().length > 0
  );
  if (!hasContent) {
    return NextResponse.json({ error: 'At least one feedback field is required' }, { status: 400 });
  }

  // Validate and sanitize each field
  const sanitized: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null || value === '') {
      sanitized[key] = null;
      continue;
    }
    if (typeof value !== 'string') {
      return NextResponse.json({ error: `Field ${key} must be a string` }, { status: 400 });
    }
    const check = validateFeedbackField(value, key);
    if (!check.valid) {
      logSecurityEvent(req, 'INVALID_INPUT', { field: key, error: check.error });
      return NextResponse.json({ error: 'Invalid input', message: check.error }, { status: 400 });
    }
    sanitized[key] = sanitizeInput(value) as string;
  }

  try {
    await appPool.execute(
      `INSERT INTO feedback
         (additional_data, exclude_data, recommended_publications, additional_comments, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [
        sanitized.additional_data,
        sanitized.exclude_data,
        sanitized.recommended_publications,
        sanitized.additional_comments,
        getClientIP(req),
      ]
    );

    logSecurityEvent(req, 'FEEDBACK_SUBMITTED', {});
    const response = NextResponse.json({ success: true }, { status: 201 });
    return addSecurityHeaders(response);
  } catch (error) {
    console.error('Error saving feedback:', error);
    logSecurityEvent(req, 'DATABASE_ERROR', { error: String(error) });
    return NextResponse.json({ error: 'Failed to save feedback' }, { status: 500 });
  }
}

export const POST = withRateLimit(feedbackHandler, feedbackRateLimiter);

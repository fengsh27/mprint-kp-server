# Security Documentation - Knowledge Portal API

## 🔒 Overview

This document outlines the comprehensive security measures implemented in the Knowledge Portal API to protect against common web vulnerabilities and ensure safe operation.

## 🚦 Rate Limiting

### Implementation
- **Per-IP tracking**: Rate limits are applied per client IP address
- **Sliding window**: 1-minute windows with automatic cleanup
- **Endpoint-specific limits**: Different limits for different types of operations

### Rate Limits by Endpoint Type
| Endpoint Type | Requests per Minute | Window |
|---------------|---------------------|---------|
| General API   | 100                 | 1 min  |
| Search        | 30                  | 1 min  |
| Download      | 10                  | 1 min  |

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-01T12:01:00.000Z
Retry-After: 45
```

### Response Codes
- **429 Too Many Requests**: When rate limit is exceeded
- **Retry-After header**: Seconds until next allowed request

## 🛡️ Input Validation & Sanitization

### String Validation
- **Length limits**: Maximum 1000 characters (configurable)
- **Character restrictions**: Only alphanumeric, spaces, and safe punctuation
- **Format validation**: Specific formats for PMIDs (1-8 digits) and CUIs (C + 7 digits)

### Array Validation
- **Size limits**: Maximum 1000 items (configurable)
- **Type checking**: Ensures all items are of expected type
- **Content validation**: Validates each array element individually

### Input Sanitization
- **HTML tag removal**: Strips potential HTML tags
- **JavaScript protocol blocking**: Removes `javascript:` protocols
- **Event handler removal**: Strips `onclick`, `onload`, etc.

## 🚨 SQL Injection Protection

### Pattern Detection
The API detects and blocks common SQL injection patterns:

```typescript
// Blocked patterns:
- UNION SELECT, INSERT, UPDATE, DELETE, DROP, CREATE, ALTER
- OR/AND with numeric comparisons
- SQL comments (--, /*, */)
- Stored procedure calls (xp_, sp_, fn_)
```

### Response
- **400 Bad Request**: When suspicious patterns detected
- **Logging**: All attempts logged for security monitoring
- **No execution**: Suspicious requests never reach database

## 📏 Request Size Limits

### Limits by Method
| HTTP Method | Maximum Size | Purpose |
|-------------|--------------|---------|
| GET         | 1MB          | Query parameters |
| POST        | 5MB          | Request body |

### Enforcement
- **Content-Length header**: Pre-request validation
- **413 Payload Too Large**: When limits exceeded
- **Logging**: Size violations logged for monitoring

## 🔐 Security Headers

### HTTP Security Headers
```http
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Content Security Policy (CSP)
```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' data:;
```

## 🌐 CORS Configuration

### Development
- **Origin**: `*` (all origins allowed)
- **Methods**: GET, POST, PUT, DELETE, OPTIONS
- **Headers**: Content-Type, Authorization, X-Requested-With

### Production
- **Origin**: Restricted to specific domains
- **Methods**: Same as development
- **Headers**: Same as development

## 📊 Security Logging

### Logged Events
- **Rate limit exceeded**: IP, timestamp, endpoint
- **Invalid input**: Field, value, error message
- **SQL injection attempts**: Input, pattern detected
- **Request size violations**: Size, limit
- **Database errors**: Error details, context
- **Successful operations**: Query parameters, result counts

### Log Format
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "method": "POST",
  "url": "/api/concepts",
  "event": "SQL_INJECTION_ATTEMPT",
  "details": {
    "field": "drug",
    "value": "'; DROP TABLE users; --"
  }
}
```

## ⚙️ Configuration

### Environment Variables
```bash
# Rate Limiting
RATE_LIMITING_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Input Validation
INPUT_VALIDATION_ENABLED=true
MAX_STRING_LENGTH=1000
MAX_ARRAY_LENGTH=1000
MAX_REQUEST_SIZE_MB=5

# Search-specific limits
SEARCH_RATE_LIMIT_MAX_REQUESTS=30
DOWNLOAD_RATE_LIMIT_MAX_REQUESTS=10
```

### Environment-Specific Configs
- **Development**: More permissive limits for testing
- **Production**: Stricter limits for security
- **Override capability**: Environment variables can override defaults

## 🚀 Implementation

### Middleware Usage
```typescript
import { withRateLimit, searchRateLimiter } from "../../libs/middleware/rateLimiter";
import { InputValidator, addSecurityHeaders } from "../../libs/middleware/security";

// Apply rate limiting
export const GET = withRateLimit(handler, searchRateLimiter);

// Apply security headers
const response = NextResponse.json(data);
return addSecurityHeaders(response);
```

### Validation Example
```typescript
// Validate input
const validation = InputValidator.validateString(input, 'fieldName');
if (!validation.valid) {
  return NextResponse.json(
    { error: 'Invalid input', message: validation.error },
    { status: 400 }
  );
}

// Check for SQL injection
if (detectSQLInjection(input)) {
  return NextResponse.json(
    { error: 'Invalid input', message: 'Suspicious input detected' },
    { status: 400 }
  );
}
```

## 🔍 Monitoring & Alerts

### Security Metrics
- **Rate limit violations**: Track abuse patterns
- **Input validation failures**: Identify attack attempts
- **SQL injection attempts**: Monitor for sophisticated attacks
- **Request size violations**: Detect potential DoS attempts

### Recommended Actions
1. **Monitor logs**: Regular review of security events
2. **Set up alerts**: Notify on suspicious activity
3. **Review patterns**: Analyze attack vectors
4. **Update rules**: Refine detection patterns

## 🛠️ Future Enhancements

### Planned Features
- **API key authentication**: For premium users
- **IP whitelisting**: For trusted clients
- **Advanced threat detection**: Machine learning-based
- **Rate limit customization**: Per-user limits
- **Audit trails**: Complete request/response logging

### Integration Options
- **Redis**: For distributed rate limiting
- **Elasticsearch**: For log aggregation
- **Prometheus**: For metrics collection
- **Grafana**: For visualization

## 📞 Support

For security-related issues or questions:
- **Security team**: security@your-domain.com
- **Emergency**: +1-XXX-XXX-XXXX
- **Bug bounty**: security.your-domain.com

---

**Last Updated**: January 2024  
**Version**: 1.0.0  
**Maintainer**: Security Team

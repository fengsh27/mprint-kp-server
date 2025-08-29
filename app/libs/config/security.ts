export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
    skipForLocalhost: boolean;
    general: {
      windowMs: number;
      maxRequests: number;
    };
    search: {
      windowMs: number;
      maxRequests: number;
    };
    download: {
      windowMs: number;
      maxRequests: number;
    };
  };
  inputValidation: {
    enabled: boolean;
    skipForLocalhost: boolean;
    maxStringLength: number;
    maxArrayLength: number;
    maxRequestSizeMB: number;
  };
  securityHeaders: {
    enabled: boolean;
    skipForLocalhost: boolean;
    csp: string;
    cors: {
      enabled: boolean;
      allowedOrigins: string[];
    };
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
    securityEvents: boolean;
    skipForLocalhost: boolean;
  };
}

// Development configuration
const devConfig: SecurityConfig = {
  rateLimiting: {
    enabled: true,
    skipForLocalhost: true,
    general: {
      windowMs: 60 * 1000,        // 1 minute
      maxRequests: 1000,           // More lenient in dev
    },
    search: {
      windowMs: 60 * 1000,
      maxRequests: 300,
    },
    download: {
      windowMs: 60 * 1000,
      maxRequests: 100,
    },
  },
  inputValidation: {
    enabled: true,
    skipForLocalhost: true,
    maxStringLength: 1000,
    maxArrayLength: 1000,
    maxRequestSizeMB: 10,
  },
  securityHeaders: {
    enabled: true,
    skipForLocalhost: false,       // Keep security headers even for localhost
    csp: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
    cors: {
      enabled: true,
      allowedOrigins: ['*'], // More permissive in dev
    },
  },
  logging: {
    enabled: true,
    level: 'debug',
    securityEvents: true,
    skipForLocalhost: false,       // Keep logging for localhost in dev
  },
};

// Production configuration
const prodConfig: SecurityConfig = {
  rateLimiting: {
    enabled: true,
    skipForLocalhost: false,       // No bypass in production
    general: {
      windowMs: 60 * 1000,        // 1 minute
      maxRequests: 100,            // Stricter in production
    },
    search: {
      windowMs: 60 * 1000,
      maxRequests: 30,
    },
    download: {
      windowMs: 60 * 1000,
      maxRequests: 10,
    },
  },
  inputValidation: {
    enabled: true,
    skipForLocalhost: false,       // No bypass in production
    maxStringLength: 500,          // Stricter in production
    maxArrayLength: 500,
    maxRequestSizeMB: 5,
  },
  securityHeaders: {
    enabled: true,
    skipForLocalhost: false,       // No bypass in production
    csp: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; font-src 'self' data:;",
    cors: {
      enabled: true,
      allowedOrigins: ['https://your-domain.com'], // Restrictive in production
    },
  },
  logging: {
    enabled: true,
    level: 'info',
    securityEvents: true,
    skipForLocalhost: false,       // No bypass in production
  },
};

// Get configuration based on environment
export function getSecurityConfig(): SecurityConfig {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production' ? prodConfig : devConfig;
}

// Environment variables override
export function getEnvOverrides(): Partial<SecurityConfig> {
  return {
    rateLimiting: {
      enabled: process.env.RATE_LIMITING_ENABLED === 'true',
      skipForLocalhost: process.env.RATE_LIMITING_SKIP_LOCALHOST === 'true',
      general: {
        windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : 60000,
        maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : 100,
      },
      search: {
        windowMs: process.env.SEARCH_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.SEARCH_RATE_LIMIT_WINDOW_MS) : 60000,
        maxRequests: process.env.SEARCH_RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.SEARCH_RATE_LIMIT_MAX_REQUESTS) : 30,
      },
      download: {
        windowMs: process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS) : 60000,
        maxRequests: process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS) : 10,
      },
    },
    inputValidation: {
      enabled: process.env.INPUT_VALIDATION_ENABLED === 'true',
      skipForLocalhost: process.env.INPUT_VALIDATION_SKIP_LOCALHOST === 'true',
      maxStringLength: process.env.MAX_STRING_LENGTH ? parseInt(process.env.MAX_STRING_LENGTH) : 1000,
      maxArrayLength: process.env.MAX_ARRAY_LENGTH ? parseInt(process.env.MAX_ARRAY_LENGTH) : 1000,
      maxRequestSizeMB: process.env.MAX_REQUEST_SIZE_MB ? parseInt(process.env.MAX_REQUEST_SIZE_MB) : 10,
    },
  };
}

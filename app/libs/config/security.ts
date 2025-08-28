export interface SecurityConfig {
  rateLimiting: {
    enabled: boolean;
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
    maxStringLength: number;
    maxArrayLength: number;
    maxRequestSizeMB: number;
  };
  securityHeaders: {
    enabled: boolean;
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
  };
}

// Development configuration
const devConfig: SecurityConfig = {
  rateLimiting: {
    enabled: true,
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
    maxStringLength: 1000,
    maxArrayLength: 1000,
    maxRequestSizeMB: 10,
  },
  securityHeaders: {
    enabled: true,
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
  },
};

// Production configuration
const prodConfig: SecurityConfig = {
  rateLimiting: {
    enabled: true,
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
    maxStringLength: 500,          // Stricter in production
    maxArrayLength: 500,
    maxRequestSizeMB: 5,
  },
  securityHeaders: {
    enabled: true,
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
      general: {
        windowMs: process.env.RATE_LIMIT_WINDOW_MS ? parseInt(process.env.RATE_LIMIT_WINDOW_MS) : undefined,
        maxRequests: process.env.RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) : undefined,
      },
      search: {
        windowMs: process.env.SEARCH_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.SEARCH_RATE_LIMIT_WINDOW_MS) : undefined,
        maxRequests: process.env.SEARCH_RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.SEARCH_RATE_LIMIT_MAX_REQUESTS) : undefined,
      },
      download: {
        windowMs: process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS ? parseInt(process.env.DOWNLOAD_RATE_LIMIT_WINDOW_MS) : undefined,
        maxRequests: process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS ? parseInt(process.env.DOWNLOAD_RATE_LIMIT_MAX_REQUESTS) : undefined,
      },
    },
    inputValidation: {
      enabled: process.env.INPUT_VALIDATION_ENABLED === 'true',
      maxStringLength: process.env.MAX_STRING_LENGTH ? parseInt(process.env.MAX_STRING_LENGTH) : undefined,
      maxArrayLength: process.env.MAX_ARRAY_LENGTH ? parseInt(process.env.MAX_ARRAY_LENGTH) : undefined,
      maxRequestSizeMB: process.env.MAX_REQUEST_SIZE_MB ? parseInt(process.env.MAX_REQUEST_SIZE_MB) : undefined,
    },
  };
}

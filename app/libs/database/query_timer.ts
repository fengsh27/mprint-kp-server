/**
 * Query timing and logging utility
 * Tracks execution time for database queries and logs them
 */

export interface QueryTimingInfo {
  queryName: string;
  durationMs: number;
  durationSeconds: number;
  resultCount?: number;
  parameters?: Record<string, any>;
  batchInfo?: {
    batchNumber: number;
    totalBatches: number;
    batchSize: number;
  };
}

/**
 * Logs query timing information
 */
export function logQueryTiming(info: QueryTimingInfo): void {
  const {
    queryName,
    durationMs,
    durationSeconds,
    resultCount,
    parameters,
    batchInfo
  } = info;

  const logData: any = {
    timestamp: new Date().toISOString(),
    query: queryName,
    duration: `${durationMs.toFixed(2)}ms (${durationSeconds.toFixed(3)}s)`,
    durationMs: Math.round(durationMs * 100) / 100, // Round to 2 decimal places
  };

  if (resultCount !== undefined) {
    logData.resultCount = resultCount;
  }

  if (parameters) {
    logData.parameters = parameters;
  }

  if (batchInfo) {
    logData.batch = `${batchInfo.batchNumber}/${batchInfo.totalBatches}`;
    logData.batchSize = batchInfo.batchSize;
  }

  // Log to console with structured format
  console.log('[QUERY_TIMING]', JSON.stringify(logData, null, 2));
}

/**
 * Wraps an async function to measure and log its execution time
 */
export async function timeQuery<T>(
  queryName: string,
  queryFn: () => Promise<T>,
  parameters?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await queryFn();
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const durationSeconds = durationMs / 1000;

    const resultCount = Array.isArray(result) ? result.length : undefined;

    logQueryTiming({
      queryName,
      durationMs,
      durationSeconds,
      resultCount,
      parameters,
    });

    return result;
  } catch (error) {
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const durationSeconds = durationMs / 1000;

    // Log timing even on error
    logQueryTiming({
      queryName,
      durationMs,
      durationSeconds,
      parameters,
    });

    throw error;
  }
}

/**
 * Times a batched query operation
 */
export async function timeBatchedQuery<T>(
  queryName: string,
  batchFn: (batchNumber: number, totalBatches: number, batchSize: number) => Promise<T>,
  batchNumber: number,
  totalBatches: number,
  batchSize: number,
  parameters?: Record<string, any>
): Promise<T> {
  const startTime = performance.now();
  
  try {
    const result = await batchFn(batchNumber, totalBatches, batchSize);
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const durationSeconds = durationMs / 1000;

    const resultCount = Array.isArray(result) ? result.length : undefined;

    logQueryTiming({
      queryName,
      durationMs,
      durationSeconds,
      resultCount,
      parameters,
      batchInfo: {
        batchNumber,
        totalBatches,
        batchSize,
      },
    });

    return result;
  } catch (error) {
    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const durationSeconds = durationMs / 1000;

    // Log timing even on error
    logQueryTiming({
      queryName,
      durationMs,
      durationSeconds,
      parameters,
      batchInfo: {
        batchNumber,
        totalBatches,
        batchSize,
      },
    });

    throw error;
  }
}


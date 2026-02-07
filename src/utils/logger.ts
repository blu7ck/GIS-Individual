/**
 * Production-safe logger utility
 * 
 * In development: logs to console
 * In production: noop (can be extended with Sentry/LogRocket)
 */

const isDevelopment = import.meta.env.DEV;



interface Logger {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    log: (...args: unknown[]) => void;
}

const noop = () => { };

const createLogger = (): Logger => {
    if (isDevelopment) {
        return {
            debug: (...args: unknown[]) => console.debug('[DEBUG]', ...args),
            info: (...args: unknown[]) => console.info('[INFO]', ...args),
            warn: (...args: unknown[]) => console.warn('[WARN]', ...args),
            error: (...args: unknown[]) => console.error('[ERROR]', ...args),
            log: (...args: unknown[]) => console.log(...args),
        };
    }

    // Production: noop by default
    return {
        debug: noop,
        info: noop,
        warn: noop,
        error: () => {
            // Errors still captured for potential Sentry integration
            // Future: Sentry.captureMessage(args.map(String).join(' '), 'error');
        },
        log: noop,
    };
};

export const logger = createLogger();

/**
 * Report an error (can be extended with Sentry)
 */
export const reportError = (error: Error, context: Record<string, unknown> = {}): void => {
    logger.error('Error reported:', {
        message: error.message,
        stack: error.stack,
        ...context,
    });
};

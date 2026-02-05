/**
 * Application Logger
 * Standardized logging utility for the application.
 * - In DEV: Logs to console (debug, info, warn, error)
 * - In PROD: Silent (noop) to prevent leaking info or cluttering console
 */

const isDev = import.meta.env.DEV;

type LogParams = any[];

export const logger = {
    debug: (...args: LogParams) => {
        if (isDev) {
            console.debug('[App:Debug]', ...args);
        }
    },

    info: (...args: LogParams) => {
        if (isDev) {
            console.info('[App:Info]', ...args);
        }
    },

    warn: (...args: LogParams) => {
        if (isDev) {
            console.warn('[App:Warn]', ...args);
        }
    },

    error: (...args: LogParams) => {
        // Errors might be useful even in prod (e.g. sent to Sentry), 
        // but for now we follow the rule: silent in PROD unless configured otherwise.
        if (isDev) {
            console.error('[App:Error]', ...args);
        }
    }
};

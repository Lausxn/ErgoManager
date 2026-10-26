/**
 * Production settings. The development build replaces this file with
 * environment.development.ts, see the fileReplacements of angular.json.
 */
export const environment = {
    production: true,
    apiUrl: 'https://api.ergomanager.mgs.com/api',
    /** Time without activity (clicks, keys, scroll) before the session is closed: 15 minutes. */
    inactivityTimeoutMs: 15 * 60 * 1000
};

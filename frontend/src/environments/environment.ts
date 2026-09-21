/**
 * Production settings. The development build replaces this file with
 * environment.development.ts, see the fileReplacements of angular.json.
 */
export const environment = {
    production: true,
    apiUrl: 'https://api.ergomanager.mgs.com/api',
    /** Preview mode without guards, never enabled in production. */
    previewMode: false
};

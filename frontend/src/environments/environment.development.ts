/**
 * Development settings, pointing to the Spring Boot application running on the
 * local machine.
 */
export const environment = {
    production: false,
    apiUrl: 'http://localhost:8080/api',
    /** Time without activity (clicks, keys, scroll) before the session is closed: 15 minutes. */
    inactivityTimeoutMs: 15 * 60 * 1000
};

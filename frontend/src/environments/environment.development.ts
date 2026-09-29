/**
 * Development settings, pointing to the Spring Boot application running on the
 * local machine.
 */
export const environment = {
    production: false,
    apiUrl: 'http://localhost:8080/api',
    /**
     * Opens every page without signing in, with a demo user, to review the
     * interface without the backend. Keep it false to use the real API.
     */
    previewMode: false
};

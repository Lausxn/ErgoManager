/**
 * Development settings, pointing to the Spring Boot application running on the
 * local machine.
 */
export const environment = {
    production: false,
    apiUrl: 'http://localhost:8080/api',
    /**
     * TEMPORARY: opens every page without signing in, with a demo user, to
     * review the interface. Set it to false to turn the guards back on.
     */
    previewMode: true
};

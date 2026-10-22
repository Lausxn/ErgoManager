/**
 * Takes the initials of the first two words of a business name, skipping
 * short lowercase connectors such as "de" or "y".
 *
 * @param businessName name of the company
 * @returns up to two uppercase letters, empty when there is no name
 */
export function companyInitials(businessName: string): string {
    return businessName
        .trim()
        .split(/\s+/)
        .filter((word) => word.length > 2 || /^[A-ZÁÉÍÓÚÑ0-9]/.test(word))
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase();
}

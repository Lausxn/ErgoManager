/** Parts of the name of a person, as the backend stores them. */
export interface PersonName {
    firstName: string;
    firstLastName: string;
    secondLastName?: string | null;
}

/**
 * Joins the parts of a name, skipping the empty second last name.
 *
 * @param person parts of the name
 * @returns full name with single spaces
 */
export function fullNameOf(person: PersonName): string {
    return [person.firstName, person.firstLastName, person.secondLastName ?? '']
        .map((part) => part.trim())
        .filter(Boolean)
        .join(' ');
}

/**
 * Avatar initials of a user: first name and first last name ("Juan José Madrigal" is "JM").
 *
 * @param person parts of the name
 * @returns two uppercase letters, fewer when a part is empty
 */
export function personInitials(person: PersonName): string {
    return `${person.firstName.trim().charAt(0)}${person.firstLastName.trim().charAt(0)}`.toUpperCase();
}

/**
 * Avatar initials of a name typed in a single field: its first two words.
 *
 * @param name full name
 * @returns up to two uppercase letters
 */
export function nameInitials(name: string): string {
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join('')
        .toUpperCase();
}

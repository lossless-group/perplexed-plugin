import { asString, isRecord } from './coerce';

export interface DateBearingSource {
    date?: unknown;
    last_updated?: unknown;
}

export function formatCitationDate(dateString: string): string {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);

        if (isNaN(date.getTime())) {
            return '';
        }

        const year = date.getFullYear();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const day = date.getDate().toString().padStart(2, '0');

        return `${year}, ${month} ${day}`;
    } catch (error) {
        console.warn('Failed to format date:', dateString, error);
        return '';
    }
}

export function getMostRecentDate(source: unknown): string {
    if (!isRecord(source)) return '';
    return asString(source.last_updated) ?? asString(source.date) ?? '';
}

export function formatPublicationInfo(source: unknown): string {
    if (!isRecord(source)) return '';
    const dateInfo: string[] = [];

    const date = asString(source.date);
    if (date) dateInfo.push(`Published: ${date}`);

    const lastUpdated = asString(source.last_updated);
    if (lastUpdated) dateInfo.push(`Updated: ${lastUpdated}`);

    return dateInfo.join(' | ');
}

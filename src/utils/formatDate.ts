/**
 * Date formatting utilities for the Perplexed plugin
 */

/**
 * Formats a date string into the format: "YYYY, MMM DD"
 * Examples: "2024, Dec 13", "2025, Jan 05"
 * 
 * @param dateString - Date string in various formats (ISO, YYYY-MM-DD, etc.)
 * @returns Formatted date string or empty string if invalid
 */
export function formatCitationDate(dateString: string): string {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        
        // Check if date is valid
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

/**
 * Gets the most recent date from available date fields
 * Prioritizes last_updated over date
 * 
 * @param source - Source object with potential date fields
 * @returns Most recent date string or empty string if none available
 */
export function getMostRecentDate(source: any): string {
    if (source.last_updated) {
        return source.last_updated;
    }
    if (source.date) {
        return source.date;
    }
    return '';
}

/**
 * Creates the publication info string for citations
 * Format: "Published: YYYY-MM-DD | Updated: YYYY-MM-DD"
 * 
 * @param source - Source object with potential date fields
 * @returns Publication info string or empty string if no dates available
 */
export function formatPublicationInfo(source: any): string {
    const dateInfo = [];
    
    if (source.date) {
        dateInfo.push(`Published: ${source.date}`);
    }
    if (source.last_updated) {
        dateInfo.push(`Updated: ${source.last_updated}`);
    }
    
    return dateInfo.join(' | ');
}

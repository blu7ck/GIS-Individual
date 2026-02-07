
/**
 * Formats a distance in meters to a human-readable string (m or km)
 */
export function formatDistance(distanceMeters: number): string {
    if (distanceMeters >= 1000) {
        return `Distance: ${(distanceMeters / 1000).toFixed(3)} km`;
    }
    return `Distance: ${distanceMeters.toFixed(2)} m`;
}

/**
 * Formats an area in square meters to a human-readable string (m², hectares, or km²)
 */
export function formatArea(areaSqMeters: number): string {
    if (areaSqMeters >= 1000000) {
        return `Area: ${(areaSqMeters / 1000000).toFixed(6)} km²`;
    }
    if (areaSqMeters >= 10000) {
        return `Area: ${(areaSqMeters / 10000).toFixed(4)} hectares`;
    }
    return `Area: ${areaSqMeters.toFixed(2)} m²`;
}
/**
 * Formats a height in meters
 */
export function formatHeight(height: number): string {
    return `Rakım: ${height.toFixed(2)} m`;
}

/**
 * Formats a slope
 */
export function formatSlope(percent: number, degree: number): string {
    return `Eğim: %${percent.toFixed(1)} (${degree.toFixed(1)}°)`;
}

/**
 * Formats a volume in cubic meters
 */
export function formatVolume(volume: number): string {
    if (volume >= 1000000) {
        return `Hacim: ${(volume / 1000000).toFixed(3)} M m³`;
    }
    return `Hacim: ${volume.toFixed(2)} m³`;
}

/**
 * ISU Echague Campus Locations Data
 * Isabela State University - Main Campus, San Fabian, Echague, Isabela
 * 
 * Coordinates verified against Google Maps satellite imagery (2026).
 * The campus center is at approximately 16.7200°N, 121.6905°E.
 */

const CAMPUS_CENTER = [16.7200, 121.6905];
const DEFAULT_ZOOM = 17;
const MIN_ZOOM = 14;
const MAX_ZOOM = 20;

const CATEGORY_CONFIG = {
    academic: {
        label: 'Academic',
        icon: 'fas fa-graduation-cap',
        color: '#4da6ff',
        markerIcon: 'fas fa-graduation-cap'
    },
    admin: {
        label: 'Administrative',
        icon: 'fas fa-building',
        color: '#a78bfa',
        markerIcon: 'fas fa-building'
    },
    facility: {
        label: 'Facility',
        icon: 'fas fa-cogs',
        color: '#f97316',
        markerIcon: 'fas fa-cogs'
    },
    sports: {
        label: 'Sports & Recreation',
        icon: 'fas fa-futbol',
        color: '#22c55e',
        markerIcon: 'fas fa-futbol'
    },
    landmark: {
        label: 'Landmark',
        icon: 'fas fa-landmark',
        color: '#f43f5e',
        markerIcon: 'fas fa-landmark'
    }
};

// LOCATIONS array has been moved to Supabase!


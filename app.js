/**
 * ISU Echague Interactive Campus Map - Application Logic
 * Built with Leaflet.js
 */

(function () {
    'use strict';

    // ─── State ───────────────────────────────────────────────
    let map;
    let markers = {};
    let LOCATIONS = [];
    let activeLocationId = null;
    let currentCategory = 'all';
    let isSatellite = true;
    let streetLayer, satelliteLayer;

    // ─── DOM References ──────────────────────────────────────
    const $map = document.getElementById('map');
    const $sidebar = document.getElementById('sidebar');
    const $sidebarToggle = document.getElementById('sidebar-toggle');
    const $searchInput = document.getElementById('search-input');
    const $searchClear = document.getElementById('search-clear');
    const $categoryFilters = document.getElementById('category-filters');
    const $locationList = document.getElementById('location-list');
    const $statLocations = document.getElementById('stat-locations');
    const $infoPanel = document.getElementById('info-panel');
    const $infoClose = document.getElementById('info-close');
    const $loadingOverlay = document.getElementById('loading-overlay');
    const $btnLocate = document.getElementById('btn-locate');
    const $btnSatellite = document.getElementById('btn-satellite');
    const $btnFullscreen = document.getElementById('btn-fullscreen');
    const $btnDirections = document.getElementById('btn-directions');
    const $btnZoomTo = document.getElementById('btn-zoom-to');

    // ─── Initialize ──────────────────────────────────────────
    async function init() {
        initMap();
        initTileLayers();
        
        // Fetch locations from Supabase
        const { data, error } = await supabaseClient.from('locations').select('*');
        if (error) {
            console.error('Error fetching locations:', error);
            alert('Failed to load map data from Supabase.');
        } else {
            // Map flat lat/lng to coords array for backwards compatibility
            LOCATIONS = data.map(row => ({
                ...row,
                coords: [row.lat, row.lng]
            }));
            window.LOCATIONS = LOCATIONS; // Expose globally for chatbot.js
            
            addMarkers();
            renderLocationList(LOCATIONS);
            
            // Update stats
            $statLocations.textContent = LOCATIONS.length;
        }

        bindEvents();

        // Hide loading after map is ready
        map.whenReady(() => {
            setTimeout(() => {
                $loadingOverlay.classList.add('hidden');
                setTimeout(() => $loadingOverlay.remove(), 600);
            }, 800);
        });
    }

    // ─── Map Setup ───────────────────────────────────────────
    function initMap() {
        map = L.map('map', {
            center: CAMPUS_CENTER,
            zoom: DEFAULT_ZOOM,
            minZoom: MIN_ZOOM,
            maxZoom: MAX_ZOOM,
            zoomControl: true,
            attributionControl: true
        });

        // Position zoom control
        map.zoomControl.setPosition('topright');

        // Close info panel when clicking on empty map
        map.on('click', () => {
            deselectLocation();
        });
    }

    function initTileLayers() {
        // Street / Default layer - CartoDB Dark
        streetLayer = L.tileLayer(
            'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
            {
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
                subdomains: 'abcd',
                maxZoom: 20
            }
        );

        // Satellite layer - ESRI World Imagery
        satelliteLayer = L.tileLayer(
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            {
                attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ',
                maxZoom: 20
            }
        );

        // Add default layer
        satelliteLayer.addTo(map);
        $btnSatellite.classList.add('active');
    }

    // ─── Markers ─────────────────────────────────────────────
    function createMarkerIcon(location) {
        const cat = location.category;
        const html = `
            <div class="custom-marker ${cat}">
                <i class="${location.icon}"></i>
            </div>
        `;
        return L.divIcon({
            html: html,
            className: 'custom-div-icon',
            iconSize: [36, 36],
            iconAnchor: [18, 36],
            popupAnchor: [0, -36]
        });
    }

    function createPopupContent(location) {
        const cat = location.category;
        const catLabel = CATEGORY_CONFIG[cat].label;
        return `
            <div class="popup-content">
                <div class="popup-header">
                    <div class="popup-icon ${cat}">
                        <i class="${location.icon}"></i>
                    </div>
                    <div>
                        <div class="popup-title">${location.name}</div>
                        <span class="popup-badge ${cat}">${catLabel}</span>
                    </div>
                </div>
                <p class="popup-desc">${location.description}</p>
                <div class="popup-coords">
                    <i class="fas fa-map-marker-alt"></i>
                    ${location.coords[0].toFixed(5)}°N, ${location.coords[1].toFixed(5)}°E
                </div>
            </div>
        `;
    }

    function addMarkers() {
        LOCATIONS.forEach((loc) => {
            const marker = L.marker(loc.coords, {
                icon: createMarkerIcon(loc),
                title: loc.name
            });

            marker.bindPopup(createPopupContent(loc), {
                maxWidth: 280,
                minWidth: 260,
                closeButton: true
            });

            marker.on('click', () => {
                selectLocation(loc.id);
            });

            marker.on('popupclose', () => {
                if (activeLocationId === loc.id) {
                    deselectLocation();
                }
            });

            marker.addTo(map);
            markers[loc.id] = marker;
        });
    }

    // ─── Location Selection ──────────────────────────────────
    function selectLocation(id) {
        const location = LOCATIONS.find(l => l.id === id);
        if (!location) return;

        // Deselect previous
        if (activeLocationId && markers[activeLocationId]) {
            const prevEl = markers[activeLocationId].getElement();
            if (prevEl) {
                const prevMarker = prevEl.querySelector('.custom-marker');
                if (prevMarker) prevMarker.classList.remove('active-marker');
            }
        }

        activeLocationId = id;

        // Highlight marker
        const markerEl = markers[id].getElement();
        if (markerEl) {
            const markerDiv = markerEl.querySelector('.custom-marker');
            if (markerDiv) {
                markerDiv.classList.add('active-marker');
                markerDiv.classList.add('marker-bounce');
                setTimeout(() => markerDiv.classList.remove('marker-bounce'), 1200);
            }
        }

        // Open popup
        markers[id].openPopup();

        // Pan to marker
        map.flyTo(location.coords, Math.max(map.getZoom(), 18), {
            duration: 0.8
        });

        // Update info panel
        updateInfoPanel(location);

        // Highlight sidebar card
        document.querySelectorAll('.location-card').forEach(card => {
            card.classList.toggle('active', card.dataset.id === id);
        });

        // Scroll sidebar card into view
        const activeCard = document.querySelector(`.location-card[data-id="${id}"]`);
        if (activeCard) {
            activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        // Dispatch custom event for chatbot integration
        window.dispatchEvent(new CustomEvent('locationSelected', {
            detail: { location: location }
        }));
    }

    function deselectLocation() {
        if (activeLocationId && markers[activeLocationId]) {
            const prevEl = markers[activeLocationId].getElement();
            if (prevEl) {
                const prevMarker = prevEl.querySelector('.custom-marker');
                if (prevMarker) prevMarker.classList.remove('active-marker');
            }
        }

        activeLocationId = null;
        $infoPanel.classList.add('hidden');
        document.querySelectorAll('.location-card').forEach(card => {
            card.classList.remove('active');
        });

        map.closePopup();
    }

    function updateInfoPanel(location) {
        const cat = location.category;
        const catConfig = CATEGORY_CONFIG[cat];

        document.getElementById('info-icon').className = location.icon;
        document.getElementById('info-title').textContent = location.name;

        const badge = document.getElementById('info-category');
        badge.textContent = catConfig.label;
        badge.className = 'info-badge';
        badge.style.background = `${catConfig.color}22`;
        badge.style.color = catConfig.color;

        document.getElementById('info-description').textContent = location.description;
        document.getElementById('info-coords').textContent =
            `${location.coords[0].toFixed(5)}°N, ${location.coords[1].toFixed(5)}°E`;

        // Update icon wrapper color
        const iconWrapper = document.querySelector('.info-icon-wrapper');
        iconWrapper.style.background = `linear-gradient(135deg, ${catConfig.color}dd, ${catConfig.color})`;
        iconWrapper.style.boxShadow = `0 4px 16px ${catConfig.color}44`;

        $infoPanel.classList.remove('hidden');
    }

    // ─── Location List ───────────────────────────────────────
    function renderLocationList(locations) {
        if (locations.length === 0) {
            $locationList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>No locations found</p>
                </div>
            `;
            return;
        }

        $locationList.innerHTML = locations.map((loc, i) => `
            <div class="location-card" data-id="${loc.id}" style="animation-delay: ${i * 0.04}s">
                <div class="location-card-icon ${loc.category}">
                    <i class="${loc.icon}"></i>
                </div>
                <div class="location-card-info">
                    <div class="location-card-name">${loc.name}</div>
                    <div class="location-card-desc">${CATEGORY_CONFIG[loc.category].label}</div>
                </div>
                <div class="location-card-arrow">
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `).join('');

        // Bind click events
        $locationList.querySelectorAll('.location-card').forEach(card => {
            card.addEventListener('click', () => {
                selectLocation(card.dataset.id);
            });
        });
    }

    function filterLocations() {
        const query = $searchInput.value.toLowerCase().trim();
        let filtered = LOCATIONS;

        // Filter by category
        if (currentCategory !== 'all') {
            filtered = filtered.filter(l => l.category === currentCategory);
        }

        // Filter by search
        if (query) {
            filtered = filtered.filter(l =>
                l.name.toLowerCase().includes(query) ||
                l.description.toLowerCase().includes(query) ||
                CATEGORY_CONFIG[l.category].label.toLowerCase().includes(query)
            );
        }

        renderLocationList(filtered);

        // Show/hide markers
        LOCATIONS.forEach(loc => {
            const marker = markers[loc.id];
            const isVisible = filtered.some(f => f.id === loc.id);

            if (isVisible) {
                if (!map.hasLayer(marker)) marker.addTo(map);
            } else {
                if (map.hasLayer(marker)) map.removeLayer(marker);
            }
        });

        // Update search clear button
        $searchClear.classList.toggle('hidden', !query);
    }

    // ─── Event Bindings ──────────────────────────────────────
    function bindEvents() {
        // Sidebar toggle
        $sidebarToggle.addEventListener('click', () => {
            $sidebar.classList.toggle('open');
            setTimeout(() => map.invalidateSize(), 400);
        });

        // Search
        $searchInput.addEventListener('input', filterLocations);
        $searchClear.addEventListener('click', () => {
            $searchInput.value = '';
            filterLocations();
            $searchInput.focus();
        });

        // Category filters
        $categoryFilters.addEventListener('click', (e) => {
            const chip = e.target.closest('.category-chip');
            if (!chip) return;

            // Update active state
            $categoryFilters.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');

            currentCategory = chip.dataset.category;
            filterLocations();
        });

        // Info panel close
        $infoClose.addEventListener('click', () => {
            deselectLocation();
        });

        // Header controls
        $btnLocate.addEventListener('click', () => {
            map.flyTo(CAMPUS_CENTER, DEFAULT_ZOOM, { duration: 1 });
        });

        $btnSatellite.addEventListener('click', () => {
            isSatellite = !isSatellite;
            $btnSatellite.classList.toggle('active', isSatellite);

            if (isSatellite) {
                map.removeLayer(streetLayer);
                satelliteLayer.addTo(map);
            } else {
                map.removeLayer(satelliteLayer);
                streetLayer.addTo(map);
            }
        });

        $btnFullscreen.addEventListener('click', () => {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                $btnFullscreen.querySelector('i').className = 'fas fa-compress';
            } else {
                document.exitFullscreen();
                $btnFullscreen.querySelector('i').className = 'fas fa-expand';
            }
        });

        // Info panel actions
        $btnDirections.addEventListener('click', () => {
            if (!activeLocationId) return;
            const loc = LOCATIONS.find(l => l.id === activeLocationId);
            if (loc) {
                window.open(
                    `https://www.google.com/maps/dir/?api=1&destination=${loc.coords[0]},${loc.coords[1]}`,
                    '_blank'
                );
            }
        });

        $btnZoomTo.addEventListener('click', () => {
            if (!activeLocationId) return;
            const loc = LOCATIONS.find(l => l.id === activeLocationId);
            if (loc) {
                map.flyTo(loc.coords, MAX_ZOOM, { duration: 0.8 });
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                deselectLocation();
            }
            if (e.key === '/' && document.activeElement !== $searchInput) {
                e.preventDefault();
                $searchInput.focus();
            }
        });

        // Handle fullscreen change
        document.addEventListener('fullscreenchange', () => {
            if (!document.fullscreenElement) {
                $btnFullscreen.querySelector('i').className = 'fas fa-expand';
            }
        });

        // Chatbot Map Control
        window.addEventListener('chatbotSelectLocation', (e) => {
            if (e.detail && e.detail.id) {
                selectLocation(e.detail.id);
                // On mobile, close sidebar if open so map is visible
                if (window.innerWidth <= 768 && $sidebar.classList.contains('open')) {
                    $sidebar.classList.remove('open');
                    setTimeout(() => map.invalidateSize(), 400);
                }
            }
        });
    }

    // ─── Start ───────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', init);

})();

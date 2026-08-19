/**
 * Map Editor Logic (Supabase Integration)
 */

let map;
let editableLocations = [];
let activeMarkerId = null;
let markers = {};

const AVAILABLE_ICONS = [
    'fas fa-map-marker-alt', 'fas fa-building', 'fas fa-building-columns', 'fas fa-graduation-cap',
    'fas fa-cogs', 'fas fa-chalkboard-teacher', 'fas fa-flask', 'fas fa-seedling',
    'fas fa-briefcase', 'fas fa-laptop-code', 'fas fa-gavel', 'fas fa-book-open',
    'fas fa-hospital', 'fas fa-industry', 'fas fa-tools', 'fas fa-network-wired',
    'fas fa-bed', 'fas fa-utensils', 'fas fa-running', 'fas fa-basketball-ball',
    'fas fa-theater-masks', 'fas fa-landmark', 'fas fa-users', 'fas fa-dungeon',
    'fas fa-tree', 'fas fa-shield-alt', 'fas fa-bicycle', 'fas fa-star', 'fas fa-coffee', 'fas fa-parking'
];

function initIconPicker() {
    const picker = document.getElementById('icon-picker');
    const hiddenInput = document.getElementById('edit-icon');
    
    picker.innerHTML = AVAILABLE_ICONS.map(icon => `
        <div class="icon-option" data-icon="${icon}">
            <i class="${icon}"></i>
        </div>
    `).join('');
    
    picker.querySelectorAll('.icon-option').forEach(el => {
        el.addEventListener('click', () => {
            // Update UI
            picker.querySelectorAll('.icon-option').forEach(opt => opt.classList.remove('selected'));
            el.classList.add('selected');
            
            // Update hidden input
            hiddenInput.value = el.dataset.icon;
        });
    });
}

function selectIconInPicker(iconClass) {
    const picker = document.getElementById('icon-picker');
    picker.querySelectorAll('.icon-option').forEach(opt => {
        if (opt.dataset.icon === iconClass) {
            opt.classList.add('selected');
        } else {
            opt.classList.remove('selected');
        }
    });
}

// Initialize Map
async function initMap() {
    initIconPicker();
    map = L.map('map', {
        zoomControl: false,
        attributionControl: false
    }).setView(CAMPUS_CENTER, DEFAULT_ZOOM);

    // Google Satellite Hybrid layer
    L.tileLayer('http://mt0.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}', {
        maxZoom: MAX_ZOOM,
        minZoom: MIN_ZOOM,
    }).addTo(map);

    // Load from Supabase
    const { data, error } = await supabaseClient.from('locations').select('*');
    if (error) {
        console.error(error);
        alert('Failed to load data from Supabase');
    } else {
        editableLocations = data.map(row => ({
            ...row,
            coords: [row.lat, row.lng]
        }));
        renderAllMarkers();
        updateMarkersList();
    }

    // Click map to add new marker
    map.on('click', async function(e) {
        const lat = parseFloat(e.latlng.lat.toFixed(5));
        const lng = parseFloat(e.latlng.lng.toFixed(5));
        const newId = 'new-loc-' + Date.now();
        
        const newLoc = {
            id: newId,
            name: 'New Location',
            category: 'landmark',
            icon: 'fas fa-map-marker',
            description: 'Description here',
            lat: lat,
            lng: lng
        };

        // Insert to DB immediately
        const { error } = await supabaseClient.from('locations').insert([newLoc]);
        if (error) {
            console.error(error);
            alert('Failed to save to database');
            return;
        }

        // Update local state for rendering
        const localLoc = { ...newLoc, coords: [lat, lng] };
        editableLocations.push(localLoc);
        addMarkerToMap(localLoc);
        updateMarkersList();
        openEditor(newId);
    });
}

function renderAllMarkers() {
    // Clear existing
    Object.values(markers).forEach(m => map.removeLayer(m));
    markers = {};

    editableLocations.forEach(loc => {
        addMarkerToMap(loc);
    });
}

function addMarkerToMap(loc) {
    const iconHtml = `<div class="custom-marker ${loc.category}">
                        <i class="${loc.icon}"></i>
                      </div>`;
    
    const icon = L.divIcon({
        className: 'custom-div-icon',
        html: iconHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 36]
    });

    const marker = L.marker(loc.coords, { 
        icon: icon,
        draggable: true // Allow dragging
    }).addTo(map);

    // Update coords on drag end
    marker.on('dragend', async function(e) {
        const pos = marker.getLatLng();
        const lat = parseFloat(pos.lat.toFixed(5));
        const lng = parseFloat(pos.lng.toFixed(5));
        
        // Update DB immediately
        const { error } = await supabaseClient.from('locations')
            .update({ lat: lat, lng: lng })
            .eq('id', loc.id);

        if (error) {
            console.error(error);
            alert('Failed to update position in database');
            // Revert marker position
            marker.setLatLng(loc.coords);
            return;
        }

        // Update local state
        const index = editableLocations.findIndex(l => l.id === loc.id);
        if (index > -1) {
            editableLocations[index].coords = [lat, lng];
            editableLocations[index].lat = lat;
            editableLocations[index].lng = lng;
            if (activeMarkerId === loc.id) {
                document.getElementById('edit-coords').value = `${lat}, ${lng}`;
            }
        }
    });

    marker.on('click', function() {
        openEditor(loc.id);
    });

    // Right click context menu
    marker.on('contextmenu', function(e) {
        const ctxMenu = document.getElementById('context-menu');
        
        // Position menu at mouse pointer
        ctxMenu.style.display = 'block';
        ctxMenu.style.left = e.originalEvent.pageX + 'px';
        ctxMenu.style.top = e.originalEvent.pageY + 'px';
        
        // Setup actions
        document.getElementById('ctx-edit').onclick = function() {
            openEditor(loc.id);
            ctxMenu.style.display = 'none';
        };
        
        document.getElementById('ctx-delete').onclick = function() {
            ctxMenu.style.display = 'none';
            deleteMarker(loc.id);
        };
        
        // Stop map from doing its own context menu
        L.DomEvent.stopPropagation(e);
    });

    markers[loc.id] = marker;
}

// Hide context menu on normal click or map click
document.addEventListener('click', function(e) {
    const ctxMenu = document.getElementById('context-menu');
    if (ctxMenu && ctxMenu.style.display === 'block') {
        ctxMenu.style.display = 'none';
    }
});

function openEditor(id) {
    activeMarkerId = id;
    const loc = editableLocations.find(l => l.id === id);
    if (!loc) return;

    document.getElementById('marker-form').style.display = 'block';
    document.getElementById('edit-id').value = loc.id;
    document.getElementById('edit-name').value = loc.name;
    document.getElementById('edit-category').value = loc.category;
    document.getElementById('edit-icon').value = loc.icon || 'fas fa-map-marker-alt';
    selectIconInPicker(loc.icon || 'fas fa-map-marker-alt');
    document.getElementById('edit-desc').value = loc.description;
    document.getElementById('edit-coords').value = loc.coords.join(', ');

    // Highlight map marker visually
    document.querySelectorAll('.custom-marker').forEach(el => el.classList.remove('active-marker'));
    if (markers[id] && markers[id]._icon) {
        const markerEl = markers[id]._icon.querySelector('.custom-marker');
        if (markerEl) markerEl.classList.add('active-marker');
    }
}

// Save edits from form
document.getElementById('btn-save-marker').addEventListener('click', async () => {
    if (!activeMarkerId) return;
    
    const index = editableLocations.findIndex(l => l.id === activeMarkerId);
    if (index > -1) {
        const newId = document.getElementById('edit-id').value;
        const updates = {
            id: newId,
            name: document.getElementById('edit-name').value,
            category: document.getElementById('edit-category').value,
            icon: document.getElementById('edit-icon').value,
            description: document.getElementById('edit-desc').value
        };

        // Update DB
        const { error } = await supabaseClient.from('locations')
            .update(updates)
            .eq('id', activeMarkerId);

        if (error) {
            console.error(error);
            alert('Failed to save changes to database');
            return;
        }

        // Update local state
        Object.assign(editableLocations[index], updates);
        activeMarkerId = newId; // Update active ID in case it changed
        
        // Re-render
        renderAllMarkers();
        updateMarkersList();
        
        alert('Saved to Supabase instantly!');
    }
});

function updateMarkersList() {
    const list = document.getElementById('markers-list');
    list.innerHTML = '';
    
    editableLocations.forEach(loc => {
        const div = document.createElement('div');
        div.className = 'marker-item';
        div.innerHTML = `
            <span>${loc.name} <small>(${loc.category})</small></span>
            <button onclick="deleteMarker('${loc.id}')">Del</button>
        `;
        div.onclick = (e) => {
            if (e.target.tagName !== 'BUTTON') {
                openEditor(loc.id);
                map.panTo(loc.coords);
            }
        };
        list.appendChild(div);
    });
}

window.deleteMarker = async function(id) {
    if(!confirm("Are you sure you want to delete this marker permanently from the database?")) return;

    const { error } = await supabaseClient.from('locations').delete().eq('id', id);
    
    if (error) {
        console.error(error);
        alert('Failed to delete from database');
        return;
    }

    editableLocations = editableLocations.filter(l => l.id !== id);
    if (activeMarkerId === id) {
        document.getElementById('marker-form').style.display = 'none';
        activeMarkerId = null;
    }
    renderAllMarkers();
    updateMarkersList();
}

// Start
document.addEventListener('DOMContentLoaded', initMap);

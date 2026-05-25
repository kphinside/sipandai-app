/**
 * js/maps.js
 * Inisialisasi Peta Leaflet, Layer Zona Risiko, Marker Laporan, & Filter Interaktif
 * Siap diintegrasikan dengan Supabase (query konflik & zones nanti)
 */

// 🌍 Konfigurasi Peta
const MAP_CONFIG = {
  center: [-3.658, 102.568], // Pusat Kabupaten Kepahiang
  zoom: 11,
  tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
};

// 🎨 Warna Zona Risiko
const RISK_COLORS = {
  'Kritis': '#991b1b',
  'Tinggi': '#dc2626',
  'Sedang': '#eab308',
  'Rendah': '#22c55e'
};

let map, zonesLayer, markersLayer;

// 🚀 Inisialisasi Peta
function initMap() {
  map = L.map('map', {
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    zoomControl: false // Pindahkan ke kanan bawah
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Base Layer
  L.tileLayer(MAP_CONFIG.tileLayer, {
    attribution: MAP_CONFIG.attribution,
    maxZoom: 18
  }).addTo(map);

  // Layer Groups
  zonesLayer = L.featureGroup().addTo(map);
  markersLayer = L.featureGroup().addTo(map);

  // Load Mock Data (ganti dengan Supabase fetch nanti)
  loadMockZones();
  loadMockMarkers();
  
  // Fit bounds jika ada data
  if (zonesLayer.getLayers().length > 0 || markersLayer.getLayers().length > 0) {
    const group = L.featureGroup([...zonesLayer.getLayers(), ...markersLayer.getLayers()]);
    map.fitBounds(group.getBounds(), { padding: [50, 50] });
  }
}

// 🟥🟨🟩 Mock Data Zona (Polygon GeoJSON sederhana)
function loadMockZones() {
  const mockZones = [
    { name: "Zona Kritis - Kepahiang Kota", coords: [[-3.64,102.55],[-3.64,102.58],[-3.66,102.58],[-3.66,102.55]], risk: "Kritis" },
    { name: "Zona Sedang - Bermani Ilir", coords: [[-3.68,102.52],[-3.68,102.56],[-3.71,102.56],[-3.71,102.52]], risk: "Sedang" },
    { name: "Zona Rendah - Merigi", coords: [[-3.62,102.48],[-3.62,102.52],[-3.65,102.52],[-3.65,102.48]], risk: "Rendah" }
  ];

  mockZones.forEach(zone => {
    const polygon = L.polygon(zone.coords, {
      color: RISK_COLORS[zone.risk],
      fillColor: RISK_COLORS[zone.risk],
      fillOpacity: 0.25,
      weight: 2,
      dashArray: '4 4'
    }).addTo(zonesLayer);

    polygon.bindPopup(`<strong>${zone.name}</strong><br>Tingkat Risiko: ${zone.risk}`);
  });
}

// 📍 Mock Data Marker Laporan
function loadMockMarkers() {
  const mockReports = [
    { id: 1, title: "Konflik Lahan Desa X", lat: -3.652, lng: 102.565, risk: "Tinggi", category: "Ekonomi", desc: "Sengketa batas lahan antar warga." },
    { id: 2, title: "Protes Infrastruktur", lat: -3.668, lng: 102.542, risk: "Sedang", category: "Politik", desc: "Tuntutan perbaikan jalan rusak." },
    { id: 3, title: "Potensi Bentrok Antar Kampung", lat: -3.635, lng: 102.578, risk: "Kritis", category: "SARA", desc: "Pemicu: Isu hoaks di media sosial." }
  ];

  mockReports.forEach(report => {
    const marker = L.circleMarker([report.lat, report.lng], {
      radius: 8,
      fillColor: RISK_COLORS[report.risk],
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.9
    }).addTo(markersLayer);

    // Custom Popup
    marker.bindPopup(`
      <div class="popup-title">${report.title}</div>
      <div>Kategori: ${report.category}</div>
      <span class="popup-risk" style="background:${RISK_COLORS[report.risk]};color:#fff">${report.risk}</span>
    `);

    // Click event buka modal detail
    marker.on('click', () => openMapModal(report));
  });
}

// 🔍 Filter Logic
function applyFilters() {
  const selectedRisks = Array.from(document.querySelectorAll('.filter-risk:checked')).map(cb => cb.value);
  const selectedCats = Array.from(document.querySelectorAll('.filter-cat:checked')).map(cb => cb.value);

  markersLayer.eachLayer(marker => {
    const data = marker.options.data || {}; // Simpan data di options nanti
    const risk = marker.options.risk || 'Sedang';
    const cat = marker.options.category || 'Lainnya';
    
    const show = selectedRisks.includes(risk) && selectedCats.includes(cat);
    if (show) marker.addTo(map);
    else map.removeLayer(marker);
  });

  zonesLayer.eachLayer(poly => {
    // Logic filter zona bisa ditambahkan serupa
  });
}

// 📖 Modal Detail Peta
function openMapModal(data) {
  document.getElementById('modalTitle').textContent = data.title;
  document.getElementById('modalBody').innerHTML = `
    <div class="modal-meta">
      <span class="meta-label">Lokasi</span><span class="meta-value">${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}</span>
      <span class="meta-label">Kategori</span><span class="meta-value">${data.category}</span>
      <span class="meta-label">Risiko</span><span class="meta-value" style="color:${RISK_COLORS[data.risk]};font-weight:600">${data.risk}</span>
    </div>
    <p class="meta-desc">${data.desc}</p>
  `;
  document.getElementById('mapDetailModal').classList.remove('d-none');
}

// 📍 Geolocation
function locateUser() {
  if (!navigator.geolocation) {
    alert("Geolocation tidak didukung browser Anda.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      map.setView([latitude, longitude], 14);
      L.circle([latitude, longitude], {
        color: '#1e40af', fillColor: '#3b82f6', fillOpacity: 0.5, radius: 50
      }).addTo(map).bindPopup("📍 Lokasi Anda").openPopup();
    },
    () => alert("Gagal mendapatkan lokasi. Pastikan izin GPS aktif.")
  );
}

// 🔄 Event Listeners UI
document.addEventListener('DOMContentLoaded', () => {
  initMap();

  // Toggle Sidebar (reused dari app.js/dashboard)
  document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
  });

  // Filter Panel
  document.getElementById('btnToggleFilters')?.addEventListener('click', () => {
    document.getElementById('filterPanel').classList.toggle('open');
  });
  document.getElementById('closeFilterPanel')?.addEventListener('click', () => {
    document.getElementById('filterPanel').classList.remove('open');
  });
  document.getElementById('applyFilters')?.addEventListener('click', () => {
    applyFilters();
    document.getElementById('filterPanel').classList.remove('open');
  });

  // Geolocation
  document.getElementById('btnLocateMe')?.addEventListener('click', locateUser);

  // Reset View
  document.getElementById('btnResetView')?.addEventListener('click', () => {
    map.setView(MAP_CONFIG.center, MAP_CONFIG.zoom);
  });

  // Modal Close
  document.getElementById('closeMapModal')?.addEventListener('click', () => {
    document.getElementById('mapDetailModal').classList.add('d-none');
  });
  document.getElementById('btnPrintModal')?.addEventListener('click', () => window.print());

  // Logout (placeholder)
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    window.location.href = 'login.html';
  });
});

// 📌 Catatan Integrasi Supabase Nanti:
/*
async function fetchConflictReports() {
  const { data, error } = await window.sbClient
    .from('conflict_reports')
    .select('id, judul, kategori, tingkat_risiko, lokasi_lat, lokasi_lng, deskripsi, created_at')
    .eq('status', 'baru'); // atau filter lain

  if (error) return console.error(error);
  
  // Bersihkan marker lama, render ulang dari 'data'
  markersLayer.clearLayers();
  data.forEach(report => {
    // Buat marker + bind popup + event click
  });
}
*/

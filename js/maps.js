/**
 * js/maps.js
 * Peta SIPANDAI - Fokus Kabupaten Kepahiang + UI Controls Terkoordinasi
 * ✅ Bounds akurat ✅ Controls tidak bentrok ✅ Responsive mobile
 */

// 🎨 Warna Risiko (konstan)
const RISK_COLORS = {
  'Kritis': '#991b1b',
  'Tinggi': '#dc2626', 
  'Sedang': '#eab308',
  'Rendah': '#22c55e'
};

// 🌍 Konfigurasi Peta (BOUNDS AKURAT untuk Kab. Kepahiang)
// Sumber: Geocoding BPS + Google Maps referensi
// 🌍 Konfigurasi Peta (BOUNDS SANGAT KETAT untuk Kab. Kepahiang)
const MAP_CONFIG = {
  center: [-3.625, 102.565], // Titik tengah Kepahiang
  zoom: 11,
  minZoom: 10,
  maxZoom: 15,
  // 🔒 Batas KETAT: hanya wilayah Kepahiang
  bounds: [
    [-3.720, 102.470], // SW: Selatan-Barat (Muara Kemumu-Kabawetan)
    [-3.530, 102.660]  // NE: Utara-Timur (Kepahiang-Bermani Ilir)
  ],
  tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; OpenStreetMap • SIPANDAI Kepahiang'
};

let map, zonesLayer, markersLayer;

// 🚀 Inisialisasi Peta
function initMap() {
  map = L.map('map', {
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    maxBounds: MAP_CONFIG.bounds,
    maxBoundsViscosity: 1.0, // "Bouncing" keras saat coba drag keluar batas
    zoomControl: false,      // Kita tempatkan manual agar tidak bentrok
    zoomSnap: 0.5,
    zoomDelta: 0.5
  });

  // ✅ Tempatkan zoom control di pojok kanan BAWAH (tidak bentrok dengan filter)
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Base Layer
  L.tileLayer(MAP_CONFIG.tileLayer, {
    attribution: MAP_CONFIG.attribution,
    maxZoom: MAP_CONFIG.maxZoom
  }).addTo(map);

  // Layer Groups
  zonesLayer = L.featureGroup().addTo(map);
  markersLayer = L.featureGroup().addTo(map);

  // Load Mock Data (nanti diganti fetch Supabase)
  loadMockZones();
  loadMockMarkers();
  
  // Fit view ke data jika ada, tetap dalam batas Kepahiang
  if (zonesLayer.getLayers().length > 0 || markersLayer.getLayers().length > 0) {
    const group = L.featureGroup([...zonesLayer.getLayers(), ...markersLayer.getLayers()]);
    const bounds = group.getBounds().pad(0.15); // padding 15% agar tidak mepet edge
    // Hanya fit jika bounds masih dalam area Kepahiang
    if (MAP_CONFIG.bounds[0][0] <= bounds.getSouthWest().lat && 
        bounds.getNorthEast().lat <= MAP_CONFIG.bounds[1][0]) {
      map.fitBounds(bounds);
    }
  }
}

// 🟥🟨🟩 Mock Data Zona (koordinat dalam batas Kepahiang)
function loadMockZones() {
  const mockZones = [
    { 
      name: "Zona Kritis - Kepahiang Kota", 
      coords: [[-3.660,102.545],[-3.660,102.570],[-3.645,102.570],[-3.645,102.545]], 
      risk: "Kritis" 
    },
    { 
      name: "Zona Sedang - Bermani Ilir", 
      coords: [[-3.720,102.530],[-3.720,102.560],[-3.700,102.560],[-3.700,102.530]], 
      risk: "Sedang" 
    },
    { 
      name: "Zona Rendah - Muara Kemumu", 
      coords: [[-3.630,102.480],[-3.630,102.510],[-3.610,102.510],[-3.610,102.480]], 
      risk: "Rendah" 
    }
  ];

  mockZones.forEach(zone => {
    const polygon = L.polygon(zone.coords, {
      color: RISK_COLORS[zone.risk],
      fillColor: RISK_COLORS[zone.risk],
      fillOpacity: 0.20,
      weight: 2,
      dashArray: '5 5'
    }).addTo(zonesLayer);

    polygon.bindPopup(`<strong>${zone.name}</strong><br>Tingkat Risiko: ${zone.risk}`);
  });
}

// 📍 Mock Data Marker (dalam batas Kepahiang)
function loadMockMarkers() {
  const mockReports = [
    { id: 1, title: "Konflik Lahan Desa X", lat: -3.652, lng: 102.558, risk: "Tinggi", category: "Ekonomi", desc: "Sengketa batas lahan antar warga." },
    { id: 2, title: "Protes Infrastruktur", lat: -3.710, lng: 102.545, risk: "Sedang", category: "Politik", desc: "Tuntutan perbaikan jalan rusak." },
    { id: 3, title: "Potensi Bentrok", lat: -3.625, lng: 102.495, risk: "Kritis", category: "SARA", desc: "Pemicu: Isu hoaks di media sosial." }
  ];

  mockReports.forEach(report => {
    const marker = L.circleMarker([report.lat, report.lng], {
      radius: 9,
      fillColor: RISK_COLORS[report.risk],
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.95
    }).addTo(markersLayer);

    // Simpan metadata untuk filter
    marker.options.risk = report.risk;
    marker.options.category = report.category;

    marker.bindPopup(`
      <div style="min-width:200px">
        <strong style="display:block;margin-bottom:4px">${report.title}</strong>
        <div style="font-size:0.9em;color:#475569">Kategori: ${report.category}</div>
        <span style="display:inline-block;margin-top:6px;padding:2px 8px;border-radius:999px;font-size:0.75em;font-weight:600;background:${RISK_COLORS[report.risk]};color:#fff">${report.risk}</span>
      </div>
    `);

    marker.on('click', () => openMapModal(report));
  });
}

// 🔍 Filter Logic (client-side untuk mock data)
function applyFilters() {
  const selectedRisks = Array.from(document.querySelectorAll('.filter-risk:checked')).map(cb => cb.value);
  const selectedCats = Array.from(document.querySelectorAll('.filter-cat:checked')).map(cb => cb.value);

  markersLayer.eachLayer(marker => {
    const risk = marker.options.risk || 'Sedang';
    const cat = marker.options.category || 'Lainnya';
    const show = selectedRisks.includes(risk) && selectedCats.includes(cat);
    if (show) marker.addTo(map);
    else map.removeLayer(marker);
  });
}

// 📖 Modal Detail (ringkas)
function openMapModal(data) {
  document.getElementById('modalTitle').textContent = data.title;
  document.getElementById('modalBody').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;font-size:0.9em">
      <div><span style="color:#64748b">Koordinat</span><br><strong>${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}</strong></div>
      <div><span style="color:#64748b">Kategori</span><br><strong>${data.category}</strong></div>
      <div><span style="color:#64748b">Risiko</span><br><strong style="color:${RISK_COLORS[data.risk]}">${data.risk}</strong></div>
      <div><span style="color:#64748b">Status</span><br><strong>Baru</strong></div>
    </div>
    <p style="margin:0;line-height:1.5">${data.desc}</p>
  `;
  document.getElementById('mapDetailModal').classList.remove('d-none');
}

// 📍 Geolocation (dengan validasi batas Kepahiang)
function locateUser() {
  if (!navigator.geolocation) {
    (window.app?.showToast || alert)('Geolocation tidak didukung', 'warning');
    return;
  }
  
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      
      // Validasi: apakah lokasi dalam batas Kepahiang?
      const inBounds = 
        latitude >= MAP_CONFIG.bounds[0][0] && latitude <= MAP_CONFIG.bounds[1][0] &&
        longitude >= MAP_CONFIG.bounds[0][1] && longitude <= MAP_CONFIG.bounds[1][1];
      
      if (inBounds) {
        map.setView([latitude, longitude], 13);
        L.circleMarker([latitude, longitude], {
          radius: 10,
          color: '#1e40af',
          fillColor: '#3b82f6',
          fillOpacity: 0.6,
          weight: 2
        }).addTo(map).bindPopup("📍 Lokasi Anda").openPopup();
        
        if (window.app?.showToast) {
          window.app.showToast('✅ Lokasi ditemukan dalam wilayah Kepahiang', 'success');
        }
      } else {
        if (window.app?.showToast) {
          window.app.showToast('⚠️ Lokasi di luar Kabupaten Kepahiang', 'warning');
        }
        map.setView(MAP_CONFIG.center, MAP_CONFIG.zoom);
      }
    },
    () => alert("Gagal mendapatkan lokasi. Pastikan izin GPS aktif.")
  );
}

// 🔄 Event Listeners UI (dengan optional chaining aman)
document.addEventListener('DOMContentLoaded', () => {
  // Hanya inisialisasi peta jika elemen #map ada
  if (document.getElementById('map')) {
    initMap();
  }

  // Toggle Sidebar (mobile)
  document.getElementById('toggleSidebar')?.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelector('.sidebar')?.classList.toggle('open');
  });

  // Filter Panel - Slide from RIGHT (tidak bentrok dengan zoom control kiri)
  const filterPanel = document.getElementById('filterPanel');
  const btnToggleFilters = document.getElementById('btnToggleFilters');
  const btnCloseFilter = document.getElementById('closeFilterPanel');
  
  btnToggleFilters?.addEventListener('click', (e) => {
    e.stopPropagation();
    filterPanel?.classList.toggle('open');
  });
  
  btnCloseFilter?.addEventListener('click', () => {
    filterPanel?.classList.remove('open');
  });
  
  // Tutup panel jika klik di luar
  document.addEventListener('click', (e) => {
    if (filterPanel?.classList.contains('open') && 
        !filterPanel.contains(e.target) && 
        e.target !== btnToggleFilters) {
      filterPanel.classList.remove('open');
    }
  });

  document.getElementById('applyFilters')?.addEventListener('click', () => {
    applyFilters();
    filterPanel?.classList.remove('open');
  });

  // Geolocation & Reset View
  document.getElementById('btnLocateMe')?.addEventListener('click', locateUser);
  
  document.getElementById('btnResetView')?.addEventListener('click', () => {
    map?.setView(MAP_CONFIG.center, MAP_CONFIG.zoom);
  });

  // Modal handling
  document.getElementById('closeMapModal')?.addEventListener('click', () => {
    document.getElementById('mapDetailModal')?.classList.add('d-none');
  });
  
  document.getElementById('mapDetailModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'mapDetailModal') {
      e.target.classList.add('d-none');
    }
  });

  // Print & Logout
  document.getElementById('btnPrintModal')?.addEventListener('click', () => window.print());
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    window.location.href = 'login.html';
  });
});

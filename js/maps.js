/**
 * js/maps.js
 * Inisialisasi Peta Leaflet dengan Fokus Wilayah Kabupaten Kepahiang
 * ✅ Sudah include RISK_COLORS & semua dependency
 */

// 🎨 Warna Risiko (WAJIB: definisikan sebelum dipakai)
const RISK_COLORS = {
  'Kritis': '#991b1b',
  'Tinggi': '#dc2626',
  'Sedang': '#eab308',
  'Rendah': '#22c55e'
};

// 🌍 Konfigurasi Peta (DIKUNCI untuk Kepahiang)
const MAP_CONFIG = {
  center: [-3.650, 102.565], // Pusat geografis Kab. Kepahiang
  zoom: 10,
  minZoom: 9,                // Mencegah zoom out terlalu jauh
  maxZoom: 16,               // Maksimal zoom detail
  // Batas wilayah: [SouthWest [lat, lng], NorthEast [lat, lng]]
  bounds: [
    [-3.790, 102.380], // Barat Daya (perbatasan Rejang Lebong/Bengkulu Selatan)
    [-3.510, 102.750]  // Timur Laut (perbatasan Bengkulu Tengah)
  ],
  tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | SIPANDAI Kepahiang'
};

let map, zonesLayer, markersLayer;

// 🚀 Inisialisasi Peta
function initMap() {
  map = L.map('map', {
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.zoom,
    minZoom: MAP_CONFIG.minZoom,
    maxZoom: MAP_CONFIG.maxZoom,
    maxBounds: MAP_CONFIG.bounds,      // 🔒 Kunci area pandang
    maxBoundsViscosity: 1.0,           // Mencegah "membal" keluar batas
    zoomControl: false,
    zoomSnap: 0.5,
    zoomDelta: 0.5
  });

  // Pindahkan kontrol zoom ke kanan bawah
  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // Base Layer
  L.tileLayer(MAP_CONFIG.tileLayer, {
    attribution: MAP_CONFIG.attribution,
    maxZoom: MAP_CONFIG.maxZoom
  }).addTo(map);

  // Layer Groups
  zonesLayer = L.featureGroup().addTo(map);
  markersLayer = L.featureGroup().addTo(map);

  // Load Mock Data
  loadMockZones();
  loadMockMarkers();
  
  // Fit bounds jika ada data
  if (zonesLayer.getLayers().length > 0 || markersLayer.getLayers().length > 0) {
    const group = L.featureGroup([...zonesLayer.getLayers(), ...markersLayer.getLayers()]);
    map.fitBounds(group.getBounds().pad(0.1));
  }
}

// 🟥🟨🟩 Mock Data Zona (Koordinat dalam batas Kepahiang)
function loadMockZones() {
  const mockZones = [
    { name: "Zona Kritis - Kepahiang Kota", coords: [[-3.66,102.55],[-3.66,102.58],[-3.64,102.58],[-3.64,102.55]], risk: "Kritis" },
    { name: "Zona Sedang - Bermani Ilir", coords: [[-3.70,102.52],[-3.70,102.56],[-3.68,102.56],[-3.68,102.52]], risk: "Sedang" },
    { name: "Zona Rendah - Muara Kemumu", coords: [[-3.62,102.48],[-3.62,102.52],[-3.60,102.52],[-3.60,102.48]], risk: "Rendah" }
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

    // Simpan data di options untuk filter
    marker.options.risk = report.risk;
    marker.options.category = report.category;

    marker.bindPopup(`
      <div class="popup-title">${report.title}</div>
      <div>Kategori: ${report.category}</div>
      <span class="popup-risk" style="background:${RISK_COLORS[report.risk]};color:#fff">${report.risk}</span>
    `);

    marker.on('click', () => openMapModal(report));
  });
}

// 🔍 Filter Logic
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

// 📍 Geolocation (Dibatasi agar tidak error jika di luar Kepahiang)
function locateUser() {
  if (!navigator.geolocation) {
    alert("Geolocation tidak didukung browser Anda.");
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      const { latitude, longitude } = pos.coords;
      
      // Cek apakah lokasi user masih dalam batas Kepahiang
      const inBounds = latitude >= MAP_CONFIG.bounds[0][0] && latitude <= MAP_CONFIG.bounds[1][0] &&
                       longitude >= MAP_CONFIG.bounds[0][1] && longitude <= MAP_CONFIG.bounds[1][1];
      
      if (inBounds) {
        map.setView([latitude, longitude], 13);
        L.circle([latitude, longitude], {
          color: '#1e40af', fillColor: '#3b82f6', fillOpacity: 0.5, radius: 50
        }).addTo(map).bindPopup("📍 Lokasi Anda").openPopup();
      } else {
        // Cek apakah window.app tersedia sebelum showToast
        if (window.app?.showToast) {
          window.app.showToast('⚠️ Lokasi Anda di luar wilayah Kabupaten Kepahiang', 'warning');
        } else {
          alert('⚠️ Lokasi Anda di luar wilayah Kabupaten Kepahiang');
        }
        map.setView(MAP_CONFIG.center, MAP_CONFIG.zoom);
      }
    },
    () => alert("Gagal mendapatkan lokasi. Pastikan izin GPS aktif.")
  );
}

// 🔄 Event Listeners UI
document.addEventListener('DOMContentLoaded', () => {
  // Pastikan elemen #map ada sebelum inisialisasi peta
  if (document.getElementById('map')) {
    initMap();
  }

  // Toggle Sidebar
  document.getElementById('toggleSidebar')?.addEventListener('click', () => {
    document.querySelector('.sidebar')?.classList.toggle('open');
  });

  // Filter Panel
  document.getElementById('btnToggleFilters')?.addEventListener('click', () => {
    document.getElementById('filterPanel')?.classList.toggle('open');
  });
  document.getElementById('closeFilterPanel')?.addEventListener('click', () => {
    document.getElementById('filterPanel')?.classList.remove('open');
  });
  document.getElementById('applyFilters')?.addEventListener('click', () => {
    applyFilters();
    document.getElementById('filterPanel')?.classList.remove('open');
  });

  // Geolocation
  document.getElementById('btnLocateMe')?.addEventListener('click', locateUser);

  // Reset View
  document.getElementById('btnResetView')?.addEventListener('click', () => {
    if (map) map.setView(MAP_CONFIG.center, MAP_CONFIG.zoom);
  });

  // Modal Close
  document.getElementById('closeMapModal')?.addEventListener('click', () => {
    document.getElementById('mapDetailModal')?.classList.add('d-none');
  });
  document.getElementById('btnPrintModal')?.addEventListener('click', () => window.print());

  // Logout
  document.getElementById('btnLogout')?.addEventListener('click', () => {
    window.location.href = 'login.html';
  });
});

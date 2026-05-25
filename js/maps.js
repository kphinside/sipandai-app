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

// 🌍 Konfigurasi Peta (BOUNDS KETAT sesuai koordinat manual Anda)
const MAP_CONFIG = {
  center: [-3.648, 102.626], // Titik tengah dari 6 koordinat Anda
  zoom: 11,
  minZoom: 10,
  maxZoom: 15,
  // 🔒 Batas: [South-West [minLat, minLng], North-East [maxLat, maxLng]]
  bounds: [
    [-3.798060, 102.443051], // Bawah-Kiri (Selatan-Barat)
    [-3.544325, 102.665886]  // Atas-Kanan (Utara-Timur)
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

function loadMockMarkers() {
  const mockReports = [
    { 
      id: 1, 
      title: "Konflik Lahan Desa Talang Bencah", 
      lat: -3.652, 
      lng: 102.558, 
      risk: "Tinggi", 
      category: "Ekonomi", 
      desc: "Sengketa batas lahan pertanian antar warga Desa Talang Bencah, Kecamatan Kepahiang.",
      kecamatan: "Kepahiang"
    },
    { 
      id: 2, 
      title: "Protes Pembangunan Jalan", 
      lat: -3.671689, 
      lng: 102.632107, 
      risk: "Sedang", 
      category: "Politik", 
      desc: "Masyarakat menuntut transparansi anggaran pembangunan jalan di Kecamatan Tebat Karai.",
      kecamatan: "Tebat Karai"
    },
    { 
      id: 3, 
      title: "Potensi Konflik Antar Kampung", 
      lat: -3.689175, 
      lng: 102.717906, 
      risk: "Kritis", 
      category: "SARA", 
      desc: "Tensi meningkat akibat isu hoaks yang tersebar di media sosial, Kecamatan Bermani Ilir.",
      kecamatan: "Bermani Ilir"
    },
    { 
      id: 4, 
      title: "Sengketa Sumber Daya Air", 
      lat: -3.599904,  // ✅ Diubah dari -3.499904 (terlalu utara)
      lng: 102.515104,
      risk: "Sedang", 
      category: "Ekonomi", 
      desc: "Konflik pembagian irigasi antara petani hulu dan hilir di Kecamatan Merigi.",
      kecamatan: "Merigi"
    },
    { 
      id: 5, 
      title: "Demonstrasi Tuntutan Layanan", 
      lat: -3.599833,
      lng: 102.615729, 
      risk: "Rendah", 
      category: "Politik", 
      desc: "Warga Kecamatan Kabawetan menuntut perbaikan layanan kesehatan puskesmas.",
      kecamatan: "Kabawetan"
    }
  ];

  mockReports.forEach(report => {
    const marker = L.circleMarker([report.lat, report.lng], {
      radius: 9,
      fillColor: RISK_COLORS[report.risk],  // ✅ Warna dari konstanta
      color: '#fff',
      weight: 2,
      opacity: 1,
      fillOpacity: 0.95
    }).addTo(markersLayer);

    // Simpan metadata untuk filter
    marker.options.risk = report.risk;
    marker.options.category = report.category;

    // Popup dengan warna risk badge
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

  let visibleCount = 0;
  
  markersLayer.eachLayer(marker => {
    const risk = marker.options.risk || 'Sedang';
    const cat = marker.options.category || 'Lainnya';
    
    const showRisk = selectedRisks.includes(risk);
    const showCat = selectedCats.includes(cat);
    
    if (showRisk && showCat) {
      marker.addTo(markersLayer);
      visibleCount++;
    } else {
      markersLayer.removeLayer(marker);
    }
  });
  
  // Feedback ke user
  if (window.app?.showToast) {
    window.app.showToast(`🔍 Menampilkan ${visibleCount} laporan sesuai filter`, 'info');
  }
  
  console.log('Filter diterapkan:', { 
    risiko: selectedRisks, 
    kategori: selectedCats, 
    visible: visibleCount 
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

// Pastikan event listener ini ada di document.addEventListener('DOMContentLoaded', ...)

// Filter Panel Toggle
const btnToggleFilters = document.getElementById('btnToggleFilters');
const filterPanel = document.getElementById('filterPanel');
const btnCloseFilter = document.getElementById('closeFilterPanel');
const btnApplyFilters = document.getElementById('applyFilters');

if (btnToggleFilters && filterPanel) {
  btnToggleFilters.addEventListener('click', (e) => {
    e.stopPropagation();
    filterPanel.classList.toggle('open');
  });
}

if (btnCloseFilter) {
  btnCloseFilter.addEventListener('click', () => {
    filterPanel.classList.remove('open');
  });
}
document.getElementById('applyFilters')?.addEventListener('click', () => {
  applyFilters();
  filterPanel?.classList.remove('open');
});
  
// Tutup panel jika klik di luar
document.addEventListener('click', (e) => {
  if (filterPanel && filterPanel.classList.contains('open') && 
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

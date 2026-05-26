/**
 * js/dashboard.js
 * Logic Dashboard: Stats, Charts, Recent Table, Filters & Early Warning
 * ✅ Terintegrasi Penuh dengan Supabase - Data Real-time
 */

// State global
let dashboardData = [];
let currentFilters = {};

// ==========================================
// 1. INIT & FETCH DATA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  await initDashboard();
  setupFilters();
  loadKecamatanFilter(); // Load dropdown filter kecamatan
});

async function initDashboard() {
  // Tampilkan loading state
  showLoadingState();
  
  // Fetch data dari Supabase
  await fetchDashboardData();
  
  // Render semua komponen
  renderStats(dashboardData);
  await initCharts(dashboardData);
  renderRecentTable(dashboardData);
  updateEarlyWarning(dashboardData);
  
  // Setup mini map (opsional)
  initMiniMap();
}

async function fetchDashboardData(filters = {}) {
  try {
    currentFilters = { ...filters };
    const user = JSON.parse(localStorage.getItem('sipandai_user') || '{}');
    
    // Query ke Supabase dengan join tabel terkait
    let query = window.sbClient
      .from('conflict_reports')
      .select(`
        id, judul, kategori, tingkat_risiko, status, created_at,
        kecamatan (id, nama),
        desa (id, nama),
        profiles (nama_lengkap)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });
    
    // Terapkan filter jika ada
    if (filters.kecamatan_id) query = query.eq('kecamatan_id', filters.kecamatan_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.kategori) query = query.eq('kategori', filters.kategori);
    if (filters.tingkat_risiko) query = query.eq('tingkat_risiko', filters.tingkat_risiko);
    if (filters.date_from) query = query.gte('created_at', filters.date_from);
    if (filters.date_to) query = query.lte('created_at', filters.date_to);
    
    // RLS: operator hanya lihat data kecamatannya
    if (user.role === 'operator_kec' && user.kecamatan_id) {
      query = query.eq('kecamatan_id', user.kecamatan_id);
    }
    
    // Ambil 5 terbaru untuk tabel recent
    query = query.limit(5);
    
    const { data, error, count } = await query;
    if (error) throw error;
    
    // Format data agar kompatibel dengan fungsi render
    dashboardData = (data || []).map(d => ({
      id: d.id,
      tgl: d.created_at,
      judul: d.judul,
      kec: d.kecamatan?.nama || '-',
      desa: d.desa?.nama || '-',
      kat: d.kategori || 'Lainnya',
      risiko: d.tingkat_risiko || 'Sedang',
      status: d.status,
      pelapor: d.profiles?.nama_lengkap || 'Anonim',
      _raw: d
    }));
    
    console.log(`✅ ${dashboardData.length} laporan dimuat untuk dashboard`);
    return dashboardData;
    
  } catch (err) {
    console.error('❌ Gagal fetch dashboard data:', err);
    window.app.showToast('Gagal memuat data dashboard', 'error');
    dashboardData = [];
    return [];
  }
}

function showLoadingState() {
  // Stats
  document.getElementById('statTotal').textContent = '...';
  document.getElementById('statProses').textContent = '...';
  document.getElementById('statSelesai').textContent = '...';
  document.getElementById('statMerah').textContent = '...';
  
  // Table
  const tbody = document.getElementById('tableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">⏳ Memuat data...</td></tr>';
  }
}

// ==========================================
// 📊 RENDER STATS CARDS
// ==========================================
function renderStats(data) {
  const total = data.length;
  const diproses = data.filter(d => d.status === 'diproses').length;
  const selesai = data.filter(d => d.status === 'selesai').length;
  const kritis = data.filter(d => d.risiko === 'Kritis' || d.risiko === 'Tinggi').length;
  
  // Animasi angka
  animateValue('statTotal', 0, total, 500);
  animateValue('statProses', 0, diproses, 500);
  animateValue('statSelesai', 0, selesai, 500);
  animateValue('statMerah', 0, kritis, 500);
}

function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    const value = Math.floor(progress * (end - start) + start);
    obj.textContent = value;
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}

// ==========================================
// 📈 INIT CHARTS DENGAN DATA REAL
// ==========================================
async function initCharts(data) {
  await initTrenChart(data);
  await initKategoriChart(data);
}

async function initTrenChart(data) {
  const ctx = document.getElementById('chartTren');
  if (!ctx) return;
  
  try {
    // Ambil data tren 30 hari terakhir dari Supabase
    const { data: trenData, error } = await window.sbClient
      .from('conflict_reports')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString())
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Group by date
    const labels = [];
    const values = [];
    const dateMap = {};
    
    // Inisialisasi 7 hari terakhir
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i*24*60*60*1000);
      const key = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      dateMap[key] = 0;
    }
    
    // Hitung laporan per hari
    trenData?.forEach(d => {
      const date = new Date(d.created_at);
      const key = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      if (dateMap[key] !== undefined) dateMap[key]++;
    });
    
    Object.entries(dateMap).forEach(([label, value]) => {
      labels.push(label);
      values.push(value);
    });
    
    // Destroy chart lama jika ada
    if (window.chartTren) window.chartTren.destroy();
    
    // Buat chart baru
    window.chartTren = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Laporan Masuk',
          data: values,
          borderColor: '#1e40af',
          backgroundColor: 'rgba(30, 64, 175, 0.1)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: '#1e40af',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } },
          x: { grid: { display: false } }
        }
      }
    });
    
  } catch (err) {
    console.error('Gagal load chart tren:', err);
    // Fallback: chart kosong
    if (window.chartTren) window.chartTren.destroy();
  }
}

async function initKategoriChart(data) {
  const ctx = document.getElementById('chartKategori');
  if (!ctx) return;
  
  try {
    // Hitung distribusi kategori dari data yang sudah di-fetch
    const kategoriCount = {};
    const allKategori = ['SARA', 'Ekonomi', 'Politik', 'Bencana', 'Lainnya'];
    
    allKategori.forEach(k => kategoriCount[k] = 0);
    
    data.forEach(d => {
      const kat = d.kat || 'Lainnya';
      kategoriCount[kat] = (kategoriCount[kat] || 0) + 1;
    });
    
    // Destroy chart lama jika ada
    if (window.chartKategori) window.chartKategori.destroy();
    
    // Buat chart baru
    window.chartKategori = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(kategoriCount),
        datasets: [{
          data: Object.values(kategoriCount),
          backgroundColor: ['#dc2626', '#059669', '#1e40af', '#f59e0b', '#64748b'],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { usePointStyle: true, padding: 15 } }
        },
        cutout: '65%'
      }
    });
    
  } catch (err) {
    console.error('Gagal load chart kategori:', err);
  }
}

// ==========================================
// 📋 RENDER RECENT TABLE
// ==========================================
function renderRecentTable(data) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Belum ada laporan.</td></tr>';
    return;
  }
  
  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${item.id}</strong></td>
      <td>${window.app.formatDate(item.tgl)}</td>
      <td>
        <strong>${item.kec}</strong><br>
        <small class="text-muted">${item.desa}</small>
      </td>
      <td>${item.kat}</td>
      <td><span class="risiko-badge ${window.app.getRisikoClass(item.risiko)}">${window.app.formatRisiko(item.risiko)}</span></td>
      <td><span class="status-badge ${window.app.getStatusClass(item.status)}">${window.app.formatStatus(item.status)}</span></td>
      <td>
        <button class="btn-action" onclick="viewReportDetail(${item.id})">👁️ Detail</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Global function untuk view detail (bisa redirect ke laporan.html dengan filter ID)
window.viewReportDetail = (id) => {
  // Redirect ke halaman laporan dengan parameter ID (opsional)
  // Atau buka modal detail jika diimplementasikan
  window.location.href = `laporan.html?report_id=${id}`;
};

// ==========================================
// 🚨 EARLY WARNING BANNER
// ==========================================
function updateEarlyWarning(data) {
  const banner = document.getElementById('earlyWarning');
  const warnKec = document.getElementById('warnKec');
  
  if (!banner || !warnKec) return;
  
  // Cari laporan dengan risiko Kritis atau Tinggi yang statusnya masih 'baru'
  const urgent = data.find(d => 
    (d.risiko === 'Kritis' || d.risiko === 'Tinggi') && d.status === 'baru'
  );
  
  if (urgent) {
    banner.classList.remove('d-none');
    warnKec.textContent = urgent.kec;
    
    // Tambahkan animasi pulse untuk perhatian
    banner.style.animation = 'pulse 2s infinite';
  } else {
    banner.classList.add('d-none');
    banner.style.animation = 'none';
  }
}

// ==========================================
// 🔍 FILTER SECTION
// ==========================================
async function loadKecamatanFilter() {
  const select = document.getElementById('filterKecamatan');
  if (!select) return;
  
  try {
    const { data, error } = await window.sbClient
      .from('kecamatan')
      .select('id, nama')
      .order('nama');
    
    if (error) throw error;
    
    data.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.id;
      opt.textContent = k.nama;
      select.appendChild(opt);
    });
  } catch (err) {
    console.warn('Gagal load filter kecamatan:', err);
  }
}

function setupFilters() {
  const form = document.getElementById('filterForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const filters = {
      kecamatan_id: document.getElementById('filterKecamatan')?.value || null,
      status: document.getElementById('filterStatus')?.value || null,
      kategori: document.getElementById('filterKategori')?.value || null,
      tingkat_risiko: null, // Bisa ditambahkan jika perlu
      date_from: document.getElementById('filterDate')?.value || null,
      date_to: null
    };
    
    // Tampilkan loading
    showLoadingState();
    
    // Fetch data dengan filter
    await fetchDashboardData(filters);
    
    // Re-render semua komponen
    renderStats(dashboardData);
    await initCharts(dashboardData);
    renderRecentTable(dashboardData);
    updateEarlyWarning(dashboardData);
    
    window.app.showToast('🔍 Filter diterapkan', 'info');
  });
}

// ==========================================
// 🗺️ MINI MAP (Opsional - Simple Implementation)
// ==========================================
function initMiniMap() {
  const mapContainer = document.getElementById('miniMap');
  if (!mapContainer || typeof L === 'undefined') return;
  
  // Inisialisasi mini map (fokus Kepahiang)
  const miniMap = L.map('miniMap', {
    center: [-3.648, 102.626],
    zoom: 10,
    zoomControl: false,
    scrollWheelZoom: false,
    dragging: false
  });
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(miniMap);
  
  // Tambahkan marker untuk laporan kritis (max 3)
  const critical = dashboardData.filter(d => d.risiko === 'Kritis').slice(0, 3);
  critical.forEach(d => {
    if (d._raw?.lokasi_lat && d._raw?.lokasi_lng) {
      L.circleMarker([d._raw.lokasi_lat, d._raw.lokasi_lng], {
        radius: 6,
        fillColor: '#991b1b',
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9
      }).addTo(miniMap).bindPopup(`<strong>${d.judul}</strong><br>${d.kec}`);
    }
  });
  
  // Simpan referensi agar bisa di-destroy nanti
  window.miniMap = miniMap;
}

// ==========================================
// 🔄 REAL-TIME SUBSCRIPTION (Opsional)
// ==========================================
function setupRealtimeSubscription() {
  if (!window.sbClient?.channel) return;
  
  window.sbClient
    .channel('public:conflict_reports')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'conflict_reports'
    }, async (payload) => {
      console.log('🔄 Realtime dashboard update:', payload.eventType);
      
      // Re-fetch data dan re-render
      showLoadingState();
      await fetchDashboardData(currentFilters);
      renderStats(dashboardData);
      await initCharts(dashboardData);
      renderRecentTable(dashboardData);
      updateEarlyWarning(dashboardData);
      
      if (payload.eventType === 'INSERT') {
        window.app.showToast('🆕 Laporan baru masuk!', 'info');
      }
    })
    .subscribe();
}

// Panggil setup realtime jika ingin fitur ini aktif
// setupRealtimeSubscription();

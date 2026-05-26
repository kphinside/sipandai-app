/**
 * js/dashboard.js
 * Logic Dashboard: Stats, Charts, Recent Table, Filters & Early Warning
 * ✅ Debug Mode ✅ Fallback ✅ Error Handling Lengkap
 */

// State global
let dashboardData = [];
let currentFilters = {};
const DEBUG = true; // ✅ Set true untuk lihat log detail di console

// ==========================================
// 1. INIT & FETCH DATA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  if (DEBUG) console.log('🚀 Initializing dashboard...');
  
  await initDashboard();
  setupFilters();
  await loadKecamatanFilter(); // Pastikan await agar load selesai sebelum user interaksi
});

async function initDashboard() {
  try {
    showLoadingState();
    
    if (DEBUG) console.log('📡 Fetching dashboard data from Supabase...');
    await fetchDashboardData();
    
    if (DEBUG) console.log('✅ Data fetched, rendering components...');
    renderStats(dashboardData);
    await initCharts(dashboardData);
    renderRecentTable(dashboardData);
    updateEarlyWarning(dashboardData);
    initMiniMap();
    
  } catch (err) {
    console.error('❌ Dashboard init error:', err);
    if (DEBUG) console.log('💡 Tips: Cek console untuk detail error Supabase');
    window.app.showToast('Gagal memuat dashboard: ' + err.message, 'error');
  }
}

async function fetchDashboardData(filters = {}) {
  try {
    currentFilters = { ...filters };
    const user = JSON.parse(localStorage.getItem('sipandai_user') || '{}');
    
    if (DEBUG) {
      console.log('👤 User role:', user.role);
      console.log('🔍 Filters:', filters);
    }
    
    // Query dasar - pastikan kolom yang dipilih ADA di database
    let query = window.sbClient
      .from('conflict_reports')
      .select(`
        id, judul, kategori, tingkat_risiko, status, created_at,
        kecamatan_id,
        lokasi_lat, lokasi_lng,
        kecamatan (id, nama),
        desa (id, nama),
        profiles (nama_lengkap)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });
    
    // Terapkan filter
    if (filters.kecamatan_id) {
      query = query.eq('kecamatan_id', parseInt(filters.kecamatan_id));
      if (DEBUG) console.log('🔒 Filter kecamatan_id:', filters.kecamatan_id);
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.kategori) query = query.eq('kategori', filters.kategori);
    if (filters.tingkat_risiko) query = query.eq('tingkat_risiko', filters.tingkat_risiko);
    if (filters.date_from) query = query.gte('created_at', filters.date_from);
    if (filters.date_to) query = query.lte('created_at', filters.date_to);
    
    // RLS: operator hanya lihat data kecamatannya
    if (user.role === 'operator_kec' && user.kecamatan_id) {
      query = query.eq('kecamatan_id', user.kecamatan_id);
      if (DEBUG) console.log('🔐 RLS: Operator filtered to kecamatan_id:', user.kecamatan_id);
    }
    
    // Ambil 5 terbaru untuk tabel recent
    query = query.limit(5);
    
    if (DEBUG) console.log('🔎 Executing Supabase query...');
    const { data, error, count } = await query;
    
    if (error) {
      console.error('❌ Supabase query error:', error);
      throw new Error(`Database error: ${error.message} (Code: ${error.code})`);
    }
    
    if (DEBUG) console.log(`✅ Query success: ${data?.length || 0} rows, count: ${count}`);
    
    // Format data
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
    
    return dashboardData;
    
  } catch (err) {
    console.error('❌ fetchDashboardData error:', err);
    
    // Fallback: coba query tanpa join (untuk debugging)
    try {
      if (DEBUG) console.log('🔄 Trying fallback query without joins...');
      const { data: fallbackData, error: fallbackError } = await window.sbClient
        .from('conflict_reports')
        .select('id, judul, kategori, tingkat_risiko, status, created_at, kecamatan_id')
        .limit(5)
        .order('created_at', { ascending: false });
      
      if (!fallbackError && fallbackData) {
        console.warn('⚠️ Fallback query worked! Join tables might have RLS issues.');
        dashboardData = fallbackData.map(d => ({
          id: d.id,
          tgl: d.created_at,
          judul: d.judul,
          kec: '-',
          desa: '-',
          kat: d.kategori || 'Lainnya',
          risiko: d.tingkat_risiko || 'Sedang',
          status: d.status,
          pelapor: '-',
          _raw: d
        }));
        return dashboardData;
      }
    } catch (fallbackErr) {
      console.error('❌ Fallback query also failed:', fallbackErr);
    }
    
    throw err;
  }
}

function showLoadingState() {
  document.getElementById('statTotal').textContent = '...';
  document.getElementById('statProses').textContent = '...';
  document.getElementById('statSelesai').textContent = '...';
  document.getElementById('statMerah').textContent = '...';
  
  const tbody = document.getElementById('tableBody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">⏳ Memuat data...</td></tr>';
  }
}

// ==========================================
// 📊 RENDER STATS
// ==========================================
function renderStats(data) {
  const total = data?.length || 0;
  const diproses = data?.filter(d => d.status === 'diproses')?.length || 0;
  const selesai = data?.filter(d => d.status === 'selesai')?.length || 0;
  const kritis = data?.filter(d => d.risiko === 'Kritis' || d.risiko === 'Tinggi')?.length || 0;
  
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
// 📈 CHARTS
// ==========================================
async function initCharts(data) {
  await initTrenChart();
  await initKategoriChart(data);
}

async function initTrenChart() {
  const ctx = document.getElementById('chartTren');
  if (!ctx) return;
  
  try {
    // Ambil data 30 hari terakhir
    const { data: trenData, error } = await window.sbClient
      .from('conflict_reports')
      .select('created_at')
      .gte('created_at', new Date(Date.now() - 30*24*60*60*1000).toISOString())
      .order('created_at', { ascending: true });
    
    if (error) throw error;
    
    // Group by date (7 hari terakhir)
    const dateMap = {};
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i*24*60*60*1000);
      const key = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      dateMap[key] = 0;
    }
    
    trenData?.forEach(d => {
      const date = new Date(d.created_at);
      const key = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      if (dateMap[key] !== undefined) dateMap[key]++;
    });
    
    if (window.chartTren) window.chartTren.destroy();
    
    window.chartTren = new Chart(ctx, {
      type: 'line',
      data: {
        labels: Object.keys(dateMap),
        datasets: [{
          label: 'Laporan Masuk',
          data: Object.values(dateMap),
          borderColor: '#1e40af',
          backgroundColor: 'rgba(30, 64, 175, 0.1)',
          tension: 0.3,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
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
    const kategoriCount = { 'SARA': 0, 'Ekonomi': 0, 'Politik': 0, 'Bencana': 0, 'Lainnya': 0 };
    
    data?.forEach(d => {
      const kat = d.kat || 'Lainnya';
      if (kategoriCount[kat] !== undefined) {
        kategoriCount[kat]++;
      } else {
        kategoriCount['Lainnya']++;
      }
    });
    
    if (window.chartKategori) window.chartKategori.destroy();
    
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
        plugins: { legend: { position: 'bottom' } },
        cutout: '65%'
      }
    });
    
  } catch (err) {
    console.error('Gagal load chart kategori:', err);
  }
}

// ==========================================
// 📋 RECENT TABLE
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
      <td><button class="btn-action" onclick="viewReportDetail(${item.id})">👁️ Detail</button></td>
    `;
    tbody.appendChild(tr);
  });
}

window.viewReportDetail = (id) => {
  window.location.href = `laporan.html?report_id=${id}`;
};

// ==========================================
// 🚨 EARLY WARNING
// ==========================================
function updateEarlyWarning(data) {
  const banner = document.getElementById('earlyWarning');
  const warnKec = document.getElementById('warnKec');
  
  if (!banner || !warnKec) return;
  
  const urgent = data?.find(d => 
    (d.risiko === 'Kritis' || d.risiko === 'Tinggi') && d.status === 'baru'
  );
  
  if (urgent) {
    banner.classList.remove('d-none');
    warnKec.textContent = urgent.kec;
  } else {
    banner.classList.add('d-none');
  }
}

// ==========================================
// 🔍 FILTER: LOAD KECAMATAN (FIXED)
// ==========================================
async function loadKecamatanFilter() {
  const select = document.getElementById('filterKecamatan');
  if (!select) {
    console.error('❌ Element #filterKecamatan not found!');
    return;
  }
  
  if (DEBUG) console.log('🔄 Loading kecamatan for filter dropdown...');
  
  try {
    const { data, error } = await window.sbClient
      .from('kecamatan')
      .select('id, nama')
      .order('nama');
    
    if (error) {
      console.error('❌ Error fetching kecamatan:', error);
      throw error;
    }
    
    if (DEBUG) console.log(`✅ Loaded ${data?.length || 0} kecamatan`);
    
    // Reset dropdown (keep default option)
    select.innerHTML = '<option value="">Semua Kecamatan</option>';
    
    if (data && data.length > 0) {
      data.forEach(k => {
        const opt = document.createElement('option');
        opt.value = k.id;
        opt.textContent = k.nama;
        select.appendChild(opt);
      });
    } else {
      console.warn('⚠️ No kecamatan data found');
      // Fallback hardcoded
      select.innerHTML += `
        <option value="8">Kepahiang</option>
        <option value="9">Tebat Karai</option>
        <option value="10">Merigi</option>
        <option value="11">Kabawetan</option>
        <option value="12">Muara Kemumu</option>
        <option value="13">Bermani Ilir</option>
        <option value="14">Seberang Musi</option>
        <option value="15">Ujan Mas</option>
      `;
    }
    
  } catch (err) {
    console.error('❌ loadKecamatanFilter error:', err);
    // Fallback hardcoded jika query gagal
    select.innerHTML = `
      <option value="">Semua Kecamatan</option>
      <option value="8">Kepahiang</option>
      <option value="9">Tebat Karai</option>
      <option value="10">Merigi</option>
      <option value="11">Kabawetan</option>
      <option value="12">Muara Kemumu</option>
      <option value="13">Bermani Ilir</option>
      <option value="14">Seberang Musi</option>
      <option value="15">Ujan Mas</option>
    `;
    console.warn('⚠️ Using hardcoded kecamatan fallback');
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
      date_from: document.getElementById('filterDate')?.value || null,
      date_to: null
    };
    
    if (DEBUG) console.log('🔍 Applying filters:', filters);
    
    showLoadingState();
    
    try {
      await fetchDashboardData(filters);
      renderStats(dashboardData);
      await initCharts(dashboardData);
      renderRecentTable(dashboardData);
      updateEarlyWarning(dashboardData);
      
      window.app.showToast('🔍 Filter diterapkan', 'info');
    } catch (err) {
      console.error('Filter apply error:', err);
      window.app.showToast('Gagal terapkan filter', 'error');
    }
  });
}

// ==========================================
// 🗺️ MINI MAP (Simple)
// ==========================================
function initMiniMap() {
  const mapContainer = document.getElementById('miniMap');
  if (!mapContainer || typeof L === 'undefined') return;
  
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
  
  // Marker untuk laporan kritis
  const critical = dashboardData?.filter(d => d.risiko === 'Kritis').slice(0, 3) || [];
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
  
  window.miniMap = miniMap;
}

/**
 * js/dashboard.js
 * Logic Dashboard: Stats, Charts, Recent Table, Filters & Early Warning
 */
document.addEventListener('DOMContentLoaded', () => {
  initDashboard();
  setupFilters();
});

// Mock Data (ganti dengan window.sbClient fetch nanti)
const mockData = [
  { id: 101, tgl: '2026-05-20T08:30:00', kec: 'Kepahiang', desa: 'Muara Aman', kat: 'Ekonomi', risiko: 'Tinggi', status: 'baru', pelapor: 'Operator Kec' },
  { id: 102, tgl: '2026-05-21T14:15:00', kec: 'Bermani Ilir', desa: 'Sindang Kelingi', kat: 'SARA', risiko: 'Sedang', status: 'diproses', pelapor: 'Admin' },
  { id: 103, tgl: '2026-05-22T09:45:00', kec: 'Merigi', desa: 'Talang Curup', kat: 'Politik', risiko: 'Rendah', status: 'selesai', pelapor: 'Operator Kec' },
  { id: 104, tgl: '2026-05-23T16:20:00', kec: 'Seberang Musi', desa: 'Pagar Gunung', kat: 'Bencana', risiko: 'Kritis', status: 'baru', pelapor: 'Camat' }
];

function initDashboard() {
  renderStats(mockData);
  initCharts();
  renderRecentTable(mockData);
  updateEarlyWarning(mockData);
}

function renderStats(data) {
  document.getElementById('statTotal').textContent = data.length;
  document.getElementById('statProses').textContent = data.filter(d => d.status === 'diproses').length;
  document.getElementById('statSelesai').textContent = data.filter(d => d.status === 'selesai').length;
  document.getElementById('statMerah').textContent = data.filter(d => d.risiko === 'Kritis' || d.risiko === 'Tinggi').length;
}

function initCharts() {
  // Tren Laporan
  const ctxTren = document.getElementById('chartTren');
  if (ctxTren) {
    new Chart(ctxTren, {
      type: 'line',
      data: {
        labels: ['18 Mei', '19 Mei', '20 Mei', '21 Mei', '22 Mei', '23 Mei'],
        datasets: [{ label: 'Laporan Masuk', data: [2, 1, 3, 2, 4, 3], borderColor: '#1e40af', tension: 0.3, fill: true, backgroundColor: 'rgba(30,64,175,0.1)' }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
    });
  }

  // Distribusi Kategori
  const ctxKat = document.getElementById('chartKategori');
  if (ctxKat) {
    new Chart(ctxKat, {
      type: 'doughnut',
      data: {
        labels: ['SARA', 'Ekonomi', 'Politik', 'Bencana', 'Lainnya'],
        datasets: [{ data: [25, 35, 20, 15, 5], backgroundColor: ['#dc2626','#059669','#1e40af','#f59e0b','#64748b'] }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
  }
}

function renderRecentTable(data) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  data.slice(0, 5).forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>#${item.id}</td>
      <td>${window.app.formatDate(item.tgl)}</td>
      <td>${item.kec} / ${item.desa}</td>
      <td>${item.kat}</td>
      <td><span class="risiko-badge ${window.app.getRisikoClass(item.risiko)}">${window.app.formatRisiko(item.risiko)}</span></td>
      <td><span class="status-badge ${window.app.getStatusClass(item.status)}">${window.app.formatStatus(item.status)}</span></td>
      <td><button class="btn-action" onclick="alert('Detail ${item.id} (siap integrasi modal)')">👁️ Detail</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateEarlyWarning(data) {
  const kritis = data.find(d => d.risiko === 'Kritis');
  const banner = document.getElementById('earlyWarning');
  if (kritis) {
    banner.classList.remove('d-none');
    document.getElementById('warnKec').textContent = kritis.kec;
  } else {
    banner.classList.add('d-none');
  }
}

function setupFilters() {
  const form = document.getElementById('filterForm');
  if (!form) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    window.app.showToast('🔍 Filter diterapkan (data mock)', 'info');
    // Nanti: panggil fetchSupabase() dengan parameter filter
  });
}

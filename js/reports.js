/**
 * js/reports.js
 * Logic Pelaporan: Form CRUD, Table Rendering, Search/Filter, File Preview, Modal
 */
document.addEventListener('DOMContentLoaded', () => {
  initReportPage();
});

// HAPUS: let reportsData = [ {...} ]

// GANTI DENGAN:
let reportsData = [];

async function fetchReports(filters = {}) {
  try {
    let query = window.sbClient
      .from('conflict_reports')
      .select(`
        id, judul, deskripsi, kategori, tingkat_risiko,
        lokasi_lat, lokasi_lng, alamat_lokasi, status, created_at,
        kecamatan (nama),
        profiles (nama_lengkap)
      `)
      .order('created_at', { ascending: false });

    // Terapkan filter jika ada
    if (filters.kecamatan_id) query = query.eq('kecamatan_id', filters.kecamatan_id);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.kategori) query = query.eq('kategori', filters.kategori);
    if (filters.tingkat_risiko) query = query.eq('tingkat_risiko', filters.tingkat_risiko);

    const { data, error } = await query;
    if (error) throw error;

    // Format data agar cocok dengan renderTable()
    reportsData = data.map(d => ({
      id: d.id,
      tgl: d.created_at,
      judul: d.judul,
      kec: d.kecamatan?.nama || '-',
      desa: d.alamat_lokasi?.split(',')[0] || 'Belum diisi',
      kat: d.kategori,
      risiko: d.tingkat_risiko,
      status: d.status,
      pelapor: d.profiles?.nama_lengkap || 'Anonim',
      // Simpan data asli untuk modal/detail
      _raw: d
    }));

    renderTable(reportsData);
    return reportsData;

  } catch (err) {
    console.error('❌ Gagal fetch laporan:', err);
    window.app.showToast('Gagal memuat data laporan', 'error');
    document.getElementById('tableLaporan').innerHTML = 
      '<tr><td colspan="8" class="text-center text-danger">Gagal memuat data.</td></tr>';
  }
}

function initReportPage() {
  renderTable(reportsData);
  setupForm();
  setupSearchFilter();
  setupFilePreview();
  setupModal();
}

function renderTable(data) {
  const tbody = document.getElementById('tableLaporan');
  if (!tbody) return;
  tbody.innerHTML = '';
  
  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Tidak ada data laporan.</td></tr>';
    return;
  }

  data.forEach((item, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>${window.app.formatDate(item.tgl)}</td>
      <td>${item.kec} / ${item.desa}</td>
      <td>${item.kat}</td>
      <td><span class="risiko-badge ${window.app.getRisikoClass(item.risiko)}">${window.app.formatRisiko(item.risiko)}</span></td>
      <td><span class="status-badge ${window.app.getStatusClass(item.status)}">${window.app.formatStatus(item.status)}</span></td>
      <td>${item.pelapor}</td>
      <td>
        <button class="btn-action" onclick="openReportModal(${item.id})">👁️</button>
        ${window.app.checkRole(['admin_kesbangpol', 'operator_kec']) ? `<button class="btn-action" onclick="updateStatus(${item.id})">🔄</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function setupForm() {
  const form = document.getElementById('formLaporan');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitLaporan');
    window.app.setLoading(btn, true);

    // Ambil data form
    const newReport = {
      id: Date.now(),
      tgl: new Date().toISOString(),
      judul: document.getElementById('laporanJudul').value,
      kec: document.getElementById('laporanKecamatan').options[document.getElementById('laporanKecamatan').selectedIndex].text,
      desa: document.getElementById('laporanDesa').options[document.getElementById('laporanDesa').selectedIndex].text,
      kat: document.getElementById('laporanKategori').value,
      risiko: document.getElementById('laporanRisiko').value,
      status: 'baru',
      pelapor: JSON.parse(localStorage.getItem('sipandai_user') || '{}').nama || 'User'
    };

    // Simulate Supabase insert / offline queue
    if (navigator.onLine) {
      reportsData.unshift(newReport);
      renderTable(reportsData);
      window.app.showToast('✅ Laporan berhasil dikirim ke database pusat', 'success');
    } else {
      window.syncOfflineQueue?.queueOfflineReport(newReport);
      window.app.showToast('⚠️ Offline. Laporan disimpan antrian lokal & akan sinkron saat online.', 'warning');
    }

    form.reset();
    document.getElementById('filePreview').innerHTML = '';
    window.app.setLoading(btn, false);
  });

  document.getElementById('btnReset')?.addEventListener('click', () => {
    document.getElementById('formLaporan').reset();
    document.getElementById('filePreview').innerHTML = '';
  });
}

function setupSearchFilter() {
  const search = document.getElementById('searchLaporan');
  const kecFilter = document.getElementById('filterKecamatanList');
  const statusFilter = document.getElementById('filterStatusList');
  const risikoFilter = document.getElementById('filterRisikoList');

  const apply = () => {
    const q = search.value.toLowerCase();
    let filtered = reportsData.filter(d => {
      const matchQ = d.kec.toLowerCase().includes(q) || d.desa.toLowerCase().includes(q) || d.judul?.toLowerCase().includes(q);
      const matchKec = !kecFilter.value || d.kec === kecFilter.value;
      const matchStatus = !statusFilter.value || d.status === statusFilter.value;
      const matchRisiko = !risikoFilter.value || d.risiko === risikoFilter.value;
      return matchQ && matchKec && matchStatus && matchRisiko;
    });
    renderTable(filtered);
  };

  [search, kecFilter, statusFilter, risikoFilter].forEach(el => el?.addEventListener('input', apply));
}

function setupFilePreview() {
  const input = document.getElementById('laporanBukti');
  const preview = document.getElementById('filePreview');
  input?.addEventListener('change', (e) => {
    preview.innerHTML = '';
    Array.from(e.target.files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const img = document.createElement('img');
        img.src = URL.createObjectURL(file);
        img.className = 'file-thumb';
        preview.appendChild(img);
      }
    });
  });
}

function setupModal() {
  document.getElementById('closeModal')?.addEventListener('click', () => {
    document.getElementById('modalDetail').classList.add('d-none');
  });
}

// Global functions for HTML onclick
window.openReportModal = (id) => {
  const item = reportsData.find(d => d.id === id);
  if (!item) return;
  document.getElementById('modalTitle').textContent = `Laporan #${item.id}: ${item.judul || 'Tanpa Judul'}`;
  document.getElementById('modalBody').innerHTML = `
    <p><strong>Kategori:</strong> ${item.kat} | <strong>Risiko:</strong> ${item.risiko}</p>
    <p><strong>Lokasi:</strong> ${item.kec}, ${item.desa}</p>
    <p><strong>Deskripsi:</strong> ${item.deskripsi || 'Belum diisi.'}</p>
    <p><strong>Status:</strong> ${item.status}</p>
  `;
  document.getElementById('modalDetail').classList.remove('d-none');
};

window.updateStatus = (id) => {
  const item = reportsData.find(d => d.id === id);
  if (item && item.status === 'baru') {
    item.status = 'diproses';
    renderTable(reportsData);
    window.app.showToast(`🔄 Status laporan #${id} diubah ke "Diproses"`, 'info');
  }
};

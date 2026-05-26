/**
 * js/koordinasi.js
 * Logic Halaman Koordinasi: Forum Koordinasi, Rapat, Tindak Lanjut
 * ✅ Supabase Real-time ✅ No Mock Data ✅ Role-based Access
 */

// State global
let koordinasiData = [];
let currentFilters = {};
const DEBUG = false; // Set true untuk debug

// ==========================================
// 1. INIT & FETCH DATA
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  if (DEBUG) console.log('🚀 Initializing koordinasi page...');
  
  // Pastikan Supabase client ready
  if (!window.sbClient) {
    console.error('❌ Supabase client not initialized');
    window.app.showToast('Koneksi database gagal', 'error');
    return;
  }
  
  await initKoordinasiPage();
  setupForm();
  setupFilters();
  setupRealtimeSubscription(); // ✅ Real-time updates
});

async function initKoordinasiPage() {
  showLoadingState();
  
  try {
    await fetchKoordinasiData();
    renderTable(koordinasiData);
    renderStats(koordinasiData);
    await loadKecamatanDropdown();
    
    if (DEBUG) console.log('✅ Koordinasi page initialized');
    
  } catch (err) {
    console.error('❌ Init error:', err);
    
    // Tampilkan pesan error yang jelas (bukan mock data)
    const tbody = document.getElementById('tableKoordinasi');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center text-danger">
            ⚠️ Gagal memuat data: ${err.message}<br>
            <small>Hubungi admin jika masalah berlanjut</small>
          </td>
        </tr>
      `;
    }
    
    window.app.showToast('Gagal memuat data koordinasi', 'error');
  }
}

async function fetchKoordinasiData(filters = {}) {
  try {
    currentFilters = { ...filters };
    const user = JSON.parse(localStorage.getItem('sipandai_user') || '{}');
    
    // Query ke tabel 'koordinasi' dengan join tabel terkait
    let query = window.sbClient
      .from('koordinasi')
      .select(`
        id, judul, jenis_kegiatan, tanggal, lokasi,
        peserta, notulensi, tindak_lanjut, status,
        created_at, updated_at,
        kecamatan_id,
        kecamatan (id, nama),
        profiles (nama_lengkap)
      `, { count: 'exact' })
      .order('tanggal', { ascending: false });
    
    // Apply filters
    if (filters.kecamatan_id) {
      query = query.eq('kecamatan_id', parseInt(filters.kecamatan_id));
    }
    if (filters.status) {
      query = query.eq('status', filters.status);
    }
    if (filters.jenis) {
      query = query.eq('jenis_kegiatan', filters.jenis);
    }
    
    // RLS: operator hanya lihat data kecamatannya
    if (user.role === 'operator_kec' && user.kecamatan_id) {
      query = query.eq('kecamatan_id', user.kecamatan_id);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('❌ Supabase query error:', error);
      
      // Error spesifik untuk tabel tidak ada
      if (error.code === '42P01') {
        throw new Error('Tabel koordinasi belum tersedia. Hubungi administrator.');
      }
      // Error permission
      if (error.code === '42501') {
        throw new Error('Akses ditolak. Periksa hak akses Anda.');
      }
      
      throw new Error(error.message);
    }
    
    koordinasiData = data || [];
    
    if (DEBUG) console.log(`✅ Loaded ${koordinasiData.length} records`);
    return koordinasiData;
    
  } catch (err) {
    console.error('❌ fetchKoordinasiData error:', err);
    throw err; // Re-throw agar ditangani di initKoordinasiPage
  }
}

function showLoadingState() {
  const tbody = document.getElementById('tableKoordinasi');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center">⏳ Memuat data...</td></tr>';
  }
  
  ['statTotal', 'statBerjalan', 'statSelesai'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '...';
  });
}

// ==========================================
// 📊 RENDER STATS
// ==========================================
function renderStats(data) {
  const total = data?.length || 0;
  const berjalan = data?.filter(d => ['berjalan', 'diproses'].includes(d.status))?.length || 0;
  const selesai = data?.filter(d => d.status === 'selesai')?.length || 0;
  
  animateValue('statTotal', 0, total, 500);
  animateValue('statBerjalan', 0, berjalan, 500);
  animateValue('statSelesai', 0, selesai, 500);
}

function animateValue(id, start, end, duration) {
  const obj = document.getElementById(id);
  if (!obj) return;
  
  let startTimestamp = null;
  const step = (timestamp) => {
    if (!startTimestamp) startTimestamp = timestamp;
    const progress = Math.min((timestamp - startTimestamp) / duration, 1);
    obj.textContent = Math.floor(progress * (end - start) + start);
    if (progress < 1) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}

// ==========================================
// 📋 RENDER TABLE
// ==========================================
function renderTable(data) {
  const tbody = document.getElementById('tableKoordinasi');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted">Belum ada data koordinasi.</td></tr>';
    return;
  }
  
  data.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>#${item.id}</strong></td>
      <td>${window.app.formatDate(item.tanggal)}</td>
      <td>
        <strong>${item.judul}</strong><br>
        <small class="text-muted">${item.jenis_kegiatan || '-'}</small>
      </td>
      <td>${item.lokasi || '-'}</td>
      <td>${item.kecamatan?.nama || '-'}</td>
      <td>${item.peserta ? item.peserta.split(',').length + ' orang' : '-'}</td>
      <td><span class="status-badge ${getStatusClass(item.status)}">${formatStatus(item.status)}</span></td>
      <td>
        <button class="btn-action" title="Detail" onclick="viewDetail(${item.id})">👁️</button>
        ${canEditKoordinasi(item) ? `<button class="btn-action" title="Edit" onclick="editKoordinasi(${item.id})">✏️</button>` : ''}
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function getStatusClass(status) {
  const map = {
    'rencana': 'status-baru',
    'berjalan': 'status-diproses',
    'diproses': 'status-diproses',
    'selesai': 'status-selesai',
    'ditunda': ''
  };
  return map[status] || '';
}

function formatStatus(status) {
  const map = {
    'rencana': '📅 Rencana',
    'berjalan': '🔄 Berjalan',
    'diproses': '🔄 Diproses',
    'selesai': '✅ Selesai',
    'ditunda': '⏸️ Ditunda'
  };
  return map[status] || status;
}

function canEditKoordinasi(item) {
  const user = JSON.parse(localStorage.getItem('sipandai_user') || '{}');
  if (user.role === 'admin_kesbangpol') return true;
  if (user.role === 'operator_kec' && item.kecamatan_id === user.kecamatan_id) return true;
  return false;
}

// Global functions for HTML onclick
window.viewDetail = async (id) => {
  try {
    // Fetch detail lengkap
    const { data, error } = await window.sbClient
      .from('koordinasi')
      .select(`
        *, 
        kecamatan (nama), 
        profiles (nama_lengkap)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    
    const modal = document.getElementById('modalDetail');
    const modalBody = document.getElementById('modalBody');
    
    if (modal && modalBody) {
      document.getElementById('modalTitle').textContent = `#${data.id}: ${data.judul}`;
      
      modalBody.innerHTML = `
        <div class="detail-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1rem">
          <div><span class="meta-label">Jenis Kegiatan</span><br><strong>${data.jenis_kegiatan || '-'}</strong></div>
          <div><span class="meta-label">Tanggal</span><br><strong>${window.app.formatDate(data.tanggal)}</strong></div>
          <div><span class="meta-label">Lokasi</span><br><strong>${data.lokasi || '-'}</strong></div>
          <div><span class="meta-label">Kecamatan</span><br><strong>${data.kecamatan?.nama || '-'}</strong></div>
          <div><span class="meta-label">Peserta</span><br><strong>${data.peserta || '-'}</strong></div>
          <div><span class="meta-label">Pelapor</span><br><strong>${data.profiles?.nama_lengkap || '-'}</strong></div>
          <div><span class="meta-label">Status</span><br><strong>${formatStatus(data.status)}</strong></div>
          <div><span class="meta-label">Dibuat</span><br><strong>${window.app.formatDate(data.created_at)}</strong></div>
        </div>
        <div style="margin-bottom:1rem">
          <strong>📝 Notulensi:</strong>
          <p style="margin:0.5rem 0;padding:0.75rem;background:#f8fafc;border-radius:6px;line-height:1.5">
            ${data.notulensi || '-'}
          </p>
        </div>
        <div>
          <strong>✅ Tindak Lanjut:</strong>
          <p style="margin:0.5rem 0;padding:0.75rem;background:#eff6ff;border-radius:6px;line-height:1.5">
            ${data.tindak_lanjut || '-'}
          </p>
        </div>
      `;
      
      // Show/hide edit button based on role
      const editSection = document.getElementById('modalEditSection');
      if (editSection) {
        if (canEditKoordinasi(data)) {
          editSection.classList.remove('d-none');
          document.getElementById('editKoordinasiId').value = data.id;
        } else {
          editSection.classList.add('d-none');
        }
      }
      
      modal.classList.remove('d-none');
    }
    
  } catch (err) {
    console.error('Gagal load detail:', err);
    window.app.showToast('Gagal memuat detail', 'error');
  }
};

window.editKoordinasi = (id) => {
  // Redirect ke form edit atau buka modal edit
  window.app.showToast('Fitur edit akan segera tersedia', 'info');
};

// ==========================================
// 📝 FORM SETUP (Tambah Data)
// ==========================================
function setupForm() {
  const form = document.getElementById('formKoordinasi');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitKoordinasi');
    window.app.setLoading(btn, true);
    
    try {
      const user = JSON.parse(localStorage.getItem('sipandai_user') || '{}');
      
      const payload = {
        judul: document.getElementById('koordinasiJudul').value.trim(),
        jenis_kegiatan: document.getElementById('koordinasiJenis').value || null,
        tanggal: document.getElementById('koordinasiTanggal').value || null,
        lokasi: document.getElementById('koordinasiLokasi').value.trim() || null,
        peserta: document.getElementById('koordinasiPeserta').value.trim() || null,
        notulensi: document.getElementById('koordinasiNotulensi').value.trim() || null,
        tindak_lanjut: document.getElementById('koordinasiTindakLanjut').value.trim() || null,
        status: document.getElementById('koordinasiStatus').value || 'rencana',
        kecamatan_id: document.getElementById('koordinasiKecamatan').value ? parseInt(document.getElementById('koordinasiKecamatan').value) : null,
        created_by: user.id,
        updated_at: new Date().toISOString()
      };
      
      // Validate required fields
      if (!payload.judul) throw new Error('Judul wajib diisi');
      if (!payload.tanggal) throw new Error('Tanggal wajib diisi');
      
      const { data, error } = await window.sbClient
        .from('koordinasi')
        .insert([payload])
        .select()
        .single();
      
      if (error) throw error;
      
      window.app.showToast('✅ Data koordinasi berhasil ditambahkan', 'success');
      form.reset();
      
      // Refresh data
      await fetchKoordinasiData(currentFilters);
      renderTable(koordinasiData);
      renderStats(koordinasiData);
      
    } catch (err) {
      console.error('❌ Submit error:', err);
      window.app.showToast('Gagal: ' + err.message, 'error');
    } finally {
      window.app.setLoading(btn, false);
    }
  });
  
  // Reset form
  document.getElementById('btnReset')?.addEventListener('click', () => {
    document.getElementById('formKoordinasi').reset();
  });
}

// ==========================================
// 🔍 FILTERS
// ==========================================
async function loadKecamatanDropdown() {
  const select = document.getElementById('koordinasiKecamatan');
  if (!select) return;
  
  try {
    const { data, error } = await window.sbClient
      .from('kecamatan')
      .select('id, nama')
      .order('nama');
    
    if (error) throw error;
    
    select.innerHTML = '<option value="">Semua Kecamatan</option>';
    data.forEach(k => {
      const opt = document.createElement('option');
      opt.value = k.id;
      opt.textContent = k.nama;
      select.appendChild(opt);
    });
    
  } catch (err) {
    console.error('❌ Gagal load kecamatan:', err);
    // Fallback hardcoded
    select.innerHTML = `
      <option value="">Semua Kecamatan</option>
      <option value="8">Kepahiang</option><option value="9">Tebat Karai</option>
      <option value="10">Merigi</option><option value="11">Kabawetan</option>
      <option value="12">Muara Kemumu</option><option value="13">Bermani Ilir</option>
      <option value="14">Seberang Musi</option><option value="15">Ujan Mas</option>
    `;
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
      jenis: document.getElementById('filterJenis')?.value || null
    };
    
    showLoadingState();
    await fetchKoordinasiData(filters);
    renderTable(koordinasiData);
    renderStats(koordinasiData);
    
    window.app.showToast('🔍 Filter diterapkan', 'info');
  });
}

// ==========================================
// 🔄 REAL-TIME SUBSCRIPTION
// ==========================================
function setupRealtimeSubscription() {
  if (!window.sbClient?.channel) {
    console.warn('⚠️ Realtime not available');
    return;
  }
  
  window.sbClient
    .channel('public:koordinasi')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'koordinasi'
    }, async (payload) => {
      if (DEBUG) console.log('🔄 Realtime update:', payload.eventType, payload.new?.id);
      
      // Re-fetch data & re-render
      showLoadingState();
      await fetchKoordinasiData(currentFilters);
      renderTable(koordinasiData);
      renderStats(koordinasiData);
      
      // Notify user
      const messages = {
        'INSERT': '🆕 Data koordinasi baru ditambahkan',
        'UPDATE': '🔄 Data koordinasi diperbarui',
        'DELETE': '🗑️ Data koordinasi dihapus'
      };
      window.app.showToast(messages[payload.eventType] || '📊 Data diperbarui', 'info');
    })
    .subscribe((status) => {
      if (DEBUG) console.log('📡 Realtime subscription status:', status);
    });
}

// ==========================================
// 📥 EXPORT CSV
// ==========================================
document.getElementById('btnExport')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnExport');
  window.app.setLoading(btn, true);
  
  try {
    // Fetch all data for export (no pagination)
    let query = window.sbClient
      .from('koordinasi')
      .select(`
        id, judul, jenis_kegiatan, tanggal, lokasi,
        peserta, notulensi, tindak_lanjut, status,
        kecamatan (nama), profiles (nama_lengkap)
      `)
      .order('tanggal', { ascending: false });
    
    // Apply active filters
    if (currentFilters.kecamatan_id) query = query.eq('kecamatan_id', currentFilters.kecamatan_id);
    if (currentFilters.status) query = query.eq('status', currentFilters.status);
    
    const { data, error } = await query;
    if (error) throw error;
    
    // Convert to CSV
    const csv = [
      ['ID', 'Tanggal', 'Judul', 'Jenis', 'Lokasi', 'Kecamatan', 'Peserta', 'Status', 'Notulensi', 'Tindak Lanjut'].join(','),
      ...data.map(d => [
        d.id,
        d.tanggal,
        `"${(d.judul || '').replace(/"/g, '""')}"`,
        d.jenis_kegiatan || '-',
        `"${(d.lokasi || '').replace(/"/g, '""')}"`,
        d.kecamatan?.nama || '-',
        `"${(d.peserta || '').replace(/"/g, '""')}"`,
        d.status,
        `"${(d.notulensi || '').replace(/"/g, '""')}"`,
        `"${(d.tindak_lanjut || '').replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');
    
    // Download
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `koordinasi_sipandai_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
    
    window.app.showToast('✅ Data berhasil diexport', 'success');
    
  } catch (err) {
    console.error('Export error:', err);
    window.app.showToast('Gagal export: ' + err.message, 'error');
  } finally {
    window.app.setLoading(btn, false);
  }
});

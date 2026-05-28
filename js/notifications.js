// ==========================================
// 🔔 NOTIFICATION SYSTEM
// ==========================================

let notificationCount = 0;
let notifications = [];

// Fetch notifications dari database
async function fetchNotifications() {
  try {
    const user = JSON.parse(localStorage.getItem('sipandai_user') || '{}');
    
    const { data, error } = await window.sbClient
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (error) throw error;
    
    notifications = data || [];
    notificationCount = notifications.length;
    
    updateNotificationBadge();
    
    return notifications;
    
  } catch (err) {
    console.error('Gagal fetch notifikasi:', err);
    return [];
  }
}

// Update badge number di lonceng
function updateNotificationBadge() {
  const badge = document.querySelector('.notification-badge');
  if (badge) {
    if (notificationCount > 0) {
      badge.textContent = notificationCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Render dropdown notifikasi
function renderNotifications() {
  const dropdown = document.getElementById('notificationDropdown');
  if (!dropdown) return;
  
  if (notifications.length === 0) {
    dropdown.innerHTML = `
      <div class="notification-empty">
        <p>🎉 Tidak ada notifikasi baru</p>
      </div>
    `;
    return;
  }
  
  dropdown.innerHTML = notifications.map(notif => `
    <div class="notification-item ${notif.type}" onclick="handleNotificationClick('${notif.id}', '${notif.link}')">
      <div class="notification-icon">
        ${getNotificationIcon(notif.type)}
      </div>
      <div class="notification-content">
        <div class="notification-title">${notif.title}</div>
        <div class="notification-message">${notif.message}</div>
        <div class="notification-time">${formatNotificationTime(notif.created_at)}</div>
      </div>
    </div>
  `).join('');
}

// Handle klik notifikasi
async function handleNotificationClick(id, link) {
  // Mark as read
  await window.sbClient
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  
  // Redirect jika ada link
  if (link) {
    window.location.href = link;
  }
  
  // Refresh notifications
  await fetchNotifications();
}

// Helper: Icon berdasarkan tipe
function getNotificationIcon(type) {
  const icons = {
    'critical': '🚨',
    'warning': '⚠️',
    'info': '📝',
    'reminder': '⏰'
  };
  return icons[type] || '🔔';
}

// Helper: Format waktu
function formatNotificationTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit yang lalu`;
  if (hours < 24) return `${hours} jam yang lalu`;
  if (days < 7) return `${days} hari yang lalu`;
  
  return date.toLocaleDateString('id-ID');
}

// Setup notification bell click
function setupNotificationBell() {
  const bellIcon = document.getElementById('notificationBell');
  const dropdown = document.getElementById('notificationDropdown');
  
  if (!bellIcon) return;
  
  bellIcon.addEventListener('click', async () => {
    await fetchNotifications();
    renderNotifications();
    
    // Toggle dropdown
    dropdown.classList.toggle('show');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!bellIcon.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });
}

// Real-time subscription untuk notifikasi baru
function setupNotificationSubscription() {
  const user = JSON.parse(localStorage.getItem('sipandai_user') || '{}');
  
  window.sbClient
    .channel('notifications')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${user.id}`
    }, (payload) => {
      console.log('🔔 Notifikasi baru:', payload.new);
      
      // Play sound (opsional)
      playNotificationSound();
      
      // Show toast
      if (window.app?.showToast) {
        window.app.showToast(payload.new.title, 'info');
      }
      
      // Refresh badge
      fetchNotifications();
    })
    .subscribe();
}

// Play notification sound
function playNotificationSound() {
  const audio = new Audio('assets/sounds/notification.mp3');
  audio.volume = 0.3;
  audio.play().catch(() => {
    // Silent fail jika browser block autoplay
  });
}

// Initialize notification system
document.addEventListener('DOMContentLoaded', () => {
  setupNotificationBell();
  setupNotificationSubscription();
  
  // Fetch initial notifications
  fetchNotifications();
  
  // Refresh setiap 30 detik
  setInterval(fetchNotifications, 30000);
});

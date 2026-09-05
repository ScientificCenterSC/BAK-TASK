// ============================================================
// ui.js — UI Helpers (Loading, Toast, Modal, etc.)
// ============================================================
var UI = {

  // ---- Loading Overlay ----
  _loadingCount: 0,

  showLoading: function(message) {
    UI._loadingCount++;
    var overlay = document.getElementById('loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading-overlay';
      overlay.innerHTML = '<div class="loading-spinner"></div><p class="loading-text">' + (message || 'Loading...') + '</p>';
      document.body.appendChild(overlay);
    } else {
      overlay.style.display = 'flex';
      if (message) overlay.querySelector('.loading-text').textContent = message;
    }
  },

  hideLoading: function() {
    UI._loadingCount--;
    if (UI._loadingCount <= 0) {
      UI._loadingCount = 0;
      var overlay = document.getElementById('loading-overlay');
      if (overlay) overlay.style.display = 'none';
    }
  },

  // ---- Toast Notifications ----
  showToast: function(message, type) {
    type = type || 'info'; // info, success, error, warning
    var container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;

    var icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = '<span class="toast-icon">' + (icons[type] || 'ℹ') + '</span><span class="toast-msg">' + message + '</span>';

    container.appendChild(toast);

    // Animate in
    setTimeout(function() { toast.classList.add('toast-show'); }, 10);

    // Auto remove
    setTimeout(function() {
      toast.classList.remove('toast-show');
      setTimeout(function() { toast.remove(); }, 300);
    }, 4000);
  },

  // ---- Modal ----
  showModal: function(title, bodyHTML, actions) {
    UI.closeModal();
    var backdrop = document.createElement('div');
    backdrop.id = 'modal-backdrop';
    backdrop.className = 'modal-backdrop';

    var modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML =
      '<div class="modal-header"><h3>' + title + '</h3><button class="modal-close" onclick="UI.closeModal()">&times;</button></div>' +
      '<div class="modal-body">' + bodyHTML + '</div>' +
      '<div class="modal-footer" id="modal-footer"></div>';

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Add action buttons
    if (actions && actions.length) {
      var footer = document.getElementById('modal-footer');
      for (var i = 0; i < actions.length; i++) {
        var btn = document.createElement('button');
        btn.textContent = actions[i].label;
        btn.className = 'btn ' + (actions[i].class || 'btn-primary');
        btn.onclick = actions[i].onClick;
        footer.appendChild(btn);
      }
    }

    setTimeout(function() { backdrop.classList.add('modal-open'); }, 10);
  },

  closeModal: function() {
    var backdrop = document.getElementById('modal-backdrop');
    if (backdrop) {
      backdrop.classList.remove('modal-open');
      setTimeout(function() { backdrop.remove(); }, 300);
    }
  },

  // ---- Confirm Dialog ----
  confirm: function(message) {
    return new Promise(function(resolve) {
      UI.showModal('Confirm', '<p>' + message + '</p>', [
        { label: 'Cancel', class: 'btn-secondary', onClick: function() { UI.closeModal(); resolve(false); } },
        { label: 'Confirm', class: 'btn-danger', onClick: function() { UI.closeModal(); resolve(true); } }
      ]);
    });
  },

  // ---- Empty State ----
  renderEmptyState: function(container, message, icon) {
    container.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">' + (icon || '📭') + '</div>' +
        '<p>' + message + '</p>' +
      '</div>';
  },

  // ---- Progress Bar ----
  renderProgressBar: function(percentage) {
    percentage = Math.min(100, Math.max(0, percentage));
    var color = percentage >= 80 ? 'var(--success)' : percentage >= 50 ? 'var(--warning)' : 'var(--danger)';
    return '<div class="progress-bar-track"><div class="progress-bar-fill" style="width:' + percentage + '%;background:' + color + '"></div></div><span class="progress-text">' + percentage + '%</span>';
  },

  // ---- Progress Ring ----
  renderProgressRing: function(percentage, size) {
    size = size || 80;
    var radius = (size - 8) / 2;
    var circumference = 2 * Math.PI * radius;
    var offset = circumference - (percentage / 100) * circumference;
    var color = percentage >= 80 ? 'var(--success)' : percentage >= 50 ? 'var(--warning)' : 'var(--danger)';
    return '<div class="progress-ring" style="width:' + size + 'px;height:' + size + 'px">' +
      '<svg width="' + size + '" height="' + size + '">' +
        '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + radius + '" fill="none" stroke="#e0e0e0" stroke-width="6"/>' +
        '<circle cx="' + size/2 + '" cy="' + size/2 + '" r="' + radius + '" fill="none" stroke="' + color + '" stroke-width="6" ' +
          'stroke-dasharray="' + circumference + '" stroke-dashoffset="' + offset + '" stroke-linecap="round" ' +
          'style="transform:rotate(-90deg);transform-origin:center;transition:stroke-dashoffset 0.6s ease"/>' +
      '</svg>' +
      '<span class="progress-ring-text">' + percentage + '%</span>' +
    '</div>';
  },

  // ---- Status Badge ----
  statusBadge: function(status) {
    var colors = {
      completed: 'badge-success',
      available: 'badge-primary',
      expired: 'badge-danger',
      locked: 'badge-dark',
      active: 'badge-success',
      inactive: 'badge-secondary',
      on_time: 'badge-success',
      late: 'badge-warning'
    };
    var icons = {
      completed: '🟢',
      available: '🔵',
      expired: '🔴',
      locked: '🔒',
      active: '🟢',
      inactive: '⚫'
    };
    return '<span class="badge ' + (colors[status] || 'badge-secondary') + '">' + (icons[status] || '') + ' ' + status + '</span>';
  },

  // ---- Format Date ----
  formatDate: function(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
};

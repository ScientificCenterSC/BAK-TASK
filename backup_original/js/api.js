// ============================================================
// api.js — API Communication Layer
// ============================================================
var API = {
  clearCache: function() {
    Object.keys(sessionStorage).forEach(key => {
      if (key.startsWith('API_CACHE_')) {
        sessionStorage.removeItem(key);
      }
    });
  },

  call: function(action, data) {
    data = data || {};
    var token = Auth.getToken();
    if (token) data.token = token;

    // Determine if action is a safe GET request
    const isGet = action.startsWith('get') || action === 'getAllCurricula' || action === 'getAllLessons' || action === 'getAllTasks' || action === 'getAllStudents';
    const cacheKey = 'API_CACHE_' + action + '_' + JSON.stringify(data);

    // If it's a mutation, clear cache so next reads are fresh
    if (!isGet && action !== 'verifyStudent' && action !== 'verifyAdmin') {
      API.clearCache();
    }

    let cachedData = null;
    if (isGet) {
      try {
        const stored = sessionStorage.getItem(cacheKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Trust cache if it's less than 2 minutes old
          if (Date.now() - parsed.timestamp < 2 * 60 * 1000) {
             cachedData = parsed.data;
          }
        }
      } catch(e) {}
    }

    if (!cachedData) {
      UI.showLoading();
    }

    const fetchPromise = fetch(CONFIG.WEB_APP_URL + '?action=' + encodeURIComponent(action), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(result) {
      if (!cachedData) UI.hideLoading();
      
      if (!result.success) {
        throw new Error(result.message || 'Unknown error');
      }
      
      if (isGet) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify({
            timestamp: Date.now(),
            data: result.data
          }));
        } catch(e) {}
      }
      return result.data;
    })
    .catch(function(err) {
      if (!cachedData) UI.hideLoading();
      if (err.message && err.message.indexOf('Unauthorized') !== -1) {
        Auth.logout();
        window.location.href = 'student-login.html';
        throw err;
      }
      if (!cachedData) {
        UI.showToast(err.message || 'Network error. Please try again.', 'error');
        throw err;
      }
      console.warn("Background fetch failed", err);
      return cachedData;
    });

    if (cachedData) {
      // Fire background fetch to keep cache warm, return cache instantly
      fetchPromise.catch(() => {});
      return Promise.resolve(cachedData);
    }

    return fetchPromise;
  },

  // Shorthand for GET-like calls (still uses POST for CORS)
  get: function(action, data) {
    return API.call(action, data);
  }
};

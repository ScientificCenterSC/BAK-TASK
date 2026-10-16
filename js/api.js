// ============================================================
// api.js — Resilient API Communication Layer
// ============================================================
var API = {
  _inflight: {},

  clearCache: function() {
    try {
      Object.keys(sessionStorage).forEach(function(key) {
        if (key.startsWith('API_CACHE_')) {
          sessionStorage.removeItem(key);
        }
      });
    } catch (e) {}
  },

  call: function(action, data, options) {
    options = options || {};
    // Shallow copy data to avoid mutating caller object
    var payload = Object.assign({}, data || {});
    var token = Auth.getToken();
    if (token) payload.token = token;

    // Determine if action is a safe read-only operation
    var isGet = action.startsWith('get') ||
                action === 'getAllCurricula' ||
                action === 'getAllLessons' ||
                action === 'getAllTasks' ||
                action === 'getAllStudents';

    var cacheKey = 'API_CACHE_' + action + '_' + JSON.stringify(payload);

    // If it's a mutation, clear cache so subsequent reads are fresh
    if (!isGet && action !== 'verifyStudent' && action !== 'verifyAdmin') {
      API.clearCache();
    }

    // Check client sessionStorage cache for GET requests (2 min TTL)
    var cachedData = null;
    if (isGet && !options.skipCache) {
      try {
        var stored = sessionStorage.getItem(cacheKey);
        if (stored) {
          var parsed = JSON.parse(stored);
          if (Date.now() - parsed.timestamp < 2 * 60 * 1000) {
            cachedData = parsed.data;
          }
        }
      } catch (e) {}
    }

    // Request deduplication key
    var dedupKey = action + '_' + JSON.stringify(payload);
    if (isGet && API._inflight[dedupKey]) {
      return API._inflight[dedupKey];
    }

    if (!cachedData) {
      UI.showLoading();
    }

    // Function to execute single fetch with timeout
    var executeFetch = function(attempt) {
      attempt = attempt || 0;
      var controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timeoutId = controller ? setTimeout(function() {
        controller.abort();
      }, 35000) : null;

      var fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      };
      if (controller) {
        fetchOptions.signal = controller.signal;
      }

      var url = CONFIG.WEB_APP_URL + '?action=' + encodeURIComponent(action);

      return fetch(url, fetchOptions)
        .then(function(response) {
          if (timeoutId) clearTimeout(timeoutId);
          return response.text();
        })
        .then(function(rawText) {
          var result;
          try {
            result = JSON.parse(rawText);
          } catch (jsonErr) {
            // Google Apps Script sometimes redirects or returns HTML on error
            if (rawText.indexOf('<html') !== -1 || rawText.indexOf('Google Drive') !== -1) {
              throw new Error('Server connection was interrupted. Please retry.');
            }
            throw new Error('Invalid response from server: ' + rawText.substring(0, 100));
          }

          if (!result.success) {
            throw new Error(result.message || 'Unknown server error');
          }

          // Cache GET results
          if (isGet) {
            try {
              sessionStorage.setItem(cacheKey, JSON.stringify({
                timestamp: Date.now(),
                data: result.data
              }));
            } catch (e) {}

            // Dispatch cache update notification if cached data differed
            if (cachedData && JSON.stringify(cachedData) !== JSON.stringify(result.data)) {
              window.dispatchEvent(new CustomEvent('lms:cache-updated', {
                detail: { action: action, data: result.data }
              }));
            }
          }

          return result.data;
        })
        .catch(function(err) {
          if (timeoutId) clearTimeout(timeoutId);

          // Handle abort/timeout
          if (err.name === 'AbortError') {
            err = new Error('Connection timed out. Please check your internet connection.');
          }

          // Auto retry up to 2 times for safe GET requests only
          if (isGet && attempt < 2 && (!err.message || err.message.indexOf('Unauthorized') === -1)) {
            var delay = (attempt + 1) * 1500;
            return new Promise(function(resolve) {
              setTimeout(resolve, delay);
            }).then(function() {
              return executeFetch(attempt + 1);
            });
          }

          throw err;
        });
    };

    var fetchPromise = executeFetch(0)
      .then(function(data) {
        if (!cachedData) UI.hideLoading();
        delete API._inflight[dedupKey];
        return data;
      })
      .catch(function(err) {
        if (!cachedData) UI.hideLoading();
        delete API._inflight[dedupKey];

        // Handle unauthorized sessions with correct role destination
        if (err.message && err.message.indexOf('Unauthorized') !== -1) {
          var wasAdmin = Auth.isAdmin();
          Auth.logout();
          window.location.href = wasAdmin ? 'admin-login.html' : 'student-login.html';
          throw err;
        }

        if (!cachedData) {
          UI.showToast(err.message || 'Network error. Please try again.', 'error');
          throw err;
        }

        console.warn('Background fetch failed for ' + action + ', using cached data', err);
        return cachedData;
      });

    if (isGet) {
      API._inflight[dedupKey] = fetchPromise;
    }

    if (cachedData) {
      // Fire background revalidation, return cache immediately
      fetchPromise.catch(function() {});
      return Promise.resolve(cachedData);
    }

    return fetchPromise;
  },

  // Shorthand for GET calls
  get: function(action, data) {
    return API.call(action, data);
  }
};

// ============================================================
// api.js — API Communication Layer
// ============================================================
var API = {
  call: function(action, data) {
    data = data || {};
    // Inject token from session
    var token = Auth.getToken();
    if (token) data.token = token;

    UI.showLoading();

    return fetch(CONFIG.WEB_APP_URL + '?action=' + encodeURIComponent(action), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(data)
    })
    .then(function(response) {
      return response.json();
    })
    .then(function(result) {
      UI.hideLoading();
      if (!result.success) {
        throw new Error(result.message || 'Unknown error');
      }
      return result.data;
    })
    .catch(function(err) {
      UI.hideLoading();
      if (err.message && err.message.indexOf('Unauthorized') !== -1) {
        Auth.logout();
        window.location.href = 'student-login.html';
        return;
      }
      UI.showToast(err.message || 'Network error. Please try again.', 'error');
      throw err;
    });
  },

  // Shorthand for GET-like calls (still uses POST for CORS)
  get: function(action, data) {
    return API.call(action, data);
  }
};

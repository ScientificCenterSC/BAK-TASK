// ============================================================
// auth.js — Authentication & Session Management
// ============================================================
var Auth = {
  // Save session to localStorage
  saveSession: function(data) {
    localStorage.setItem('lms_token', data.token);
    localStorage.setItem('lms_role', data.role || 'student');
    if (data.studentId) localStorage.setItem('lms_student_id', data.studentId);
    if (data.name) localStorage.setItem('lms_student_name', data.name);
    if (data.code) localStorage.setItem('lms_student_code', data.code);
  },

  getToken: function() {
    return localStorage.getItem('lms_token');
  },

  getRole: function() {
    return localStorage.getItem('lms_role');
  },

  getSession: function() {
    var token = localStorage.getItem('lms_token');
    if (!token) return null;
    return {
      token: token,
      role: localStorage.getItem('lms_role'),
      studentId: localStorage.getItem('lms_student_id'),
      name: localStorage.getItem('lms_student_name'),
      code: localStorage.getItem('lms_student_code')
    };
  },

  isLoggedIn: function() {
    return !!localStorage.getItem('lms_token');
  },

  isAdmin: function() {
    return localStorage.getItem('lms_role') === 'admin';
  },

  isStudent: function() {
    return localStorage.getItem('lms_role') === 'student';
  },

  logout: function() {
    var token = Auth.getToken();
    if (token) {
      // Fire and forget logout call
      fetch(CONFIG.WEB_APP_URL + '?action=logout', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ token: token })
      }).catch(function() {});
    }
    localStorage.removeItem('lms_token');
    localStorage.removeItem('lms_role');
    localStorage.removeItem('lms_student_id');
    localStorage.removeItem('lms_student_name');
    localStorage.removeItem('lms_student_code');
  },

  // Redirect if not logged in as student
  requireStudent: function() {
    if (!Auth.isLoggedIn() || !Auth.isStudent()) {
      window.location.href = 'student-login.html';
      return false;
    }
    return true;
  },

  // Redirect if not logged in as admin
  requireAdmin: function() {
    if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
      window.location.href = 'admin-login.html';
      return false;
    }
    return true;
  },

  // Student login
  login: function(code, password) {
    return API.call('login', { code: code, password: password })
      .then(function(data) {
        Auth.saveSession({
          token: data.token,
          role: 'student',
          studentId: data.studentId,
          name: data.name,
          code: data.code
        });
        return data;
      });
  },

  // Admin login
  adminLogin: function(username, password) {
    return API.call('adminLogin', { username: username, password: password })
      .then(function(data) {
        Auth.saveSession({
          token: data.token,
          role: 'admin'
        });
        return data;
      });
  }
};

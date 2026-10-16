// admin-dashboard.js
document.addEventListener('DOMContentLoaded', async () => {
    Auth.requireAdmin();

    document.getElementById('logoutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        Auth.logout();
        window.location.href = 'admin-login.html';
    });

    try {
        UI.showLoading();
        const data = await API.call('getAdminDashboard');
        
        // Render stats
        const statGrid = document.getElementById('statGrid');
        statGrid.innerHTML = `
            <div class="stat-card">
              <div class="stat-icon stat-icon-primary">👥</div>
              <div class="stat-info"><h4>Total Students</h4><div class="stat-value">${data.totalStudents || 0}</div></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-success">🟢</div>
              <div class="stat-info"><h4>Active Students</h4><div class="stat-value">${data.activeStudents || 0}</div></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-warning">📚</div>
              <div class="stat-info"><h4>Curricula</h4><div class="stat-value">${data.totalCurricula || 0}</div></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-primary">📝</div>
              <div class="stat-info"><h4>Total Tasks</h4><div class="stat-value">${data.totalTasks || 0}</div></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-success">✅</div>
              <div class="stat-info"><h4>Submissions</h4><div class="stat-value">${data.totalSubmissions || 0}</div></div>
            </div>
            <div class="stat-card">
              <div class="stat-icon stat-icon-warning">📈</div>
              <div class="stat-info"><h4>Average Score</h4><div class="stat-value">${data.averageScore || 0}%</div></div>
            </div>
        `;

        // Render activity
        const tbody = document.getElementById('activityTableBody');
        if (data.recentActivity && data.recentActivity.length > 0) {
            tbody.innerHTML = data.recentActivity.map(act => `
                <tr>
                    <td>${UI.formatDate(act.submittedAt)}</td>
                    <td>${act.studentName || 'Unknown'}</td>
                    <td>Submitted Task: ${act.taskId}</td>
                    <td>${act.isCorrect ? '<span class="badge badge-success">✓ Correct</span>' : '<span class="badge badge-danger">✕ Incorrect</span>'}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align: center;" class="empty-state">No recent submissions found.</td></tr>';
        }

    } catch (err) {
        UI.showToast('Failed to load dashboard data: ' + err.message, 'error');
    } finally {
        UI.hideLoading();
    }
});

// js/student-dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Require student authentication
    if (!Auth.requireStudent()) return;
    
    // 2. Set student name
    const session = Auth.getSession();
    if(session) {
        document.getElementById('studentNameDisplay').textContent = session.name || 'Student';
    }

    // 3. Load dashboard data
    loadDashboard();

    // 4. Listen for cache background revalidation updates
    window.addEventListener('lms:cache-updated', (e) => {
        if (e.detail && (e.detail.action === 'getStudentDashboardFull' || e.detail.action === 'getStudentDashboard' || e.detail.action === 'getStudentCurricula')) {
            loadDashboard(true);
        }
    });
});

function logout() {
    Auth.logout();
    window.location.href = 'student-login.html';
}

async function loadDashboard(isBackgroundUpdate) {
    try {
        if (!isBackgroundUpdate) UI.showLoading();
        
        let dashboardData, curriculaList;
        try {
            // Attempt fast combined endpoint first
            const full = await API.call('getStudentDashboardFull');
            dashboardData = full.dashboard || full;
            curriculaList = full.curricula || [];
        } catch(fallbackErr) {
            // Graceful fallback to parallel calls
            const [dash, curr] = await Promise.all([
                API.call('getStudentDashboard'),
                API.call('getStudentCurricula')
            ]);
            dashboardData = dash;
            curriculaList = (curr && curr.curricula) ? curr.curricula : [];
        }
        
        renderStats({
            completed_tasks: dashboardData.completedTasks,
            correct_tasks: dashboardData.correctAnswers,
            incorrect_tasks: dashboardData.incorrectAnswers,
            total_score: dashboardData.totalScore,
            remaining_tasks: dashboardData.remainingTasks
        });
        renderProgressRing(dashboardData.progress || 0);
        renderCurricula(curriculaList);
        
    } catch (error) {
        if (!isBackgroundUpdate) {
            UI.showToast(error.message || 'Failed to load dashboard', 'error');
            const grid = document.getElementById('curriculaGrid');
            if (grid) {
                UI.renderErrorState(grid, error.message, () => loadDashboard(false));
            }
        }
        console.error(error);
    } finally {
        if (!isBackgroundUpdate) UI.hideLoading();
    }
}

function renderStats(stats) {
    const grid = document.getElementById('statsGrid');
    if(!stats || !grid) return;
    
    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${Number(stats.completed_tasks) || 0}</div>
            <div class="stat-label">Tasks Completed</div>
        </div>
        <div class="stat-card" style="border-top-color: var(--color-success);">
            <div class="stat-value">${Number(stats.correct_tasks) || 0}</div>
            <div class="stat-label">Correct Answers</div>
        </div>
        <div class="stat-card" style="border-top-color: var(--color-danger);">
            <div class="stat-value">${Number(stats.incorrect_tasks) || 0}</div>
            <div class="stat-label">Incorrect Answers</div>
        </div>
        <div class="stat-card" id="totalScoreCard" style="border-top-color: var(--warning); cursor: pointer;" title="Click to view detailed performance">
            <div class="stat-value">${Number(stats.total_score) || 0}</div>
            <div class="stat-label">Total Score (Click for Details)</div>
        </div>
        <div class="stat-card" style="border-top-color: var(--color-gray-500);">
            <div class="stat-value">${Number(stats.remaining_tasks) || 0}</div>
            <div class="stat-label">Remaining Tasks</div>
        </div>
    `;

    const scoreCard = document.getElementById('totalScoreCard');
    if (scoreCard) {
        scoreCard.onclick = () => {
            const sess = Auth.getSession();
            if (typeof PerformanceDetails !== 'undefined' && sess) {
                PerformanceDetails.viewStudentPerformance(sess.studentId, null, null, sess.name);
            }
        };
    }
}

function renderProgressRing(percentage) {
    const ring = document.getElementById('overallProgressRing');
    const text = document.getElementById('overallProgressText');
    if (!ring || !text) return;
    
    // Circumference = 2 * PI * r = 2 * 3.14159 * 64 = 402.12
    const circumference = 402;
    ring.style.strokeDasharray = circumference;
    
    // Ensure percentage is between 0 and 100
    const clampedPercent = Math.min(Math.max(percentage, 0), 100);
    const offset = circumference - (clampedPercent / 100) * circumference;
    
    setTimeout(() => {
        ring.style.strokeDashoffset = offset;
        text.textContent = `${Math.round(clampedPercent)}%`;
    }, 100);
}

function renderCurricula(curricula) {
    const grid = document.getElementById('curriculaGrid');
    if (!grid) return;
    
    if(!curricula || curricula.length === 0) {
        UI.renderEmptyState(grid, 'No curricula assigned to you yet.', '📚');
        return;
    }
    
    grid.innerHTML = curricula.map(curr => `
        <div class="curriculum-card" data-id="${UI.escapeHTML(curr.curriculum_id)}" style="cursor: pointer;">
            <h3>${UI.escapeHTML(curr.name || 'Curriculum')}</h3>
            <p>${UI.escapeHTML(curr.description || 'Explore this curriculum')}</p>
            
            <div style="margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                    <span>Progress</span>
                    <span>${Math.round(curr.progress || 0)}%</span>
                </div>
                <div class="lesson-progress">
                    <div class="lesson-progress-bar" style="width: ${Math.min(100, Math.max(0, curr.progress || 0))}%;"></div>
                </div>
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('.curriculum-card').forEach(card => {
        card.onclick = () => {
            const id = card.getAttribute('data-id');
            if (id) window.location.href = `student-curriculum.html?id=${encodeURIComponent(id)}`;
        };
    });
}

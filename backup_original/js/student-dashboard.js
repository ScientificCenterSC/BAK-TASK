// js/student-dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Require student authentication
    Auth.requireStudent();
    
    // 2. Set student name
    const session = Auth.getSession();
    if(session && session) {
        document.getElementById('studentNameDisplay').textContent = session.name || 'Student';
    }

    // 3. Load dashboard data
    loadDashboard();
});

function logout() {
    Auth.logout();
    window.location.href = 'student-login.html';
}

async function loadDashboard() {
    try {
        UI.showLoading();
        
        // Fetch dashboard data
        const dashboardData = await API.call('getStudentDashboard');
        const curriculaData = await API.call('getStudentCurricula');
        
        renderStats({
            completed_tasks: dashboardData.completedTasks,
            correct_tasks: dashboardData.correctAnswers,
            incorrect_tasks: dashboardData.incorrectAnswers,
            total_score: dashboardData.totalScore,
            remaining_tasks: dashboardData.remainingTasks
        });
        renderProgressRing(dashboardData.progress || 0);
        renderCurricula(curriculaData.curricula || []);
        
    } catch (error) {
        UI.showToast(error.message || 'Failed to load dashboard', 'error');
        console.error(error);
    } finally {
        UI.hideLoading();
    }
}

function renderStats(stats) {
    const grid = document.getElementById('statsGrid');
    if(!stats) return;
    
    grid.innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${stats.completed_tasks || 0}</div>
            <div class="stat-label">Tasks Completed</div>
        </div>
        <div class="stat-card" style="border-top-color: var(--color-success);">
            <div class="stat-value">${stats.correct_tasks || 0}</div>
            <div class="stat-label">Correct Answers</div>
        </div>
        <div class="stat-card" style="border-top-color: var(--color-danger);">
            <div class="stat-value">${stats.incorrect_tasks || 0}</div>
            <div class="stat-label">Incorrect Answers</div>
        </div>
        <div class="stat-card" style="border-top-color: var(--warning); cursor: pointer;" onclick="PerformanceDetails.viewStudentPerformance(Auth.getSession().studentId, null, null, Auth.getSession().name)" title="Click to view detailed performance">
            <div class="stat-value">${stats.total_score || 0}</div>
            <div class="stat-label">Total Score (Click for Details)</div>
        </div>
        <div class="stat-card" style="border-top-color: var(--color-gray-500);">
            <div class="stat-value">${stats.remaining_tasks || 0}</div>
            <div class="stat-label">Remaining Tasks</div>
        </div>
    `;
}

function renderProgressRing(percentage) {
    const ring = document.getElementById('overallProgressRing');
    const text = document.getElementById('overallProgressText');
    
    // Circumference = 2 * PI * r = 2 * 3.14159 * 64 = 402.12
    const circumference = 402;
    ring.style.strokeDasharray = circumference;
    
    // Ensure percentage is between 0 and 100
    const clampedPercent = Math.min(Math.max(percentage, 0), 100);
    
    const offset = circumference - (clampedPercent / 100) * circumference;
    
    // Small timeout to allow transition to run
    setTimeout(() => {
        ring.style.strokeDashoffset = offset;
        text.textContent = `${Math.round(clampedPercent)}%`;
    }, 100);
}

function renderCurricula(curricula) {
    const grid = document.getElementById('curriculaGrid');
    
    if(curricula.length === 0) {
        grid.innerHTML = `<p class="text-muted">No curricula assigned to you yet.</p>`;
        return;
    }
    
    grid.innerHTML = curricula.map(curr => `
        <div class="curriculum-card" onclick="window.location.href='student-curriculum.html?id=${curr.curriculum_id}'">
            <h3>${curr.name}</h3>
            <p>${curr.description || 'Explore this curriculum'}</p>
            
            <div style="margin-top: 1rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 0.25rem;">
                    <span>Progress</span>
                    <span>${curr.progress || 0}%</span>
                </div>
                <div class="lesson-progress">
                    <div class="lesson-progress-bar" style="width: ${curr.progress || 0}%;"></div>
                </div>
            </div>
        </div>
    `).join('');
}

// js/student-curriculum.js

document.addEventListener('DOMContentLoaded', () => {
    Auth.requireStudent();
    
    const params = new URLSearchParams(window.location.search);
    const curriculumId = params.get('id');
    
    if(!curriculumId) {
        UI.showToast('Invalid curriculum ID', 'error');
        setTimeout(() => window.location.href = 'student-dashboard.html', 1500);
        return;
    }
    
    loadLessons(curriculumId);
});

async function loadLessons(curriculumId) {
    try {
        UI.showLoading();
        
        const data = await API.call('getLessons', { curriculum_id: curriculumId });
        
        if(data.curriculumName) {
            document.getElementById('curriculumName').textContent = data.curriculumName;
            document.getElementById('curriculumDesc').textContent = data.description || data.curriculumDescription || '';
        }
        
        renderLessons(data.lessons || []);
        
    } catch (error) {
        UI.showToast(error.message || 'Failed to load lessons', 'error');
        const list = document.getElementById('lessonsList');
        if (list) {
            UI.renderErrorState(list, error.message, () => loadLessons(curriculumId));
        }
    } finally {
        UI.hideLoading();
    }
}

function renderLessons(lessons) {
    const list = document.getElementById('lessonsList');
    if (!list) return;
    
    if(lessons.length === 0) {
        UI.renderEmptyState(list, 'No lessons available in this curriculum yet.', '📖');
        return;
    }
    
    list.innerHTML = lessons.map(lesson => {
        const progress = Math.min(100, Math.max(0, Math.round(lesson.progress || 0)));
        const isCheat = lesson.cheatingStatus === 'CHEATING';
        
        return `
        <div class="lesson-card" data-id="${UI.escapeHTML(lesson.lesson_id)}" style="cursor: pointer;">
            <div class="lesson-info">
                <h3>${UI.escapeHTML(lesson.title || 'Lesson')}</h3>
                <div class="lesson-meta">
                    <span>${Number(lesson.totalTasks) || 0} Tasks</span>
                    ${lesson.filesCount ? `<span>📄 ${lesson.filesCount} Files</span>` : ''}
                    ${isCheat 
                        ? `<span style="color: #DC2626; font-weight: bold; background: #FEE2E2; padding: 2px 6px; border-radius: 4px;">🚫 CHEATING</span>` 
                        : `<span>${UI.escapeHTML(lesson.status || 'Available')}</span>`}
                    ${lesson.deadline ? `<span>⏰ ${new Date(lesson.deadline).toLocaleDateString()}</span>` : ''}
                </div>
            </div>
            
            <div style="text-align: right;">
                <div style="font-size: 0.8rem; margin-bottom: 0.25rem;">${progress}% Completed</div>
                <div class="lesson-progress">
                    <div class="lesson-progress-bar" style="width: ${progress}%;"></div>
                </div>
            </div>
        </div>
    `}).join('');

    list.querySelectorAll('.lesson-card').forEach(card => {
        card.onclick = () => {
            const id = card.getAttribute('data-id');
            if (id) window.location.href = `student-lesson.html?id=${encodeURIComponent(id)}`;
        };
    });
}

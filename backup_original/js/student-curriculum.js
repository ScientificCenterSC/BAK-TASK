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
            document.getElementById('curriculumDesc').textContent = '';
        }
        
        renderLessons(data.lessons || []);
        
    } catch (error) {
        UI.showToast(error.message || 'Failed to load lessons', 'error');
    } finally {
        UI.hideLoading();
    }
}

function renderLessons(lessons) {
    const list = document.getElementById('lessonsList');
    
    if(lessons.length === 0) {
        list.innerHTML = `<p class="text-muted">No lessons available in this curriculum yet.</p>`;
        return;
    }
    
    list.innerHTML = lessons.map(lesson => {
        const progress = lesson.progress || 0;
        
        return `
        <div class="lesson-card" onclick="window.location.href='student-lesson.html?id=${lesson.lesson_id}'">
            <div class="lesson-info">
                <h3>${lesson.title}</h3>
                <div class="lesson-meta">
                    <span>${lesson.totalTasks || 0} Tasks</span>
                    ${lesson.filesCount ? `<span>📄 ${lesson.filesCount} Files</span>` : ''}
                    ${lesson.cheatingStatus === 'CHEATING' 
                        ? `<span style="color: #DC2626; font-weight: bold; background: #FEE2E2; padding: 2px 6px; border-radius: 4px;">🚫 CHEATING</span>` 
                        : `<span>${lesson.status || 'Available'}</span>`}
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
}

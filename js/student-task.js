let currentTask = null;
let taskStartTime = 0;
let antiCheatActive = false;
let lessonIdForCheat = null;
let countdownInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    const session = Auth.requireStudent();
    if(!session) return;
    
    document.getElementById('backBtn').addEventListener('click', () => {
        if(currentTask && currentTask.lesson_id) {
            window.location.href = `student-lesson.html?id=${currentTask.lesson_id}`;
        } else {
            window.location.href = 'student-dashboard.html';
        }
    });
    
    document.getElementById('submitBtn').addEventListener('click', submitTask);
    
    const urlParams = new URLSearchParams(window.location.search);
    const taskId = urlParams.get('id');
    
    if(!taskId) {
        document.getElementById('loadingState').textContent = 'Invalid Task ID';
        return;
    }
    
    await loadTaskDetail(taskId);
});

async function loadTaskDetail(taskId) {
    try {
        UI.showLoading();
        const data = await API.call('getTaskDetail', { task_id: taskId });
        currentTask = data;
        
        taskStartTime = Date.now();
        renderTask();
        
        if (!data.isCompleted && !data.isExpired && data.lesson_id) {
            activateAntiCheat(data.lesson_id);
        }
        
    } catch (error) {
        document.getElementById('loadingState').textContent = 'Error loading task: ' + error.message;
        UI.showToast(error.message, 'error');
    } finally {
        UI.hideLoading();
    }
}

function activateAntiCheat(lessonId) {
    antiCheatActive = true;
    lessonIdForCheat = lessonId;
    document.addEventListener('visibilitychange', handleCheat);
    window.addEventListener('blur', handleCheat);
}

async function handleCheat() {
    if (!antiCheatActive) return;
    antiCheatActive = false; 
    document.removeEventListener('visibilitychange', handleCheat);
    window.removeEventListener('blur', handleCheat);
    
    const eventType = document.hidden ? 'tab_switch' : 'window_blur';
    try {
        await API.call('reportCheating', {
            lesson_id: lessonIdForCheat,
            task_id: currentTask.task_id,
            event_type: eventType,
            details: 'Tab switched or window lost focus during task'
        });
        UI.showModal('Warning', '<p class="text-danger">You have navigated away from the task window. This has been recorded as a violation and the task is now locked.</p>', [
            { label: 'Back to Lesson', class: 'btn-primary', onClick: () => window.location.href = `student-lesson.html?id=${lessonIdForCheat}` }
        ]);
        document.getElementById('taskContent').style.display = 'none';
    } catch(e) {
        console.error('Failed to report cheating', e);
    }
}

function renderTask() {
    if(!currentTask) return;
    
    document.getElementById('loadingState').style.display = 'none';
    const contentArea = document.getElementById('taskContent');
    const resultArea = document.getElementById('resultArea');
    
    document.getElementById('taskPointsDisplay').textContent = `${currentTask.points || 0} pts`;
    if(currentTask.deadline) {
        const dlSpan = document.createElement('span');
        dlSpan.className = 'badge badge-warning';
        dlSpan.style.marginLeft = '1rem';
        dlSpan.textContent = `Deadline: ${new Date(currentTask.deadline).toLocaleString()}`;
        document.getElementById('taskPointsDisplay').parentNode.appendChild(dlSpan);
    }
    // Start countdown timer if task has deadline and is not completed/expired
    if(currentTask.deadline && !currentTask.isCompleted && !currentTask.isExpired && currentTask.status !== 'locked') {
        startCountdown(new Date(currentTask.deadline));
    }
    document.getElementById('questionText').textContent = currentTask.title || currentTask.question;
    
    const answerArea = document.getElementById('answerArea');
    const submitBtn = document.getElementById('submitBtn');
    
    // Check if task is already completed
    if(currentTask.isCompleted || currentTask.studentAnswer) {
        contentArea.style.display = 'block';
        submitBtn.style.display = 'none';
        renderInputs(answerArea, currentTask.type, currentTask.options, currentTask.studentAnswer, true);
        showResult(currentTask);
        return;
    }
    
    // Check if task is expired or locked
    if(currentTask.isExpired || currentTask.status === 'locked') {
        contentArea.style.display = 'block';
        submitBtn.style.display = 'none';
        answerArea.innerHTML = `<div class="card"><p class="text-danger">This task is expired/locked and cannot be submitted.</p></div>`;
        return;
    }
    
    // Active task
    contentArea.style.display = 'block';
    renderInputs(answerArea, currentTask.type, currentTask.options, null, false);
}

function renderInputs(container, type, options, studentAnswer, disabled) {
    if (type === 'quiz') {
        let questions = [];
        try { questions = typeof options === 'string' ? JSON.parse(options) : options; } catch(e) {}
        
        let parsedAnswer = {};
        if (studentAnswer) {
            try { parsedAnswer = typeof studentAnswer === 'string' ? JSON.parse(studentAnswer) : studentAnswer; } catch(e){}
        }

        let html = '<div class="quiz-container">';
        questions.forEach((q, idx) => {
            html += `<div class="card" style="margin-bottom: 1rem;">`;
            html += `<h4>${q.title || ''}</h4>`;
            
            // Bilingual question
            let qText = q.question;
            if (typeof q.question === 'object') {
                qText = `<div style="text-align: right; direction: rtl; margin-bottom: 0.5rem; font-size: 1.1rem; font-weight: bold;">${idx + 1}. ${q.question.ar}</div>
                         <div style="text-align: left; direction: ltr; margin-bottom: 1rem; font-size: 1.1rem; color: #555;">${idx + 1}. ${q.question.en}</div>`;
            } else {
                qText = `<p style="font-size: 1.1rem; font-weight: 500; margin-bottom:1rem;">${idx + 1}. ${q.question}</p>`;
            }
            html += qText;
            
            const qType = q.type || 'multiple_choice';
            const qAns = parsedAnswer['q' + idx] || '';
            const qOpts = q.options ? (typeof q.options==='string'?JSON.parse(q.options):q.options) : [];
            const qDisabled = disabled ? 'disabled' : '';
            
            if (qType === 'multiple_choice' || qType === 'mcq' || qType === 'true_false') {
                html += '<div class="task-options">';
                qOpts.forEach(opt => {
                    let optValue = opt;
                    let optAr = opt;
                    let optEn = '';
                    
                    if (typeof opt === 'object') {
                        optValue = opt.value;
                        optAr = opt.ar;
                        optEn = opt.en;
                    }
                    
                    const isChecked = qAns === optValue ? 'checked' : '';
                    const selectedClass = isChecked ? 'selected' : '';
                    let optClass = selectedClass;
                    
                    let optDisplay = optAr;
                    if (optEn) {
                        optDisplay = `<div style="display:flex; flex-direction:column; width:100%;">
                                        <span style="text-align:right; direction:rtl; font-weight:bold;">${optAr}</span>
                                        <span style="text-align:left; direction:ltr; font-size:0.9em; color:#666;">${optEn}</span>
                                      </div>`;
                    }
                    
                    let icon = '';
                    if (disabled && q.correct_answer !== undefined) {
                        if (optValue === q.correct_answer) {
                            optClass += ' correct-option';
                            icon = '<span style="color: green; font-weight: bold; margin-right: 5px;">✅</span>';
                        } else if (isChecked && optValue !== q.correct_answer) {
                            optClass += ' incorrect-option';
                            icon = '<span style="color: red; font-weight: bold; margin-right: 5px;">❌</span>';
                        }
                    }

                    html += `
                        <label class="task-option ${optClass}" style="align-items: flex-start;">
                            ${icon}
                            <input type="radio" name="q${idx}_answer" value="${optValue}" data-idx="${idx}" ${isChecked} ${qDisabled} style="margin-top: 0.5rem;">
                            <span style="flex:1;">${optDisplay}</span>
                        </label>
                    `;
                });
                html += '</div>';
            } else {
                html += `<textarea name="q${idx}_answer" class="form-control" data-idx="${idx}" rows="2" style="width:100%" placeholder="Type your answer here..." ${qDisabled}>${qAns}</textarea>`;
                if (disabled && q.correct_answer) {
                    html += `
                        <div style="margin-top: 0.5rem; padding: 0.5rem; background: #e6ffed; border-left: 3px solid #28a745; font-size: 0.95rem;">
                            <strong style="color: #28a745;">Correct Answer:</strong> ${q.correct_answer}
                        </div>
                    `;
                }
            }
            html += `</div>`;
        });
        html += '</div>';
        container.innerHTML = html;
        
        if(!disabled) {
            const radioLabels = container.querySelectorAll('.task-option');
            radioLabels.forEach(label => {
                const radio = label.querySelector('input[type="radio"]');
                radio.addEventListener('change', () => {
                    const name = radio.getAttribute('name');
                    container.querySelectorAll(`input[name="${name}"]`).forEach(r => {
                        r.closest('.task-option').classList.remove('selected');
                    });
                    if(radio.checked) label.classList.add('selected');
                });
            });
        }
    } 
    else if(type === 'multiple_choice' || type === 'mcq' || type === 'true_false') {
        let html = '<div class="task-options">';
        let opts = [];
        if(typeof options === 'string') {
            try { opts = JSON.parse(options); } catch(e) { opts = options.split(','); }
        } else if (Array.isArray(options)) {
            opts = options;
        }
        
        opts.forEach((opt, index) => {
            let optValue = opt;
            let optAr = opt;
            let optEn = '';
            
            if (typeof opt === 'object') {
                optValue = opt.value;
                optAr = opt.ar;
                optEn = opt.en;
            }
            
            const isChecked = studentAnswer === optValue ? 'checked' : '';
            const isDisabled = disabled ? 'disabled' : '';
            const selectedClass = isChecked ? 'selected' : '';
            
            let optDisplay = optAr;
            if (optEn) {
                optDisplay = `<div style="display:flex; flex-direction:column; width:100%;">
                                <span style="text-align:right; direction:rtl; font-weight:bold;">${optAr}</span>
                                <span style="text-align:left; direction:ltr; font-size:0.9em; color:#666;">${optEn}</span>
                              </div>`;
            }
            
            let optClass = selectedClass;
            let icon = '';
            if (disabled && currentTask.correctAnswer) {
                if (optValue === currentTask.correctAnswer) {
                    optClass += ' correct-option';
                    icon = '<span style="color: green; font-weight: bold; margin-right: 5px;">✅</span>';
                } else if (isChecked && optValue !== currentTask.correctAnswer) {
                    optClass += ' incorrect-option';
                    icon = '<span style="color: red; font-weight: bold; margin-right: 5px;">❌</span>';
                }
            }
            html += `
                <label class="task-option ${optClass}" style="align-items: flex-start;">
                    ${icon}
                    <input type="radio" name="task_answer" value="${optValue}" ${isChecked} ${isDisabled} style="margin-top: 0.5rem;">
                    <span style="flex:1;">${optDisplay}</span>
                </label>
            `;
        });
        html += '</div>';
        container.innerHTML = html;
        
        if(!disabled) {
            const radioLabels = container.querySelectorAll('.task-option');
            radioLabels.forEach(label => {
                const radio = label.querySelector('input[type="radio"]');
                radio.addEventListener('change', () => {
                    container.querySelectorAll('.task-option').forEach(l => l.classList.remove('selected'));
                    if(radio.checked) label.classList.add('selected');
                });
            });
        }
    } else {
        container.innerHTML = `<textarea id="task_answer_text" class="form-control" rows="4" style="width:100%" placeholder="Type your answer here..." ${disabled ? 'disabled' : ''}>${studentAnswer || ''}</textarea>`;
        if (disabled && currentTask.correctAnswer) {
            container.innerHTML += `
                <div style="margin-top: 1rem; padding: 1rem; background: #e6ffed; border-left: 4px solid #28a745; border-radius: 4px;">
                    <strong style="color: #28a745;">Correct Answer:</strong>
                    <p style="margin: 0.5rem 0 0 0; color: #333;">${currentTask.correctAnswer}</p>
                </div>
            `;
        }
    }
}

function showResult(data) {
    const resultArea = document.getElementById('resultArea');
    resultArea.style.display = 'block';
    
    const isCorrect = String(data.isCorrect) === 'true' || data.isCorrect === true;
    
    let icon = isCorrect ? '✅' : '❌';
    if (data.type === 'quiz') {
        icon = (data.score === data.maxScore) ? '✅' : (data.score > 0 ? '⚠️' : '❌');
    }
    let title = isCorrect ? 'Correct!' : 'Incorrect';
    if (data.type === 'quiz') title = 'Quiz Submitted!';
    
    resultArea.innerHTML = `
        <div style="font-size: 3rem; margin-bottom: 1rem;">${icon}</div>
        <h3 style="margin-top: 0;">${title}</h3>
        ${data.latePenalty > 0 ? `
            <div style="background: rgba(255, 0, 0, 0.1); border-left: 4px solid red; padding: 1rem; margin-bottom: 1rem; text-align: left;">
                <p style="margin: 0; color: red;"><strong>⚠️ A ${data.latePenalty}-point late penalty was applied because this task was completed after the original deadline.</strong></p>
                <ul style="margin: 0.5rem 0 0 0; color: #555;">
                    <li>Original Score: ${data.originalScore} / ${data.maxScore || currentTask.points || 0}</li>
                    <li>Late Penalty: -${data.latePenalty}</li>
                    <li>Final Score: <strong>${data.score || 0} / ${data.maxScore || currentTask.points || 0}</strong></li>
                </ul>
            </div>
        ` : `
            <p style="font-size: 1.2rem; margin-bottom: 0.5rem;">Score: <strong>${data.score || 0} / ${data.maxScore || currentTask.points || 0}</strong></p>
        `}
        ${data.explanation ? `<div style="margin-top: 1rem; padding: 1rem; background: rgba(0,0,0,0.05); border-radius: 8px;"><strong>Explanation:</strong><br>${data.explanation}</div>` : ''}
        <button id="downloadPdfBtn" class="btn btn-primary" style="margin-top: 1rem;">⬇ Download PDF</button>
    `;
    
    if (isCorrect || data.type === 'quiz') {
        resultArea.classList.add('correct');
        resultArea.classList.remove('incorrect');
    } else {
        resultArea.classList.add('incorrect');
        resultArea.classList.remove('correct');
    }

    document.getElementById('downloadPdfBtn').addEventListener('click', () => {
        const element = document.getElementById('taskContent');
        const opt = {
            margin: 10,
            filename: `Task_Result_${currentTask.task_id}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save();
    });
}

function startCountdown(deadline) {
    var timerEl = document.getElementById('countdownTimer');
    var displayEl = document.getElementById('countdownDisplay');
    if(!timerEl || !displayEl) return;
    
    timerEl.style.display = 'block';
    
    function updateCountdown() {
        var now = new Date().getTime();
        var distance = deadline.getTime() - now;
        
        if(distance <= 0) {
            clearInterval(countdownInterval);
            displayEl.textContent = '00 Days : 00 Hours : 00 Minutes : 00 Seconds';
            displayEl.style.color = 'var(--danger)';
            // Handle time expiry - disable submit and show message
            var submitBtn = document.getElementById('submitBtn');
            if(submitBtn) submitBtn.style.display = 'none';
            var answerArea = document.getElementById('answerArea');
            if(answerArea && !currentTask.isCompleted) {
                answerArea.innerHTML = '<div class="card"><p class="text-danger" style="color:var(--danger);">⏰ Time has expired for this task.</p></div>';
            }
            return;
        }
        
        var days = Math.floor(distance / (1000 * 60 * 60 * 24));
        var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        var seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        var pad = function(n) { return n.toString().padStart(2, '0'); };
        displayEl.textContent = pad(days) + ' Days : ' + pad(hours) + ' Hours : ' + pad(minutes) + ' Minutes : ' + pad(seconds) + ' Seconds';
        
        // Change color when less than 1 hour
        if(distance < 3600000) {
            displayEl.style.color = 'var(--danger)';
        } else if(distance < 86400000) {
            displayEl.style.color = 'var(--warning)';
        } else {
            displayEl.style.color = 'var(--success)';
        }
    }
    
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
}

async function submitTask() {
    let answer = null;
    
    if (currentTask.type === 'quiz') {
        answer = {};
        const container = document.getElementById('answerArea');
        const textareas = container.querySelectorAll('textarea');
        textareas.forEach(t => { answer['q' + t.dataset.idx] = t.value; });
        
        const radios = container.querySelectorAll('input[type="radio"]:checked');
        radios.forEach(r => { answer['q' + r.dataset.idx] = r.value; });
        
        answer = JSON.stringify(answer);
    } else if(currentTask.type === 'multiple_choice' || currentTask.type === 'mcq') {
        const selected = document.querySelector('input[name="task_answer"]:checked');
        if(!selected) {
            UI.showToast('Please select an answer', 'warning');
            return;
        }
        answer = selected.value;
    } else {
        answer = document.getElementById('task_answer_text').value.trim();
        if(!answer) {
            UI.showToast('Please type an answer', 'warning');
            return;
        }
    }
    
    // Calculate time spent in seconds
    const timeSpent = Math.floor((Date.now() - taskStartTime) / 1000);
    
    try {
        UI.showLoading();
        
        if(antiCheatActive) {
            antiCheatActive = false; // Turn off listeners while submitting
            document.removeEventListener('visibilitychange', handleCheat);
            window.removeEventListener('blur', handleCheat);
        }
        
        const res = await API.call('submitAnswer', {
            task_id: currentTask.task_id,
            answer: answer,
            time_spent: timeSpent
        });
        
        document.getElementById('submitBtn').style.display = 'none';
        
        // update local task state to show disabled inputs properly
        currentTask.isCompleted = true;
        currentTask.studentAnswer = answer;
        renderInputs(document.getElementById('answerArea'), currentTask.type, currentTask.options, currentTask.studentAnswer, true);
        
        showResult(res);
        UI.showToast('Answer submitted successfully!', 'success');
        
    } catch (err) {
        UI.showToast(err.message, 'error');
        // Reactivate anti cheat if submission failed and it wasn't a cheating error
        if(!err.message.includes('CHEATING_BLOCKED')) {
            activateAntiCheat(currentTask.lesson_id);
        }
    } finally {
        UI.hideLoading();
    }
}

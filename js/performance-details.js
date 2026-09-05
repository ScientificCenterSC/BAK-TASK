var PerformanceDetails = {
    viewStudentPerformance: async function(studentId, curriculumId, lessonId, studentName, taskId = null) {
        UI.showLoading();
        try {
            const payload = { student_id: studentId };
            const res = await API.call('getStudentAnswers', payload);
            
            let answers = res.answers || [];
            
            // Filter
            if (curriculumId) answers = answers.filter(a => a.curriculum === curriculumId || a.curriculum_id === curriculumId);
            if (lessonId) answers = answers.filter(a => a.lesson === lessonId || a.lesson_id === lessonId);
            if (taskId) answers = answers.filter(a => a.task_id === taskId);
            
            console.log("=== DEBUGGING INFO ===");
            console.log("Selected Student ID:", studentId);
            console.log("Selected Curriculum ID:", curriculumId);
            console.log("Selected Lesson ID:", lessonId);
            console.log("Selected Task ID:", taskId);
            console.log("Submission Records Found:", answers.length);
            console.log("Student Answers (parsed from records):", answers);
            console.log("======================");
            
            const html = PerformanceDetails.buildPerformanceHTML(studentName, answers);
            
            UI.showModal('Performance Details - ' + studentName, html, [
                { label: 'Download PDF', class: 'btn-primary', onClick: function() { PerformanceDetails.downloadPDF(studentName, answers); } },
                { label: 'Close', class: 'btn-secondary', onClick: function() { UI.closeModal(); } }
            ]);
            
            // Fix modal style for large content
            var modalBody = document.querySelector('.modal-body');
            if(modalBody) {
                modalBody.style.maxHeight = '70vh';
                modalBody.style.overflowY = 'auto';
                modalBody.style.padding = '1.5rem';
            }
            var modal = document.querySelector('.modal');
            if(modal) {
                modal.style.maxWidth = '850px';
                modal.style.width = '95%';
            }
        } catch(e) {
            UI.showToast(e.message, 'error');
        } finally {
            UI.hideLoading();
        }
    },
    
    buildPerformanceHTML: function(studentName, answers) {
        if(answers.length === 0) {
            return '<div class="empty-state" style="text-align:center; padding:3rem; font-size:1.2rem; color:var(--text-muted);">Not Attempted Yet / لم يتم حل هذه المهمة بعد</div>';
        }
        
        // Calculate overall stats
        var totalScore = 0, totalMax = 0, totalCorrect = 0, totalWrong = 0;
        answers.forEach(function(ans) {
            totalScore += (ans.score || 0);
            totalMax += (ans.maxScore || 0);
            if(ans.isCorrect) totalCorrect++; else totalWrong++;
        });
        
        var html = '<div style="font-family: sans-serif;">';
        html += '<h2 style="margin-bottom: 0.5rem; text-align: center; color: var(--text-main);">Performance Report: ' + studentName + '</h2>';
        
        // Overall summary
        html += '<div style="display:flex; gap:1rem; flex-wrap:wrap; margin-bottom:1.5rem; justify-content:center;">';
        html += '<div style="padding:0.75rem 1.25rem; border-radius:8px; background:rgba(99,102,241,0.1); border:1px solid rgba(99,102,241,0.3); text-align:center;"><strong style="color:var(--primary-light);">Overall Score</strong><br><span style="font-size:1.3rem; font-weight:700; color:var(--text-main);">' + totalScore + ' / ' + totalMax + '</span></div>';
        html += '<div style="padding:0.75rem 1.25rem; border-radius:8px; background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.3); text-align:center;"><strong style="color:var(--success);">Correct</strong><br><span style="font-size:1.3rem; font-weight:700; color:var(--success);">' + totalCorrect + '</span></div>';
        html += '<div style="padding:0.75rem 1.25rem; border-radius:8px; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); text-align:center;"><strong style="color:var(--danger);">Wrong</strong><br><span style="font-size:1.3rem; font-weight:700; color:var(--danger);">' + totalWrong + '</span></div>';
        html += '</div>';
        
        // Render each task independently
        answers.forEach(function(ans, taskIdx) {
            var borderColor = ans.isCorrect ? 'var(--success)' : (ans.score > 0 ? 'var(--warning)' : 'var(--danger)');
            
            html += '<div style="margin-bottom: 2rem; background: var(--card-bg); border-radius: 12px; border-left: 6px solid ' + borderColor + '; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">';
            html += '<div style="display: flex; justify-content: space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding-bottom: 0.75rem; margin-bottom: 1rem;">';
            html += '<div>';
            html += '<h3 style="margin: 0 0 0.25rem 0; color: var(--primary-light); font-size:1.2rem;">' + (ans.taskTitle || 'Task ' + (taskIdx + 1)) + '</h3>';
            html += '<div style="font-size:0.85rem; color:var(--text-muted);">ID: ' + ans.task_id + ' | Date: ' + new Date(ans.submittedAt).toLocaleString() + '</div>';
            html += '</div>';
            html += '<strong style="color: var(--text-main); font-size:1.1rem; padding:0.5rem 1rem; background:rgba(0,0,0,0.1); border-radius:8px;">Score: ' + (ans.score || 0) + ' / ' + (ans.maxScore || 0) + '</strong>';
            html += '</div>';
            
            if (ans.type === 'quiz') {
                var questions = [];
                try { questions = typeof ans.options === 'string' ? JSON.parse(ans.options) : (ans.options || []); } catch(e) {}
                var studentAnswers = {};
                try { studentAnswers = typeof ans.studentAnswer === 'string' ? JSON.parse(ans.studentAnswer) : (ans.studentAnswer || {}); } catch(e) {}
                var correctAnswers = {};
                try { correctAnswers = typeof ans.correctAnswer === 'string' ? JSON.parse(ans.correctAnswer) : (ans.correctAnswer || {}); } catch(e) {}
                
                if(questions.length === 0) {
                    html += '<p style="color:var(--text-muted);">No questions data available for this task.</p>';
                } else {
                    questions.forEach(function(q, idx) {
                        var sAns = studentAnswers['q' + idx];
                        var hasAnswered = sAns !== undefined && sAns !== null && String(sAns).trim() !== '';
                        var cAns = correctAnswers['q' + idx] || q.correct_answer || '';
                        
                        var isQCorrect = false;
                        if(hasAnswered) {
                            isQCorrect = String(sAns).trim() === String(cAns).trim();
                        }
                        
                        var qText = q.question;
                        if (typeof q.question === 'object') {
                            qText = '<div style="text-align: right; direction: rtl; font-weight:600;">' + q.question.ar + '</div><div style="font-size: 0.9em; color: var(--text-muted); margin-top:0.25rem;">' + q.question.en + '</div>';
                        }
                        
                        // Frame Color Logic
                        var frameBg = 'rgba(0,0,0,0.15)';
                        var frameBorder = '1px solid var(--border-color)';
                        if (!hasAnswered) {
                            frameBg = 'rgba(107, 114, 128, 0.1)';
                            frameBorder = '2px dashed #9CA3AF';
                        } else if (isQCorrect) {
                            frameBg = 'rgba(16, 185, 129, 0.1)';
                            frameBorder = '2px solid #10B981';
                        } else {
                            frameBg = 'rgba(239, 68, 68, 0.1)';
                            frameBorder = '2px solid #EF4444';
                        }
                        
                        html += '<div style="margin-bottom: 1.25rem; background: ' + frameBg + '; border: ' + frameBorder + '; padding: 1rem; border-radius: 8px;">';
                        
                        // Question Header
                        html += '<div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 1rem;">';
                        html += '<div style="font-weight: 600; color: var(--text-main); font-size:1rem; flex:1;">Q' + (idx + 1) + ': ' + qText + '</div>';
                        
                        // Status Badge
                        if(!hasAnswered) {
                            html += '<span style="padding:0.25rem 0.75rem; background:#6B7280; color:white; border-radius:99px; font-size:0.8rem; font-weight:bold; white-space:nowrap;">Not Answered</span>';
                        } else if(isQCorrect) {
                            html += '<span style="padding:0.25rem 0.75rem; background:#10B981; color:white; border-radius:99px; font-size:0.8rem; font-weight:bold; white-space:nowrap;">\u2713 Correct</span>';
                        } else {
                            html += '<span style="padding:0.25rem 0.75rem; background:#EF4444; color:white; border-radius:99px; font-size:0.8rem; font-weight:bold; white-space:nowrap;">\u2717 Wrong</span>';
                        }
                        html += '</div>';
                        
                        var qOpts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];
                        html += '<div style="display: flex; flex-direction: column; gap: 0.5rem;">';
                        
                        // Show all options
                        qOpts.forEach(function(opt) {
                            var optValue = typeof opt === 'object' ? opt.value : opt;
                            var optDisplay = typeof opt === 'object' ? '<span style="font-weight:600;">' + opt.ar + '</span>' + (opt.en ? ' <span style="color:var(--text-muted); font-size:0.85em;">(' + opt.en + ')</span>' : '') : opt;
                            
                            var optBgStyle = 'background: rgba(0,0,0,0.1); color: var(--text-main); border: 1px solid var(--border-color);';
                            var marker = '';
                            
                            var isStudentChoice = hasAnswered && String(optValue) === String(sAns);
                            var isCorrectChoice = String(optValue) === String(cAns);
                            
                            if (isCorrectChoice && isStudentChoice) {
                                optBgStyle = 'background: rgba(16, 185, 129, 0.25); border: 2px solid #10B981; color: #10B981;';
                                marker = '<strong style="color:#10B981;">\u2713 Student Answer (Correct)</strong>';
                            } else if (isStudentChoice && !isCorrectChoice) {
                                optBgStyle = 'background: rgba(239, 68, 68, 0.25); border: 2px solid #EF4444; color: #EF4444;';
                                marker = '<strong style="color:#EF4444;">\u2717 Student Answer (Wrong)</strong>';
                            } else if (isCorrectChoice && !isStudentChoice) {
                                optBgStyle = 'background: rgba(16, 185, 129, 0.1); border: 2px dashed #10B981; color: #10B981;';
                                marker = '<strong style="color:#10B981;">\u2713 Correct Answer</strong>';
                            }
                            
                            html += '<div style="' + optBgStyle + ' padding: 0.75rem 1rem; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">';
                            html += '<div style="flex:1;">' + optDisplay + '</div>';
                            if(marker) html += '<div style="margin-left: 1rem; white-space:nowrap; font-size:0.9rem;">' + marker + '</div>';
                            html += '</div>';
                        });
                        html += '</div>';
                        
                        html += '<div style="margin-top:0.75rem; font-size:0.85rem; font-weight:600; color:var(--text-muted); text-align:right;">Points: ' + (isQCorrect ? (q.points || 10) : 0) + ' / ' + (q.points || 10) + '</div>';
                        html += '</div>';
                    });
                }
            } else {
                var resColor = ans.isCorrect ? '#10B981' : '#EF4444';
                var resBg = ans.isCorrect ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)';
                var resBorder = ans.isCorrect ? '2px solid #10B981' : '2px solid #EF4444';
                
                html += '<div style="margin-bottom: 1rem; padding:1rem; border-radius:8px; background:'+resBg+'; border:'+resBorder+';">';
                html += '<div style="font-weight: 600; margin-bottom: 0.75rem; color: var(--text-main); font-size:1.1rem;">Question: ' + (ans.question || ans.taskTitle || '') + '</div>';
                
                html += '<div style="display: flex; gap: 1rem; flex-wrap: wrap; margin-top:1rem;">';
                
                html += '<div style="flex:1; min-width: 250px; padding: 1rem; border-radius: 8px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color);">';
                html += '<strong style="color: ' + resColor + '; display:block; margin-bottom: 0.5rem; font-size:0.9rem; text-transform:uppercase;">Student Answer</strong>';
                html += '<pre style="white-space: pre-wrap; font-family: inherit; color: var(--text-main); margin:0;">' + (ans.studentAnswer || '<span style="color:var(--text-muted);font-style:italic;">Not answered</span>') + '</pre>';
                html += '</div>';
                
                html += '<div style="flex:1; min-width: 250px; padding: 1rem; border-radius: 8px; background: rgba(0,0,0,0.2); border: 1px solid var(--border-color);">';
                html += '<strong style="color: #10B981; display:block; margin-bottom: 0.5rem; font-size:0.9rem; text-transform:uppercase;">Correct Answer</strong>';
                html += '<pre style="white-space: pre-wrap; font-family: inherit; color: var(--text-main); margin:0;">' + (ans.correctAnswer || '<span style="color:var(--text-muted);font-style:italic;">Not provided</span>') + '</pre>';
                html += '</div>';
                
                html += '</div></div>';
            }
            
            html += '</div>';
        });
        
        html += '</div>';
        return html;
    },
    
    downloadPDF: function(studentName, answers) {
        if (!window.html2pdf) {
            UI.showLoading('Loading PDF library...');
            var script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
            script.onload = function() {
                UI.hideLoading();
                PerformanceDetails._generatePDF(studentName, answers);
            };
            script.onerror = function() {
                UI.hideLoading();
                UI.showToast('Failed to load PDF library', 'error');
            };
            document.head.appendChild(script);
        } else {
            PerformanceDetails._generatePDF(studentName, answers);
        }
    },
    
    _generatePDF: function(studentName, answers) {
        UI.showLoading('Generating PDF...');
        
        var htmlContent = PerformanceDetails._buildPDFHTML(studentName, answers);
        
        var container = document.createElement('div');
        container.innerHTML = htmlContent;
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        container.style.width = '800px';
        container.style.zIndex = '-9999';
        container.style.backgroundColor = '#FFFFFF';
        container.style.padding = '20px';
        
        document.body.appendChild(container);
        
        var opt = {
            margin: 10,
            filename: 'Performance_Report_' + studentName.replace(/\s+/g, '_') + '.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, windowWidth: 800, backgroundColor: '#FFFFFF' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Important: Wait for DOM to render completely before passing to html2pdf
        setTimeout(function() {
            html2pdf().set(opt).from(container).save().then(function() {
                document.body.removeChild(container);
                UI.hideLoading();
                UI.showToast('PDF downloaded successfully', 'success');
            }).catch(function(err) {
                document.body.removeChild(container);
                UI.hideLoading();
                UI.showToast('Failed to generate PDF', 'error');
            });
        }, 1000);
    },
    
    _buildPDFHTML: function(studentName, answers) {
        if(answers.length === 0) return '<div style="padding:40px;text-align:center;font-family:sans-serif;color:#6B7280;">No data to export.</div>';
        
        var now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        
        var totalScore = 0, totalMax = 0, totalCorrect = 0, totalWrong = 0;
        answers.forEach(function(ans) {
            totalScore += (ans.score || 0);
            totalMax += (ans.maxScore || 0);
            if(ans.isCorrect) totalCorrect++; else totalWrong++;
        });
        
        var html = '<div style="font-family:Segoe UI,Arial,sans-serif; color:#1E293B; max-width:750px;">';
        
        // Header
        html += '<div style="text-align:center; border-bottom:3px solid #4F46E5; padding-bottom:15px; margin-bottom:20px;">';
        html += '<h1 style="color:#4F46E5; margin:0; font-size:22px;">\ud83d\udcda Student Performance Report</h1>';
        html += '<p style="color:#6B7280; font-size:12px; margin:5px 0 0;">Generated: ' + now + '</p>';
        html += '</div>';
        
        // Student Info
        html += '<div style="background:#F8FAFC; border-radius:8px; padding:12px 16px; margin-bottom:20px; border:1px solid #E2E8F0;">';
        html += '<h3 style="margin:0 0 8px; font-size:16px; color:#4F46E5;">Student: ' + studentName + '</h3>';
        html += '<table style="width:100%; font-size:13px;"><tr>';
        html += '<td>Total Score: <strong style="color:#4F46E5;font-size:16px;">' + totalScore + '/' + totalMax + '</strong></td>';
        html += '<td>Correct: <strong style="color:#10B981;font-size:16px;">' + totalCorrect + '</strong></td>';
        html += '<td>Wrong: <strong style="color:#EF4444;font-size:16px;">' + totalWrong + '</strong></td>';
        html += '</tr></table></div>';
        
        // Each task
        answers.forEach(function(ans, taskIdx) {
            var taskBorder = ans.isCorrect ? '#10B981' : (ans.score > 0 ? '#F59E0B' : '#EF4444');
            html += '<div style="margin-bottom:20px; border-left:5px solid ' + taskBorder + '; padding:15px; background:#FAFAFA; border-radius:0 8px 8px 0; border-top:1px solid #E5E7EB; border-right:1px solid #E5E7EB; border-bottom:1px solid #E5E7EB;">';
            
            html += '<div style="display:flex; justify-content:space-between; border-bottom:1px solid #E5E7EB; padding-bottom:10px; margin-bottom:15px;">';
            html += '<div>';
            html += '<strong style="color:#1E293B; font-size:16px; display:block;">Task ' + (taskIdx + 1) + ': ' + (ans.taskTitle || 'Unknown') + '</strong>';
            html += '<span style="color:#6B7280; font-size:11px;">ID: ' + ans.task_id + ' | Date: ' + new Date(ans.submittedAt).toLocaleDateString() + '</span>';
            html += '</div>';
            html += '<strong style="font-size:14px; padding:4px 10px; background:#F1F5F9; border-radius:4px;">Score: ' + (ans.score || 0) + ' / ' + (ans.maxScore || 0) + '</strong>';
            html += '</div>';
            
            if (ans.type === 'quiz') {
                var questions = [];
                try { questions = typeof ans.options === 'string' ? JSON.parse(ans.options) : (ans.options || []); } catch(e) {}
                var studentAnswersObj = {};
                try { studentAnswersObj = typeof ans.studentAnswer === 'string' ? JSON.parse(ans.studentAnswer) : (ans.studentAnswer || {}); } catch(e) {}
                var correctAnswersObj = {};
                try { correctAnswersObj = typeof ans.correctAnswer === 'string' ? JSON.parse(ans.correctAnswer) : (ans.correctAnswer || {}); } catch(e) {}
                
                questions.forEach(function(q, idx) {
                    var sAns = studentAnswersObj['q' + idx];
                    var hasAnswered = sAns !== undefined && sAns !== null && String(sAns).trim() !== '';
                    var cAns = correctAnswersObj['q' + idx] || q.correct_answer || '';
                    var isQCorrect = hasAnswered && String(sAns).trim() === String(cAns).trim();
                    
                    var qText = typeof q.question === 'object' ? (q.question.ar + (q.question.en ? ' / ' + q.question.en : '')) : (q.question || '');
                    
                    var frameBg = '#FFFFFF';
                    var frameBorder = '#E5E7EB';
                    var badgeHtml = '';
                    
                    if (!hasAnswered) {
                        frameBg = '#F3F4F6'; frameBorder = '#9CA3AF';
                        badgeHtml = '<span style="color:#4B5563; font-weight:bold; font-size:10px;">NOT ANSWERED</span>';
                    } else if (isQCorrect) {
                        frameBg = '#F0FDF4'; frameBorder = '#10B981';
                        badgeHtml = '<span style="color:#059669; font-weight:bold; font-size:10px;">\u2713 CORRECT</span>';
                    } else {
                        frameBg = '#FEF2F2'; frameBorder = '#EF4444';
                        badgeHtml = '<span style="color:#DC2626; font-weight:bold; font-size:10px;">\u2717 WRONG</span>';
                    }
                    
                    html += '<div style="margin-bottom:12px; padding:10px; background:'+frameBg+'; border-radius:6px; border:2px solid '+frameBorder+'; page-break-inside:avoid;">';
                    html += '<div style="display:flex; justify-content:space-between; margin-bottom:8px;">';
                    html += '<div style="font-weight:600; font-size:13px; color:#1F2937;">Q' + (idx + 1) + ': ' + qText + '</div>';
                    html += '<div>' + badgeHtml + '</div>';
                    html += '</div>';
                    
                    var qOpts = q.options ? (typeof q.options === 'string' ? JSON.parse(q.options) : q.options) : [];
                    qOpts.forEach(function(opt) {
                        var optValue = typeof opt === 'object' ? opt.value : opt;
                        var optText = typeof opt === 'object' ? (opt.ar + (opt.en ? ' (' + opt.en + ')' : '')) : opt;
                        
                        var bgColor = '#F9FAFB';
                        var borderCol = '#E5E7EB';
                        var textCol = '#374151';
                        var marker = '';
                        
                        var isStudentChoice = hasAnswered && String(optValue) === String(sAns);
                        var isCorrectChoice = String(optValue) === String(cAns);
                        
                        if (isCorrectChoice && isStudentChoice) {
                            bgColor = '#D1FAE5'; borderCol = '#10B981'; textCol = '#065F46';
                            marker = ' \u2713 Student Answer (Correct)';
                        } else if (isStudentChoice && !isCorrectChoice) {
                            bgColor = '#FEE2E2'; borderCol = '#EF4444'; textCol = '#991B1B';
                            marker = ' \u2717 Student Answer';
                        } else if (isCorrectChoice && !isStudentChoice) {
                            bgColor = '#F3F4F6'; borderCol = '#10B981'; textCol = '#059669';
                            marker = ' \u2713 Correct Answer';
                        }
                        
                        html += '<div style="padding:5px 8px; margin:3px 0; border-radius:4px; font-size:12px; background:' + bgColor + '; border:1px solid ' + borderCol + '; color:' + textCol + ';">' + optText + '<strong style="float:right;">' + marker + '</strong></div>';
                    });
                    
                    html += '<div style="font-size:11px; color:#6B7280; margin-top:6px; text-align:right;">Points: ' + (isQCorrect ? (q.points || 10) : 0) + '/' + (q.points || 10) + '</div>';
                    html += '</div>';
                });
            } else {
                var resColor = ans.isCorrect ? '#10B981' : '#EF4444';
                var resBg = ans.isCorrect ? '#F0FDF4' : '#FEF2F2';
                html += '<div style="font-size:12px; padding:10px; background:'+resBg+'; border:2px solid '+resColor+'; border-radius:6px; page-break-inside:avoid;">';
                html += '<div style="margin-bottom:8px;"><strong style="font-size:14px; color:#1F2937;">Question:</strong> ' + (ans.question || ans.taskTitle || '') + '</div>';
                html += '<div style="padding:8px; background:#FFFFFF; border:1px solid #E5E7EB; border-radius:4px; margin-bottom:6px;"><strong style="color:' + resColor + ';">Student Answer:</strong><br>' + (ans.studentAnswer || '<span style="color:#9CA3AF;">Not answered</span>') + '</div>';
                html += '<div style="padding:8px; background:#FFFFFF; border:1px solid #E5E7EB; border-radius:4px;"><strong style="color:#10B981;">Correct Answer:</strong><br>' + (ans.correctAnswer || '<span style="color:#9CA3AF;">Not provided</span>') + '</div>';
                html += '</div>';
            }
            
            html += '</div>';
        });
        
        // Footer
        html += '<div style="text-align:center; margin-top:30px; padding-top:15px; border-top:2px solid #E5E7EB; color:#9CA3AF; font-size:11px;">';
        html += '<p>Student Learning Platform \u2014 Auto-generated Report</p>';
        html += '</div></div>';
        
        return html;
    }
};

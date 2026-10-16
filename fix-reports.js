const fs = require('fs');

let code = fs.readFileSync('js/admin-reports.js', 'utf8');

// The Arabic strings in JS were mangled in powershell, so I will write a Node script to replace the function using standard UTF-8.

let newFunc = `function buildPrintableDOM(groupName, students) {
    const container = document.getElementById('printableReport');
    if (!students || students.length === 0) {
        container.innerHTML = '<h2 style="text-align:center; margin-top:50px;">No students enrolled in this group.</h2>';
        return;
    }
    
    container.innerHTML = students.map(s => {
        let lessonsHtml = '';
        let totalLessonScore = 0;
        let totalLessonMax = 0;
        
        if (s.lessons && s.lessons.length > 0) {
            lessonsHtml = \`
                <div class="table-section">
                    <h3 class="section-title">أداء الدروس والمهام:</h3>
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th>الدرس</th>
                                <th>إجمالي الدرجات</th>
                                <th>النسبة</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${s.lessons.map(l => {
                                totalLessonScore += Number(l.total_score) || 0;
                                totalLessonMax += Number(l.total_max) || 0;
                                const percent = l.total_max > 0 ? Math.round((l.total_score / l.total_max)*100) : 0;
                                return \`
                                    <tr>
                                        <td>\${l.title}</td>
                                        <td>\${l.total_score} / \${l.total_max}</td>
                                        <td><span class="badge \${percent >= 85 ? 'badge-excellent' : (percent >= 70 ? 'badge-good' : (percent >= 50 ? 'badge-pass' : 'badge-fail'))}">\${percent}%</span></td>
                                    </tr>
                                \`;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td>المجموع الكلي للمهام</td>
                                <td>\${totalLessonScore} / \${totalLessonMax}</td>
                                <td>\${totalLessonMax > 0 ? Math.round((totalLessonScore / totalLessonMax)*100) : 0}%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            \`;
        }

        let examsHtml = '';
        let totalExamScore = 0;
        let totalExamMax = 0;
        
        if (s.exams && s.exams.length > 0) {
            examsHtml = \`
                <div class="table-section">
                    <h3 class="section-title">درجات الامتحانات:</h3>
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th>الامتحان</th>
                                <th>الدرجة</th>
                                <th>الدرجة النهائية</th>
                                <th>النسبة</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${s.exams.map(e => {
                                const score = Number(e.score) || 0;
                                const max = Number(e.max_score) || 0;
                                totalExamScore += score;
                                totalExamMax += max;
                                const percent = max > 0 ? Math.round((score / max)*100) : 0;
                                return \`
                                <tr>
                                    <td>\${e.name}</td>
                                    <td>\${e.score}</td>
                                    <td>\${e.max_score}</td>
                                    <td><span class="badge \${percent >= 85 ? 'badge-excellent' : (percent >= 70 ? 'badge-good' : (percent >= 50 ? 'badge-pass' : 'badge-fail'))}">\${percent}%</span></td>
                                </tr>
                                \`;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="1">المجموع الكلي للامتحانات</td>
                                <td>\${totalExamScore}</td>
                                <td>\${totalExamMax}</td>
                                <td>\${totalExamMax > 0 ? Math.round((totalExamScore / totalExamMax)*100) : 0}%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            \`;
        }

        let attendanceHtml = '';
        if (s.attendance && s.attendance.length > 0) {
            let presentCount = s.attendance.filter(a => a.status === 'present').length;
            let totalSessions = s.attendance.length;
            let attPercent = Math.round((presentCount / totalSessions) * 100);
            attendanceHtml = \`
                <div class="table-section">
                    <h3 class="section-title">سجل الحضور والملاحظات:</h3>
                    <table class="print-table">
                        <thead>
                            <tr>
                                <th>التاريخ</th>
                                <th>الموضوع</th>
                                <th>الحالة</th>
                                <th>ملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            \${s.attendance.map(a => {
                                let st = a.status === 'present' ? '<span style="color:#059669;font-weight:bold;">حاضر</span>' : '<span style="color:#DC2626;font-weight:bold;">غائب</span>';
                                return \`
                                <tr>
                                    <td>\${a.date}</td>
                                    <td>\${a.topic}</td>
                                    <td>\${st}</td>
                                    <td>\${a.note || '-'}</td>
                                </tr>
                                \`;
                            }).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td colspan="2">إجمالي الحضور</td>
                                <td colspan="2">\${presentCount} من \${totalSessions} جلسات (\${attPercent}%)</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            \`;
        }
        
        let overallScore = totalLessonScore + totalExamScore;
        let overallMax = totalLessonMax + totalExamMax;
        let overallPercent = overallMax > 0 ? Math.round((overallScore / overallMax) * 100) : 0;
        
        let motivationMsg = '';
        if(overallPercent >= 90) motivationMsg = 'ممتاز جداً! نحن فخورون جداً بمجهودك الرائع وتفوقك.';
        else if(overallPercent >= 75) motivationMsg = 'أداء جيد جداً! استمر في التميز، ونتوقع منك المزيد.';
        else if(overallPercent >= 50) motivationMsg = 'نجاح جيد! يمكنك تحقيق نتائج أفضل بالتركيز والمثابرة.';
        else motivationMsg = 'تحتاج إلى بذل مجهود مضاعف، نحن نثق بقدرتك على التحسن.';

        return \`
            <div class="student-page">
                <div class="report-header">
                    <img src="logo.png" alt="Logo Top" onerror="this.style.display='none'">
                </div>
                
                <div class="student-info">
                    <div class="info-block"><strong>الطالب:</strong> <span>\${s.name}</span></div>
                    <div class="info-block"><strong>الكود:</strong> <span>\${s.code}</span></div>
                    <div class="info-block"><strong>المجموعة:</strong> <span>\${groupName}</span></div>
                    <div class="info-block" style="background:#EEF2FF; padding: 5px 10px; border-radius: 4px; border: 1px solid #C7D2FE;">
                        <strong>النسبة العامة:</strong> <span style="color:#4338CA; font-weight:bold; font-size:1.1rem;">\${overallPercent}%</span>
                    </div>
                </div>
                
                <div class="motivation-box">
                    \${motivationMsg}
                </div>

                <div class="tables-container">
                    \${lessonsHtml}
                    \${examsHtml}
                    \${attendanceHtml}
                </div>
                
                <div class="report-footer-wrapper">
                    <div class="signature-box">
                        إمضاء ولي الأمر: _________________________
                    </div>
                    <div class="report-footer">
                        <img src="logo2.png" alt="Logo Bottom" onerror="this.style.display='none'">
                    </div>
                </div>
            </div>
        \`;
    }).join('');
}`;

// replace it using Regex or indexOf
let startIdx = code.indexOf('function buildPrintableDOM');
let endIdx = code.indexOf('}', code.lastIndexOf('container.innerHTML = students.map')) + 1; // It ends where join('') is. Wait, safer to just replace from function buildPrintableDOM to the end of the file, since it's the last function in admin-reports.js.

if (startIdx !== -1) {
    code = code.substring(0, startIdx) + newFunc;
    fs.writeFileSync('js/admin-reports.js', code, 'utf8');
    console.log('Replaced buildPrintableDOM');
} else {
    console.log('Could not find buildPrintableDOM');
}

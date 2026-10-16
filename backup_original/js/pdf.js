// ============================================================
// pdf.js — PDF Report Generation (using html2pdf.js)
// ============================================================
var PDF = {
  _loaded: false,

  _loadLibrary: function() {
    return new Promise(function(resolve, reject) {
      if (PDF._loaded || window.html2pdf) { PDF._loaded = true; resolve(); return; }
      var script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = function() { PDF._loaded = true; resolve(); };
      script.onerror = function() { reject(new Error('Failed to load PDF library')); };
      document.head.appendChild(script);
    });
  },

  generateStudentReport: function(reportData) {
    UI.showLoading('Generating PDF...');

    return PDF._loadLibrary().then(function() {
      var student = reportData.student || {};
      var submissions = reportData.submissions || [];
      var summary = reportData.summary || {};

      var html = PDF._buildReportHTML(student, submissions, summary);

      var container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.width = '800px';
      container.style.zIndex = '-9999';
      container.style.backgroundColor = '#FFFFFF';
      document.body.appendChild(container);

      var opt = {
        margin:       [10, 10, 10, 10],
        filename:     'Report_' + (student.name || 'Student').replace(/\s+/g, '_') + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#FFFFFF' },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      return new Promise(function(resolve) {
          setTimeout(function() {
              html2pdf().set(opt).from(container).save().then(function() {
                  document.body.removeChild(container);
                  UI.hideLoading();
                  UI.showToast('PDF downloaded successfully', 'success');
                  resolve();
              });
          }, 500);
      });
    }).catch(function(err) {
      UI.hideLoading();
      UI.showToast('Failed to generate PDF: ' + err.message, 'error');
    });
  },

  _buildReportHTML: function(student, submissions, summary) {
    var now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    var html = '';
    html += '<div style="font-family:Segoe UI,Arial,sans-serif;color:#1E293B;padding:20px;max-width:750px">';

    // Header
    html += '<div style="text-align:center;border-bottom:3px solid #4F46E5;padding-bottom:15px;margin-bottom:20px">';
    html += '<h1 style="color:#4F46E5;margin:0;font-size:22px">\ud83d\udcda Student Learning Platform</h1>';
    html += '<h2 style="color:#374151;margin:5px 0 0;font-size:16px">Student Performance Report</h2>';
    html += '<p style="color:#6B7280;font-size:12px;margin:5px 0 0">Generated: ' + now + '</p>';
    html += '</div>';

    // Student Info
    html += '<div style="background:#F8FAFC;border-radius:8px;padding:12px 16px;margin-bottom:20px;border:1px solid #E2E8F0">';
    html += '<h3 style="margin:0 0 8px;font-size:14px;color:#4F46E5">Student Information</h3>';
    html += '<table style="width:100%;font-size:13px">';
    html += '<tr><td style="padding:3px 0;color:#6B7280;width:120px"><strong>Name:</strong></td><td>' + (student.name || '\u2014') + '</td></tr>';
    html += '<tr><td style="padding:3px 0;color:#6B7280"><strong>Code:</strong></td><td>' + (student.code || '\u2014') + '</td></tr>';
    html += '</table></div>';

    // Summary
    html += '<div style="background:#F0FDF4;border-radius:8px;padding:12px 16px;margin-bottom:20px;border:1px solid #BBF7D0">';
    html += '<h3 style="margin:0 0 8px;font-size:14px;color:#10B981">Performance Summary</h3>';
    html += '<table style="width:100%;font-size:13px">';
    html += '<tr><td style="padding:3px 0;width:50%">Total Tasks: <strong>' + (summary.totalTasks || 0) + '</strong></td>';
    html += '<td>Correct: <strong style="color:#10B981">' + (summary.correct || 0) + '</strong></td></tr>';
    html += '<tr><td>Incorrect: <strong style="color:#EF4444">' + (summary.incorrect || 0) + '</strong></td>';
    html += '<td>Score: <strong style="color:#4F46E5">' + (summary.scorePercentage || 0) + '%</strong></td></tr>';
    html += '<tr><td>Total Score: <strong>' + (summary.totalScore || 0) + '/' + (summary.totalMaxScore || 0) + '</strong></td>';
    html += '<td></td></tr>';
    html += '</table></div>';

    // Submissions Table
    if (submissions.length > 0) {
      html += '<h3 style="font-size:14px;color:#374151;margin-bottom:10px">Detailed Results</h3>';
      html += '<table style="width:100%;border-collapse:collapse;font-size:11px">';
      html += '<thead><tr style="background:#4F46E5;color:white">';
      html += '<th style="padding:8px 6px;text-align:left;border-radius:4px 0 0 0">#</th>';
      html += '<th style="padding:8px 6px;text-align:left">Task</th>';
      html += '<th style="padding:8px 6px;text-align:left">Curriculum</th>';
      html += '<th style="padding:8px 6px;text-align:left">Your Answer</th>';
      html += '<th style="padding:8px 6px;text-align:left">Correct Answer</th>';
      html += '<th style="padding:8px 6px;text-align:center">Result</th>';
      html += '<th style="padding:8px 6px;text-align:center;border-radius:0 4px 0 0">Score</th>';
      html += '</tr></thead><tbody>';

      for (var i = 0; i < submissions.length; i++) {
        var s = submissions[i];
        var bg = i % 2 === 0 ? '#FFFFFF' : '#F9FAFB';
        var resultIcon = s.isCorrect ? '\u2713' : '\u2715';
        var resultColor = s.isCorrect ? '#10B981' : '#EF4444';
        var resultBg = s.isCorrect ? '#ECFDF5' : '#FEF2F2';

        html += '<tr style="background:' + bg + '">';
        html += '<td style="padding:6px;border-bottom:1px solid #E5E7EB">' + (i + 1) + '</td>';
        html += '<td style="padding:6px;border-bottom:1px solid #E5E7EB">' + (s.task || s.taskTitle || '') + '</td>';
        html += '<td style="padding:6px;border-bottom:1px solid #E5E7EB">' + (s.curriculum || '') + '</td>';
        html += '<td style="padding:6px;border-bottom:1px solid #E5E7EB;background:' + resultBg + '">' + (s.studentAnswer || '') + '</td>';
        html += '<td style="padding:6px;border-bottom:1px solid #E5E7EB;background:#ECFDF5">' + (s.correctAnswer || '') + '</td>';
        html += '<td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:center;color:' + resultColor + ';font-weight:bold">' + resultIcon + '</td>';
        html += '<td style="padding:6px;border-bottom:1px solid #E5E7EB;text-align:center">' + (s.score || 0) + '/' + (s.maxScore || 0) + '</td>';
        html += '</tr>';
      }

      html += '</tbody></table>';
    } else {
      html += '<p style="color:#6B7280;text-align:center;padding:20px">No submissions found.</p>';
    }

    // Footer
    html += '<div style="text-align:center;margin-top:30px;padding-top:15px;border-top:2px solid #E5E7EB;color:#9CA3AF;font-size:11px">';
    html += '<p>Student Learning Platform \u2014 Auto-generated Report</p>';
    html += '</div></div>';
    return html;
  },

  downloadMyReport: function() {
    return API.call('getStudentReport').then(function(data) {
      return PDF.generateStudentReport(data);
    });
  },

  downloadStudentReport: function(studentId) {
    return API.call('getStudentProfile', { student_id: studentId }).then(function(data) {
      var reportData = {
        student: data.student,
        submissions: [],
        summary: {
          totalTasks: data.overall.totalTasks,
          correct: data.overall.correctAnswers,
          incorrect: data.overall.incorrectAnswers,
          totalScore: data.overall.totalScore,
          totalMaxScore: data.overall.totalMaxScore,
          scorePercentage: data.overall.scorePercentage
        }
      };

      return API.call('getStudentAnswers', { student_id: studentId }).then(function(ansData) {
        reportData.submissions = (ansData.answers || []).map(function(a) {
          return {
            task: a.taskTitle,
            curriculum: a.curriculum,
            studentAnswer: a.studentAnswer,
            correctAnswer: a.correctAnswer,
            isCorrect: a.isCorrect,
            score: a.score,
            maxScore: a.maxScore
          };
        });
        return PDF.generateStudentReport(reportData);
      });
    });
  }
};

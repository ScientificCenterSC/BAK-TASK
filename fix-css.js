const fs = require('fs');

let code = fs.readFileSync('admin-reports.html', 'utf8');

let newStyles = `
        /* Print Styles */
        @media print {
            body * { visibility: hidden; }
            #printableReport, #printableReport * { visibility: visible; color: black !important; }
            #printableReport {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
                direction: rtl;
                display: block !important;
            }
            .student-page {
                page-break-after: always;
                min-height: 100vh;
                padding: 1cm 1.5cm;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                font-family: Arial, sans-serif;
            }
            .report-header {
                text-align: center;
                margin-bottom: 1.5rem;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            .report-header img {
                max-width: 150px;
                max-height: 80px;
                object-fit: contain;
            }
            .student-info {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1rem;
                padding-bottom: 0.8rem;
                border-bottom: 2px solid #1E293B;
                font-size: 1.1rem;
            }
            .info-block strong { color: #334155 !important; margin-left: 5px; }
            
            .motivation-box {
                background-color: #F0FDF4 !important;
                border: 1px solid #16A34A !important;
                color: #16A34A !important;
                padding: 10px;
                border-radius: 8px;
                text-align: center;
                font-size: 1.1rem;
                font-weight: bold;
                margin-bottom: 1.5rem;
                -webkit-print-color-adjust: exact;
            }
            
            .tables-container {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .table-section {
                break-inside: avoid;
            }
            .section-title {
                margin: 0 0 0.5rem 0;
                font-size: 1.1rem;
                color: #0F172A !important;
            }
            
            .print-table {
                width: 100%;
                border-collapse: collapse;
                text-align: right;
                font-size: 0.9rem;
            }
            .print-table th, .print-table td {
                border: 1px solid #CBD5E1;
                padding: 6px 8px;
            }
            .print-table th { 
                background: #F1F5F9 !important; 
                -webkit-print-color-adjust: exact; 
                font-weight: bold;
                color: #334155 !important;
            }
            .total-row {
                background: #F8FAFC !important;
                -webkit-print-color-adjust: exact;
                font-weight: bold;
            }
            
            .badge {
                display: inline-block;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 0.85rem;
                font-weight: bold;
                -webkit-print-color-adjust: exact;
            }
            .badge-excellent { background: #DCFCE7 !important; color: #16A34A !important; }
            .badge-good { background: #DBEAFE !important; color: #2563EB !important; }
            .badge-pass { background: #FEF9C3 !important; color: #CA8A04 !important; }
            .badge-fail { background: #FEE2E2 !important; color: #DC2626 !important; }
            
            .report-footer-wrapper {
                margin-top: auto;
            }
            .signature-box {
                margin-top: 1.5rem;
                text-align: right;
                font-size: 1.1rem;
                font-weight: bold;
            }
            .report-footer {
                text-align: center;
                margin-top: 1rem;
            }
            .report-footer img {
                max-width: 150px;
                max-height: 80px;
                opacity: 0.8;
            }
        }`;

let startIdx = code.indexOf('/* Print Styles */');
let endIdx = code.indexOf('</style>', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    code = code.substring(0, startIdx) + newStyles + "\n    " + code.substring(endIdx);
    fs.writeFileSync('admin-reports.html', code, 'utf8');
    console.log('Styles updated.');
} else {
    console.log('Indices not found!');
}

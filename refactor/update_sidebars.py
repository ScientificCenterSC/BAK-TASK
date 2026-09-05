import os
import glob

html_files = glob.glob('admin-*.html')

sidebar_link = '<a href="admin-tracking.html">Student Tracking</a>\n                <a href="#" id="logoutBtn" style="color: #ef4444; margin-top: 2rem;">Logout</a>'

for file in html_files:
    if file == 'admin-tracking.html': continue
    
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Replace the old logout link line with the tracking link + logout link
    old_logout = '<a href="#" id="logoutBtn" style="color: #ef4444; margin-top: 2rem;">Logout</a>'
    if old_logout in content:
        content = content.replace(old_logout, sidebar_link)
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated {file}")

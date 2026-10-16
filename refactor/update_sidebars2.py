import glob

html_files = glob.glob('admin-*.html')

for file in html_files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Check if tracking is already in the file
    if 'admin-tracking.html' not in content or file == 'admin-tracking.html':
        # Find the line with logoutBtn and prepend the tracking link
        if 'id="logoutBtn"' in content:
            new_link = '<li><a href="admin-tracking.html">👀 Student Tracking</a></li>\n                '
            # If the nav uses <li>, inject <li>. If it uses <a> directly (like I did in admin-tracking initially), inject <a>.
            # Let's just find the exact string `<li><a href="#" id="logoutBtn">` or similar.
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if 'id="logoutBtn"' in line:
                    indent = len(line) - len(line.lstrip())
                    if '<li' in line:
                        lines.insert(i, ' ' * indent + '<li><a href="admin-tracking.html">👀 Student Tracking</a></li>')
                    else:
                        lines.insert(i, ' ' * indent + '<a href="admin-tracking.html">👀 Student Tracking</a>')
                    break
            
            with open(file, 'w', encoding='utf-8') as f:
                f.write('\n'.join(lines))
            print(f"Updated {file}")

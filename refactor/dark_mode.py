import re

with open('css/global.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace variables
new_vars = """:root {
  --primary: #6366F1;
  --primary-light: #818CF8;
  --primary-dark: #4338CA;
  --secondary: #94A3B8;
  --success: #34D399;
  --warning: #FBBF24;
  --danger: #F87171;
  
  --dark: #0F172A;
  --light: #F8FAFC;
  
  --gray-50: #111827;   /* Was lightest, now darkest */
  --gray-100: #1F2937;
  --gray-200: #374151;
  --gray-300: #4B5563;
  --gray-400: #6B7280;
  --gray-500: #9CA3AF;
  --gray-600: #D1D5DB;
  --gray-700: #E5E7EB;
  --gray-800: #F3F4F6;
  --gray-900: #F9FAFB;  /* Was darkest, now lightest */

  --bg-color: var(--gray-50);
  --card-bg: var(--gray-100);
  --border-color: var(--gray-200);
  --text-main: var(--gray-900);
  --text-muted: var(--gray-500);

  --radius: 12px;
  --radius-sm: 8px;
  --radius-lg: 16px;
  --shadow: 0 4px 6px -1px rgba(0,0,0,0.5), 0 2px 4px -1px rgba(0,0,0,0.3);
  --shadow-md: 0 10px 15px -3px rgba(0,0,0,0.5), 0 4px 6px -2px rgba(0,0,0,0.3);
  --shadow-lg: 0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.2);
  --transition: all 0.2s ease;
  --font: 'Segoe UI', system-ui, -apple-system, sans-serif;
}"""

css = re.sub(r':root\s*\{[^}]+\}', new_vars, css)
css = css.replace("background: var(--gray-50);", "background: var(--bg-color);")
css = css.replace("color: var(--gray-800);", "color: var(--text-main);")

with open('css/global.css', 'w', encoding='utf-8') as f:
    f.write(css)

# Update components.css
with open('css/components.css', 'r', encoding='utf-8') as f:
    comp = f.read()

comp = comp.replace("background: white;", "background: var(--card-bg);")
comp = comp.replace("background: #fff;", "background: var(--card-bg);")
comp = comp.replace("border: 1px solid var(--gray-200);", "border: 1px solid var(--border-color);")
comp = comp.replace("border: 1px solid #ddd;", "border: 1px solid var(--border-color);")
comp = comp.replace("color: var(--gray-800);", "color: var(--text-main);")
comp = comp.replace("color: #333;", "color: var(--text-main);")
comp = comp.replace("color: #555;", "color: var(--text-muted);")
comp = comp.replace("color: #666;", "color: var(--text-muted);")
comp = comp.replace("border-bottom: 1px solid var(--gray-200);", "border-bottom: 1px solid var(--border-color);")
comp = comp.replace("background: var(--gray-50);", "background: var(--bg-color);")
comp = comp.replace("background: var(--gray-100);", "background: var(--bg-color);")

with open('css/components.css', 'w', encoding='utf-8') as f:
    f.write(comp)

# Update admin.css
with open('css/admin.css', 'r', encoding='utf-8') as f:
    admin = f.read()

admin = admin.replace("background: white;", "background: var(--card-bg);")
admin = admin.replace("background: #fff;", "background: var(--card-bg);")
admin = admin.replace("background: var(--gray-50);", "background: var(--bg-color);")
admin = admin.replace("border-bottom: 1px solid #ddd;", "border-bottom: 1px solid var(--border-color);")
admin = admin.replace("border-top: 1px solid #ddd;", "border-top: 1px solid var(--border-color);")
admin = admin.replace("border-bottom: 1px solid var(--gray-200);", "border-bottom: 1px solid var(--border-color);")
admin = admin.replace("border: 1px solid var(--gray-200);", "border: 1px solid var(--border-color);")
admin = admin.replace("color: #333;", "color: var(--text-main);")
admin = admin.replace("color: #666;", "color: var(--text-muted);")
admin = admin.replace("color: var(--gray-700);", "color: var(--text-main);")
admin = admin.replace("color: var(--gray-800);", "color: var(--text-main);")

with open('css/admin.css', 'w', encoding='utf-8') as f:
    f.write(admin)

# Update student.css
with open('css/student.css', 'r', encoding='utf-8') as f:
    student = f.read()

student = student.replace("background: white;", "background: var(--card-bg);")
student = student.replace("background: #fff;", "background: var(--card-bg);")
student = student.replace("border: 1px solid var(--gray-200);", "border: 1px solid var(--border-color);")
student = student.replace("color: var(--gray-800);", "color: var(--text-main);")
student = student.replace("color: #333;", "color: var(--text-main);")
student = student.replace("color: #666;", "color: var(--text-muted);")
student = student.replace("background: #f0fdf4;", "background: rgba(52, 211, 153, 0.1);")
student = student.replace("background: #fef2f2;", "background: rgba(248, 113, 113, 0.1);")

with open('css/student.css', 'w', encoding='utf-8') as f:
    f.write(student)

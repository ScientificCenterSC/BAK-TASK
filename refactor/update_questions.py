import json

with open('questions.json', 'r', encoding='utf-8') as f:
    questions = json.load(f)

# English translations mapped
translations = {
    "القاهرة هي عاصمة جمهورية مصر العربية.": "Cairo is the capital of the Arab Republic of Egypt.",
    "عدد كواكب المجموعة الشمسية هو 9 كواكب.": "The number of planets in the solar system is 9.",
    "HTML هي لغة تُستخدم لبناء هيكل صفحات الويب.": "HTML is a language used to build the structure of web pages.",
    "الشمس كوكب من كواكب المجموعة الشمسية.": "The sun is a planet in the solar system.",
    "الماء يتكون من ذرتي هيدروجين وذرة أكسجين.": "Water consists of two hydrogen atoms and one oxygen atom.",
    "الأرض هي أكبر كواكب المجموعة الشمسية.": "Earth is the largest planet in the solar system.",
    "اللغة العربية تُكتب من اليمين إلى اليسار.": "The Arabic language is written from right to left.",
    "الكمبيوتر لا يستطيع تنفيذ العمليات الحسابية.": "A computer cannot perform arithmetic operations.",
    "CSS تُستخدم لتنسيق وتصميم صفحات الويب.": "CSS is used to style and design web pages.",
    "JavaScript هي لغة برمجة تُستخدم لإضافة التفاعل إلى صفحات الويب.": "JavaScript is a programming language used to add interactivity to web pages.",
    "القمر يصدر ضوءه من نفسه.": "The moon emits its own light.",
    "الإنسان يحتاج إلى الأكسجين للتنفس.": "Humans need oxygen to breathe.",
    "أفريقيا هي أكبر قارات العالم مساحةً.": "Africa is the largest continent in the world by area.",
    "الرقم الثنائي 1 و0 هما أساس نظام العد الثنائي.": "The binary digits 1 and 0 are the basis of the binary numeral system.",
    "RAM هي ذاكرة دائمة لا تفقد البيانات عند إيقاف تشغيل الكمبيوتر.": "RAM is a permanent memory that does not lose data when the computer is turned off.",
    "المحيط الهادئ هو أكبر محيطات العالم.": "The Pacific Ocean is the largest ocean in the world.",
    "Python هي إحدى لغات البرمجة.": "Python is a programming language.",
    "HTML اختصار لـ HyperText Markup Language.": "HTML stands for HyperText Markup Language.",
    "الشبكة العنكبوتية العالمية World Wide Web هي نفسها الإنترنت تمامًا.": "The World Wide Web is exactly the same as the Internet.",
    "البكتيريا كلها ضارة للإنسان.": "All bacteria are harmful to humans.",
    "الذهب عنصر كيميائي رمزه Au.": "Gold is a chemical element with the symbol Au.",
    "يمكن استخدام محرك البحث للوصول إلى المعلومات الموجودة على الإنترنت.": "A search engine can be used to access information on the Internet.",
    "الملف الذي ينتهي بالامتداد .jpg يكون عادةً ملفًا صوتيًا.": "A file ending with the extension .jpg is usually an audio file.",
    "يمكن أن تحتوي صفحة HTML على صور وروابط ونصوص.": "An HTML page can contain images, links, and text.",
    "الذكاء الاصطناعي هو مجال يهتم بتطوير أنظمة تستطيع أداء مهام تتطلب عادةً قدرات بشرية.": "Artificial intelligence is a field concerned with developing systems that can perform tasks that normally require human intelligence."
}

for q in questions:
    q['type'] = 'true_false'
    
    ar_q = q['question'] if isinstance(q['question'], str) else q['question'].get('ar', '')
    en_q = translations.get(ar_q, "")
    
    # Store bilingual question
    q['question'] = {
        "ar": ar_q,
        "en": en_q
    }
    
    # Bilingual options
    q['options'] = [
        {"ar": "صح", "en": "True", "value": "صح"},
        {"ar": "خطأ", "en": "False", "value": "خطأ"}
    ]

with open('questions.json', 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

print("Updated questions.json successfully.")

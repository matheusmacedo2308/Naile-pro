const fs = require('fs');

let code = fs.readFileSync('src/app/components/AdminPanel.tsx', 'utf-8');

// Update header in admin panel
code = code.replace(
  /<h2 className="text-2xl text-foreground mb-6" style=\{\{ fontFamily: "'Cormorant', serif", fontWeight: 400 \}\}>/g,
  `<h2 className="text-4xl text-foreground mb-10" style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300 }}>`
);

// Update inputClass in admin panel to match
code = code.replace(
  /const inputClass = "w-full p-3 bg-input text-sm rounded-sm border focus:border-primary transition-colors outline-none";/g,
  `const inputClass = "w-full py-4 px-4 bg-transparent text-sm border-b border-border focus:border-primary transition-all duration-300 outline-none placeholder:text-muted-foreground/50 rounded-none";`
);

// Update primary buttons
code = code.replace(
  /className="w-full py-4 mt-6 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"/g,
  `className="w-full py-5 mt-8 text-[11px] tracking-[0.2em] uppercase transition-all duration-300 hover:shadow-xl disabled:opacity-50 border border-primary text-primary-foreground" style={{ borderRadius: "0" }}`
);

// Update Admin Nav Tabs to be more editorial
code = code.replace(
  /className="flex-1 py-3 text-sm transition-colors border-b-2"/g,
  `className="flex-1 py-4 text-[10px] tracking-widest uppercase transition-all duration-300 border-b"`
);

// Tab active state text color in Admin Panel
// Looking for: color: activeTab === opt.key ? "var(--primary)" : "var(--muted-foreground)"
code = code.replace(
  /color: activeTab === opt\.key \? "var\(--primary\)" : "var\(--muted-foreground\)"/g,
  `color: activeTab === opt.key ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: activeTab === opt.key ? 500 : 400`
);

fs.writeFileSync('src/app/components/AdminPanel.tsx', code);
console.log('Admin Patched.');

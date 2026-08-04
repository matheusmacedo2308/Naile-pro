const fs = require('fs');

let code = fs.readFileSync('src/app/App.tsx', 'utf-8');

code = code.replace(
  /const supabase = createClient\(`https:\/\/\$\{projectId\}\.supabase\.co`, publicAnonKey, \{\n  auth: \{\n    persistSession: true,\n    autoRefreshToken: true,\n    detectSessionInUrl: true,\n  \},\n\}\);/,
  `// Use a global variable to prevent multiple GoTrueClient instances during HMR
const supabase = (globalThis as any).__supabaseClient ??= createClient(\`https://\${projectId}.supabase.co\`, publicAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});`
);

fs.writeFileSync('src/app/App.tsx', code);
console.log('Client Patched.');

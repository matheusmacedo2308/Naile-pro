const fs = require('fs');

// Adjust this path if your App.tsx lives somewhere else in your project.
const filePath = 'src/app/App.tsx';
let code = fs.readFileSync(filePath, 'utf8');

const before = `  // The official client auto-refreshes the token; getSession() returns a valid one.
  const getToken = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || publicAnonKey;
  };

  // Fetch helper that attaches a valid access token to server requests.
  const authedFetch = async (url: string, options: any = {}) => {
    const token = await getToken();
    return fetch(url, {
      ...options,
      headers: { ...SERVER_HEADERS, ...(options.headers || {}), Authorization: \`Bearer \${token}\` },
    });
  };`;

const after = `  // Returns a valid user access token, or null if the session is truly gone
  // (refresh token expired/rotated). No longer silently falls back to the
  // anon key, which is what caused the confusing "Invalid or expired
  // session" error from the server.
  const getToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return null;
    return data.session.access_token;
  };

  // Fetch helper that attaches a valid access token to server requests.
  // If the session is actually gone, log the user out and surface a clear
  // message instead of sending an anon key the server will reject.
  const authedFetch = async (url: string, options: any = {}) => {
    const token = await getToken();
    if (!token) {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      throw new Error("Sua sessão expirou. Faça login novamente para continuar.");
    }
    return fetch(url, {
      ...options,
      headers: { ...SERVER_HEADERS, ...(options.headers || {}), Authorization: \`Bearer \${token}\` },
    });
  };`;

if (!code.includes(before)) {
  console.error('Não encontrei o bloco esperado em ' + filePath + '.');
  console.error('Verifique se o caminho do arquivo está correto ou se o código já foi alterado manualmente.');
  process.exit(1);
}

code = code.replace(before, after);
fs.writeFileSync(filePath, code);
console.log('✔ Correção de sessão aplicada em ' + filePath);

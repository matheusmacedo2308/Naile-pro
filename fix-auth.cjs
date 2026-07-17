const fs = require('fs');
let code = fs.readFileSync('src/app/App.tsx', 'utf8');

// Add auth states and imports
code = code.replace(
  'import { useState, useEffect } from "react";\nimport { projectId, publicAnonKey } from "../../utils/supabase/info";',
  'import { useState, useEffect } from "react";\nimport { projectId, publicAnonKey } from "../../utils/supabase/info";\nimport { createClient } from "@supabase/supabase-js";'
);

code = code.replace(
  '  const [activeTab, setActiveTab] = useState<"home" | "book" | "appointments">("home");',
  '  const [activeTab, setActiveTab] = useState<"home" | "book" | "appointments">("home");\n' +
  '  const [user, setUser] = useState<any>(null);\n' +
  '  const [authMode, setAuthMode] = useState<"login" | "register">("login");\n' +
  '  const [email, setEmail] = useState("");\n' +
  '  const [password, setPassword] = useState("");\n' +
  '  const [authLoading, setAuthLoading] = useState(false);\n' +
  '  const [authError, setAuthError] = useState<string | null>(null);\n' +
  '  const [isAdmin, setIsAdmin] = useState(false);\n'
);

code = code.replace(
  '  const today = new Date();\n\n  const API_URL',
  '  const supabase = createClient(\n    `https://${projectId}.supabase.co`,\n    publicAnonKey\n  );\n\n  const today = new Date();\n\n  const API_URL'
);

code = code.replace(
  '  useEffect(() => {\n    if (activeTab === "appointments" || activeTab === "book") {\n      fetchAppointments();\n    }\n  }, [activeTab]);',
  '  useEffect(() => {\n    // Check active sessions and sets the user\n    supabase.auth.getSession().then(({ data: { session } }) => {\n      setUser(session?.user ?? null);\n      setIsAdmin(session?.user?.email === "admin@maisonnaile.com");\n    });\n\n    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {\n      setUser(session?.user ?? null);\n      setIsAdmin(session?.user?.email === "admin@maisonnaile.com");\n    });\n\n    return () => subscription.unsubscribe();\n  }, []);\n\n  useEffect(() => {\n    if (user && (activeTab === "appointments" || activeTab === "book")) {\n      fetchAppointments();\n    }\n  }, [activeTab, user]);'
);

code = code.replace(
  '  const handleConfirm = async () => {\n    setIsSubmitting(true);',
  '  const handleAuth = async (e: React.FormEvent) => {\n    e.preventDefault();\n    setAuthLoading(true);\n    setAuthError(null);\n    \n    try {\n      if (authMode === "register") {\n        const { error } = await supabase.auth.signUp({\n          email,\n          password,\n        });\n        if (error) throw error;\n        // Automatically log in after register since email confirmation is disabled by default in our setup\n      } else {\n        const { error } = await supabase.auth.signInWithPassword({\n          email,\n          password,\n        });\n        if (error) throw error;\n      }\n    } catch (err: any) {\n      setAuthError(err.message || "Erro na autenticação.");\n    } finally {\n      setAuthLoading(false);\n    }\n  };\n\n  const handleLogout = async () => {\n    await supabase.auth.signOut();\n  };\n\n  const handleConfirm = async () => {\n    setIsSubmitting(true);'
);

code = code.replace(
  '  return (\n    <div\n      className="size-full flex flex-col overflow-hidden"',
  '  if (!user) {\n    return (\n      <div className="size-full flex flex-col items-center justify-center p-6" style={{ fontFamily: "\'DM Sans\', sans-serif", background: "var(--background)" }}>\n        <div className="w-full max-w-sm">\n          <div className="text-center mb-10">\n            <h1 className="text-4xl mb-2" style={{ fontFamily: "\'Cormorant\', serif", fontWeight: 300 }}>Maison Nailê</h1>\n            <p className="text-sm text-muted-foreground">Acesse sua conta para agendar</p>\n          </div>\n          \n          <form onSubmit={handleAuth} className="space-y-4">\n            {authError && (\n              <div className="p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-sm">\n                {authError}\n              </div>\n            )}\n            \n            <div>\n              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Email</label>\n              <input\n                type="email"\n                required\n                value={email}\n                onChange={(e) => setEmail(e.target.value)}\n                className="w-full px-4 py-3 bg-card border border-border rounded-sm focus:outline-none focus:border-primary transition-colors"\n                placeholder="seu@email.com"\n              />\n            </div>\n            \n            <div>\n              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Senha</label>\n              <input\n                type="password"\n                required\n                value={password}\n                onChange={(e) => setPassword(e.target.value)}\n                className="w-full px-4 py-3 bg-card border border-border rounded-sm focus:outline-none focus:border-primary transition-colors"\n                placeholder="••••••••"\n              />\n            </div>\n            \n            <button\n              type="submit"\n              disabled={authLoading}\n              className="w-full py-4 mt-4 rounded-sm text-primary-foreground text-sm tracking-widest uppercase transition-opacity hover:opacity-90 disabled:opacity-50"\n              style={{ background: "var(--primary)" }}\n            >\n              {authLoading ? "Aguarde..." : authMode === "login" ? "Entrar" : "Criar Conta"}\n            </button>\n          </form>\n          \n          <div className="mt-6 text-center">\n            <button\n              type="button"\n              onClick={() => setAuthMode(m => m === "login" ? "register" : "login")}\n              className="text-sm text-muted-foreground hover:text-foreground transition-colors"\n            >\n              {authMode === "login" ? "Não tem conta? Registre-se" : "Já tem conta? Entre aqui"}\n            </button>\n          </div>\n          <div className="mt-8 text-center border-t border-border pt-4">\n             <p className="text-xs text-muted-foreground mb-1">Admin Acesso:</p>\n             <p className="text-xs text-muted-foreground">admin@maisonnaile.com / admin123</p>\n          </div>\n        </div>\n      </div>\n    );\n  }\n\n  return (\n    <div\n      className="size-full flex flex-col overflow-hidden"'
);

// Add admin panel tab to bottom nav
code = code.replace(
  '          { key: "book", label: "Agendar" },\n          { key: "appointments", label: "Meus Agend." },\n        ] as const).map((tab) => (',
  '          { key: "book", label: "Agendar" },\n          { key: "appointments", label: isAdmin ? "Geral" : "Meus Agend." },\n        ] as const).map((tab) => ('
);

// Add logout button to header
code = code.replace(
  '          <button className="p-2 rounded-full hover:bg-secondary transition-colors">\n            <Phone size={18} className="text-muted-foreground" />\n          </button>\n        </div>\n      </header>',
  '          <button className="p-2 rounded-full hover:bg-secondary transition-colors">\n            <Phone size={18} className="text-muted-foreground" />\n          </button>\n          <button onClick={handleLogout} className="p-2 ml-1 text-xs text-red-400 hover:text-red-500 transition-colors uppercase tracking-widest">\n            Sair\n          </button>\n        </div>\n      </header>'
);

// Update fetch and create logic to include user id
code = code.replace(
  '      const res = await fetch(API_URL, {\n        method: "POST",\n        headers: {\n          "Content-Type": "application/json",\n          Authorization: `Bearer ${publicAnonKey}`\n        },\n        body: JSON.stringify(booking)\n      });',
  '      const res = await fetch(API_URL, {\n        method: "POST",\n        headers: {\n          "Content-Type": "application/json",\n          Authorization: `Bearer ${publicAnonKey}`\n        },\n        body: JSON.stringify({ ...booking, userId: user.id })\n      });'
);

fs.writeFileSync('src/app/App.tsx', code);

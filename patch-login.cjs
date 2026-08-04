const fs = require('fs');

let code = fs.readFileSync('src/app/App.tsx', 'utf-8');

const regex = /if \(!user\) \{\s*return \([\s\S]*?<div className="mt-8 text-center border-t border-border pt-4">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\);\s*\}/;

const replacement = `if (!user) {
    return (
      <motion.div 
        className="size-full flex flex-col items-center justify-center p-6 overflow-y-auto relative" 
        style={{ fontFamily: "'DM Sans', sans-serif", background: "var(--background)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      >
        {/* Abstract 3D/Editorial background shapes */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <motion.div 
            className="absolute -top-20 -right-20 w-96 h-96 rounded-full blur-3xl"
            style={{ background: "var(--primary)" }}
            animate={{ 
              x: [0, 20, 0], 
              y: [0, 30, 0],
              scale: [1, 1.1, 1] 
            }}
            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full blur-3xl"
            style={{ background: "var(--accent)" }}
            animate={{ 
              x: [0, -20, 0], 
              y: [0, -30, 0],
              scale: [1, 1.2, 1] 
            }}
            transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
          />
        </div>

        <motion.div 
          className="w-full max-w-sm py-8 relative z-10"
          style={{ transformPerspective: 1200 }}
          initial={{ opacity: 0, rotateX: 15, y: 30 }}
          animate={{ opacity: 1, rotateX: 0, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="text-center mb-10">
            <motion.p 
              className="text-[10px] tracking-[0.4em] uppercase text-accent mb-3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
            >
              Plataforma de Agendamento
            </motion.p>
            <motion.h1 
              className="text-5xl mb-3 text-foreground" 
              style={{ fontFamily: "'Cormorant', serif", fontStyle: "italic", fontWeight: 300, lineHeight: 1.1 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
            >
              {viewingBusiness?.businessName || "Nailê Pro"}
            </motion.h1>
            <motion.p 
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.6 }}
            >
              {authMode === "login"
                ? "Acesse seu refúgio de beleza"
                : authMode === "forgot"
                ? "Recupere seu acesso"
                : accountType === "business"
                ? "Eleve seu estúdio a outro nível"
                : "Seu perfil exclusivo"}
            </motion.p>
          </div>

          {viewingBusinessError && (
            <div className="mb-6 p-4 border border-border/50 text-sm bg-secondary/80 backdrop-blur-md rounded-none text-foreground text-center">
              {viewingBusinessError}
            </div>
          )}

          {/* Account type toggle */}
          {authMode === "register" && !viewingBusiness && (
            <motion.div 
              className="flex gap-2 p-1 mb-8 bg-transparent border-b border-border pb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              {([
                { key: "client", label: "Sou Cliente" },
                { key: "business", label: "Sou Empresa" },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setAccountType(opt.key)}
                  className="flex-1 py-3 text-[11px] tracking-widest uppercase transition-all duration-300 relative"
                  style={{
                    color: accountType === opt.key ? "var(--foreground)" : "var(--muted-foreground)",
                  }}
                >
                  {opt.label}
                  {accountType === opt.key && (
                    <motion.div 
                      layoutId="activeTabIndicator"
                      className="absolute bottom-[-17px] left-0 right-0 h-[1px] bg-foreground"
                    />
                  )}
                </button>
              ))}
            </motion.div>
          )}

          <form onSubmit={handleAuth} className="space-y-5">
            <AnimatePresence mode="popLayout">
              {authError && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 bg-red-50/50 backdrop-blur-sm border border-red-200 text-red-600 text-[13px] text-center"
                >
                  {authError}
                </motion.div>
              )}
              {authNotice && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="p-4 border border-border/50 text-[13px] bg-secondary/80 backdrop-blur-sm text-foreground text-center"
                >
                  {authNotice}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence mode="popLayout">
              {authMode === "register" && accountType === "business" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">Nome do Estúdio</label>
                  <input type="text" required value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} placeholder="Ex: Studio Bella Unhas" />
                </motion.div>
              )}

              {authMode === "register" && accountType === "business" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1 mt-5"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">CPF ou CNPJ</label>
                  <input type="text" required value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} className={inputClass} placeholder="000.000.000-00" />
                </motion.div>
              )}

              {authMode === "register" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1 mt-5"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">
                    {accountType === "business" ? "Seu Nome (responsável)" : "Nome completo"}
                  </label>
                  <input type="text" required value={fullName} onChange={(e) => setFullName(e.target.value)} className={inputClass} placeholder="Seu nome" />
                </motion.div>
              )}

              {authMode === "register" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1 mt-5"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className={inputClass}
                    placeholder="(11) 91234-5678"
                  />
                </motion.div>
              )}

              <motion.div layout className="space-y-1 mt-5">
                <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">Email</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="seu@email.com" />
              </motion.div>

              {authMode !== "forgot" && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-1 mt-5"
                >
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-1">Senha</label>
                  <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
                </motion.div>
              )}
            </AnimatePresence>

            {authMode === "forgot" && (
              <motion.p 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-xs text-muted-foreground leading-relaxed text-center py-2"
              >
                Enviaremos um link seguro para o seu email. Ao clicar nele, você poderá definir uma nova senha.
              </motion.p>
            )}

            {authMode === "login" && (
              <motion.div layout className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode("forgot"); setAuthError(null); setAuthNotice(null); setPassword(""); }}
                  className="text-[11px] tracking-widest text-muted-foreground hover:text-foreground transition-colors uppercase"
                >
                  Esqueci a senha
                </button>
              </motion.div>
            )}

            <motion.button
              type="submit"
              disabled={authLoading}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full py-5 mt-6 rounded-none text-primary-foreground text-[11px] tracking-[0.2em] uppercase transition-all duration-300 hover:shadow-xl disabled:opacity-50 border border-primary"
              style={{ background: "var(--primary)" }}
            >
              {authLoading
                ? "Aguarde..."
                : authMode === "login"
                ? "Acessar Plataforma"
                : authMode === "forgot"
                ? "Enviar Link"
                : accountType === "business"
                ? "Criar Estúdio"
                : "Criar Conta"}
            </motion.button>
          </form>

          {authMode === "register" && accountType === "business" && (
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground text-center mt-6 leading-relaxed">
              14 dias grátis · Sem cartão
            </p>
          )}

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => { setAuthMode(m => m === "login" ? "register" : "login"); setAuthError(null); setAuthNotice(null); setPassword(""); }}
              className="text-[11px] tracking-widest uppercase text-muted-foreground hover:text-foreground transition-colors pb-1 border-b border-muted-foreground/30 hover:border-foreground"
            >
              {authMode === "login"
                ? "Primeira vez? Cadastre-se"
                : authMode === "forgot"
                ? "Voltar para o login"
                : "Já tem conta? Entre aqui"}
            </button>
          </div>

          <div className="mt-12 text-center border-t border-border/50 pt-8 opacity-50 hover:opacity-100 transition-opacity duration-500">
            <p className="text-[9px] tracking-widest uppercase text-muted-foreground mb-2">Acesso Administrador</p>
            <p className="text-xs text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>admin@maisonnaile.com</p>
            <p className="text-xs text-foreground" style={{ fontFamily: "'DM Mono', monospace" }}>Naile@Admin2026</p>
          </div>
        </motion.div>
      </motion.div>
    );
  }`;

code = code.replace(regex, replacement);

// Refine inputClass to match the new editorial style
code = code.replace(
  /const inputClass = "w-full p-3 bg-input text-sm rounded-sm border focus:border-primary transition-colors outline-none";/,
  `const inputClass = "w-full py-4 px-4 bg-transparent text-sm border-b border-border focus:border-primary transition-all duration-300 outline-none placeholder:text-muted-foreground/50 rounded-none";`
);

fs.writeFileSync('src/app/App.tsx', code);
console.log('Login Patched.');

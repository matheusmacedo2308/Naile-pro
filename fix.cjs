const fs = require('fs');
let code = fs.readFileSync('src/app/App.tsx', 'utf8');

// The error is because we replaced `<div className="px-4 pb-28">` with `<>`.
// Let's restore the `div` wrapper around the appointments tab content.

code = code.replace(
  '            {loadingAppts ? (\n              <div className="py-10 text-center text-muted-foreground text-sm">Carregando agendamentos...</div>\n            ) : (\n              <>\n                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Próximos</p>',
  '            {loadingAppts ? (\n              <div className="py-10 text-center text-muted-foreground text-sm">Carregando agendamentos...</div>\n            ) : (\n              <div className="px-4 pb-28">\n                <p className="text-xs tracking-widest uppercase text-muted-foreground mb-3">Próximos</p>'
);

code = code.replace(
  '              ))}\n            </div>\n          </>\n        )}\n      </div>\n    )}\n      </main>',
  '              ))}\n            </div>\n          </div>\n        )}\n      </div>\n    )}\n      </main>'
);

fs.writeFileSync('src/app/App.tsx', code);

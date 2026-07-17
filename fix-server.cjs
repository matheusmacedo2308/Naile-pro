const fs = require('fs');
let code = fs.readFileSync('supabase/functions/server/index.tsx', 'utf8');

// Update backend to save userId in appointment data
code = code.replace(
  '    const { service, professional, date, time } = body;',
  '    const { service, professional, date, time, userId } = body;'
);

code = code.replace(
  '      status: \'confirmado\',',
  '      status: \'confirmado\',\n      userId,'
);

fs.writeFileSync('supabase/functions/server/index.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/app/App.tsx', 'utf8');

// Update appointments tab to filter by user unless admin
code = code.replace(
  '      if (data.appointments) setMyAppointments(data.appointments);',
  '      if (data.appointments) {\n        if (isAdmin) {\n          setMyAppointments(data.appointments);\n        } else {\n          setMyAppointments(data.appointments.filter((a: any) => a.userId === user.id));\n        }\n      }'
);

fs.writeFileSync('src/app/App.tsx', code);

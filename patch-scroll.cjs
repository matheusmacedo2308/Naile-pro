const fs = require('fs');

let code = fs.readFileSync('src/app/App.tsx', 'utf-8');

// The main scroll container is here:
// <main className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">

code = code.replace(
  /<main className="flex-1 overflow-y-auto \[scrollbar-width:none\] \[\&::-webkit-scrollbar\]:hidden">/,
  `<main 
        className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ perspective: "1000px" }}
      >`
);

fs.writeFileSync('src/app/App.tsx', code);
console.log('Scroll Patched.');

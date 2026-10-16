const fs = require('fs');

let code = fs.readFileSync('backend/Code.gs', 'utf8');

// I will just check if there is a syntax error that I missed.
try {
  eval(code); // evaluate to check syntax
  console.log("Syntax is OK");
} catch(e) {
  console.log("Syntax error:", e);
}

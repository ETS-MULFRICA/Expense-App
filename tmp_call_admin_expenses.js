const fetch = require('node-fetch');

(async function(){
  try {
    const res = await fetch('http://localhost:5000/api/admin/expenses');
    console.log('status', res.status);
    const text = await res.text();
    console.log('body', text);
  } catch (err) {
    console.error('error', err.message);
  }
})();

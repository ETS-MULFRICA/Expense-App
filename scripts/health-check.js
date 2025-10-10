const url = process.argv[2] || 'http://localhost:5000/health';
const timeout = 5000;

(async () => {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    console.log('status', res.status);
    const body = await res.text();
    console.log('body', body);
    process.exit(res.status === 200 ? 0 : 2);
  } catch (err) {
    console.error('error', err && err.message ? err.message : err);
    process.exit(2);
  }
})();

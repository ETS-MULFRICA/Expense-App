// 1. For simple module imports (like ngrok)
import ngrok from '@ngrok/ngrok';
// 2. For dotenv, you need to import config and call it.
import { config } from 'dotenv';
config();

// ... rest of your code
(async function() {
    const listener = await ngrok.forward({
        // The port your app is running on.
        addr: 5000,
        authtoken: process.env.NGROK_AUTHTOKEN,
        domain: process.env.NGROK_DOMAIN,
        // Secure your endpoint with a traffic policy.
        // This could also be a path to a traffic policy file.
        traffic_policy: '{"on_http_request": [{"actions": [{"type": "oauth","config": {"provider": "google"}}]}]}'
    });

    // Output ngrok url to console
    console.log(`Ingress established at ${listener.url()}`);
})();

// Keep the process alive
process.stdin.resume();
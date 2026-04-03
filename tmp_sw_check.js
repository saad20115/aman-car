const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function runDeploy() {
  try {
    await ssh.connect({
      host: '195.35.2.75',
      username: 'root',
      password: 'SCe@11223345'
    });
    
    // Check if there is a service worker
    const swCheck = await ssh.execCommand('ls -la /var/www/aman-car/dist | grep "sw.js \\| manifest.json \\| workbox"');
    console.log('SW Check:', swCheck.stdout);
    
    // Read the main js file to see if it registers a service worker
    const regCheck = await ssh.execCommand('grep -i "serviceWorker" /var/www/aman-car/dist/assets/*.js');
    console.log('SW Registration:', regCheck.stdout.length > 0 ? "Found Registration" : "No SW Found");

    ssh.dispose();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runDeploy();

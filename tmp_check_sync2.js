const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function runDeploy() {
  try {
    await ssh.connect({
      host: '195.35.2.75',
      username: 'root',
      password: 'SCe@11223345'
    });
    
    // Check if the source code on VPS has my fix
    const srcCheck = await ssh.execCommand('grep "store-car-year" /var/www/aman-car/js/app.js');
    console.log('Source Code Check:', srcCheck.stdout);

    ssh.dispose();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runDeploy();

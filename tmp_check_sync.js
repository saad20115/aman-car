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
    const srcCheck = await ssh.execCommand('grep "initCarYears" /var/www/aman-car/js/app.js');
    console.log('Source Code Check:', srcCheck.stdout);

    // Check if the compiled code has my fix
    const distCheck = await ssh.execCommand('grep "initCarYears" /var/www/aman-car/dist/assets/*.js');
    console.log('Compiled Code Check:', distCheck.stdout.length > 0 ? "Found in dist!" : "NOT FOUND in dist!");

    ssh.dispose();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runDeploy();

const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function runDeploy() {
  try {
    await ssh.connect({
      host: '195.35.2.75',
      username: 'root',
      password: 'SCe@11223345'
    });
    
    // 1. Check if there are requests hitting the nginx access log for this domain in the last 10 minutes
    const logCheck = await ssh.execCommand('tail -n 50 /var/log/nginx/access.log | grep -i "aman"');
    console.log('Access Log:', logCheck.stdout);
    if (logCheck.stderr) console.log('Log Error:', logCheck.stderr);

    // 2. See if there is a specific log file for amancar
    const lsLogs = await ssh.execCommand('ls -la /var/log/nginx/ | grep aman');
    console.log('Specific Nginx logs:', lsLogs.stdout);

    // 3. Check what port the NodeJS process or Vite is running on, IF ANY
    const psCheck = await ssh.execCommand('ps aux | grep node');
    console.log('Node processes:', psCheck.stdout);

    // 4. Test DNS resolution from inside the VPS
    const dnsCheck = await ssh.execCommand('ping -c 1 amancar.elitemsr.com');
    console.log('DNS Check from VPS:', dnsCheck.stdout);

    ssh.dispose();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runDeploy();

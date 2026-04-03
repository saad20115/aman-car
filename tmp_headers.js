const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();

async function runDeploy() {
  try {
    await ssh.connect({
      host: '195.35.2.75',
      username: 'root',
      password: 'SCe@11223345'
    });
    
    // Check http headers externally
    const curlExternal = await ssh.execCommand('curl -I -k "https://amancar.elitemsr.com/"');
    console.log('Headers:', curlExternal.stdout);
    
    ssh.dispose();
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runDeploy();

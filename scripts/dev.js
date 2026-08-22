const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.resolve(__dirname, '..');
const pidFile = path.join(projectRoot, '.dev-server.pid');

function readPid() {
  try {
    const pid = Number(fs.readFileSync(pidFile, 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

function removePidFile() {
  try {
    fs.rmSync(pidFile, { force: true });
  } catch {
    // A later server start can overwrite it.
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

function waitForProcessToStop(pid, timeoutMs = 5000) {
  const startedAt = Date.now();

  return new Promise((resolve) => {
    const check = () => {
      if (!isProcessRunning(pid)) {
        resolve(true);
        return;
      }

      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }

      setTimeout(check, 150);
    };

    check();
  });
}

async function stopExistingDevServer() {
  const existingPid = readPid();

  if (!existingPid) {
    removePidFile();
    return;
  }

  if (!isProcessRunning(existingPid)) {
    removePidFile();
    return;
  }

  console.log(`Stopping existing development server on this project (PID ${existingPid})...`);

  try {
    process.kill(existingPid, 'SIGTERM');
  } catch (error) {
    console.error(`Could not stop existing development server: ${error.message}`);
    process.exit(1);
  }

  const stopped = await waitForProcessToStop(existingPid);

  if (!stopped) {
    console.error('Existing development server did not stop. Close it manually, then run npm run dev again.');
    process.exit(1);
  }

  removePidFile();
}

async function main() {
  await stopExistingDevServer();

  const child = spawn(process.execPath, [path.join(projectRoot, 'server.js')], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DEV_SERVER_PID_FILE: pidFile,
    },
    stdio: 'inherit',
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.once('SIGINT', () => forwardSignal('SIGINT'));
  process.once('SIGTERM', () => forwardSignal('SIGTERM'));

  child.once('error', (error) => {
    console.error(`Could not start development server: ${error.message}`);
    process.exit(1);
  });

  child.once('exit', (code, signal) => {
    if (signal) {
      process.exit(1);
    }

    process.exit(code ?? 1);
  });
}

main();

import { execSync } from 'child_process';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3001;

try {
  console.log(`Searching for processes listening on port ${PORT}...`);
  
  if (process.platform === 'win32') {
    // Windows implementation
    let output = '';
    try {
      output = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' });
    } catch (e) {
      // execSync throws if no match is found (exit code 1)
      console.log(`No active processes found listening on port ${PORT}.`);
      process.exit(0);
    }

    const lines = output.trim().split('\n');
    const pids = new Set();
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      // Local address is parts[1] (e.g. 0.0.0.0:3001 or [::]:3001)
      if (parts[1] && (parts[1].endsWith(`:${PORT}`) || parts[1].endsWith(`]:${PORT}`))) {
        const pid = parts[parts.length - 1];
        if (pid && pid !== '0') {
          pids.add(parseInt(pid, 10));
        }
      }
    }
    
    if (pids.size === 0) {
      console.log(`No active processes found listening on port ${PORT}.`);
    } else {
      console.log(`Found active PIDs: ${Array.from(pids).join(', ')}`);
      for (const pid of pids) {
        console.log(`Terminating process with PID ${pid}...`);
        try {
          execSync(`taskkill /F /PID ${pid}`);
          console.log(`Successfully terminated process ${pid}.`);
        } catch (e) {
          console.error(`Failed to terminate process ${pid}: ${e.message}`);
        }
      }
    }
  } else {
    // macOS / Linux implementation
    let pid = '';
    try {
      pid = execSync(`lsof -t -i:${PORT}`, { encoding: 'utf8' }).trim();
    } catch (e) {
      // lsof returns status code 1 if no process is found
    }

    if (pid) {
      console.log(`Terminating process ${pid} listening on port ${PORT}...`);
      execSync(`kill -9 ${pid}`);
      console.log('Successfully terminated process.');
    } else {
      console.log(`No active processes found listening on port ${PORT}.`);
    }
  }
} catch (err) {
  console.error('An error occurred while trying to kill the server process:', err.message);
}

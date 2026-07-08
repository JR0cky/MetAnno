const { app, BrowserWindow } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function getBackendPath() {
  if (app.isPackaged) {
    // In packaged app, the backend binary is copied as an extraResource
    const exeName = process.platform === 'win32' ? 'metanno-backend.exe' : 'metanno-backend';
    return path.join(process.resourcesPath, 'metanno-backend', exeName);
  } else {
    // In development mode, run using local python virtual env
    return process.platform === 'win32' 
      ? path.join(__dirname, 'backend', '.venv', 'Scripts', 'python.exe')
      : path.join(__dirname, 'backend', '.venv', 'bin', 'python');
  }
}

function getBackendArgs() {
  if (app.isPackaged) {
    return [];
  } else {
    // In dev, run main.py directly
    return [path.join(__dirname, 'backend', 'main.py')];
  }
}

function startBackend() {
  const backendPath = getBackendPath();
  const args = getBackendArgs();
  
  console.log(`Starting backend: ${backendPath} with args: ${args}`);
  
  // Set custom port and host env vars
  const env = { 
    ...process.env, 
    PORT: '8421', 
    HOST: '127.0.0.1',
    PYTHONPATH: __dirname
  };
  
  backendProcess = spawn(backendPath, args, { env, cwd: __dirname });
  
  backendProcess.stdout.on('data', (data) => {
    console.log(`[Backend Stdout]: ${data}`);
  });
  
  backendProcess.stderr.on('data', (data) => {
    console.error(`[Backend Stderr]: ${data}`);
  });
  
  backendProcess.on('close', (code) => {
    console.log(`Backend process exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1450,
    height: 950,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    title: "MetAnno Metaphor Annotation Tool"
  });

  // Load the backend URL (which serves our React app) with a retry loop
  function loadAppURL() {
    mainWindow.loadURL('http://127.0.0.1:8421/')
      .catch((err) => {
        console.log('Backend not ready yet, retrying in 300ms...');
        setTimeout(loadAppURL, 300);
      });
  }

  loadAppURL();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', () => {
  startBackend();
  createWindow();
});

app.on('window-all-closed', () => {
  // Gracefully terminate the backend process
  if (backendProcess) {
    backendProcess.kill('SIGTERM');
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Ensure backend process is killed if parent exits
process.on('exit', () => {
  if (backendProcess) {
    backendProcess.kill('SIGKILL');
  }
});

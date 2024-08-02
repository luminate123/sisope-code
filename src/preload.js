const { contextBridge, ipcRenderer } = require('electron');
const si = require('systeminformation');
const sudo = require('sudo-prompt');
//informacion sistema de archivos
contextBridge.exposeInMainWorld('electronAPI', {
  getFsInfo: async () => {
    try {
      const data = await si.fsSize();
      return data.map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: (fs.size / 1024 / 1024 / 1024).toFixed(2),
        used: (fs.used / 1024 / 1024 / 1024).toFixed(2),
        available: (fs.available / 1024 / 1024 / 1024).toFixed(2),
        use: fs.use,
        mount: fs.mount,
        rw: fs.rw
      }));
    } catch (error) {
      console.error('Error fetching filesystem info:', error);
      return { error: 'Error fetching filesystem info' }; // Better error handling
    }
  },
});
//informacion de los procesos
contextBridge.exposeInMainWorld('InformationSys', {
  getProcesses: async () => {
    try {
      const data = await si.processes();
      return data.list.map(process => ({
        pid: process.pid,
        name: process.name,
        cpu: process.cpu,
        memory: process.mem,
        memoryV: process.memVsz,
        memoryR: process.memRss,
        state: process.state,
        command : process.command,
        priority : process.priority


      }));
    } catch (error) {
      console.error('Error fetching process info:', error);
      return { error: 'Error fetching process info' }; // Better error handling
    }
  },
  killProcess: async (pid) => {
    const result = await ipcRenderer.invoke('kill-process', pid);
    if (result.error && result.error.includes('Permission denied')) {
      // Attempt to kill process with administrator privileges
      return new Promise((resolve) => {
        const options = {
          name: 'Electron App'
        };
        sudo.exec(`taskkill /PID ${pid} /F`, options, (error, stdout, stderr) => {
          if (error) {
            resolve({ error: `Failed to kill process ${pid}: ${stderr}` });
          } else {
            resolve({ success: true });
          }
        });
      });
    }
    return result;
  }
});
contextBridge.exposeInMainWorld('electron', {
  selectFiles: (selectionType) => ipcRenderer.invoke('select-files', selectionType),
  saveFile: (defaultName) => ipcRenderer.invoke('save-file', defaultName),
  compressFiles: (filePaths, outputFilePath) => ipcRenderer.invoke('compress-files', filePaths, outputFilePath),
  on: (channel, callback) => ipcRenderer.on(channel, callback)
});
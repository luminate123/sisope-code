// index.js

const { app, BrowserWindow, ipcMain, dialog } = require('electron/main');
const path = require('node:path');
const fs = require('fs-extra');
const archiver = require('archiver');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true 
    }
  });

  win.loadFile('src/index.html');
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

ipcMain.handle('select-files', async (event, selectionType) => {
  let properties;
  if (selectionType === 'folders') {
    properties = ['openDirectory', 'multiSelections'];
  } else {
    properties = ['openFile', 'multiSelections'];
  }

  const result = await dialog.showOpenDialog({
    properties
  });
  return result.filePaths;
});

ipcMain.handle('save-file', async (event, defaultName) => {
  const result = await dialog.showSaveDialog({
    title: 'Guardar archivo ZIP',
    defaultPath: defaultName,
    filters: [
      { name: 'Zip Files', extensions: ['zip'] }
    ]
  });
  return result.filePath;
});

ipcMain.handle('compress-files', async (event, filePaths, outputFilePath) => {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputFilePath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    output.on('close', () => resolve());
    archive.on('error', err => reject(err));

    let totalSize = 0;
    let processedSize = 0;

    filePaths.forEach(file => {
      totalSize += fs.lstatSync(file).isDirectory() ? getDirectorySize(file) : fs.statSync(file).size;
    });

    function getDirectorySize(directory) {
      let size = 0;
      const files = fs.readdirSync(directory);
      files.forEach(file => {
        const filePath = path.join(directory, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          size += getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      });
      return size;
    }

    archive.on('data', data => {
      processedSize += data.length;
      const progressPercent = Math.round((processedSize / totalSize) * 100);
      event.sender.send('compression-progress', progressPercent);
    });

    archive.pipe(output);

    filePaths.forEach(file => {
      if (fs.lstatSync(file).isDirectory()) {
        archive.directory(file, path.basename(file));
      } else {
        archive.file(file, { name: path.basename(file) });
      }
    });

    archive.finalize();
  });
});

ipcMain.handle('kill-process', async (event, pid) => {
  try {
    process.kill(pid);
    return { success: true };
  } catch (error) {
    console.error(`Error killing process ${pid}:`, error);
    if (error.code === 'EPERM') {
      return { error: `Permission denied. Please run the application as an administrator to kill process ${pid}.` };
    }
    return { error: `Error killing process ${pid}: ${error.message}` };
  }
});
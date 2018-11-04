const { app, BrowserWindow, protocol, dialog,contentTracing,ipcMain,shell } = require('electron');
const { dirname, join, resolve } = require('path');
const {writeFile} = require('fs');
const protocolServe = require('electron-protocol-serve');
const electronLocalshortcut = require('electron-localshortcut');
// Following 2 lines are the fix (workaround?) from #5101
var powerSaveBlocker = require('electron').powerSaveBlocker;
powerSaveBlocker.start('prevent-app-suspension');

const autoUpdater = require('./auto-updater');
const appLocation = 'file://'+join(__dirname || resolve(dirname('')) , 'app','app.html');
process.chdir(__dirname); // force exec dir

let mainWindow = null;

// // Registering a protocol & schema to serve our application
// protocol.registerStandardSchemes(['serve'], { secure: true });
// protocolServe({
//   cwd: join(__dirname || resolve(dirname(''))),
//   app,
//   protocol
// });
// console.log(appLocation);
  
/*
crashReporter.start({
  productName: 'HospitalRun',
  companyName: 'HospitalRun',
  submitURL: 'https://webhooks.hospitalrun.io/crash',
  autoSubmit: true
});*/




function initialize() {
  let shouldQuit = app.requestSingleInstanceLock();
  if (!shouldQuit) {
    return app.quit();
  }
  ipcMain.on('print-to-pdf', (event, arg) => {
    arg = Object.assign({
      marginsType: 1,
      pageSize : 'A4',
      printBackground: false,
      printSelectionOnly: false,
      landscape: true
    },arg || {});
    console.log(arg) // prints "ping"
    let win = BrowserWindow.fromWebContents(event.sender);
    let path = dialog.showSaveDialog(win,{title:"Enregister sous",buttonLabel:"Enregistrer PDF",filters : [{name:"Fichier PDF",extensions  : ["pdf"]}]});
    if(path)
      win.webContents.printToPDF(arg, (error, data) => {
        if (error) throw error
        writeFile(path, data, (error) => {
          event.sender.send('print-to-pdf-done',error ? (error.message || error) :  null);
          console.log('Write PDF successfully.');
          try{
            // open file in default application 
            shell.openItem(path);
          }catch(e){}// ignore error
        })
      })
    else
      event.sender.send('print-to-pdf-done',"Reject");
  })
  ipcMain.on('print-to-page', (event, arg) => {
    arg = Object.assign({
      silent: false,
      printBackground: false,
      deviceName: ''
    },arg || {});
    let win = BrowserWindow.fromWebContents(event.sender);
    win.webContents.print(arg, (success) => {
      console.log('Print',success ? 'successfully' : 'Fail')
      event.sender.send('print-to-page-done',success);
    })
  })
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window.
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1025,
      minWidth: 1025,
      height: 840,
      minHeight: 780,
      show : false,
      backgroundThrottling: false,
      webPreferences: {
        nodeIntegration: true,
         preload: join(__dirname, 'preload.js')
      },
      frame: false,
      transparent: true,
      icon: join(__dirname || resolve(dirname('')) , 'app','img','logo-big.png')
    });
    mainWindow.once('ready-to-show', () => {
      mainWindow.show();
      if(process.env.DEBUG)
        mainWindow.webContents.openDevTools();
    })
    if(process.env.DEBUG)
      new BrowserWindow({
        width: 1080,
        minWidth: 680,
        height: 840,
        backgroundThrottling: false,
        webPreferences: {
          nodeIntegration: false,
          preload: join(__dirname, 'preload.js')
        }
      }).loadURL('file://'+join(__dirname || resolve(dirname('')) ,'light-admin-all-files','html_admin', 'dist','index.html'));
    else
      mainWindow.setMenu(null);
    electronLocalshortcut.register(mainWindow, 'Ctrl+D', () => {
      // mainWindow.openDevTools();
      mainWindow.webContents.openDevTools();
    });

    // Load the application using our custom protocol/scheme
    mainWindow.loadURL(appLocation);

    // If a loading operation goes wrong, we'll send Electron back to
    // App entry point
    mainWindow.webContents.on('did-fail-load', function(){
      console.log("12",arguments)
      // mainWindow.loadURL(appLocation);
    });

    mainWindow.webContents.on('crashed', function(){
      console.log('Your app (or other code) in the main window has crashed.');
      console.log('This is a serious issue that needs to be handled and/or debugged.');
      console.log(arguments)
    });

    mainWindow.on('closed', () => {
      electronLocalshortcut.unregisterAll(mainWindow);
      mainWindow = null;
    });

    mainWindow.on('unresponsive', () => {
      console.log('Your app (or other code) has made the window unresponsive.');
    });

    mainWindow.on('responsive', () => {
      console.log('The main window has become responsive again.');
    });
  }

  app.on('window-all-closed', () => {
    app.quit();
    electronLocalshortcut.unregisterAll(mainWindow);
  });

  app.on('ready', () => {
    createWindow();
    autoUpdater.initialize();
  });
}

// Handle Squirrel on Windows startup events
switch (process.argv[1]) {
  case '--squirrel-install':
    autoUpdater.createShortcut(function() {
      app.quit();
    });
    break;
  case '--squirrel-uninstall':
    autoUpdater.removeShortcut(function() {
      app.quit();
    });
    break;
  case '--squirrel-obsolete':
  case '--squirrel-updated':
    app.quit();
    break;
  default:
    initialize();
}

function makeSingleInstance() {
  if (process.mas) {
    return false;
  }

  return app.makeSingleInstance(function() {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });
}

// Handle an unhandled error in the main thread
//
// Note that 'uncaughtException' is a crude mechanism for exception handling intended to
// be used only as a last resort. The event should not be used as an equivalent to
// "On Error Resume Next". Unhandled exceptions inherently mean that an application is in
// an undefined state. Attempting to resume application code without properly recovering
// from the exception can cause additional unforeseen and unpredictable issues.
//
// Attempting to resume normally after an uncaught exception can be similar to pulling out
// of the power cord when upgrading a computer -- nine out of ten times nothing happens -
// but the 10th time, the system becomes corrupted.
//
// The correct use of 'uncaughtException' is to perform synchronous cleanup of allocated
// resources (e.g. file descriptors, handles, etc) before shutting down the process. It is
// not safe to resume normal operation after 'uncaughtException'.
process.on('uncaughtException', (err) => {
  console.log('An exception in the main thread was not handled.');
  console.log('This is a serious issue that needs to be handled and/or debugged.');
  console.log(`Exception: ${err}`);
  console.log(err);
});

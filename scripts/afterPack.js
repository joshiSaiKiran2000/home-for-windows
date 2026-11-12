const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');

exports.default = async function (context) {
  if (context.electronPlatformName === 'win32') {
    const exeName = `${context.packager.appInfo.productFilename || 'HostProcess'}.exe`;
    let exePath = path.join(context.appOutDir, exeName);

    if (!fs.existsSync(exePath)) {
      exePath = path.join(context.appOutDir, 'HostProcess.exe');
    }

    const iconPath = path.resolve(__dirname, '../build/icon.ico');
    const rceditPath = path.resolve(__dirname, '../node_modules/rcedit/bin/rcedit.exe');

    if (fs.existsSync(exePath) && fs.existsSync(iconPath) && fs.existsSync(rceditPath)) {
      console.log(`[afterPack] Injecting custom icon into ${exePath}...`);
      try {
        execFileSync(rceditPath, [exePath, '--set-icon', iconPath]);
        console.log('[afterPack] Successfully injected icon into executable!');
      } catch (err) {
        console.error('[afterPack] Failed to inject icon with rcedit:', err);
      }
    } else {
      console.warn('[afterPack] Missing files for icon injection:', { exePath, iconPath, rceditPath });
    }
  }
};


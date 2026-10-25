'use strict';
/**
 * Code-signs the finished exe (Authenticode, SHA-256, RFC 3161 timestamp) and verifies the result.
 *
 *   node scripts/sign-exe.cjs <file.exe>
 *
 * Settings come from the environment, so no key ever lives in the repository:
 *   SWA_SIGN_PFX        path to a .pfx / .p12 file                       (required)
 *   SWA_SIGN_PASSWORD   its password                                      (required)
 *   SWA_SIGN_TIMESTAMP  timestamp server, default http://timestamp.digicert.com ("none" to skip)
 *
 * It uses osslsigncode when present (Linux, macOS, Windows with it installed) and otherwise Windows' own
 * Set-AuthenticodeSignature, so the same command works on a Windows PC and in CI.
 * Run it BEFORE node scripts/checksum.cjs, because signing changes the file.
 */
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

function has(cmd, args = ['--version']) { try { return spawnSync(cmd, args, { stdio: 'ignore' }).status !== null; } catch { return false; } }

function sign(file, env = process.env, run = spawnSync) {
  const pfx = env.SWA_SIGN_PFX, password = env.SWA_SIGN_PASSWORD;
  if (!pfx || !fs.existsSync(pfx)) throw new Error('Set SWA_SIGN_PFX to your .pfx certificate file.');
  if (!password) throw new Error('Set SWA_SIGN_PASSWORD to the certificate password.');
  if (!fs.existsSync(file)) throw new Error(`Not found: ${file}`);
  const stamp = env.SWA_SIGN_TIMESTAMP ?? 'http://timestamp.digicert.com';
  const out = `${file}.signing`;
  if (has('osslsigncode', ['--version'])) {
    const args = ['sign', '-pkcs12', pfx, '-pass', password, '-h', 'sha256', '-n', 'Study with Sarang', '-in', file, '-out', out];
    if (stamp !== 'none') args.push('-ts', stamp, '-t', stamp);
    let result = run('osslsigncode', args, { encoding: 'utf8' });
    if (result.status !== 0 && stamp !== 'none') {
      // A timestamp server that cannot be reached must not block a local build; sign without one and say so.
      console.warn('  ! timestamp server unreachable, signing without a timestamp (the signature will stop validating when the certificate expires)');
      result = run('osslsigncode', ['sign', '-pkcs12', pfx, '-pass', password, '-h', 'sha256', '-n', 'Study with Sarang', '-in', file, '-out', out], { encoding: 'utf8' });
    }
    if (result.status !== 0) throw new Error(`osslsigncode failed: ${(result.stderr || result.stdout || '').slice(0, 400)}`);
    fs.renameSync(out, file);
    return 'osslsigncode';
  }
  if (process.platform === 'win32') {
    const ps = [
      '$ErrorActionPreference="Stop"',
      '$cert=Get-PfxCertificate -FilePath $env:SWA_SIGN_PFX -Password (ConvertTo-SecureString $env:SWA_SIGN_PASSWORD -AsPlainText -Force)',
      stamp === 'none' ? 'Set-AuthenticodeSignature -FilePath $args[0] -Certificate $cert -HashAlgorithm SHA256 | Out-Null'
        : 'Set-AuthenticodeSignature -FilePath $args[0] -Certificate $cert -HashAlgorithm SHA256 -TimestampServer $env:SWA_SIGN_TIMESTAMP_URL | Out-Null',
    ].join(';');
    const result = run('powershell.exe', ['-NoProfile', '-Command', `& { ${ps} }`, file], { encoding: 'utf8', env: { ...env, SWA_SIGN_TIMESTAMP_URL: stamp } });
    if (result.status !== 0) throw new Error(`PowerShell signing failed: ${(result.stderr || '').slice(0, 400)}`);
    return 'Set-AuthenticodeSignature';
  }
  throw new Error('Install osslsigncode (apt install osslsigncode, brew install osslsigncode) to sign on this system.');
}

function verify(file, cer) {
  if (!has('osslsigncode')) return null;
  const args = ['verify', '-in', file];
  if (cer) args.push('-CAfile', cer, '-ignore-timestamp', '-no-verify-time');
  const r = spawnSync('osslsigncode', args, { encoding: 'utf8' });
  return { status: r.status, text: `${r.stdout}${r.stderr}` };
}

module.exports = { sign, verify };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node scripts/sign-exe.cjs <file.exe>'); process.exit(2); }
  try {
    const tool = sign(path.resolve(file));
    console.log(`  • signed ${path.basename(file)} with ${tool}`);
    const v = verify(path.resolve(file));
    if (v) console.log(v.text.split('\n').filter((l) => /Signature verification|Number of signers|Subject:|Message digest|Signer's certificate/.test(l)).slice(0, 6).join('\n'));
    console.log('Remember to run: node scripts/checksum.cjs <folder> (the checksum must be made after signing).');
  } catch (error) { console.error(error.message); process.exit(1); }
}

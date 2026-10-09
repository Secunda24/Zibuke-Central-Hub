import {spawnSync} from 'node:child_process';
import {cpSync,existsSync,mkdtempSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot=fileURLToPath(new URL('../',import.meta.url));
const args=new Set(process.argv.slice(2));
const cli=path.join(appRoot,'node_modules/@opennextjs/cloudflare/dist/cli/index.js');
function run(entry,arguments_,cwd=appRoot,environment={}) {
  const result=spawnSync(process.execPath,[entry,...arguments_],{cwd,stdio:'inherit',env:{...process.env,...environment}});
  if(result.error)throw result.error;
  if(result.status!==0)throw new Error(`Release command failed (exit ${result.status ?? 'unknown'}). No subsequent release step was run.`);
}
try {
  if(!args.has('--skip-next-build')) {
    run(path.join(appRoot,'node_modules/next/dist/bin/next'),['build','--webpack'],appRoot,{
      NEXT_PRIVATE_STANDALONE:'true',NEXT_PRIVATE_OUTPUT_TRACE_ROOT:appRoot,
    });
  }
  if(!existsSync(path.join(appRoot,'.next/standalone/server.js')))throw new Error('A successful standalone Next.js build is required before packaging.');
  const releaseRoot=mkdtempSync(path.join(tmpdir(),'zibuke-release-'));
  console.log(`Preparing isolated Cloudflare release in ${releaseRoot}`);
  // Copy an explicit allowlist. Environment files, employee exports, backups and Git are never copied.
  for(const entry of ['app','src','components','public','package.json','package-lock.json','next.config.ts','open-next.config.ts','wrangler.json','worker.mjs','tsconfig.json','next-env.d.ts','cloudflare-env.d.ts']) {
    const source=path.join(appRoot,entry);
    if(existsSync(source))cpSync(source,path.join(releaseRoot,entry),{recursive:true});
  }
  const nextRoot=path.join(appRoot,'.next');
  cpSync(nextRoot,path.join(releaseRoot,'.next'),{recursive:true,filter:source=>{
    const relative=path.relative(nextRoot,source);
    return relative!=='cache'&&!relative.startsWith('cache'+path.sep)&&relative!=='lock';
  }});
  // Tools use installed dependencies; generated files are written outside the OneDrive workspace.
  symlinkSync(path.join(appRoot,'node_modules'),path.join(releaseRoot,'node_modules'),process.platform==='win32'?'junction':'dir');
  run(cli,['build','--skipNextBuild'],releaseRoot);
  if(args.has('--build-only'))console.log(`Worker built successfully: ${path.join(releaseRoot,'.open-next/worker.js')}`);
  else if(args.has('--dry-run'))run(path.join(appRoot,'node_modules/wrangler/bin/wrangler.js'),['deploy','--dry-run'],releaseRoot);
  else run(cli,['deploy'],releaseRoot);
  console.log(`Release artifacts retained for inspection: ${releaseRoot}`);
} catch(error) {console.error(error.message);process.exitCode=1;}

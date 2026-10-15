import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
const core = resolve('src/core'), files = readdirSync(core).filter(f=>f.endsWith('.js')).sort();
const check = process.argv.includes('--check'), temporary = check ? mkdtempSync(join(tmpdir(),'resonance-types-')) : null;
try {
  execFileSync(process.execPath,['node_modules/typescript/bin/tsc',...files.map(f=>join(core,f)),'--allowJs','--declaration','--emitDeclarationOnly','--declarationDir',temporary || core,'--noCheck','--target','es2022','--module','nodenext'],{stdio:'inherit'});
  if(check)for(const file of files){
    const name=file.replace(/\.js$/,'.d.ts');
    if(readFileSync(join(core,name),'utf8')!==readFileSync(join(temporary,name),'utf8'))throw new Error(`Declaration drift: ${name}; run npm run types:generate`);
  }
  process.stdout.write(`${files.length} core declaration files ${check?'verified':'generated'}.\n`);
} finally { if(temporary) rmSync(temporary,{recursive:true,force:true}); }

import {readFile,writeFile,mkdir,cp,chmod} from 'node:fs/promises';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const platform=resolve(dirname(fileURLToPath(import.meta.url)),'..'),project=resolve(platform,'..');
const deploy=join(platform,'.temp/cloud-english-deploy'),fn=join(deploy,'functions/kele-english-api');
await mkdir(fn,{recursive:true});
const original=await readFile(join(project,'EnglishLearning/server.mjs'),'utf8');
let provider=original.slice(original.indexOf('const BAIDU_API_KEY'),original.indexOf('const MIME ='));
provider=provider.replace('http://vop.baidu.com/server_api','https://vop.baidu.com/server_api').replace('16 * 1024 * 1024','1024 * 1024').replaceAll('await fetch(','await boundedFetch(');
// Original loadDotEnv definition remains unused. Secrets are supplied as server environment variables.
provider='import {createHash} from "node:crypto";\nconst boundedFetch=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(12000)});\n'+provider+'\nexport {handleConfig,handleBaiduAsr,handleBaiduTts,handleBaiduTranslate,handleBaiduSpeechTranslate};\n';
await writeFile(join(fn,'provider.mjs'),provider);
await cp(join(platform,'apps/cloud-english/server.mjs'),join(fn,'server.mjs'));
await writeFile(join(fn,'index.js'),'exports.main = async () => ({statusCode:200,body:"Use HTTP endpoint"});\n');
await writeFile(join(fn,'package.json'),JSON.stringify({name:'kele-english-api',version:'0.1.0',private:true,scripts:{start:'node server.mjs'}}));
await writeFile(join(fn,'scf_bootstrap'),'#!/bin/bash\nexport PORT=9000\nexec /var/lang/node20/bin/node /var/user/server.mjs\n');await chmod(join(fn,'scf_bootstrap'),0o755);
const secrets={CLOUDBASE_GATEWAY_CORS:'1'};const allowed=new Set(['BAIDU_API_KEY','BAIDU_SECRET_KEY','BAIDU_TRANSLATE_API_KEY','BAIDU_TRANSLATE_SECRET_KEY','BAIDU_TRANSLATE_APPID','BAIDU_TRANSLATE_KEY']);
for(const line of (await readFile(join(project,'EnglishLearning/.env'),'utf8')).split(/\r?\n/)){const match=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(match&&allowed.has(match[1]))secrets[match[1]]=match[2].replace(/^["']|["']$/g,'');}
if(!secrets.BAIDU_API_KEY||!secrets.BAIDU_SECRET_KEY)throw new Error('Baidu credentials unavailable');
await writeFile(join(deploy,'cloudbaserc.json'),JSON.stringify({envId:'ning-and-far-d4gnalnk55f9133e8',region:'ap-shanghai',functionRoot:'functions',functions:[{name:'kele-english-api',type:'HTTP',runtime:'Nodejs20.19',timeout:30,memorySize:256,handler:'index.main',installDependency:false,public:true,gatewayPath:'/kele-english-api',envVariables:secrets}]},null,2));
console.log(JSON.stringify({function:'kele-english-api',configured:Object.keys(secrets),config:'Ignored .temp/cloud-english-deploy/cloudbaserc.json; not in public upload'}));

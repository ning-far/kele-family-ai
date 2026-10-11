import path from 'node:path';
import { defineConfig } from '@tarojs/cli';
export default defineConfig({
 projectName:'kele-platform',date:'2026-10-01',designWidth:750,
 deviceRatio:{640:2.34/2,750:1,828:1.81/2},
 sourceRoot:'src',outputRoot:'dist',framework:'react',compiler:'webpack5',
 plugins:['@tarojs/plugin-platform-weapp'],cache:{enable:false},
 mini:{
  compile:{include:[path.resolve(process.cwd(),'../../packages')]},
  webpackChain(chain){
   chain.resolve.symlinks(true);
   chain.module.rule('script').use('babelLoader').tap(options=>({...options,configFile:path.resolve(process.cwd(),'babel.config.cjs')}));
  }
 },h5:{}
});

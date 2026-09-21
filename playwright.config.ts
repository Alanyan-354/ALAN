import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const chrome='C:/Program Files/Google/Chrome/Application/chrome.exe';
export default defineConfig({testDir:'./tests',testMatch:'browser.spec.ts',workers:1,fullyParallel:false,timeout:90000,expect:{timeout:15000},use:{baseURL:process.env.PLAYWRIGHT_BASE_URL??'http://127.0.0.1:3000',headless:true,launchOptions:existsSync(chrome)?{executablePath:chrome}:{},screenshot:'only-on-failure'},reporter:'list'});

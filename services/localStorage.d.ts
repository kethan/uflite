import type { StorageServiceOptions } from './index.js';
export function createLocalStorageService(options?: Pick<StorageServiceOptions, 'basePath' | 'publicUrl' | 'maxFileSize'>): any;
export default createLocalStorageService;

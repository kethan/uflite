import type { StorageServiceOptions } from './storage.js';
export function createLocalStorageService(options?: Pick<StorageServiceOptions, 'basePath' | 'publicUrl' | 'maxFileSize'>): any;
export default createLocalStorageService;

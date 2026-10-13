export interface StorageServiceOptions {
  type?: 'local' | 's3';
  basePath?: string;
  publicUrl?: string;
  maxFileSize?: number;
  bucket?: string;
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  endpoint?: string;
  forcePathStyle?: boolean;
  uploadExpiresIn?: number;
  downloadExpiresIn?: number;
  client?: any;
  presign?: (...args: any[]) => any;
}

export function createStorageService(options?: StorageServiceOptions): any;
export const createStorage: typeof createStorageService;
export default createStorageService;

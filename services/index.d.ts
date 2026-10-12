export type CollectionProvider = (params?: any) => any | Promise<any>;
export interface DBServiceOptions {
  idField?: string;
  paginate?: { default: number; max: number };
  multi?: boolean | string[] | Record<string, boolean>;
  initialData?: any[];
}
export function createDBService(getCollection?: CollectionProvider | null, options?: DBServiceOptions): any;
export function createTableService(db: any): any;
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

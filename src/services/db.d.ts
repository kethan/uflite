export type CollectionProvider = (params?: any) => any | Promise<any>;

export interface DBServiceOptions {
  idField?: string;
  paginate?: { default: number; max: number };
  multi?: boolean | string[] | Record<string, boolean>;
  initialData?: any[];
}

export function createDBService(getCollection?: CollectionProvider | null, options?: DBServiceOptions): any;
export default createDBService;

// Private dotted-path reader shared by optional feature modules.
export const pathValue = (object, path) =>
  String(path).split('.').reduce((value, key) => value == null ? undefined : value[key], object);

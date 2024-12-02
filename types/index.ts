export type TypeFrom<T> = T[keyof T];

export type TRequestMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "HEAD"
  | "PATCH"
  | "OPTIONS"
  | "CONNECT"
  | "TRACE";

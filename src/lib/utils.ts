import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function toJson<T>(value: T): unknown {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

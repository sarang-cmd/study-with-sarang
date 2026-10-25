import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Shared class-name utility used by shadcn-style UI components. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

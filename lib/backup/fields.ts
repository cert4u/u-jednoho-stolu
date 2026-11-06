import { z } from 'zod';

export const id = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/)
  .refine((v) => !['__proto__', 'constructor', 'prototype'].includes(v));
export const text = (n: number) => z.string().max(n);
export const int = (a: number, b: number) => z.number().int().min(a).max(b);

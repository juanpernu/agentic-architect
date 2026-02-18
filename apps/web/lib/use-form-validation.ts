'use client';

import { useState, useCallback } from 'react';
import type { z } from 'zod';

export function useFormValidation<T extends z.ZodType>(schema: T) {
  type Shape = z.infer<T>;
  const [errors, setErrors] = useState<Partial<Record<keyof Shape, string>>>({});

  const validate = useCallback(
    (data: unknown): data is Shape => {
      const result = schema.safeParse(data);
      if (result.success) {
        setErrors({});
        return true;
      }
      const fieldErrors: Partial<Record<keyof Shape, string>> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof Shape;
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return false;
    },
    [schema]
  );

  const clearErrors = useCallback(() => setErrors({}), []);

  return { errors, validate, clearErrors } as const;
}

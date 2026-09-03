import { z } from 'zod';

export const createApprovalDelegationSchema = z
  .object({
    delegatedManagerId: z.string().uuid('delegatedManagerId must be a valid UUID'),
    effectiveFrom: z.string().datetime({ message: 'effectiveFrom must be a valid ISO datetime' }),
    effectiveUntil: z.string().datetime({ message: 'effectiveUntil must be a valid ISO datetime' }),
  })
  .superRefine((data, ctx) => {
    const effectiveFrom = new Date(data.effectiveFrom);
    const effectiveUntil = new Date(data.effectiveUntil);

    if (Number.isNaN(effectiveFrom.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'effectiveFrom must be a valid date',
        path: ['effectiveFrom'],
      });
      return;
    }

    if (Number.isNaN(effectiveUntil.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'effectiveUntil must be a valid date',
        path: ['effectiveUntil'],
      });
      return;
    }

    if (effectiveUntil <= effectiveFrom) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'effectiveUntil must be after effectiveFrom',
        path: ['effectiveUntil'],
      });
    }
  });

export type CreateApprovalDelegationBody = z.infer<typeof createApprovalDelegationSchema>;

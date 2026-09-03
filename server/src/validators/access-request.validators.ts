import { AccessType } from '@prisma/client';
import { z } from 'zod';

const reasonSchema = z
  .string()
  .trim()
  .min(1, 'Reason is required')
  .max(500, 'Reason must be at most 500 characters')
  .refine((value) => value.trim().length > 0, {
    message: 'Reason cannot be empty or whitespace only',
  });

export const createAccessRequestSchema = z
  .object({
    facilityId: z.string().uuid('facilityId must be a valid UUID').optional(),
    areaId: z.string().uuid('areaId must be a valid UUID').optional(),
    assetId: z.string().uuid('assetId must be a valid UUID').optional(),
    accessType: z.nativeEnum(AccessType),
    startAt: z.string().datetime({ message: 'startAt must be a valid ISO datetime' }),
    endAt: z.string().datetime({ message: 'endAt must be a valid ISO datetime' }).optional().nullable(),
    reason: reasonSchema,
    requestedForId: z.string().uuid('requestedForId must be a valid UUID').optional(),
  })
  .superRefine((data, ctx) => {
    const targetCount = [data.facilityId, data.areaId, data.assetId].filter(Boolean).length;

    if (targetCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Exactly one of facilityId, areaId, or assetId must be provided',
        path: ['facilityId'],
      });
    }

    if (targetCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Only one of facilityId, areaId, or assetId may be provided',
        path: ['facilityId'],
      });
    }

    const startAt = new Date(data.startAt);
    if (Number.isNaN(startAt.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startAt must be a valid date',
        path: ['startAt'],
      });
      return;
    }

    if (data.accessType === AccessType.TEMPORARY) {
      if (!data.endAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endAt is required for temporary access requests',
          path: ['endAt'],
        });
        return;
      }

      const endAt = new Date(data.endAt);
      if (Number.isNaN(endAt.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endAt must be a valid date',
          path: ['endAt'],
        });
        return;
      }

      if (endAt <= startAt) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'endAt must be after startAt',
          path: ['endAt'],
        });
      }
    }

    if (data.accessType === AccessType.PERMANENT && data.endAt != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'endAt must not be provided for permanent access requests',
        path: ['endAt'],
      });
    }
  });

export type CreateAccessRequestBody = z.infer<typeof createAccessRequestSchema>;

export const accessRequestStatusFilterSchema = z
  .enum(['PENDING', 'APPROVED', 'REJECTED'])
  .optional();

export const rejectAccessRequestSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(1, 'Rejection reason is required')
    .max(500, 'Rejection reason must be at most 500 characters')
    .refine((value) => value.trim().length > 0, {
      message: 'Rejection reason cannot be empty or whitespace only',
    }),
});

export type RejectAccessRequestBody = z.infer<typeof rejectAccessRequestSchema>;

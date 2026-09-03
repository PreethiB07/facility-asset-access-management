import { z } from 'zod';

const nameSchema = z.string().trim().min(1, 'Name is required').max(200, 'Name is too long');
const descriptionSchema = z.string().trim().max(1000, 'Description is too long').optional();

export const createFacilitySchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  requiresApproval: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
});

export const updateFacilitySchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.nullable(),
    requiresApproval: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const createAreaSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  requiresApproval: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
});

export const updateAreaSchema = z
  .object({
    name: nameSchema.optional(),
    description: descriptionSchema.nullable(),
    requiresApproval: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided for update',
  });

export const createAssetSchema = z.object({
  facilityId: z.string().uuid('A valid facilityId is required'),
  areaId: z.string().uuid('areaId must be a valid UUID').nullable().optional(),
  name: nameSchema,
  description: descriptionSchema,
  requiresApproval: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
});

export const updateAssetSchema = z
  .object({
    facilityId: z.string().uuid('facilityId must be a valid UUID').optional(),
    areaId: z.string().uuid('areaId must be a valid UUID').nullable().optional(),
    name: nameSchema.optional(),
    description: descriptionSchema.nullable(),
    requiresApproval: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field must be provided for update',
  });

export type CreateFacilityInput = z.infer<typeof createFacilitySchema>;
export type UpdateFacilityInput = z.infer<typeof updateFacilitySchema>;
export type CreateAreaInput = z.infer<typeof createAreaSchema>;
export type UpdateAreaInput = z.infer<typeof updateAreaSchema>;
export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;

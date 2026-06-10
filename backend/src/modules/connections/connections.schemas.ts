import { z } from 'zod';

export const createConnectionSchema = z.object({
  phoneNumberId: z.string().min(1, 'phoneNumberId requerido'),
  displayPhone:  z.string().min(1, 'displayPhone requerido'),
  accessToken:   z.string().min(1, 'accessToken requerido'),
  businessName:  z.string().min(1, 'businessName requerido').max(100),
});

export const testConnectionSchema = z.object({
  testPhone: z.string().min(8, 'Número de teléfono inválido'),
});

export type CreateConnectionInput = z.infer<typeof createConnectionSchema>;

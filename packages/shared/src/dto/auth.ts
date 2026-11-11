import { z } from "zod";

export const RegisterSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  phone: z.string().min(8).max(20).optional(),
  password: z.string().min(8).max(128),
  businessName: z.string().min(2).max(160),
  businessCategory: z.string().min(2).max(80),
  businessWebsite: z.string().url().optional().or(z.literal("")),
  country: z.string().min(2).max(80),
  serviceInterests: z.array(z.string()).optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const ForgotPasswordSchema = z.object({ email: z.string().email() });

export const ResetPasswordSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8).max(128),
});

export const VerifyEmailSchema = z.object({ token: z.string().min(10) });

export const RefreshTokenSchema = z.object({ refreshToken: z.string().min(10) });

export const AcceptInvitationSchema = z.object({
  token: z.string().min(10),
  fullName: z.string().min(2).max(120),
  password: z.string().min(8).max(128),
});

export const CreateInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER", "FINANCE"]),
});

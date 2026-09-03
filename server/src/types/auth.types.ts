import type { Role } from '@prisma/client';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
}

export interface JwtPayload {
  userId: string;
  role: Role;
}

export interface AuthTokenResponse {
  token: string;
  user: PublicUser;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

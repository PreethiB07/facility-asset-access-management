export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_REQUIREMENTS = `Password must contain at least ${PASSWORD_MIN_LENGTH} characters.`;

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validatePassword(value: string): string | undefined {
  if (!value) {
    return 'Password is required';
  }
  if (value.length < PASSWORD_MIN_LENGTH) {
    return PASSWORD_REQUIREMENTS;
  }
  return undefined;
}

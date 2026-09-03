function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.e2e.example to .env.e2e and set credentials from docs/demo-accounts.md`,
    );
  }
  return value;
}

export const credentials = {
  acme: {
    user: {
      email: required('E2E_ACME_USER_EMAIL'),
      password: required('E2E_ACME_USER_PASSWORD'),
    },
    manager: {
      email: required('E2E_ACME_MANAGER_EMAIL'),
      password: required('E2E_ACME_MANAGER_PASSWORD'),
    },
    admin: {
      email: required('E2E_ACME_ADMIN_EMAIL'),
      password: required('E2E_ACME_ADMIN_PASSWORD'),
    },
  },
  globex: {
    user: {
      email: required('E2E_GLOBEX_USER_EMAIL'),
      password: required('E2E_GLOBEX_USER_PASSWORD'),
    },
    manager: {
      email: required('E2E_GLOBEX_MANAGER_EMAIL'),
      password: required('E2E_GLOBEX_MANAGER_PASSWORD'),
    },
    admin: {
      email: required('E2E_GLOBEX_ADMIN_EMAIL'),
      password: required('E2E_GLOBEX_ADMIN_PASSWORD'),
    },
  },
} as const;

export const apiBaseUrl = process.env.E2E_API_URL ?? 'http://localhost:3001';

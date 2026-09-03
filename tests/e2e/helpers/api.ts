import { apiBaseUrl, credentials } from './credentials';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    companyId: string;
  };
}

interface FacilitySummary {
  id: string;
  name: string;
}

interface AccessRequestPayload {
  facilityId?: string;
  areaId?: string;
  assetId?: string;
  accessType: 'TEMPORARY' | 'PERMANENT';
  startAt: string;
  endAt?: string;
  reason: string;
}

export async function loginViaApi(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(`API login failed for ${email}: ${response.status}`);
  }

  const body = (await response.json()) as AuthResponse;
  return body;
}

export async function listFacilities(token: string): Promise<FacilitySummary[]> {
  const response = await fetch(`${apiBaseUrl}/api/facilities`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(`List facilities failed: ${response.status}`);
  }

  const body = (await response.json()) as { data: FacilitySummary[] };
  return body.data;
}

export async function getFacilityIdByName(token: string, name: string): Promise<string> {
  const facilities = await listFacilities(token);
  const facility = facilities.find((item) => item.name === name);
  if (!facility) {
    throw new Error(`Facility not found: ${name}`);
  }
  return facility.id;
}

interface CreateAreaInput {
  name: string;
  description?: string;
  requiresApproval?: boolean;
}

export async function createAreaViaApi(
  token: string,
  facilityId: string,
  input: CreateAreaInput,
): Promise<{ id: string; name: string }> {
  const response = await fetch(`${apiBaseUrl}/api/facilities/${facilityId}/areas`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Create area failed: ${response.status} ${body}`);
  }

  const body = (await response.json()) as { data: { id: string; name: string } };
  return body.data;
}

interface CreateAssetInput {
  facilityId: string;
  areaId?: string | null;
  name: string;
  description?: string;
  requiresApproval?: boolean;
}

export async function createAssetViaApi(
  token: string,
  input: CreateAssetInput,
): Promise<{ id: string; name: string }> {
  const response = await fetch(`${apiBaseUrl}/api/assets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Create asset failed: ${response.status} ${body}`);
  }

  const body = (await response.json()) as { data: { id: string; name: string } };
  return body.data;
}

export async function getFacilityById(token: string, id: string) {
  const response = await fetch(`${apiBaseUrl}/api/facilities/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return {
    ok: response.ok,
    status: response.status,
    data: response.ok ? ((await response.json()) as { data: unknown }).data : null,
  };
}

export async function createAccessRequest(token: string, payload: AccessRequestPayload) {
  const response = await fetch(`${apiBaseUrl}/api/access-requests`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return {
    ok: response.ok,
    status: response.status,
    body: await response.json(),
  };
}

export async function getGlobexMainOperationsFacilityId(): Promise<string> {
  const auth = await loginViaApi(
    credentials.globex.user.email,
    credentials.globex.user.password,
  );
  const facilities = await listFacilities(auth.token);
  const facility = facilities.find((item) => item.name.includes('Globex Main Operations'));
  if (!facility) {
    throw new Error('Globex Main Operations Facility not found — run npm run db:seed in server/');
  }
  return facility.id;
}

export async function getAcmeInactiveFacilityId(): Promise<string> {
  const auth = await loginViaApi(
    credentials.acme.admin.email,
    credentials.acme.admin.password,
  );
  const response = await fetch(`${apiBaseUrl}/api/facilities?active=false`, {
    headers: { Authorization: `Bearer ${auth.token}` },
  });
  if (!response.ok) {
    throw new Error(`List inactive facilities failed: ${response.status}`);
  }
  const body = (await response.json()) as { data: FacilitySummary[] };
  const facility = body.data.find((item) => item.name.includes('Decommissioned'));
  if (!facility) {
    throw new Error('Acme inactive facility not found — run npm run db:seed in server/');
  }
  return facility.id;
}

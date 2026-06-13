export interface PassportData {
  surname: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  expiryDate: string;
  documentNumber: string;
  sodBytes: string;
  chipAuthSuccess: boolean;
}

function parseICAODate(icaoDate: string): Date {
  const yy = parseInt(icaoDate.slice(0, 2), 10);
  const mm = parseInt(icaoDate.slice(2, 4), 10) - 1;
  const dd = parseInt(icaoDate.slice(4, 6), 10);
  const year = yy < 50 ? 2000 + yy : 1900 + yy;
  return new Date(year, mm, dd);
}

export async function validatePassport(data: PassportData): Promise<{ valid: boolean; reason?: string }> {
  if (!data.chipAuthSuccess) {
    return { valid: false, reason: 'chip authentication failed' };
  }

  const expiry = parseICAODate(data.expiryDate);
  if (expiry < new Date()) {
    return { valid: false, reason: 'passport expired' };
  }

  return { valid: true };
}

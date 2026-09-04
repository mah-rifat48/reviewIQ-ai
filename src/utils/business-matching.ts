export function normalizeString(str?: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function businessMatches(
  business: any,
  businessName?: string,
  address?: string,
): boolean {
  if (!business) return false;

  const bName = normalizeString(business.business_name || business.name);
  const targetName = normalizeString(businessName);

  if (targetName && !bName.includes(targetName) && !targetName.includes(bName)) {
    return false;
  }

  if (address) {
    const targetAddr = normalizeString(address);
    const bAddr = normalizeString(
      business.business_address || business.input_address || '',
    );
    if (!bAddr.includes(targetAddr) && !targetAddr.includes(bAddr)) {
      return false;
    }
  }

  return true;
}

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
    if (targetAddr && bAddr && !bAddr.includes(targetAddr) && !targetAddr.includes(bAddr)) {
      return false;
    }
  }

  return true;
}

export function findUserBusiness(
  businesses: any[],
  businessName?: string,
  address?: string,
): any | null {
  if (!businesses || businesses.length === 0) return null;

  // 1. Exact or fuzzy match on both name and address
  let match = businesses.find((b) => businessMatches(b, businessName, address));
  if (match) return match;

  // 2. Match on business_name alone
  if (businessName) {
    const targetName = normalizeString(businessName);
    match = businesses.find((b) => {
      const bName = normalizeString(b.business_name || b.name);
      return bName && targetName && (bName.includes(targetName) || targetName.includes(bName));
    });
    if (match) return match;
  }

  // 3. Fallback to first business
  return businesses[0];
}

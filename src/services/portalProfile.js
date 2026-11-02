/** Map only attributes supplied by CAP ProfileService v0.7.4. */
export function toPortalUser(profile) {
  if (!profile) return null
  const firstName = profile.FNAME || ''
  const lastName = profile.LNAME || ''
  return {
    uuid: profile.UUID,
    iasId: profile.IAS_ID,
    accountType: profile.ACCOUNT_TYPE || '',
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(' ') || profile.EMAIL || '',
    welcomeName: firstName,
    email: profile.EMAIL || '',
  }
}

export function toProfileDetails(profile, original = {}) {
  return {
    ...original,
    // Unsupported attributes are intentionally blank; do not invent identity data.
    firstName: profile?.FNAME || '',
    fatherName: '',
    grandfatherName: '',
    lastName: profile?.LNAME || '',
    email: profile?.EMAIL || '',
    phone: '',
    documentNo: '',
    building: '',
    apartment: '',
    street: '',
    city: '',
    postal: '',
  }
}

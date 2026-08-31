/*
 * The legal entity behind footfall.
 *
 * Google's OAuth review checks that the operator named in the privacy
 * policy, the operator named in the terms, and the owner of the verified
 * domain are the same. Keeping the details in one place is what stops
 * those three drifting apart.
 */

export const COMPANY = {
  legalName: "Doubt Buddy Education Technology Private Limited",
  shortName: "Doubt Buddy Education Technology Pvt. Ltd.",
  product: "footfall",
  site: "https://footfall.zone",
  address: {
    line1: "36 Imambara, Near Jain Kanya Pathshala",
    city: "Muzaffarnagar",
    state: "Uttar Pradesh",
    pin: "251002",
    country: "India",
  },
  gst: "09AAICD1656J1ZE",
  email: "community@doubtbuddy.in",
  phone: "+91 70175 30842",
  phoneHref: "+917017530842",
  founder: {
    name: "Nishkarsh Bansal",
    linkedin: "https://www.linkedin.com/in/nishkarsh-bansal-2676a8115/",
  },
  /** Named under the DPDP Act so complaints have somewhere to land. */
  grievanceOfficer: "Nishkarsh Bansal",
  jurisdiction: "Muzaffarnagar, Uttar Pradesh",
  updated: "31 August 2026",
} as const;

/** "36 Imambara…, Muzaffarnagar, Uttar Pradesh 251002, India" */
export const ADDRESS_LINE = [
  COMPANY.address.line1,
  COMPANY.address.city,
  `${COMPANY.address.state} ${COMPANY.address.pin}`,
  COMPANY.address.country,
].join(", ");

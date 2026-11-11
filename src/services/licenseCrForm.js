/** Fields originating from the user's authorized CR_DETAILS record. */
const DB_FIELDS = Object.freeze({
  national: "crNationalNumber",
  companyEn: "companyNameEn",
  nameAr: "companyNameAr",
  address: "address",
  cityCode: "cityCode",
  postal: "postal",
  district: "district",
  street: "street",
  building: "building",
  secondary: "secondary",
  shortAddress: "shortAddress",
});

const nonempty = (value) => value != null && String(value).trim() !== "";
const valueOrEmpty = (value) => (value == null ? "" : String(value));

/** The selected CR's ID is the select value; the CR number is what users see. */
export function crToForm(record, language = "en") {
  if (!record?.id || !nonempty(record.crNumber))
    throw new Error("Invalid commercial registration");
  return {
    crId: String(record.id),
    number: valueOrEmpty(record.crNumber),
    national: valueOrEmpty(record.crNationalNumber),
    companyEn: valueOrEmpty(record.companyNameEn),
    nameAr: valueOrEmpty(record.companyNameAr),
    address: valueOrEmpty(record.address),
    cityCode: valueOrEmpty(record.cityCode),
    city: valueOrEmpty(
      language === "ar"
        ? record.cityAr || record.cityEn
        : record.cityEn || record.cityAr,
    ),
    postal: valueOrEmpty(record.postal),
    district: valueOrEmpty(record.district),
    street: valueOrEmpty(record.street),
    building: valueOrEmpty(record.building),
    secondary: valueOrEmpty(record.secondary),
    shortAddress: valueOrEmpty(record.shortAddress),
  };
}

/** Only fields originally present in PostgreSQL are locked; blank ones can be completed. */
export function crFieldIsLocked(record, field) {
  if (!record) return false;
  if (field === "number") return true; // selected CR identity is never editable
  if (field === "city")
    return nonempty(record.cityEn) || nonempty(record.cityAr);
  const key = DB_FIELDS[field];
  return key ? nonempty(record[key]) : false;
}

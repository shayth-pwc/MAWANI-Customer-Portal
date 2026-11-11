import { useEffect, useState } from "react";
import { getLicenseList } from "../services/licenseListsApi";

const CODES = [
  "INVESTOR_TYPE",
  "SERVICE_TYPE",
  "LICENSE_TYPE",
  "PORT_FOR_PERMIT",
  "ACTIVITY_TYPE",
  "APPLICANT_DOCUMENT_TYPE",
];
export function useLicenseLookups(enabled = true) {
  const [state, setState] = useState({ lists: {}, loading: false, error: "" });
  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    // Always re-read admin-managed lists on opening the form; never use hardcoded fallback values.
    Promise.resolve().then(() => {
      if (active) setState({ lists: {}, loading: true, error: "" });
    });
    Promise.all(CODES.map(async (code) => [code, await getLicenseList(code)]))
      .then((entries) => {
        if (active)
          setState({
            lists: Object.fromEntries(entries),
            loading: false,
            error: "",
          });
      })
      .catch((error) => {
        if (active)
          setState({
            lists: {},
            loading: false,
            error: error.message || "Could not load license lists",
          });
      });
    return () => {
      active = false;
    };
  }, [enabled]);
  return state;
}

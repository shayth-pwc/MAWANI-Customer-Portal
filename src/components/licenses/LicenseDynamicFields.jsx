import { useApp } from "../../hooks/useApp";
import { useLicenseLookups } from "../../hooks/useLicenseLookups";

const classes =
  "h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-text-primary";

export default function LicenseDynamicFields({
  form,
  onChange,
  enabled = true,
}) {
  const { language } = useApp();
  const ar = language === "ar";
  const { lists, loading, error } = useLicenseLookups(enabled);
  const options = (code) =>
    (lists[code] || []).filter(
      (item) =>
        code !== "LICENSE_TYPE" ||
        !["ZSA001", "ZMA001", "ZSA002"].includes(item.key),
    );
  const selected = form.comprehensive
    ? form.licenseTypes || []
    : [form.licenseType].filter(Boolean);
  const selectedServices = form.serviceTypes || [];
  const update = (patch) => onChange({ ...form, ...patch });
  const dropdown = (code, value, handle, required = true) => (
    <select
      required={required}
      value={value || ""}
      disabled={loading || !options(code).length}
      onChange={(e) => handle(e.target.value)}
      className={classes}
    >
      <option value="">{ar ? "\u0627\u062e\u062a\u0631" : "Select"}</option>
      {options(code).map((item) => (
        <option key={item.key} value={item.key}>
          {ar ? item.titleAr : item.title}
        </option>
      ))}
    </select>
  );
  const field = (label, child) => (
    <label className="flex flex-col gap-1 text-sm font-medium text-text-secondary">
      <span>{label}</span>
      {child}
    </label>
  );
  return (
    <div
      className="col-span-full grid gap-4 sm:grid-cols-2"
      data-testid="license-dynamic-fields"
    >
      {error && (
        <p role="alert" className="col-span-full text-sm text-error-primary">
          {error}
        </p>
      )}
      {field(
        ar
          ? "\u0646\u0648\u0639 \u0627\u0644\u0645\u0633\u062a\u062b\u0645\u0631"
          : "Investor type",
        dropdown("INVESTOR_TYPE", form.investor, (v) =>
          update({ investor: v }),
        ),
      )}
      <fieldset className="col-span-full grid gap-2 rounded-lg border border-border p-3">
        <legend className="text-sm font-medium text-text-secondary">
          {ar ? "الخدمات المطلوبة" : "Requested services (select one or more)"}
        </legend>
        {options("SERVICE_TYPE").map((item) => (
          <label
            key={item.key}
            className="flex items-center gap-2 text-sm text-text-secondary"
          >
            <input
              type="checkbox"
              disabled={loading}
              checked={selectedServices.includes(item.key)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...selectedServices, item.key]
                  : selectedServices.filter((code) => code !== item.key);
                update({
                  serviceTypes: next,
                  serviceType: next[0] || "",
                  portCode: next.includes("111") ? form.portCode : "",
                });
              }}
            />
            {ar ? item.titleAr : item.title}
          </label>
        ))}
        {!options("SERVICE_TYPE").length && !loading && (
          <p className="text-sm text-text-tertiary">
            {ar
              ? "لا توجد خدمات متاحة"
              : "No active services have been configured"}
          </p>
        )}
      </fieldset>
      {selectedServices.includes("111") &&
        field(
          ar ? "\u0627\u0644\u0645\u064a\u0646\u0627\u0621" : "Port for permit",
          dropdown("PORT_FOR_PERMIT", form.portCode, (v) =>
            update({ portCode: v }),
          ),
        )}
      <div className="col-span-full flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <input
            type="checkbox"
            checked={Boolean(form.comprehensive)}
            onChange={(e) =>
              update({
                comprehensive: e.target.checked,
                licenseTypes: [],
                licenseType: "",
              })
            }
          />
          {ar
            ? "\u0627\u0644\u0631\u062e\u0635\u0629 \u0627\u0644\u0634\u0627\u0645\u0644\u0629"
            : "Comprehensive License"}
        </label>
        {form.comprehensive ? (
          <fieldset className="grid gap-2 rounded-lg border border-border p-3">
            <legend className="text-sm font-medium text-text-secondary">
              {ar
                ? "\u0623\u0646\u0648\u0627\u0639 \u0627\u0644\u0631\u062e\u0635"
                : "License types"}
            </legend>
            {!options("LICENSE_TYPE").length && (
              <p className="text-sm text-text-tertiary">
                {ar
                  ? "\u0644\u0627 \u062a\u0648\u062c\u062f \u062e\u064a\u0627\u0631\u0627\u062a"
                  : "Admin has not configured this list"}
              </p>
            )}
            {options("LICENSE_TYPE").map((item) => (
              <label
                key={item.key}
                className="flex items-center gap-2 text-sm text-text-secondary"
              >
                <input
                  type="checkbox"
                  value={item.key}
                  checked={(form.licenseTypes || []).includes(item.key)}
                  onChange={(e) =>
                    update({
                      licenseTypes: e.target.checked
                        ? [...(form.licenseTypes || []), item.key]
                        : (form.licenseTypes || []).filter(
                            (k) => k !== item.key,
                          ),
                    })
                  }
                />
                <span>{ar ? item.titleAr : item.title}</span>
              </label>
            ))}
          </fieldset>
        ) : (
          field(
            ar
              ? "\u0646\u0648\u0639 \u0627\u0644\u0631\u062e\u0635\u0629"
              : "License type",
            dropdown("LICENSE_TYPE", form.licenseType, (v) =>
              update({ licenseType: v }),
            ),
          )
        )}
      </div>
      {field(
        ar
          ? "\u0646\u0648\u0639 \u0627\u0644\u0647\u0648\u064a\u0629"
          : "Applicant document type",
        dropdown("APPLICANT_DOCUMENT_TYPE", form.documentType, (v) =>
          update({ documentType: v }),
        ),
      )}
      {selected.includes("ZSA013") && (
        <>
          {field(
            ar
              ? "\u0627\u0633\u0645 \u0627\u0644\u0633\u0641\u064a\u0646\u0629"
              : "Ship name",
            <input
              className={classes}
              value={form.shipName || ""}
              onChange={(e) => update({ shipName: e.target.value })}
            />,
          )}
          {field(
            ar
              ? "\u0646\u0648\u0639 \u0627\u0644\u0646\u0634\u0627\u0637"
              : "Activity type",
            dropdown(
              "ACTIVITY_TYPE",
              form.activityType,
              (v) => update({ activityType: v }),
              false,
            ),
          )}
          {field(
            ar
              ? "\u062a\u0627\u0631\u064a\u062e \u0631\u062e\u0635\u0629 \u0648\u0632\u0627\u0631\u0629 \u0627\u0644\u0637\u0627\u0642\u0629"
              : "Ministry of Energy license date",
            <input
              type="date"
              className={classes}
              value={form.ministryEnergyLicenseDate || ""}
              onChange={(e) =>
                update({ ministryEnergyLicenseDate: e.target.value })
              }
            />,
          )}
        </>
      )}
      {loading && (
        <p role="status" className="col-span-full text-sm text-text-tertiary">
          {ar
            ? "\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0642\u0648\u0627\u0626\u0645..."
            : "Loading admin-managed options..."}
        </p>
      )}
    </div>
  );
}

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { icons } from "../assets";
import Button from "../components/ui/Button";
import DateField from "../components/ui/DateField";
import { DrawerClose, FeaturedIcon } from "../components/common/InfoDrawer";
import LoadingCards from "../components/common/LoadingCards";
import { useApp } from "../hooks/useApp";
import LicenseDynamicFields from "../components/licenses/LicenseDynamicFields";
import {
  getMyLicenses,
  getMyRequests,
  getC4cConnection,
  getServicePrices,
  getServiceQuote,
  submitLicenseRequest,
  fileToC4cAttachment,
  getMyCommercialRegistrations,
  getLicenseAttachments,
  getRequestAttachments,
  renewLicenseRequest,
} from "../services/licensesApi";
import { calculatePreview, displaySar } from "../services/licensePricing";
import { crToForm, crFieldIsLocked } from "../services/licenseCrForm";
import { useLicenseLookups } from "../hooks/useLicenseLookups";

const emptyFilters = {
  start: "",
  end: "",
  active: false,
  expired: false,
  suspended: false,
};

function countLabel(count) {
  return String(count).padStart(2, "0");
}

function displayDate(iso) {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

function chipDate(iso) {
  const [year, month, day] = iso.split("-");
  return `${Number(day)}/${Number(month)}/${year}`;
}

const STATUS_KEYS = {
  Active: "crActive",
  Expired: "invExpired",
  Suspended: "licSuspended",
  Open: "open",
  Approved: "approved",
};

function statusLabel(t, status) {
  return STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status;
}

function FunnelIcon({ active }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2.5 3.75h15l-5.833 6.917v4.583L8.333 16.667V10.667L2.5 3.75Z"
        stroke={active ? "#1b8354" : "#535862"}
        strokeWidth="1.67"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 4.167v11.666M4.167 10h11.666"
        stroke="currentColor"
        strokeWidth="1.67"
        strokeLinecap="round"
      />
    </svg>
  );
}

function RenewIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13.333 8A5.333 5.333 0 0 1 4.2 11.2M2.667 8A5.333 5.333 0 0 1 11.8 4.8"
        stroke="#1b8354"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M11.333 2.667h2V4.667M4.667 13.333h-2V11.333"
        stroke="#1b8354"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M1.333 6.667h13.334M2.667 3.333h10.666c.737 0 1.334.597 1.334 1.334v6.666c0 .737-.597 1.334-1.334 1.334H2.667c-.737 0-1.334-.597-1.334-1.334V4.667c0-.737.597-1.334 1.334-1.334Z"
        stroke="#1b8354"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 7.5v3.333M10 13.333h.008M8.575 3.383 1.517 15.5A1.667 1.667 0 0 0 2.942 18h14.116a1.667 1.667 0 0 0 1.425-2.5L11.425 3.383a1.667 1.667 0 0 0-2.85 0Z"
        stroke="#b54708"
        strokeWidth="1.67"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function statusClass(status) {
  if (status === "Active" || status === "Open")
    return "border-success-200 bg-success-50 text-success-700";
  if (status === "Suspended")
    return "border-orange-200 bg-orange-50 text-orange-700";
  if (status === "Expired")
    return "border-[#d5d9eb] bg-[#f8f9fc] text-[#515481]";
  return "border-indigo-200 bg-indigo-50 text-indigo-700";
}

function matchesQuery(row, query) {
  if (!query) return true;
  return [row.code, row.name, row.cr, row.company, row.service]
    .join(" ")
    .toLowerCase()
    .includes(query.trim().toLowerCase());
}

function selectedStatuses(filters) {
  return [
    filters.active && "Active",
    filters.expired && "Expired",
    filters.suspended && "Suspended",
  ].filter(Boolean);
}

export default function LicensesPage() {
  const { t, language } = useApp();
  const [tab, setTab] = useState("licenses");
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [c4cStatus, setC4cStatus] = useState("Checking C4C destination...");
  const [query, setQuery] = useState("");
  const [licenses, setLicenses] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [filters, setFilters] = useState(emptyFilters);
  const [statusSort, setStatusSort] = useState(null);
  const [startWidth, setStartWidth] = useState(140);
  const [resizing, setResizing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [drawer, setDrawer] = useState(null);
  const [renewalRow, setRenewalRow] = useState(null);
  const filterRef = useRef(null);

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onPointer = (event) => {
      if (!window.matchMedia("(min-width: 1024px)").matches) return;
      if (!filterRef.current || filterRef.current.contains(event.target))
        return;
      setFiltersOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [filtersOpen]);

  const reloadFromC4c = useCallback(async () => {
    setLoading(true);
    setPageError("");
    try {
      const [remoteLicenses, remoteRequests] = await Promise.all([
        getMyLicenses(),
        getMyRequests(),
      ]);
      setLicenses(
        remoteLicenses.map((r, index) => ({
          id: r.ObjectID || r.AccountID || String(index),
          code: r.LicenseNumber || "",
          name: (language === "ar" ? r.LicenseTypeTextAr : r.LicenseTypeText) || r.LicenseType || "",
          title: r.CompanyName || "",
          start: r.StartDate || "",
          expiry: r.ExpiryDate || "",
          status: r.Status || "",
          service: (language === "ar" ? r.PortTextAr : r.PortText) || r.Port || "",
          cr: r.CRNationalNumber || "",
          amount: r.Amount || "",
          company: r.CompanyName || "",
          accountId: r.AccountID || "",
          crNumber: r.CommercialRegistrationNumber || "",
          licenseType: r.LicenseType || "",
          kind: "license",
        })),
      );
      setRequests(
        remoteRequests.map((r, index) => ({
          id: r.ObjectID || r.ID || String(index),
          code: r.ID || "",
          name: (language === "ar" ? r.LicenseTypeTextAr : r.LicenseTypeText) || r.LicenseType || "",
          title: (language === "ar" ? r.LicenseTypeTextAr : r.LicenseTypeText) || r.LicenseType || "",
          start: r.CreatedAt || "",
          expiry: "",
          status: r.Status || "",
          service: (language === "ar" ? r.ServiceTypeTextAr : r.ServiceTypeText) || r.ServiceType || r.RequestType || "",
          cr: r.CRNationalNumber || "",
          amount: r.Amount || "",
          company: r.CompanyName || r.CommercialRegistrationNumber || "",
          kind: "request",
        })),
      );
    } catch (error) {
      setLicenses([]);
      setRequests([]);
      setPageError(error.message || "Cannot retrieve C4C licenses");
    } finally {
      setLoading(false);
    }
  }, [language]);
  useEffect(() => {
    let active = true;

    Promise.resolve().then(() => {
      if (active) {
        void reloadFromC4c();
      }
    });

    return () => {
      active = false;
    };
  }, [reloadFromC4c]);
  useEffect(() => {
    let active = true;
    getC4cConnection()
      .then(() => {
        if (active)
          setC4cStatus(
            "C4C metadata reachable; business APIs not yet verified",
          );
      })
      .catch(() => {
        if (active) setC4cStatus("C4C destination not verified");
      });
    return () => {
      active = false;
    };
  }, []);

  const filtersActive = Boolean(
    filters.start ||
    filters.end ||
    filters.active ||
    filters.expired ||
    filters.suspended,
  );

  const licenseRows = useMemo(() => {
    const statuses = selectedStatuses(filters);
    const rows = licenses.filter((row) => {
      if (!matchesQuery(row, query)) return false;
      if (filters.start && row.start < filters.start) return false;
      if (filters.end && row.expiry > filters.end) return false;
      if (statuses.length && !statuses.includes(row.status)) return false;
      return true;
    });
    if (!statusSort) return rows;
    return [...rows].sort((a, b) => {
      const order = a.status.localeCompare(b.status);
      return statusSort === "asc" ? order : -order;
    });
  }, [filters, licenses, query, statusSort]);

  const requestRows = useMemo(() => {
    const next = requests.filter((row) => matchesQuery(row, query));
    if (!statusSort) return next;
    return [...next].sort((a, b) => {
      const order = a.status.localeCompare(b.status);
      return statusSort === "asc" ? order : -order;
    });
  }, [query, requests, statusSort]);
  const rows = tab === "licenses" ? licenseRows : requestRows;

  function rowName(row) {
    return row.name;
  }

  function rowService(row) {
    return row.service === "Type here" ? t("licTypeHere") : row.service;
  }

  function exportRows() {
    const headers = [
      t("licNameCode"),
      t("licStartDateCol"),
      t("licExpiryDate"),
      t("invStatus"),
      t("reqServiceType"),
      t("reqCrNational"),
      t("licAmountSarCol"),
      t("reqCompanyName"),
    ];
    const source = tab === "licenses" ? licenseRows : requestRows;
    const lines = [
      headers,
      ...source.map((row) => [
        `${row.code} ${rowName(row)}`,
        displayDate(row.start),
        displayDate(row.expiry),
        statusLabel(t, row.status),
        rowService(row),
        row.cr,
        row.amount,
        row.company,
      ]),
    ];
    const safeCsv = (cell) => {
      const value = String(cell ?? "");

      // Prevent spreadsheet formula injection.
      const safeValue = /^[=+@-]/.test(value.trimStart()) ? `'${value}` : value;

      // Escape double quotes according to CSV rules.
      return `"${safeValue.replaceAll('"', '""')}"`;
    };
    const url = URL.createObjectURL(
      new Blob(
        [lines.map((cells) => cells.map(safeCsv).join(",")).join("\n")],
        { type: "text/csv" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      tab === "licenses" ? "licenses.csv" : "license-requests.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function startResize(event) {
    event.preventDefault();
    const startX = event.clientX;
    const width = startWidth;
    const direction = document.documentElement.dir === "rtl" ? -1 : 1;
    setResizing(true);
    const move = (moveEvent) =>
      setStartWidth(
        Math.min(
          280,
          Math.max(110, width + (moveEvent.clientX - startX) * direction),
        ),
      );
    const stop = () => {
      setResizing(false);
      document.removeEventListener("mousemove", move);
      document.removeEventListener("mouseup", stop);
    };
    document.addEventListener("mousemove", move);
    document.addEventListener("mouseup", stop);
  }

  function renew() {
    setRenewalRow(drawer);
    setDrawer(null);
  }

  function openFilters() {
    setDraftFilters(filters);
    setFiltersOpen((open) => !open);
  }

  function applyFilters() {
    setFilters(draftFilters);
    setFiltersOpen(false);
  }

  return (
    <div className="px-4 pb-10 pt-4 md:px-8">
      <p className="mb-3 text-xs text-text-tertiary" role="status">
        {c4cStatus}
      </p>
      {pageError ? (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {pageError}
        </p>
      ) : null}
      <div className="mb-4 flex items-center justify-between gap-3 lg:hidden">
        <h1 className="text-display-xs font-semibold text-text-primary">
          {t("licPageTitle")}
        </h1>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-1 text-sm font-semibold text-brand"
        >
          <PlusIcon />
          {t("licNew")}
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-end gap-4 overflow-x-auto sm:gap-6">
          <TabButton
            active={tab === "licenses"}
            label={t("licenses")}
            count={licenses.length}
            onClick={() => setTab("licenses")}
          />
          <TabButton
            active={tab === "requests"}
            label={t("requests")}
            count={requests.length}
            onClick={() => setTab("requests")}
          />
        </div>
        <div className="ms-auto hidden items-center gap-3 lg:flex">
          <SearchField value={query} onChange={setQuery} t={t} />
          <span className="h-6 w-px bg-border" aria-hidden="true" />
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-label={t("invFilters")}
              onClick={openFilters}
              className="relative flex size-10 items-center justify-center"
            >
              <FunnelIcon active={filtersOpen || filtersActive} />
              {filtersActive ? (
                <span className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-brand" />
              ) : null}
            </button>
            {filtersOpen ? (
              <FilterMenu
                draft={draftFilters}
                onChange={setDraftFilters}
                onCancel={() => setFiltersOpen(false)}
                onApply={applyFilters}
              />
            ) : null}
          </div>
          <button
            type="button"
            aria-label={t("invDownload")}
            onClick={exportRows}
            className="flex size-10 items-center justify-center"
          >
            <img src={icons.excel} alt="" width={20} height={20} />
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-white px-3.5 text-sm font-semibold text-brand shadow-xs"
          >
            <PlusIcon />
            {t("licNew")}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2 lg:hidden">
        <MobileSearchField value={query} onChange={setQuery} />
        <button
          type="button"
          aria-label={t("invDownload")}
          onClick={exportRows}
          className="flex size-10 shrink-0 items-center justify-center"
        >
          <img src={icons.excel} alt="" width={20} height={20} />
        </button>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-label={t("invFilters")}
          onClick={openFilters}
          className="relative flex size-10 shrink-0 items-center justify-center"
        >
          <FunnelIcon active={filtersOpen || filtersActive} />
          {filtersActive ? (
            <span className="absolute end-1.5 top-1.5 size-1.5 rounded-full bg-brand" />
          ) : null}
        </button>
      </div>

      {filtersOpen ? (
        <FilterSheet
          draft={draftFilters}
          onChange={setDraftFilters}
          onCancel={() => setFiltersOpen(false)}
          onApply={applyFilters}
        />
      ) : null}

      {tab === "licenses" && filtersActive ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {filters.start ? (
            <FilterChip
              label={t("licStartChip", { date: chipDate(filters.start) })}
              onRemove={() => setFilters({ ...filters, start: "" })}
            />
          ) : null}
          {filters.end ? (
            <FilterChip
              label={t("licEndChip", { date: chipDate(filters.end) })}
              onRemove={() => setFilters({ ...filters, end: "" })}
            />
          ) : null}
          {selectedStatuses(filters).map((status) => (
            <FilterChip
              key={status}
              label={statusLabel(t, status)}
              onRemove={() =>
                setFilters({ ...filters, [status.toLowerCase()]: false })
              }
            />
          ))}
          <button
            type="button"
            className="text-sm font-semibold text-brand"
            onClick={() => setFilters(emptyFilters)}
          >
            {t("visRemoveAll")}
          </button>
        </div>
      ) : null}

      {loading ? (
        <LoadingCards />
      ) : rows.length === 0 ? (
        <section className="overflow-hidden rounded-3xl border border-border bg-white">
          <EmptyLicenses
            onCreate={() => setModalOpen(true)}
            requests={tab === "requests"}
          />
        </section>
      ) : (
        <>
          <section className="hidden overflow-hidden rounded-3xl border border-border bg-white lg:block">
            <LicenseTable
              rows={rows}
              requests={tab === "requests"}
              startWidth={startWidth}
              resizing={resizing}
              statusSort={statusSort}
              onSort={() =>
                setStatusSort((current) => (current === "asc" ? "desc" : "asc"))
              }
              onResizeStart={startResize}
              onOpen={setDrawer}
            />
          </section>
          <div className="flex flex-col gap-3 lg:hidden">
            {rows.map((row) => (
              <LicenseMobileCard key={row.id} row={row} onOpen={setDrawer} />
            ))}
          </div>
        </>
      )}

      <p className="mt-8 text-center text-xs text-text-placeholder lg:hidden">
        {t("rightsReserved")}
      </p>

      <LicenseDrawer
        row={drawer}
        onClose={() => setDrawer(null)}
        onRenew={renew}
      />
      <RenewLicenseModal
        row={renewalRow}
        onClose={() => setRenewalRow(null)}
        onComplete={async () => {
          await reloadFromC4c();
          setRenewalRow(null);
        }}
      />
      <NewLicenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={async (draft) => {
          const attachments = draft.file
            ? [await fileToC4cAttachment(draft.file)]
            : [];
          const result = await submitLicenseRequest({
            clientRequestId: draft.clientRequestId,
            crNationalNumber: draft.national,
            crNumber: draft.number,
            licenseTypes: draft.comprehensive
              ? draft.licenseTypes
              : [draft.licenseType],
            investorType: draft.investor,
            serviceType: draft.serviceType,
            serviceTypes: draft.serviceTypes,
            portCode: draft.portCode || "",
            activityType: draft.activityType || "",
            shipName: draft.shipName || "",
            ministryEnergyLicenseDate: draft.ministryEnergyLicenseDate || null,
            applicant: {
              name: draft.applicantName,
              id: draft.applicantId,
              documentType: draft.documentType,
              mobile: draft.applicantMobile,
              email: draft.applicantEmail,
            },
            address: {
              cityCode: draft.cityCode,
              postalCode: draft.postal,
              district: draft.district,
              street: draft.street,
              building: draft.building,
              secondaryNumber: draft.secondary,
            },
            attachments,
          });
          const incomplete =
            result.results?.filter(
              (item) =>
                !["SUCCEEDED", "ALREADY_SUCCEEDED"].includes(item.status),
            ) || [];
          if (incomplete.length)
            throw new Error(
              "C4C needs attention: " +
                incomplete
                  .map((i) => i.type + " (" + i.status + ")")
                  .join(", "),
            );
          await reloadFromC4c();
          setTab("requests");
          setModalOpen(false);
        }}
      />
    </div>
  );
}

function TabButton({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-10 items-center gap-2 border-b-2 px-3 text-sm font-semibold ${active ? "border-brand bg-brand-50 text-brand" : "border-transparent text-text-tertiary"}`}
    >
      {label}
      <span
        className={`rounded-full px-2 py-0.5 text-xs font-medium ${active ? "bg-white text-brand" : "bg-bg-active text-text-placeholder"}`}
      >
        {countLabel(count)}
      </span>
    </button>
  );
}

function SearchField({ value, onChange, t }) {
  return (
    <label className="flex h-10 items-center gap-2">
      <img src={icons.search} alt="" width={20} height={20} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("invSearch")}
        aria-label={t("invSearch")}
        className="w-16 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-placeholder"
      />
      {value ? (
        <button
          type="button"
          aria-label={t("invClearSearch")}
          onClick={() => onChange("")}
        >
          <img src={icons.xClose} alt="" width={20} height={20} />
        </button>
      ) : null}
    </label>
  );
}

function MobileSearchField({ value, onChange }) {
  const { t } = useApp();
  return (
    <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-white px-3 shadow-xs">
      <img src={icons.search} alt="" width={20} height={20} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("licSearchPlaceholder")}
        aria-label={t("licSearchPlaceholder")}
        className="min-w-0 flex-1 bg-transparent text-sm font-medium text-text-primary outline-none placeholder:font-normal placeholder:text-text-placeholder"
      />
      {value ? (
        <button
          type="button"
          aria-label={t("invClearSearch")}
          onClick={() => onChange("")}
        >
          <img src={icons.xClose} alt="" width={20} height={20} />
        </button>
      ) : null}
    </label>
  );
}

function LicenseMobileCard({ row, onOpen }) {
  const { t } = useApp();
  const name = row.name;
  return (
    <article className="rounded-2xl border border-border bg-white p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-text-tertiary">{row.code}</p>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}
        >
          {statusLabel(t, row.status)}
        </span>
      </div>
      <h2 className="mt-2 text-md font-semibold leading-6 text-text-primary">
        {name}
      </h2>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium text-text-primary">
            {displayDate(row.start)}
          </p>
          <p className="mt-0.5 text-xs text-text-tertiary">
            {t("licStartDateCol")}
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">
            {displayDate(row.expiry)}
          </p>
          <p className="mt-0.5 text-xs text-text-tertiary">
            {t("licExpiryDate")}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-1">
        {row.kind === "license" && row.status === "Expired" ? (
          <button
            type="button"
            aria-label={t("licRenew")}
            className="rounded-md p-1.5"
            onClick={() => onOpen(row)}
          >
            <RenewIcon />
          </button>
        ) : null}
        <button
          type="button"
          aria-label={t("reqViewNamed", { name: row.code })}
          className="rounded-md p-1.5"
          onClick={() => onOpen(row)}
        >
          <img src={icons.info} alt="" width={16} height={16} />
        </button>
      </div>
    </article>
  );
}

function FilterChip({ label, onRemove }) {
  const { t } = useApp();
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-white px-2 text-sm text-text-secondary">
      {label}
      <button
        type="button"
        aria-label={t("visRemoveNamed", { label })}
        onClick={onRemove}
      >
        <img src={icons.xClose} alt="" width={20} height={20} />
      </button>
    </span>
  );
}

const STATUS_OPTIONS = [
  ["active", "Active"],
  ["expired", "Expired"],
  ["suspended", "Suspended"],
];

function FilterFields({ draft, onChange }) {
  const { t } = useApp();
  return (
    <div className="flex flex-col gap-4">
      <DateField
        label={t("licStartDateCol")}
        value={draft.start}
        max={draft.end}
        onChange={(start) => onChange({ ...draft, start })}
      />
      <DateField
        label={t("licEndDate")}
        value={draft.end}
        min={draft.start}
        onChange={(end) => onChange({ ...draft, end })}
      />
      <fieldset>
        <legend className="text-sm font-semibold text-text-secondary">
          {t("invStatus")}
        </legend>
        {STATUS_OPTIONS.map(([key, label]) => (
          <label
            key={key}
            className="mt-3 flex cursor-pointer items-center gap-2"
          >
            <input
              type="checkbox"
              checked={draft[key]}
              onChange={(event) =>
                onChange({ ...draft, [key]: event.target.checked })
              }
              className="sr-only"
            />
            <span
              className={`flex size-5 items-center justify-center rounded-md border ${draft[key] ? "border-brand bg-brand text-white" : "border-[#d0d5dd] bg-white"}`}
            >
              {draft[key] ? (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2.5 6.2 4.7 8.4 9.5 3.6"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : null}
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(label)}`}
            >
              {statusLabel(t, label)}
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function FilterMenu({ draft, onChange, onCancel, onApply }) {
  const { t } = useApp();
  return (
    <div className="absolute end-0 top-12 z-30 hidden w-[320px] rounded-xl border border-border bg-white shadow-lg lg:block">
      <h2 className="border-b border-border px-4 py-3 text-sm font-semibold text-text-primary">
        {t("invFilters")}
      </h2>
      <div className="px-4 py-4">
        <FilterFields draft={draft} onChange={onChange} />
      </div>
      <div className="flex justify-end gap-2 px-4 pb-4">
        <Button variant="secondary" className="h-9" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button className="h-9" onClick={onApply}>
          {t("invApply")}
        </Button>
      </div>
    </div>
  );
}

function FilterSheet({ draft, onChange, onCancel, onApply }) {
  const { t } = useApp();
  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        aria-label={t("close")}
        className="absolute inset-0 bg-[#0a0d12]/70"
        onClick={onCancel}
      />
      <div
        data-filter-sheet
        className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-white shadow-lg"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="text-lg font-semibold text-text-primary">
            {t("filterBy")}
          </h2>
          <button
            type="button"
            aria-label={t("close")}
            onClick={onCancel}
            className="flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"
          >
            <img src={icons.xClose} alt="" width={20} height={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">
          <FilterFields draft={draft} onChange={onChange} />
        </div>
        <div className="border-t border-border px-5 py-4">
          <Button className="h-11 w-full" onClick={onApply}>
            {t("applyFilter")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LicenseTable({
  rows,
  requests,
  startWidth,
  resizing,
  statusSort,
  onSort,
  onResizeStart,
  onOpen,
}) {
  const { t } = useApp();
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1100px] border-collapse text-start">
        <colgroup>
          <col />
          <col style={{ width: startWidth }} />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col />
          <col style={{ width: requests ? 120 : 88 }} />
        </colgroup>
        <thead>
          <tr className="text-xs font-semibold text-text-tertiary">
            <th className="border-b border-border px-6 py-3 text-start font-semibold">
              {t("licNameCode")}
            </th>
            <th
              className={`relative border-b border-border px-6 py-3 text-start font-semibold ${resizing ? "bg-bg-active" : ""}`}
            >
              {t("licStartDateCol")}
              <button
                type="button"
                aria-label={t("licResizeStart")}
                onMouseDown={onResizeStart}
                className={`absolute inset-y-2 end-0 w-1 cursor-col-resize rounded-full ${resizing ? "bg-text-primary" : "hover:bg-text-placeholder"}`}
              />
            </th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">
              {t("licExpiryDate")}
            </th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">
              <button
                type="button"
                onClick={onSort}
                className="inline-flex items-center gap-1"
              >
                {t("invStatus")}
                <img
                  src={icons.chevronDown}
                  alt=""
                  width={20}
                  height={20}
                  className={statusSort === "desc" ? "rotate-180" : ""}
                />
              </button>
            </th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">
              {t("reqServiceType")}
            </th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">
              {t("reqCrNational")}
            </th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">
              {t("licAmountSarCol")}
            </th>
            <th className="border-b border-border px-6 py-3 text-start font-semibold">
              {t("reqCompanyName")}
            </th>
            <th className="border-b border-border px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="h-14 text-sm text-text-tertiary hover:bg-bg-active"
            >
              <td className="border-b border-border px-6 text-text-primary">
                <span className="font-medium">{row.code}</span> {row.name}
              </td>
              <td className="border-b border-border px-6">
                {displayDate(row.start)}
              </td>
              <td className="border-b border-border px-6">
                {displayDate(row.expiry)}
              </td>
              <td className="border-b border-border px-6">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}
                >
                  {statusLabel(t, row.status)}
                </span>
              </td>
              <td className="border-b border-border px-6">
                {row.service === "Type here" ? t("licTypeHere") : row.service}
              </td>
              <td className="border-b border-border px-6">{row.cr}</td>
              <td className="border-b border-border px-6">{row.amount}</td>
              <td className="border-b border-border px-6">{row.company}</td>
              <td className="border-b border-border px-4">
                <div className="flex items-center justify-end gap-1">
                  {row.kind === "license" && row.status === "Expired" ? (
                    <Hint label={t("licRenew")}>
                      <button
                        type="button"
                        aria-label={t("licRenew")}
                        className="rounded-md p-1.5"
                        onClick={() => onOpen(row)}
                      >
                        <RenewIcon />
                      </button>
                    </Hint>
                  ) : null}
                  {row.payable ? (
                    <Hint
                      label={t("licPayment")}
                      body={t("licPaymentHint")}
                      wide
                    >
                      <button
                        type="button"
                        aria-label={t("licPayment")}
                        className="rounded-md p-1.5"
                      >
                        <CardIcon />
                      </button>
                    </Hint>
                  ) : null}
                  <button
                    type="button"
                    aria-label={t("reqViewNamed", { name: row.code })}
                    className="rounded-md p-1.5"
                    onClick={() => onOpen(row)}
                  >
                    <img src={icons.info} alt="" width={16} height={16} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Hint({ label, body, wide = false, children }) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute end-full top-1/2 z-10 me-2 hidden -translate-y-1/2 rounded-lg bg-text-primary px-3 py-2 text-white group-hover:block group-focus-within:block ${wide ? "w-64" : "whitespace-nowrap"}`}
      >
        <span className="block text-xs font-semibold">{label}</span>
        {body ? (
          <span className="mt-1 block text-xs font-normal leading-5">
            {body}
          </span>
        ) : null}
      </span>
    </span>
  );
}

function EmptyLicenses({ onCreate, requests }) {
  const { t } = useApp();
  return (
    <div className="relative flex min-h-[560px] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      <div
        className="pointer-events-none absolute left-1/2 top-16 size-[420px] -translate-x-1/2"
        style={{
          maskImage:
            "radial-gradient(circle at center, black 0%, transparent 70%)",
        }}
      >
        <img
          src={icons.gridVertical}
          alt=""
          width={768}
          height={768}
          className="absolute left-1/2 top-0 -translate-x-1/2"
        />
        <img
          src={icons.gridHorizontal}
          alt=""
          width={768}
          height={768}
          className="absolute left-1/2 top-0 -translate-x-1/2"
        />
      </div>
      <span className="relative mb-4 flex size-16 items-center justify-center rounded-2xl border border-border bg-white shadow-xs">
        <img src={icons.certificateLine} alt="" width={24} height={24} />
      </span>
      <h2 className="relative text-md font-semibold text-text-primary">
        {requests ? t("invNoRequests") : t("licNoLicenses")}
      </h2>
      <p className="relative mt-1 text-sm text-text-tertiary">
        {requests ? t("licRequestsHint") : t("licLicensesHint")}
      </p>
      <Button className="relative mt-6" onClick={onCreate}>
        <PlusIcon />
        {t("licNew")}
      </Button>
    </div>
  );
}

function LicenseDrawer({ row, onClose, onRenew }) {
  const { t } = useApp();
  const [attachments, setAttachments] = useState([]);
  const [attachmentsError, setAttachmentsError] = useState("");
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  useEffect(() => {
    if (!row) return undefined;
    let active = true;
    setAttachments([]);
    setAttachmentsError("");
    setAttachmentsLoading(true);
    const load = row.kind === "request"
      ? getRequestAttachments(row.code)
      : getLicenseAttachments(row.accountId);
    load
      .then((items) => {
        if (active) setAttachments(items);
      })
      .catch((error) => {
        if (active) setAttachmentsError(error.message || "Could not load attachments");
      })
      .finally(() => {
        if (active) setAttachmentsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [row?.accountId, row?.code, row?.kind]);
  if (!row) return null;

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label={t("licCloseLicense")}
        className="absolute inset-0 bg-[#0a0d12]/70"
        onClick={onClose}
      />
      <aside className="absolute inset-x-0 bottom-0 flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-lg lg:inset-y-0 lg:end-0 lg:start-auto lg:max-h-none lg:max-w-[420px] lg:rounded-none">
        <div className="relative px-6 pb-4 pt-6">
          <div className="absolute end-4 top-4 flex items-center gap-1">
            <button
              type="button"
              aria-label={t("moreActions")}
              className="flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"
            >
              <DotsIcon />
            </button>
            <DrawerClose onClose={onClose} />
          </div>
          <FeaturedIcon type="license" className="mb-4" />
          <p className="text-sm text-text-tertiary">{row.code}</p>
          <h2 className="text-lg font-semibold text-text-primary">
            {row.title || row.name}
          </h2>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-tertiary">
            {row.expiry ? (
              <span>{t("reqExpiry", { date: row.expiry })}</span>
            ) : null}
            <span className="h-3 w-px bg-border" />
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass(row.status)}`}
            >
              {statusLabel(t, row.status)}
            </span>
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <section className="border-t border-border px-6 py-5">
            <h3 className="flex items-center gap-2 text-sm font-medium text-text-placeholder">
              <img src={icons.homeLine} alt="" width={16} height={16} />
              {t("reqCrAddress")}
            </h3>
            <div className="mt-4 flex flex-col gap-3 text-sm">
              {[
                [t("reqCrNational"), row.cr || "—"],
                [t("reqCompanyName"), row.company || "—"],
                [t("reqServiceType"), row.service || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex gap-4">
                  <p className="w-36 shrink-0 text-text-placeholder">{label}</p>
                  <p className="font-medium text-text-primary">{value}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="border-t border-border px-6 py-5">
            <h3 className="text-sm font-medium text-text-placeholder">{t("reqAttachments")}</h3>
            {attachmentsLoading ? <p className="mt-3 text-sm text-text-tertiary">Loading…</p> : null}
            {attachmentsError ? <p className="mt-3 text-sm text-[#b54708]">{attachmentsError}</p> : null}
            {!attachmentsLoading && !attachmentsError && attachments.length === 0 ? (
              <p className="mt-3 text-sm text-text-tertiary">—</p>
            ) : null}
            <div className="mt-3 flex flex-col gap-2">
              {attachments.map((attachment, index) => (
                <button
                  key={`${attachment.Name || "attachment"}-${index}`}
                  type="button"
                  className="rounded-lg border border-border px-3 py-2 text-start text-sm font-medium text-brand"
                  onClick={() => downloadLicenseAttachment(attachment)}
                >
                  {attachment.Name || t("reqAttachments")}
                </button>
              ))}
            </div>
          </section>
        </div>
        {row.kind === "license" && row.status === "Expired" ? (
          <div className="border-t border-border px-6 py-4 lg:flex lg:justify-end">
            <Button
              className="h-11 w-full lg:h-10 lg:w-auto"
              onClick={() => onRenew(row)}
            >
              {t("licRenewBtn")}
            </Button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

function downloadLicenseAttachment(attachment) {
  if (typeof attachment?.Binary !== "string" || !attachment.Binary) return;
  const raw = atob(attachment.Binary);
  const bytes = Uint8Array.from(raw, (value) => value.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: attachment.MimeType || "application/octet-stream" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.Name || "attachment";
  link.click();
  URL.revokeObjectURL(url);
}

function RenewLicenseModal({ row, onClose, onComplete }) {
  const { t } = useApp();
  const { lists, loading: listsLoading, error: listsError } = useLicenseLookups(Boolean(row));
  const [form, setForm] = useState({ name: "", id: "", documentType: "", mobile: "", email: "", accepted: false, file: null });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!row) return;
    setForm({ name: "", id: "", documentType: "", mobile: "", email: "", accepted: false, file: null });
    setError("");
  }, [row]);
  if (!row) return null;
  const fields = [
    ["name", t("reqApplicantName"), "text"],
    ["id", t("reqApplicantId"), "text"],
    ["mobile", t("reqApplicantMobile"), "tel"],
    ["email", t("reqApplicantEmail"), "email"],
  ];
  async function submit(event) {
    event.preventDefault();
    if (!form.accepted || !form.name || !form.id || !form.documentType || !form.mobile || !form.email) {
      setError(t("fieldRequired"));
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const attachments = form.file ? [await fileToC4cAttachment(form.file)] : [];
      const result = await renewLicenseRequest({
        clientRequestId: crypto.randomUUID(), accountId: row.accountId, licenseNumber: row.code,
        licenseType: row.licenseType, crNationalNumber: row.cr, crNumber: row.crNumber,
        applicant: { name: form.name, id: form.id, documentType: form.documentType, mobile: form.mobile, email: form.email },
        address: {}, attachments,
      });
      if (result.status !== "SUCCEEDED") throw new Error(result.message || "Renewal requires reconciliation before retrying");
      await onComplete();
    } catch (submitError) {
      setError(submitError.message || "License renewal failed");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label={t("close")} className="absolute inset-0 bg-[#0a0d12]/70" onClick={onClose} />
      <form onSubmit={submit} className="relative max-h-[calc(100vh-2rem)] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-text-primary">{t("licRenewBtn")}</h2>
        <p className="mt-1 text-sm text-text-tertiary">{row.code} · {row.name}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {fields.map(([key, label, type]) => (
            <label key={key} className="text-sm font-medium text-text-secondary">{label}
              <input required type={type} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-border px-3 text-text-primary" />
            </label>
          ))}
          <label className="text-sm font-medium text-text-secondary">{t("reqApplicantDocType")}
            <select required value={form.documentType} onChange={event => setForm({ ...form, documentType: event.target.value })}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-white px-3 text-text-primary">
              <option value="">{listsLoading ? "Loading…" : "—"}</option>
              {(lists.APPLICANT_DOCUMENT_TYPE || []).map(item => <option key={item.key} value={item.key}>{item.title}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-text-secondary">{t("reqAttachments")}
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={event => setForm({ ...form, file: event.target.files?.[0] || null })}
              className="mt-1 block w-full text-sm" />
          </label>
        </div>
        {listsError ? <p className="mt-3 text-sm text-[#b54708]">{listsError}</p> : null}
        <label className="mt-5 flex gap-2 text-sm text-text-secondary"><input type="checkbox" checked={form.accepted}
          onChange={event => setForm({ ...form, accepted: event.target.checked })} />{t("reqAcceptTerms")}</label>
        {error ? <p role="alert" className="mt-3 text-sm text-[#d92d20]">{error}</p> : null}
        <div className="mt-6 flex justify-end gap-3"><Button variant="secondary" onClick={onClose}>{t("cancel")}</Button>
          <Button type="submit" disabled={submitting || listsLoading}>{submitting ? "…" : t("licRenewBtn")}</Button></div>
      </form>
    </div>
  );
}

function DotsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 10.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM10 5.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666ZM10 15.833a.833.833 0 1 0 0-1.666.833.833 0 0 0 0 1.666Z"
        fill="#535862"
        stroke="#535862"
        strokeWidth="1.67"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const blankForm = {
  crId: "",
  national: "",
  companyEn: "",
  number: "",
  nameAr: "",
  investor: "",
  licenseType: "",
  licenseTypes: [],
  comprehensive: false,
  serviceType: "",
  serviceTypes: [],
  portCode: "",
  activityType: "",
  shipName: "",
  ministryEnergyLicenseDate: "",
  documentType: "",
  applicantName: "",
  applicantId: "",
  applicantMobile: "",
  applicantEmail: "",
  fileName: "",
  file: null,
  address: "",
  cityCode: "",
  city: "",
  postal: "",
  district: "",
  street: "",
  building: "",
  secondary: "",
  shortAddress: "",
  accepted: false,
};

function NewLicenseModal({ open, onClose, onSubmit }) {
  const { t, language } = useApp();
  const titleId = useId();
  const [form, setForm] = useState(blankForm);
  const [registrations, setRegistrations] = useState([]);
  const [crLoading, setCrLoading] = useState(false);
  const [crError, setCrError] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [priceRows, setPriceRows] = useState([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState("");
  const requestTokenRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setForm({ ...blankForm });
        setErrors({});
        setRegistrations([]);
        setCrError("");
        setCrLoading(true);
        requestTokenRef.current = null;
      }
    });
    getMyCommercialRegistrations()
      .then((rows) => {
        if (active)
          setRegistrations(rows.filter((row) => row.id && row.crNumber));
      })
      .catch((error) => {
        if (active)
          setCrError(
            error.message || "Could not load your commercial registrations",
          );
      })
      .finally(() => {
        if (active) setCrLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  const selectedRegistration = useMemo(
    () => registrations.find((row) => String(row.id) === form.crId) || null,
    [registrations, form.crId],
  );

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    Promise.resolve().then(() => {
      if (active) {
        setPriceLoading(true);
        setPriceError("");
        setPriceRows([]);
      }
    });
    getServicePrices()
      .then((rows) => {
        if (active) setPriceRows(rows);
      })
      .catch((error) => {
        if (active) setPriceError(error.message || "Prices are unavailable");
      })
      .finally(() => {
        if (active) setPriceLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

const selectedLicenseTypes = form.comprehensive
  ? form.licenseTypes
  : form.licenseType
    ? [form.licenseType]
    : []

let preview = ''
let previewError = ''

try {
  if (selectedLicenseTypes.length && !priceLoading && !priceError)
    preview = calculatePreview(selectedLicenseTypes, priceRows)
}
catch (error) { previewError = error.message }

  if (!open) return null;

  function chooseRegistration(id) {
    const record = registrations.find((item) => String(item.id) === id);
    requestTokenRef.current = null;
    // Drop the previous CR's values, services, applicant details and disclaimer.
    setForm(
      record
        ? { ...blankForm, ...crToForm(record, language) }
        : { ...blankForm },
    );
    setErrors({});
  }

  // CR fields with a stored PostgreSQL value are not editable. Request fields
  // (applicant/services/license type) remain editable independently.
  function crInput(field, options = {}) {
    const locked = crFieldIsLocked(selectedRegistration, field);
    return (
      <input
        value={form[field] ?? ""}
        type={options.type || "text"}
        maxLength={options.maxLength}
        placeholder={options.placeholder}
        readOnly={locked}
        aria-readonly={locked}
        className={`${inputClass(errors[field], locked)} ${locked ? "cursor-default" : ""}`}
        onChange={(event) =>
          setForm((current) => ({ ...current, [field]: event.target.value }))
        }
      />
    );
  }

  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!form.crId || !selectedRegistration) next.crId = t("fieldRequired");
    if (!form.number) next.number = t("fieldRequired");
    if (!form.national) next.national = t("fieldRequired");
    if (!form.companyEn.trim()) next.companyEn = t("fieldRequired");
    if (!form.investor || !form.serviceTypes.length)
      next.lists = t("fieldRequired");
    if (priceLoading || priceError || previewError || !preview)
      next.pricing =
        priceError || previewError || "Service prices are unavailable";
    if (!(form.comprehensive ? form.licenseTypes.length : form.licenseType))
      next.licenseType = t("fieldRequired");
    if (form.serviceTypes.includes("111") && !form.portCode)
      next.portCode = t("fieldRequired");
    if (
      !form.applicantName.trim() ||
      !form.applicantId.trim() ||
      !form.documentType ||
      !form.applicantMobile.trim() ||
      !form.applicantEmail.trim()
    )
      next.applicant = t("fieldRequired");
    if (
      form.applicantEmail.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.applicantEmail.trim())
    )
      next.applicant =
        language === "ar"
          ? "يرجى إدخال بريد إلكتروني صحيح"
          : "Enter a valid email address";
    if (!form.accepted) next.accepted = t("reqAcceptTerms");
    if (selectedRegistration?.isTestData) {
      next.submit =
        language === "ar"
          ? "هذا السجل التجاري تجريبي ولا يمكن إرساله إلى C4C. استخدم سجلاً معتمداً للاختبار."
          : "This synthetic DEV CR cannot be submitted to C4C. Select an approved test CR.";
    }
    setErrors(next);
    if (Object.keys(next).length) return;
    if (!requestTokenRef.current) requestTokenRef.current = crypto.randomUUID();
    setSubmitting(true);
    try {
const authoritative = await getServiceQuote(selectedLicenseTypes)
      if (
        !authoritative ||
        authoritative.currency !== "SAR" ||
        authoritative.totalHalalas !== preview
      ) {
        throw new Error(
          "Service prices changed; refresh the form before submitting",
        );
      }
      await onSubmit({
        ...form,
        clientRequestId: requestTokenRef.current,
        quotedTotalHalalas: authoritative.totalHalalas,
      });
      requestTokenRef.current = null;
      setForm(blankForm);
    } catch (error) {
      setErrors({ submit: error.message || "License request failed" });
    } finally {
      setSubmitting(false);
    }
  }

  // Checking the disclaimer enables an attempt; submit() explains missing fields
  // and still checks the authoritative PostgreSQL quote before calling CAP.
  const canAttemptSubmit = Boolean(form.accepted && !submitting);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("close")}
        className="absolute inset-0 bg-[#0a0d12]/70"
        onClick={onClose}
      />
      <form
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={submit}
        className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-white shadow-lg"
      >
        <div className="flex items-start gap-3 px-6 pt-6">
          <span className="flex size-10 items-center justify-center rounded-xl border border-border">
            <img src={icons.file} alt="" width={20} height={20} />
          </span>
          <h2
            id={titleId}
            className="pt-2 text-lg font-semibold text-text-primary"
          >
            {t("reqNewLicenseTitle")}
          </h2>
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="ms-auto flex size-9 items-center justify-center rounded-lg hover:bg-bg-active"
          >
            <img src={icons.xClose} alt="" width={20} height={20} />
          </button>
        </div>
        <div className="mt-4 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
          <div className="flex gap-3 rounded-xl border border-[#fedf89] bg-[#fffaeb] px-4 py-3 text-sm text-[#b54708]">
            <AlertIcon />
            <p>{t("reqCrHint")}</p>
          </div>
          {crError ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {crError}
            </p>
          ) : null}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("reqCrNumber")} required error={errors.crId}>
              <select
                value={form.crId}
                disabled={crLoading || Boolean(crError)}
                onChange={(event) => chooseRegistration(event.target.value)}
                className={inputClass(errors.crId)}
              >
                <option value="">
                  {crLoading
                    ? language === "ar"
                      ? "جار تحميل السجلات التجارية..."
                      : "Loading CRs..."
                    : language === "ar"
                      ? "اختر رقم السجل التجاري"
                      : "Select CR number"}
                </option>
                {registrations.map((record) => (
                  <option key={record.id} value={record.id}>
                    {record.crNumber}
                    {record.companyName ? ` - ${record.companyName}` : ""}
                    {record.isTestData ? " [DEV TEST]" : ""}
                  </option>
                ))}
              </select>
              {!crLoading && !crError && registrations.length === 0 ? (
                <span className="text-xs text-text-tertiary">
                  {language === "ar"
                    ? "لا توجد سجلات تجارية مرتبطة بحسابك"
                    : "No CRs assigned to your account"}
                </span>
              ) : null}
            </Field>
            <Field
              label={t("reqCrNationalField")}
              required
              error={errors.national}
            >
              {crInput("national", { maxLength: 32 })}
            </Field>
            <Field label={t("reqCompanyEn")} required error={errors.companyEn}>
              {crInput("companyEn", { placeholder: t("reqEnterNameEn") })}
            </Field>
            <Field label={t("reqCrName")}>{crInput("nameAr")}</Field>
            {selectedRegistration?.isTestData ? (
              <p className="col-span-full text-sm text-[#b54708]" role="status">
                {language === "ar"
                  ? "هذا السجل مخصص لاختبار واجهة المستخدم فقط، وليس لإرسال طلب حقيقي إلى C4C."
                  : "DEV-only CR: use this to test the form, not to submit a real C4C request."}
              </p>
            ) : null}
            <LicenseDynamicFields
              form={form}
              onChange={setForm}
              enabled={open}
            />
          </div>
          <div
            className="rounded-xl border border-border p-3 text-sm"
            role="status"
          >
            <p className="font-medium text-text-primary">
              {language === "ar"
                ? "إجمالي رسوم الخدمات المختارة"
                : "Selected service total (SAR)"}
            </p>
            <p className="mt-1">
              {priceLoading
                ? "Loading prices..."
                : priceError ||
                  previewError ||
                  (preview
                    ? displaySar(preview, language === "ar" ? "ar-SA" : "en-SA")
                    : "Select services to view the total")}
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              {language === "ar"
                ? "يتم التحقق من الأسعار على الخادم قبل الإرسال."
                : "Prices come from PostgreSQL and are checked on the server before submitting."}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              {language === "ar" ? "اسم مقدم الطلب" : "Applicant name"}
              <input
                required
                className={inputClass()}
                value={form.applicantName}
                onChange={(e) =>
                  setForm({ ...form, applicantName: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              {language === "ar" ? "رقم هوية مقدم الطلب" : "Applicant ID"}
              <input
                required
                className={inputClass()}
                value={form.applicantId}
                onChange={(e) =>
                  setForm({ ...form, applicantId: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              {language === "ar" ? "جوال مقدم الطلب" : "Applicant mobile"}
              <input
                required
                className={inputClass()}
                value={form.applicantMobile}
                onChange={(e) =>
                  setForm({ ...form, applicantMobile: e.target.value })
                }
              />
            </label>
            <label className="text-sm">
              {language === "ar"
                ? "البريد الإلكتروني لمقدم الطلب"
                : "Applicant email"}
              <input
                required
                type="email"
                className={inputClass()}
                value={form.applicantEmail}
                onChange={(e) =>
                  setForm({ ...form, applicantEmail: e.target.value })
                }
              />
            </label>
          </div>
          <div>
            <p className="text-sm font-medium text-text-secondary">
              {t("reqAttachments")}
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) setForm({ ...form, file, fileName: file.name });
              }}
              className="mt-2 flex w-full flex-col items-center rounded-xl border border-border px-4 py-8 text-center"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
                className="mb-2"
              >
                <path
                  d="M6.667 10 10 6.667 13.333 10M10 6.667V14.5M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z"
                  stroke="#1b8354"
                  strokeWidth="1.67"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm text-text-tertiary">
                <span className="font-semibold text-brand">
                  {t("reqClickUpload")}
                </span>{" "}
                {t("reqDragDrop")}
              </span>
              {form.fileName ? (
                <span className="mt-2 text-sm text-text-primary">
                  {form.fileName}
                </span>
              ) : null}
            </button>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setForm({ ...form, file, fileName: file?.name || "" });
              }}
            />
            <p className="mt-2 text-sm text-text-tertiary">
              {t("reqUploadHint")}
            </p>
          </div>
          <Field label={t("reqCurrentAddress")}>{crInput("address")}</Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("reqCityCode")}>{crInput("cityCode")}</Field>
            <Field label={t("reqCity")}>{crInput("city")}</Field>
            <Field label={t("reqPostalField")}>{crInput("postal")}</Field>
            <Field label={t("reqDistrict")}>{crInput("district")}</Field>
            <Field label={t("reqStreet")}>{crInput("street")}</Field>
            <Field label={t("reqBuilding")}>{crInput("building")}</Field>
            <Field label={t("reqSecondary")}>{crInput("secondary")}</Field>
            <Field label={t("reqShortAddress")}>
              {crInput("shortAddress")}
            </Field>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center">
          <label className="flex flex-1 items-start gap-2 text-sm text-text-tertiary">
            <input
              type="checkbox"
              checked={form.accepted}
              onChange={(event) =>
                setForm({ ...form, accepted: event.target.checked })
              }
              className="mt-0.5 size-4 accent-[#1b8354]"
            />
            {t("reqTerms")}
          </label>
          <div className="flex shrink-0 justify-end gap-3">
            <Button variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <button
              type="submit"
              disabled={!canAttemptSubmit}
              className={`h-10 rounded-lg px-4 text-sm font-semibold ${canAttemptSubmit ? "bg-brand text-white" : "cursor-not-allowed bg-[#f2f4f7] text-text-placeholder"}`}
            >
              {t("reqSubmit")}
            </button>
          </div>
        </div>
        {errors.crId ||
        errors.number ||
        errors.accepted ||
        errors.lists ||
        errors.licenseType ||
        errors.portCode ||
        errors.applicant ||
        errors.pricing ||
        errors.submit ? (
          <p role="alert" className="px-6 pb-3 text-sm text-[#d92d20]">
            {Object.values(errors).filter(Boolean).join(" | ")}
          </p>
        ) : null}
      </form>
    </div>
  );
}

function inputClass(error, locked = false) {
  return `h-11 w-full rounded-lg border ${locked ? "bg-bg-neutral" : "bg-white"} px-3 text-sm text-text-primary shadow-xs outline-none ${error ? "border-[#d92d20]" : "border-border"}`;
}

function Field({ label, required = false, error, children }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-text-secondary">
      <span>
        {label}
        {required ? <span className="text-[#d92d20]">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="font-normal text-[#d92d20]">{error}</span>
      ) : null}
    </label>
  );
}

/*
 * Mawani Portal Phase 1 administrator acceptance test (v0.7.4).
 * Review before running. Nothing is written until you call mawaniQA.run().
 * Run only on the authenticated Mawani App Router origin in DevTools Console.
 * This changes ONLY the dedicated IAS test user, then attempts to restore it.
 * The test user's original IAS name is assumed to be Mawani Test.
 */
(() => {
  "use strict";
  const ORIGIN =
    "https://mawani-btp-dev-mawani-btp-dev-sp-mawani-portal-router.cfapps.sa30.hana.ondemand.com";
  const IAS_ID = "83c30c52-6933-4223-b916-18f0a6b751dc";
  const USERNAME = "mawani.test.user01";
  const ORIGINAL_IAS_NAME = { givenName: "Mawani", familyName: "Test" };

  function ensureOrigin() {
    if (location.origin !== ORIGIN) {
      throw new Error(
        "Open an authenticated page on the Mawani Application Router first.",
      );
    }
  }

  async function request(path, options = {}) {
    ensureOrigin();
    const { headers = {}, ...otherOptions } = options;
    const response = await fetch(path, {
      credentials: "same-origin",
      ...otherOptions,
      headers: { Accept: "application/json", ...headers },
    });
    const text = await response.text();
    let json;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`${path}: HTTP ${response.status}; non-JSON response`);
    }
    if (!response.ok) {
      const message =
        typeof json?.error?.message === "string"
          ? json.error.message.substring(0, 180)
          : "Request rejected";
      throw new Error(`${path}: HTTP ${response.status} (${message})`);
    }
    return json;
  }

  async function readIas() {
    return request(`/admin/getIasUser(id='${IAS_ID}')`);
  }

  async function readPortal() {
    const result = await request("/admin/getUsers(limit=100,offset=0)");
    if (!Array.isArray(result.value))
      throw new Error("Unexpected getUsers response");
    const matches = result.value.filter((user) => user.IAS_ID === IAS_ID);
    if (matches.length !== 1) {
      throw new Error(
        `Expected exactly one PostgreSQL profile for test user; found ${matches.length}`,
      );
    }
    return matches[0];
  }

  async function action(name, body) {
    ensureOrigin();
    const csrfResp = await fetch("/admin/$metadata", {
      credentials: "same-origin",
      headers: { "X-CSRF-Token": "Fetch" },
    });
    const csrf = csrfResp.headers.get("x-csrf-token");
    if (!csrfResp.ok || !csrf) {
      throw new Error(
        "No CSRF token. Check authentication and local DevTools CSP override.",
      );
    }
    return request(`/admin/${name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CSRF-Token": csrf },
      body: JSON.stringify(body),
    });
  }

  async function baseline() {
    const [ias, portal] = await Promise.all([readIas(), readPortal()]);
    if (ias.id !== IAS_ID || ias.userName !== USERNAME) {
      throw new Error(
        "IAS identity mismatch; stopping to avoid modifying another user",
      );
    }
    if (!portal.UUID || portal.ACCOUNT_TYPE !== "PORTAL_USER") {
      throw new Error("Unexpected test profile; stopping");
    }
    return {
      iasUserName: ias.userName,
      iasActive: ias.active,
      portalUuid: portal.UUID,
      portalActive: portal.ACTIVE_STATUS,
      portalFirstName: portal.FNAME,
      portalLastName: portal.LNAME,
    };
  }

  async function run() {
    const initial = await baseline();
    console.table(initial);
    if (initial.iasActive !== true || initial.portalActive !== true) {
      throw new Error(
        "Test IAS and portal accounts must both be active before beginning",
      );
    }
    if (!initial.portalFirstName || initial.portalFirstName === "MawaniQA") {
      throw new Error(
        "Cannot safely restore the existing first name after the test",
      );
    }
    const approved = confirm(
      `Run IAS and PostgreSQL write tests on ${USERNAME} ONLY?\n` +
        `IAS names will be temporarily changed, IAS will be disabled then re-enabled, ` +
        `and the portal first name will be changed then restored.\n` +
        `IAS original name is assumed to be ${ORIGINAL_IAS_NAME.givenName} ${ORIGINAL_IAS_NAME.familyName}.`,
    );
    if (!approved) return { skipped: true };

    const summary = { baseline: initial, tests: {}, cleanup: {} };
    let iasNameAttempted = false;
    let iasActiveAttempted = false;
    let portalNameAttempted = false;
    try {
      // v0.7.4 checks the raw SCIM name attributes server-side after PATCH.
      // A successful response means the requested names were independently
      // confirmed by the backend (unlike the old v0.7.3 behavior).
      iasNameAttempted = true;
      const nameResult = await action("updateIasUser", {
        id: IAS_ID,
        givenName: "MawaniQA",
        familyName: "TestQA",
      });
      if (nameResult.id !== IAS_ID)
        throw new Error("IAS update returned wrong user");
      summary.tests.iasNameReadback =
        "PASS: verified by backend raw SCIM read-back";
      const synced = await readPortal();
      if (
        synced.UUID !== initial.portalUuid ||
        synced.FNAME !== "MawaniQA" ||
        synced.LNAME !== "TestQA"
      ) {
        throw new Error(
          "IAS names updated but PostgreSQL profile did not match",
        );
      }
      summary.tests.iasNameSyncedToPortal = "PASS";

      iasActiveAttempted = true;
      try {
        await action("setIasUserActive", { id: IAS_ID, active: false });
        const disabled = await readIas();
        if (disabled.active !== false)
          throw new Error("IAS did not report active=false");
        const disabledPortal = await readPortal();
        if (disabledPortal.ACTIVE_STATUS !== false)
          throw new Error("PostgreSQL was not deactivated");
        summary.tests.portalDeactivateSynced = "PASS";
        summary.tests.iasDeactivate = "PASS";
      } finally {
        // Restore IAS state even if deactivation status/readback fails.
        try {
          await action("setIasUserActive", { id: IAS_ID, active: true });
          const restored = await readIas();
          if (restored.active !== true) throw new Error("IAS still inactive");
          const enabledPortal = await readPortal();
          if (enabledPortal.ACTIVE_STATUS !== true)
            throw new Error("PostgreSQL still inactive");
          summary.tests.portalReactivateSynced = "PASS";
          summary.cleanup.iasActive = "RESTORED true";
          summary.tests.iasReactivate = "PASS";
          iasActiveAttempted = false;
        } catch (error) {
          summary.cleanup.iasActive = `FAILED: ${error.message}`;
          throw error;
        }
      }

      portalNameAttempted = true;
      await action("updatePortalUser", {
        uuid: initial.portalUuid,
        FNAME: "MawaniQA",
      });
      const updated = await readPortal();
      if (updated.UUID !== initial.portalUuid || updated.FNAME !== "MawaniQA") {
        throw new Error("PostgreSQL portal name update not confirmed");
      }
      summary.tests.portalUpdate = "PASS";
      summary.tests.portalUuidUnchanged = "PASS";
    } catch (error) {
      summary.failure = error.message;
    } finally {
      if (portalNameAttempted) {
        try {
          await action("updatePortalUser", {
            uuid: initial.portalUuid,
            FNAME: initial.portalFirstName,
          });
          const after = await readPortal();
          if (after.FNAME !== initial.portalFirstName)
            throw new Error("Portal name not restored");
          summary.cleanup.portalFirstName = "RESTORED";
        } catch (error) {
          summary.cleanup.portalFirstName = `FAILED: ${error.message}`;
        }
      }
      if (iasActiveAttempted) {
        try {
          await action("setIasUserActive", { id: IAS_ID, active: true });
          const after = await readIas();
          const local = await readPortal();
          summary.cleanup.iasActive =
            after.active === true && local.ACTIVE_STATUS === true
              ? "RESTORED true in both IAS and PostgreSQL"
              : "FAILED: IAS or PostgreSQL still inactive";
        } catch (error) {
          summary.cleanup.iasActive = `FAILED: ${error.message}`;
        }
      }
      if (iasNameAttempted) {
        try {
          await action("updateIasUser", { id: IAS_ID, ...ORIGINAL_IAS_NAME });
          const local = await readPortal();
          summary.cleanup.iasNames =
            local.FNAME === ORIGINAL_IAS_NAME.givenName &&
            local.LNAME === ORIGINAL_IAS_NAME.familyName
              ? "RESTORED; raw IAS names confirmed by backend; PostgreSQL matched"
              : "FAILED: PostgreSQL names do not match originals";
        } catch (error) {
          summary.cleanup.iasNames = `FAILED: ${error.message}`;
        }
      }
    }
    const after = await baseline().catch((error) => ({ error: error.message }));
    summary.finalReadback = after;
    console.log("Mawani Phase 1 QA summary (no tokens or emails):", summary);
    if (
      summary.failure ||
      Object.values(summary.cleanup).some((v) => String(v).startsWith("FAILED"))
    ) {
      console.warn(
        "A test or cleanup failed. Review the summary and manually restore the test user if necessary.",
      );
    }
    return summary;
  }

  window.mawaniQA = { baseline, run };
  console.log(
    "Ready. Run: await mawaniQA.baseline()  (read-only), then await mawaniQA.run() (confirmed test writes).",
  );
})();

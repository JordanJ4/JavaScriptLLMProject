# Azure Function + Storyline 360 + LLM Gateway Integration (Production)

> This README describes the **Prod** branch, which deploys to the production
> Function App **`Articulate-Storyline`**. The `main` branch is the dev/integration
> line and deploys to the non-prod app `javascriptazurellmproject2`.

## Project Overview

A secure middleware layer between Articulate Storyline 360 and the enterprise LLM
Gateway, implemented as an Azure Function App. The function handles OAuth token
generation, request forwarding, and response shaping so that Storyline never talks
to the gateway (or holds gateway credentials) directly.

Primary goals:

* Allow Storyline courses to interact with AI services
* Keep enterprise gateway credentials server-side
* Centralize AI request handling
* Support scalable deployment and maintenance

---

# High-Level Architecture

```text
Storyline 360 Course
        ↓
Azure Function App (/api/coach)
        ↓
OAuth (client credentials) token request
        ↓
Enterprise LLM Gateway
        ↓
AI Response Returned to Storyline
```

---

# Technology Stack

| Component                | Purpose                         |
| ------------------------ | ------------------------------- |
| Azure Function App       | Backend API layer               |
| Node.js / JavaScript     | Function runtime/language       |
| GitHub + GitHub Actions  | Source control & CI/CD          |
| Azure Portal             | Cloud resource management       |
| Articulate Storyline 360 | Frontend learning application   |
| Enterprise LLM Gateway   | Enterprise AI access layer      |
| OAuth (client creds)     | Gateway authentication          |

---

# Azure Resources

## Function Apps

| Branch | Function App Name            | Trigger of deploy                    |
| ------ | ---------------------------- | ------------------------------------ |
| Prod   | `Articulate-Storyline`       | Manual (GitHub Actions, from `Prod`) |
| main   | `javascriptazurellmproject2` | Auto on push to `main`               |

Runtime: Node.js (see workflow `NODE_VERSION`; confirm it matches the Function
App's configured version).

Endpoint: `/api/coach`

Resource Group: _TODO — document actual resource group name._

Region: East US

---

# Repository Structure

```text
.github/
  workflows/
    azure-functions.yml        # dev deploy: auto on push to main -> javascriptazurellmproject2
    azure-functions-prod.yml   # prod deploy: manual dispatch, guarded to the Prod branch

coach/
  index.js                     # main function; wraps gateway reply as { gaiaResponse: { result } }
  function.json                # httpTrigger; authLevel: anonymous; route: coach
  rootca-bundle.cer            # CA bundle used to trust the enterprise gateway

InvokeGateway/
  index.js                     # secondary function; returns the raw gateway response body
  function.json                # httpTrigger; authLevel: function; POST only

host.json
package.json
package-lock.json
README.md
```

## Functions

| Function       | Route / Trigger        | Auth      | Response shape                          |
| -------------- | ---------------------- | --------- | --------------------------------------- |
| `coach`        | `/api/coach` (GET/POST/OPTIONS) | anonymous | `{ "gaiaResponse": { "result": ... } }` |
| `InvokeGateway`| function name (POST)   | function  | raw gateway response body               |

The Storyline course calls **`coach`**. `InvokeGateway` is a secondary endpoint
that returns the gateway payload verbatim.

---

# Deployment Process (CI/CD)

Deployment is handled by GitHub Actions.

| Workflow                   | Trigger                       | Deploys to                   |
| -------------------------- | ----------------------------- | ---------------------------- |
| `azure-functions.yml`      | push to `main`                | `javascriptazurellmproject2` |
| `azure-functions-prod.yml` | manual (`workflow_dispatch`)  | `Articulate-Storyline`       |

**Production is deliberately manual.** The prod workflow is guarded with
`if: github.ref == 'refs/heads/Prod'`, so it only deploys when dispatched from the
`Prod` branch; a dispatch from any other branch (e.g. `main`) no-ops instead of
deploying non-prod code onto the live app.

To ship to production: merge into `Prod`, then Actions → "Build and deploy PROD…"
→ Run workflow → select the `Prod` branch.

Required GitHub Secrets: `AZURE_FUNCTIONAPP_PUBLISH_PROFILE` (dev) and
`AZURE_FUNCTIONAPP_PUBLISH_PROFILE_PROD` (prod). Publish profiles change when
regenerated, so update the secret if a deploy starts failing auth.

---

# Updating the Code (Step by Step)

This section is for anyone new to GitHub. There are two environments:

* **Non-production (dev):** app `javascriptazurellmproject2`, built from the `main`
  branch, and it updates **automatically**.
* **Production:** app `Articulate-Storyline`, built from the `Prod` branch, and it
  updates **only when you run the deploy by hand**.

Always change non-production first, test it, then move the same change to production.

## How to update the NON-PRODUCTION (dev) code

1. Open the repository on GitHub and switch the branch dropdown to `main`.
2. Open the file you want to change (for example `coach/index.js`) and click the
   pencil (Edit) icon.
3. Make your edit.
4. At the bottom, under "Commit changes", type a short message describing what you
   changed, leave "Commit directly to the main branch" selected, and click
   **Commit changes**.
5. That's it — saving to `main` automatically starts a deployment. Watch it under the
   **Actions** tab; a green check mark means it published to the dev app.
6. Test the dev app (see the maintainer guide / "How to Check It Is Working").

## How to update the PRODUCTION code

Production does **not** update on its own. First you get your change onto the `Prod`
branch, then you run the deploy by hand.

**Step 1 — get the change onto `Prod`** (pick one):

* If it is already tested on `main`: open a Pull Request from `main` into `Prod`
  (Pull requests -> New pull request -> base: `Prod`, compare: `main` -> Create ->
  Merge), **or**
* Edit the file directly on `Prod` the same way as above, but switch the branch
  dropdown to `Prod` **before** you edit.

**Step 2 — deploy to production (manual):**

1. Go to the **Actions** tab.
2. Click the workflow "Build and deploy PROD Node.js Azure Function App".
3. Click **Run workflow**, and in the branch dropdown **select `Prod`** (important),
   then confirm.
4. Wait for the green check mark, then test the production app.

> Saving code to `Prod` does NOT make it live by itself. Production only changes when
> you run the workflow above.

## Do's and Don'ts (for anyone new to GitHub / GitHub Actions)

**Do:**

* Do make and test changes on `main` (dev) before touching production.
* Do write a short, clear commit message so others know what changed.
* Do use the **Actions** tab to confirm a deploy finished — green check = success,
  red X = failed (click it to read the error).
* Do keep secrets (Client ID/Secret, keys) in Azure Application Settings — never type
  them into code, commit messages, or issues.
* Do ask the contacts in the maintainer guide if you are unsure.

**Don't:**

* Don't run the production workflow from any branch other than `Prod`. (It is guarded
  to do nothing if run elsewhere, but always pick `Prod` anyway.)
* Don't paste passwords, tokens, Client Secrets, or function keys anywhere in the repo.
* Don't edit files under `.github/workflows/` unless you understand them — those
  control deployment.
* Don't assume editing a file publishes it — production still needs the manual deploy.
* Don't delete the `main` or `Prod` branches.
* Don't force-push or rewrite history unless you are comfortable with Git.

---

# Authentication & Security

## Current state of the `coach` endpoint

> **`coach` is currently `authLevel: anonymous`** — it does **not** require an
> Azure Function key. Any client that knows the URL can call it. (`InvokeGateway`
> is `authLevel: function` and does require a key.)

## Recommended next step: function-level auth for `coach`

Switching `coach` to `authLevel: function` is the recommended hardening. It is a
coordinated change, not just a config flip, because the Storyline course calls the
endpoint from the browser:

1. Get the key: Function App → Functions → `coach` → Function Keys.
2. Update the Storyline JS to call `.../api/coach?code=YOUR_FUNCTION_KEY`.
3. Re-export and republish the course to the LMS (older published copies without
   the key will start returning 401).
4. Add the LMS/Storyline domain to the Function App's CORS settings (a browser
   `POST` with `Content-Type: application/json` triggers a preflight). Configure
   CORS in **one** place (portal *or* code) to avoid duplicate headers.

### Known limitation

Because the key would live in the published course's client-side JavaScript, it is
not a true secret. Function auth stops drive-by abuse and lets you rotate a leaked
key, but the only way to keep the key fully server-side is a backend proxy in front
of the function (see Future Enhancements).

## Do NOT

* Store production secrets in source control
* Share Function keys publicly

---

# OAuth / LLM Gateway Authentication

## Flow

1. Function receives the request from Storyline.
2. Function requests an OAuth token (client-credentials grant) from `TOKEN_URL`.
3. Function calls `GATEWAY_URL` with the bearer token and gateway identity headers.
4. AI response is returned to Storyline.

## Gateway request headers

The function sends these to the gateway (values are env-driven with defaults):

| Header           | App setting / default                       |
| ---------------- | ------------------------------------------- |
| `x-client-id`    | `GAIA_CLIENT_ID` (default `IDStoryLineLLmProd`) |
| `x-app-name`     | `GAIA_APP_NAME` (default `Articulate-Storyline`) |
| `x-model-name`   | `GAIA_MODEL_NAME` (default `gpt-5-mini`)    |
| `x-partner-name` | `GAIA_PARTNER_NAME` (default `asurion`)     |

---

# Environment Variables (Azure Application Settings)

| Variable            | Purpose                                                         |
| ------------------- | -------------------------------------------------------------- |
| `CLIENT_ID`         | OAuth client ID                                                |
| `CLIENT_SECRET`     | OAuth client secret                                            |
| `TOKEN_URL`         | OAuth token endpoint                                           |
| `SCOPE`             | OAuth scope                                                    |
| `GATEWAY_URL`       | LLM Gateway endpoint                                           |
| `NODE_EXTRA_CA_CERTS` | Path to the CA bundle for the gateway cert. Falls back to `/home/site/wwwroot/coach/rootca-bundle.cer` if unset. |
| `GAIA_CLIENT_ID`    | Gateway `x-client-id` (default `IDStoryLineLLmProd`)           |
| `GAIA_APP_NAME`     | Gateway `x-app-name` (default `Articulate-Storyline`)          |
| `GAIA_MODEL_NAME`   | Gateway `x-model-name` (default `gpt-5-mini`)                  |
| `GAIA_PARTNER_NAME` | Gateway `x-partner-name` (default `asurion`)                   |

Never store secrets in source code — use Azure Application Settings (and GitHub
Secrets for deploy credentials).

---

# Storyline 360 Integration

```javascript
var p = GetPlayer();

// coach is currently anonymous, so no ?code= is required today.
// If/when coach is switched to function auth, append ?code=YOUR_FUNCTION_KEY.
var FUNCTION_URL = "https://<functionapp>.azurewebsites.net/api/coach";

fetch(FUNCTION_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    input: p.GetVar("user_input")
    // Optional: pass a stable sessionId to keep a multi-turn conversation together
    // sessionId: p.GetVar("session_id")
  })
})
.then(function (r) {
  if (!r.ok) { throw new Error("Backend error " + r.status); }
  return r.json();
})
.then(function (data) {
  var answer =
    data && data.gaiaResponse && data.gaiaResponse.result
      ? data.gaiaResponse.result
      : data.error || "No reply returned";
  p.SetVar("ai_response", answer);
})
.catch(function (e) {
  p.SetVar("ai_response", "ERROR: " + e.message);
  console.error(e);
});
```

---

# Request & Response Format

## Request

```json
{
  "input": "How can I improve customer empathy?"
}
```

`coach` also accepts `message`, `text`, or `prompt` instead of `input`, plus an
optional `sessionId`. If no `sessionId` is supplied, each request is isolated with
a generated id (so learners do not share conversation context).

## Response (`coach`)

```json
{
  "gaiaResponse": {
    "result": "Example AI response"
  }
}
```

---

# Monitoring & Logging

* Azure Function logs / Application Insights
* GitHub Actions logs

Note: the functions log operational status (token status, gateway status) and
errors, but do **not** log raw learner input, to reduce PII exposure. The gateway
payload also sets `scrub_pii: true`.

Watch for: failed requests, auth failures, function timeouts, gateway latency, and
unusual request volume.

---

# Troubleshooting

## 401 Unauthorized
* `coach` is anonymous today, so a 401 here usually means you switched it to
  function auth without the key. Verify `?code=` / `x-functions-key`, or regenerate
  the key. (`InvokeGateway` always requires a key.)

## CORS errors
* Add the LMS/Storyline domain under the Function App's CORS settings.

## Gateway authentication failure
* Verify `CLIENT_ID`, `CLIENT_SECRET`, `TOKEN_URL`, and `SCOPE`; regenerate creds
  if needed. Confirm the gateway identity headers / `GAIA_*` settings are correct.

## Certificate errors to the gateway
* Ensure the CA bundle exists (`coach/rootca-bundle.cer`) and `NODE_EXTRA_CA_CERTS`
  points to it (or rely on the built-in fallback path).

## GitHub Actions deploy failure
* Check the publish-profile secret is current; review the Actions logs. Remember the
  prod workflow only runs when dispatched from the `Prod` branch.

---

# Maintenance

* **Rotate function keys:** Function App → Functions → `coach` → Function Keys.
* **Update deploy secrets:** repo Settings → Secrets and variables → Actions.
* **Redeploy prod:** merge to `Prod`, then run the prod workflow from `Prod`.

---

# Future Enhancements

* Switch `coach` to function-level auth (see Authentication)
* Add a backend proxy so the key stays server-side
* Reconcile `InvokeGateway` (harden or remove) and reduce duplication
* Centralized logging/dashboard, rate limiting, automated tests, Key Vault

---

# Ownership & Support

_TODO — document primary/backup owners, Azure subscription owner, and repo owner._

Personnel supporting this project need access to: Azure Portal, this repo & Actions,
the LLM Gateway credentials/process, and the Storyline project files.

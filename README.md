# Azure Function + Storyline 360 + LLM Gateway Integration Documentation

## Project Overview

This project provides a secure integration between Articulate Storyline 360 and the enterprise LLM Gateway using an Azure Function App.

The Azure Function acts as a middleware/API layer between the Storyline course and the enterprise AI gateway. The function securely handles authentication, token generation, request processing, and response handling.

Primary goals:

* Allow Storyline courses to interact with AI services
* Prevent direct exposure of enterprise API credentials
* Centralize AI request handling
* Support scalable deployment and maintenance
* Enable future enhancements and governance

---

# High-Level Architecture

```text
Storyline 360 Course
        ↓
Azure Function App (/api/coach)
        ↓
OAuth / PingFederate Authentication
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
| GitHub                   | Source control                  |
| GitHub Actions           | CI/CD deployment pipeline       |
| Azure Portal             | Cloud resource management       |
| Articulate Storyline 360 | Frontend learning application   |
| LLM Gateway              | Enterprise AI access layer      |
| PingFederate / OAuth     | Authentication/token generation |

---

# Azure Resources

## Function App

| Setting           | Value                      |
| ----------------- | -------------------------- |
| Function App Name | javascriptazurellmproject2 |
| Runtime           | Node.js 20.x               |
| Hosting           | Azure Functions            |
| Endpoint          | /api/coach                 |

> Confirm the Function App's configured Node version matches the workflow `NODE_VERSION` (currently 20.x in both dev and prod workflows).

## Resource Group

Articulate-Storyline_group

## Region

East US

---

# Repository Structure

```text
.github/
  workflows/
    azure-functions.yml        # dev deploy (push to main)
    azure-functions-prod.yml   # prod deploy (manual: workflow_dispatch)

coach/
  index.js                     # main function (wraps response as gaiaResponse)
  function.json                # httpTrigger config, authLevel: function
  rootca-bundle.cer            # CA bundle for the enterprise gateway

InvokeGateway/
  index.js                     # secondary function (returns raw gateway body)
  function.json                # httpTrigger config, authLevel: function

shared/
  gatewayClient.js             # shared OAuth token + gateway call + CORS helpers

host.json
package.json
README.md
```

## Important Files

| File                        | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| coach/index.js              | Main Azure Function logic (Storyline endpoint)      |
| InvokeGateway/index.js      | Secondary endpoint; returns raw gateway response    |
| shared/gatewayClient.js     | Shared token/gateway/CORS logic used by both        |
| package.json                | Node.js dependencies & metadata                     |
| host.json                   | Azure Functions configuration                       |
| azure-functions.yml         | GitHub Actions dev deployment workflow              |
| azure-functions-prod.yml    | GitHub Actions prod deployment workflow (manual)    |

---

# Deployment Process (CI/CD)

## Current Deployment Method

Deployment is handled through GitHub Actions.

## Deployment Flow

```text
Developer Pushes Code to GitHub (main)
        ↓
GitHub Actions Triggered
        ↓
Dependencies Installed
        ↓
Function App Packaged
        ↓
Deployment to Azure Function App
```

## GitHub Actions Workflows

| Workflow                   | Trigger                     | Target App                 |
| -------------------------- | --------------------------- | -------------------------- |
| azure-functions.yml        | push to `main`              | javascriptazurellmproject2 |
| azure-functions-prod.yml   | manual (`workflow_dispatch`)| Articulate-Storyline       |

Primary responsibilities:

* Checkout repository
* Install dependencies
* Authenticate to Azure (publish profile secret)
* Deploy Azure Function

---

# Authentication & Security

## Function Authorization Level

Both functions use:

```text
Function-level authorization  (authLevel: "function")
```

This means requests must include a valid Azure Function key.

## Function Key Usage

Requests can authenticate using either:

### URL Method

```text
https://<functionapp>.azurewebsites.net/api/coach?code=FUNCTION_KEY
```

### Header Method

```text
x-functions-key: FUNCTION_KEY
```

## Important Security Notes

Do NOT:

* Store production secrets directly in source control
* Share Function keys publicly
* Switch the Function App to Anonymous unless approved

## Known Limitation: Client-Side Function Key

Because the Storyline course calls the function from the browser, the Function
key is visible in the published course's client-side JavaScript. Function-level
auth therefore stops casual/drive-by abuse and lets you rotate a leaked key
quickly, but it is **not** a true secret in this setup.

Mitigations in place / recommended:

* Restrict CORS to your Storyline/LMS domain (see `ALLOWED_ORIGIN` below and the
  Azure Portal CORS settings)
* Rotate the Function key if it is exposed
* (Long term) move to an authenticated backend proxy so the key stays server-side

## Recommended Long-Term Security Improvement

```text
Storyline
    ↓
Authenticated Backend/Proxy
    ↓
Azure Function App
    ↓
LLM Gateway
```

This would keep Function keys server-side only.

---

# OAuth / LLM Gateway Authentication

## Authentication Flow

1. Azure Function receives request from Storyline
2. Function requests an OAuth token (client credentials grant)
3. Function authenticates against the enterprise gateway
4. Request is forwarded to the LLM Gateway
5. AI response returned to Storyline

## Required Credentials

The following values are required:

| Setting       | Purpose              |
| ------------- | -------------------- |
| CLIENT_ID     | OAuth client ID      |
| CLIENT_SECRET | OAuth client secret  |
| TOKEN_URL     | OAuth token endpoint |
| SCOPE         | OAuth scope          |
| GATEWAY_URL   | LLM Gateway endpoint |

Store these securely within:

* Azure Application Settings
* GitHub Secrets

Never store secrets directly in source code.

---

# Storyline 360 Integration

## Example Storyline JavaScript

```javascript
var p = GetPlayer();

var FUNCTION_URL = "https://javascriptazurellmproject2-dehrhfhuhkcpaygu.eastus-01.azurewebsites.net/api/coach?code=FUNCTION_KEY";

fetch(FUNCTION_URL, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    input: p.GetVar("user_input")
    // Optional: pass a stable sessionId to keep a conversation together, e.g.
    // sessionId: p.GetVar("session_id")
  })
})
.then(function(r) {
  if (!r.ok) {
    throw new Error("Backend error " + r.status);
  }
  return r.json();
})
.then(function(data) {
  console.log("Raw response:", data);

  var answer =
    data && data.gaiaResponse && data.gaiaResponse.result
      ? data.gaiaResponse.result
      : data.reply || data.error || "No reply returned";

  p.SetVar("ai_response", answer);
})
.catch(function(e) {
  p.SetVar("ai_response", "ERROR: " + e.message);
  console.error(e);
});
```

---

# Request & Response Format

## Example Request

```json
{
  "input": "How can I improve customer empathy?"
}
```

The function also accepts `message`, `text`, or `prompt` in place of `input`,
and an optional `sessionId` to maintain a multi-turn conversation. If no
`sessionId` is supplied, each request is isolated with a generated id.

## Example Response (coach)

```json
{
  "gaiaResponse": {
    "result": "Example AI response"
  }
}
```

---

# Environment Variables

## Azure Application Settings

| Variable            | Purpose                                                             |
| ------------------- | ------------------------------------------------------------------- |
| CLIENT_ID           | OAuth authentication                                                |
| CLIENT_SECRET       | OAuth authentication                                                |
| TOKEN_URL           | OAuth token endpoint                                                |
| SCOPE               | OAuth scope                                                         |
| GATEWAY_URL         | AI gateway endpoint                                                 |
| NODE_EXTRA_CA_CERTS | Path to the CA bundle used to trust the enterprise gateway cert     |
| ALLOWED_ORIGIN      | (Optional) Origin allowed via CORS; defaults to `*` if unset        |

---

# Monitoring & Logging

## Recommended Logging

* Azure Function logs
* Application Insights
* GitHub Actions logs
* Gateway response logging

> Note: verbose logging of raw learner input has been removed from the function
> code to reduce PII exposure. Errors are still logged.

## Recommended Monitoring

* Failed requests
* Authentication failures
* Function timeout errors
* Gateway latency
* High request volume

---

# Troubleshooting

## 401 Unauthorized

Cause:

* Missing Function key
* Invalid Function key

Resolution:

* Verify `?code=FUNCTION_KEY`
* Verify `x-functions-key` header
* Regenerate Function key if needed

---

## CORS Errors

Cause:

* Storyline domain not allowed

Resolution:

* Add the domain under Azure Function App CORS settings
* Optionally set `ALLOWED_ORIGIN` to that domain

---

## Gateway Authentication Failure

Cause:

* Expired OAuth token
* Invalid client credentials

Resolution:

* Verify CLIENT_ID and CLIENT_SECRET
* Verify token endpoint (TOKEN_URL) and SCOPE
* Regenerate credentials if necessary

---

## GitHub Actions Deployment Failure

Cause:

* Invalid Azure publish profile
* Failed npm install
* Invalid workflow configuration

Resolution:

* Verify GitHub Secrets
* Review GitHub Actions logs
* Reauthenticate deployment credentials

---

# Maintenance Procedures

## Rotate Function Keys

Azure Portal:

```text
Function App → Functions → coach → Function Keys
```

## Update GitHub Secrets

GitHub Repository:

```text
Settings → Secrets and Variables → Actions
```

## Redeploy Application

Push changes to `main` (dev) or manually run the prod workflow via
`workflow_dispatch`.

---

# Future Enhancements

Potential improvements:

* Remove Function key from Storyline frontend
* Add backend proxy layer
* Add centralized logging/dashboard
* Add rate limiting
* Add conversation memory/state handling
* Add retry/error handling improvements
* Add automated testing
* Add API versioning
* Add Azure Key Vault integration

---

# Ownership & Support

## Recommended Ownership

Document:

* Primary owner
* Backup owner
* Azure subscription owner
* GitHub repository owner

## Access Requirements

Personnel supporting this project should have access to:

* Azure Portal
* GitHub repository
* GitHub Actions
* LLM Gateway credentials/process
* Storyline project files

---

# Handoff Notes

This documentation is intended to support long-term maintainability and reduce dependency on individual contributors.

Future maintainers should:

* Review deployment workflow
* Understand Function authorization/security
* Understand LLM Gateway authentication flow
* Review Storyline integration requirements
* Maintain secure handling of credentials and Function keys

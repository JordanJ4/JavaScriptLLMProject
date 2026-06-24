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
| Runtime           | Node.js                    |
| Hosting           | Azure Functions            |
| Endpoint          | /api/coach                 |

## Resource Group

Document actual resource group name here.

## Region

East US

---

# Repository Structure

```text
.github/
  workflows/
    azure-function-deploy.yml

api/
  coach.js

host.json
package.json
README.md
```

## Important Files

| File                      | Purpose                            |
| ------------------------- | ---------------------------------- |
| coach.js                  | Main Azure Function logic          |
| package.json              | Node.js dependencies               |
| host.json                 | Azure Functions configuration      |
| azure-function-deploy.yml | GitHub Actions deployment workflow |

---

# Deployment Process (CI/CD)

## Current Deployment Method

Deployment is handled through GitHub Actions.

## Deployment Flow

```text
Developer Pushes Code to GitHub
        ↓
GitHub Actions Triggered
        ↓
Dependencies Installed
        ↓
Function App Packaged
        ↓
Deployment to Azure Function App
```

## GitHub Actions Workflow

Workflow location:

```text
.github/workflows/
```

Primary responsibilities:

* Checkout repository
* Install dependencies
* Build/package application
* Authenticate to Azure
* Deploy Azure Function

## Deployment Trigger

Document deployment branch here (example: main).

---

# Authentication & Security

## Function Authorization Level

The Azure Function uses:

```text
Function-level authorization
```

This means requests must include a valid Azure Function key.

## Function Key Usage

Requests can authenticate using either:

### URL Method (to be adjusted for Prod)

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

## Recommended Long-Term Security Improvement

Current implementation may expose the Function key client-side within Storyline JavaScript.

Recommended future architecture:

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
2. Function generates or retrieves OAuth token
3. Function authenticates against enterprise gateway
4. Request is forwarded to LLM Gateway
5. AI response returned to Storyline

## Required Credentials

The following values are required:

| Setting       | Purpose              |
| ------------- | -------------------- |
| CLIENT_ID     | OAuth client ID      |
| CLIENT_SECRET | OAuth client secret  |
| TOKEN_URL     | OAuth token endpoint |
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

## Example Response

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

Document actual values/setting names here.

| Variable      | Purpose              |
| ------------- | -------------------- |
| CLIENT_ID     | OAuth authentication |
| CLIENT_SECRET | OAuth authentication |
| TOKEN_URL     | OAuth token endpoint |
| GATEWAY_URL   | AI gateway endpoint  |

---

# Monitoring & Logging

## Recommended Logging

* Azure Function logs
* Application Insights
* GitHub Actions logs
* Gateway response logging

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

* Verify ?code=FUNCTION_KEY
* Verify x-functions-key header
* Regenerate Function key if needed

---

## CORS Errors

Cause:

* Storyline domain not allowed

Resolution:

* Add domain under Azure Function App CORS settings

---

## Gateway Authentication Failure

Cause:

* Expired OAuth token
* Invalid client credentials

Resolution:

* Verify CLIENT_ID and CLIENT_SECRET
* Verify token endpoint
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

Push changes to deployment branch or manually trigger GitHub Actions workflow.

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

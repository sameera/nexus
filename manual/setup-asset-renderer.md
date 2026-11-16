# Set up the Nexus asset renderer

GitHub does not render HTML in an issue. The asset renderer is a small service that serves an HTML mockup from your asset store as an isolated page. Issues then link to the renderer instead of to raw source.

Set it up once per team. After that, every `/nxs.epic` and `/nxs.decision-record` run with `--assets` links HTML mockups to it.

## How it works

- A filed issue links to `<renderer>/?url=<pinned mockup address>`.
- The pinned address is `https://github.com/<owner>/<repo>/blob/<full commit sha>/<path>.html`.
- The renderer fetches that file from GitHub and serves it sandboxed. The sandbox blocks scripts from calling back into the renderer.
- For a public store, the reader sees the mockup at once.
- For a private store, GitHub refuses the first fetch. The renderer sends the reader through a GitHub sign-in, then fetches the file as that reader. A reader sees a mockup only if their GitHub account can read the store.
- The renderer keeps no state between requests and stores no access list.

## Before you start

You need:

- An asset store already configured. See [Attach assets to filed issues](attaching-assets.md).
- Permission to create a GitHub App for the store's owner (user or organization).
- Somewhere to host an HTTPS service: AWS Lambda with a Function URL, or any Node 22 host.
- Node 22 and `pnpm` to build from this repository.

## Step 1: Create a GitHub App

The renderer signs readers in through a GitHub App. You can only finish the callback URL after Step 4, so create the app first and edit it later.

1. Open **Settings → Developer settings → GitHub Apps → New GitHub App** for the store's owner.
2. Set:
   - **Name:** for example `Nexus renderer`.
   - **Homepage URL:** any URL.
   - **Callback URL:** `https://<renderer-host>/auth/callback`. Use a placeholder now and fix it in Step 4.
   - **Expire user authorization tokens:** on.
   - **Webhook:** off.
3. Under **Repository permissions**, set **Contents** to **Read-only**. Grant nothing else.
4. Under **Where can this GitHub App be installed?**, choose **Only on this account**.
5. Create the app. Note the **Client ID**.
6. Under **Client secrets**, generate a secret. Copy it now. GitHub shows it once.

## Step 2: Install the app on the store

1. Open the app's **Install App** page.
2. Install it on the owner of the asset store.
3. Choose **Only select repositories** and pick the asset store repository.

A store without the installation fails with "That store is not set up for rendering".

## Step 3: Generate the session key

The renderer seals its session and sign-in cookies with a 32-byte key. It has no default. It refuses to start without one.

```bash
openssl rand -base64 32
```

Keep this value secret. Changing it signs every reader out.

## Step 4: Deploy

The renderer is configured only through environment variables.

| Variable | Required | Meaning |
| --- | --- | --- |
| `NEXUS_RENDERER_STORES` | yes | Comma-separated `owner/repo` list the renderer serves. Any other store is refused. |
| `NEXUS_RENDERER_CLIENT_ID` | yes | Client ID of the GitHub App. |
| `NEXUS_RENDERER_CLIENT_SECRET` | yes | Client secret of the GitHub App. |
| `NEXUS_RENDERER_SESSION_KEY` | yes | The base64 key from Step 3. Must decode to exactly 32 bytes. |
| `NEXUS_RENDERER_SIZE_CAP` | no | Largest file served, in bytes. Default 5242880 (5 MB). |
| `NEXUS_RENDERER_ADDRESS` | no | Local listener only. `host:port`. Default `127.0.0.1:8787`. |

Set `NEXUS_RENDERER_STORES` to the same store as `github.asset-store` in `.nexus/config/settings.yml`, without any `@branch`.

### Option A: AWS Lambda with a Function URL

1. Build the bundle:

   ```bash
   pnpm install
   pnpm nx bundle-lambda renderer
   ```

   The output is `apps/renderer/dist/lambda/index.mjs`.

2. Zip it:

   ```bash
   cd apps/renderer/dist/lambda && zip renderer.zip index.mjs
   ```

3. Create a Lambda function:
   - Runtime: Node.js 22.
   - Handler: `index.lambdaHandler`.
   - Upload `renderer.zip`.
   - Set the environment variables from the table.

4. Enable a **Function URL** with auth type `NONE`. Readers are not AWS users, so the URL must be public. The renderer does its own access checks through GitHub.

5. Note the Function URL, or attach your own domain. This is `<renderer-host>`.

### Option B: Any Node 22 host

1. Build the bundle:

   ```bash
   pnpm install
   pnpm nx bundle renderer
   ```

   The output is `apps/renderer/dist/handler.mjs`. It exports the request handler. It does not start a server.

2. To run the bundled handler behind your own HTTPS server, call `handleRequest(request, dependencies)`. Build the dependencies with `dependenciesFromEnvironment(process.env)` from `apps/renderer/src/environment.ts`. The source `apps/renderer/src/listen.ts` shows a minimal Node HTTP wrapper.

3. Terminate TLS in front of it. GitHub sign-in and the `Secure` session cookie both require HTTPS.

### Finish the GitHub App

Return to the GitHub App and set **Callback URL** to `https://<renderer-host>/auth/callback`. The callback must match exactly. The renderer does not use a path prefix.

## Step 5: Point Nexus at the renderer

In the repository's `.nexus/config/settings.yml`:

```yaml
github:
  asset-store: acme/issue-assets
  asset-renderer: "https://<renderer-host>/?url={url}"
```

Rules:

- The value must be an absolute `http` or `https` URL.
- It must contain exactly one `{url}` placeholder.
- It has no default. Without it, HTML assets link to the plain source.

Check the store resolves:

```bash
nexus assets resolve
```

## Step 6: Verify

1. Attach a small HTML file to a test epic draft:

   ```text
   /nxs.epic Test the renderer --assets assets/test-mockup.html
   ```

2. In the approval digest, confirm HTML assets use the configured renderer. Approve.
3. Open the filed issue and click the mockup link.
4. Expected results:
   - **Public store:** the mockup renders at once.
   - **Private store:** GitHub asks you to authorize the app once. Then the mockup renders.
   - **A reader without access to the store:** "That mockup could not be read as you."

## Run locally

For a trial before deploying:

```bash
export NEXUS_RENDERER_STORES=acme/issue-assets
export NEXUS_RENDERER_CLIENT_ID=<client id>
export NEXUS_RENDERER_CLIENT_SECRET=<client secret>
export NEXUS_RENDERER_SESSION_KEY=$(openssl rand -base64 32)
pnpm exec tsx apps/renderer/src/main.ts
```

It prints `renderer listening at http://127.0.0.1:8787/`. The sign-in cookie is `Secure`, so private-store sign-in will not complete over plain `http` on a non-localhost address. Public stores work without it.

## Common problems

- **Renderer will not start: `NEXUS_RENDERER_SESSION_KEY must be 32 bytes, base64-encoded`** — regenerate with `openssl rand -base64 32`.
- **`NEXUS_RENDERER_CLIENT_ID names no GitHub App`** or the secret equivalent — set the variable. Both are required even for a public-only store.
- **"That store is not set up for rendering"** — install the GitHub App on the asset store repository (Step 2).
- **"That store is not one this renderer serves"** — add `owner/repo` to `NEXUS_RENDERER_STORES`.
- **"A mockup is served only at a full commit identifier"** — the link names a branch or short SHA. Issues filed by Nexus always pin a full commit. Re-file the issue.
- **"Only an HTML page is served"** — the renderer serves `.html` and `.htm` files only. Images and other files link to the store directly.
- **"That file is larger than this renderer serves"** — raise `NEXUS_RENDERER_SIZE_CAP`.
- **Sign-in ends with "The sign-in could not be completed"** — check the client secret, and that the app's callback URL matches `https://<renderer-host>/auth/callback` exactly.
- **"No sign-in of yours is waiting to finish"** — the sign-in cookie expired (10 minutes) or the browser blocked it. Open the mockup link again.
- **"That mockup could not be read as you"** — the reader's GitHub account cannot read the file, or the file does not exist. The renderer gives the same answer for both on purpose.
- **A mockup script that calls the renderer fails** — by design. Mockups run sandboxed and cannot reach the renderer.
- **Changed `asset-renderer` but old issues still point to the old address** — expected. A filed reference is frozen. Only new issues use the new value.

## Security notes

- The renderer holds no credential of its own. It uses the reader's token and never writes it to a response, redirect, or log.
- Rotate the session key if you suspect it leaked. Rotate the client secret in the GitHub App and update `NEXUS_RENDERER_CLIENT_SECRET`.
- Keep `NEXUS_RENDERER_STORES` as short as possible. It limits which repositories a reader's token can be used against.

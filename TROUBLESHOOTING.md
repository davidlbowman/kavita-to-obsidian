# Troubleshooting

This guide covers common errors you may encounter when using the Kavita-to-Obsidian plugin, along with step-by-step solutions.

## Quick Reference

| Error Message | Likely Cause | Solution |
|---|---|---|
| Authentication failed | Wrong or expired API key | [Authentication Failed](#authentication-failed) |
| Access denied (401/403) | Server rejected credentials | [Network Error (Status 401/403)](#network-error-status-401403) |
| Kavita server not found (404) | Incorrect server URL | [Network Error (Status 404)](#network-error-status-404) |
| Cannot reach Kavita | Kavita not running or unreachable | [Connection Refused](#connection-refused) |
| Unexpected response | Plugin/server version mismatch | [Failed to Parse Response](#failed-to-parse-response) |
| Cannot write to path | Invalid output path or permissions | [Failed to Write File](#failed-to-write-file) |
| Folder error | Invalid folder name or path | [Folder Operation Failed](#folder-operation-failed) |
| No annotations synced | No highlights exist in Kavita | [No Annotations Synced](#no-annotations-synced) |

---

## Authentication Failed

**Error:** `Authentication failed: <reason>`

**Cause:** Your Kavita API key is missing, incorrect, or has expired.

**Steps to fix:**

1. Open your Kavita server in a web browser and log in.
2. Click your user avatar in the top-right corner and select **User Settings**.
3. Navigate to the **3rd Party Clients** section.
4. Copy your existing API key, or click **Reset Key** to generate a new one.
5. In Obsidian, open **Settings > Kavita to Obsidian**.
6. Paste the API key into the **API Key** field.
7. Run the sync again.

> **Tip:** If you recently changed your Kavita password, your API key may have been invalidated. Generate a new key and update the plugin settings.

---

## Network Error (Status 401/403)

**Error:** `Access denied. Your API key may be invalid or expired.`

**Cause:** Your Kavita server received the request but rejected your credentials. This differs from an authentication failure because the server actively refused access rather than the key being unrecognized.

**Steps to fix:**

1. Open your Kavita server and navigate to **User Settings > 3rd Party Clients**.
2. Click **Reset Key** to generate a fresh API key.
3. Copy the new key and paste it into the plugin settings in Obsidian.
4. Confirm you are using the API key for the correct Kavita user account. If your Kavita instance has multiple users, each user has their own API key.
5. Verify the account has the necessary permissions to access the library and series you want to sync.

---

## Network Error (Status 404)

**Error:** `Kavita server not found. Check your URL in settings.`

**Cause:** The plugin sent a request to the configured URL, but the server returned a 404 (Not Found) response. This typically means the URL is wrong.

**Steps to fix:**

1. Open the plugin settings and check your **Kavita URL**.
2. Remove any trailing slash from the URL. Use `http://localhost:5000` not `http://localhost:5000/`.
3. Verify the port number is correct. The default Kavita port is `5000`, but your installation may use a different port.
4. Check the protocol: use `http://` for local instances and `https://` for instances behind a reverse proxy with SSL.
5. Open the URL in your browser to confirm it loads the Kavita web interface.

**Common URL mistakes:**

- `http://localhost:5000/` -- remove the trailing slash
- `https://localhost:5000` -- use `http://` unless you have SSL configured locally
- `http://localhost` -- missing port number
- `http://kavita:5000` -- Docker internal hostname; use `http://localhost:5000` from Obsidian

---

## Connection Refused

**Error:** `Cannot reach Kavita: <details>`

**Cause:** The plugin could not connect to your Kavita server at all. The server may not be running, or a firewall is blocking the connection.

**Steps to fix:**

1. Confirm Kavita is running. If you installed Kavita as a service, check its status. If you run it manually, start the Kavita executable.
2. Open `http://localhost:5000` (or your configured URL) in a web browser to verify the server is accessible.
3. If Kavita runs on a different machine, verify that the firewall on the Kavita host allows incoming connections on the Kavita port.
4. If you use a reverse proxy (nginx, Caddy, Traefik), confirm the proxy is running and forwarding requests to Kavita correctly.
5. If Kavita runs inside Docker, ensure the container port is mapped to the host (e.g., `-p 5000:5000`).

---

## Failed to Parse Response

**Error:** `Failed to parse response: expected <type>`

**Cause:** The plugin received a response from Kavita that it could not decode. This usually means a version mismatch between the plugin and your Kavita server.

**Steps to fix:**

1. Update the Kavita-to-Obsidian plugin to the latest version via Obsidian's community plugin browser.
2. Update your Kavita server to the latest stable release. See the [Kavita releases page](https://github.com/Kareadita/Kavita/releases) for instructions.
3. After updating both, restart Kavita and try the sync again.
4. If the error persists after updating, open a [GitHub issue](https://github.com/davidlbowman/kavita-to-obsidian/issues) and include the Kavita version number from **Server Settings > About** in your report.

> **Note:** Kavita API responses may change between major versions. The plugin is tested against the latest stable Kavita release.

---

## Failed to Write File

**Error:** `Failed to write file: <path>`

**Cause:** The plugin could not write the output file to the specified path in your Obsidian vault.

**Steps to fix:**

1. Open the plugin settings and check the **Output Path** value.
2. Verify the path does not contain special characters that are invalid in file names on your operating system (e.g., `<`, `>`, `:`, `"`, `|`, `?`, `*` on Windows).
3. If you specified a subfolder (e.g., `Kavita/annotations.md`), make sure the folder already exists in your vault, or enable the hierarchical sync mode which creates folders automatically.
4. Try resetting the output path to a simple value like `kavita-annotations.md` to rule out path issues.
5. Check that your vault folder is not read-only or located on a locked volume.

---

## Folder Operation Failed

**Error:** `Folder <operation> failed: <path>`

**Cause:** The plugin could not create or modify a folder in your vault, usually because the folder name contains characters that are not allowed by the file system.

**Steps to fix:**

1. Check the folder path in the error message for special characters. Remove any characters like `<`, `>`, `:`, `"`, `|`, `?`, `*`, or leading/trailing spaces.
2. Shorten the folder path if it is very long. Some operating systems limit the total path length to 260 characters (Windows) or 1024 characters (macOS/Linux).
3. Ensure the parent folder exists and is writable.
4. If using hierarchical sync mode, check that your Kavita library and series names do not contain problematic characters. The plugin sanitizes names, but edge cases can occur.

---

## No Annotations Synced

**Error:** The sync completes without errors, but the output file is empty or missing.

**Cause:** There are no annotations (highlights or bookmarks) in your Kavita library, or the plugin is not finding them.

**Steps to fix:**

1. Open Kavita in your browser and navigate to a book or comic.
2. Select some text and choose **Highlight** to create an annotation.
3. Verify the highlight appears in Kavita by checking the annotation panel in the reader.
4. Run the sync again in Obsidian.
5. If you have annotations but they are not syncing, check that the spoiler setting in Kavita is not hiding them. Annotations marked as spoilers may be excluded depending on your server configuration.

---

## How to Find Your Kavita API Key

1. Open your Kavita server in a web browser and log in.
2. Click your **user avatar** in the top-right corner.
3. Select **User Settings** from the dropdown menu.
4. Scroll down to the **3rd Party Clients** section.
5. Your API key is displayed here. Click the copy button to copy it to your clipboard.
6. If no key is shown, click **Reset Key** to generate one.

---

## How to Verify Your Kavita URL

The correct URL is the address you use to access Kavita in your web browser, without any trailing path segments.

1. Open Kavita in your browser.
2. Look at the address bar. It should show something like `http://localhost:5000` or `https://kavita.example.com`.
3. Copy only the base URL (protocol + host + port). Do not include paths like `/library` or `/login`.
4. Remove any trailing slash.
5. Paste this value into the plugin's **Kavita URL** setting.

**Examples of correct URLs:**

- `http://localhost:5000`
- `http://192.168.1.100:5000`
- `https://kavita.example.com`

**Examples of incorrect URLs:**

- `http://localhost:5000/` (trailing slash)
- `http://localhost:5000/login` (includes path)
- `localhost:5000` (missing protocol)

---

## Common HTTPS and Certificate Issues

If your Kavita server uses HTTPS with a self-signed certificate, Obsidian may reject the connection because it cannot verify the certificate.

**Symptoms:** Connection errors, SSL/TLS errors, or "certificate not trusted" messages.

**Options:**

1. **Use a trusted certificate.** Services like [Let's Encrypt](https://letsencrypt.org/) provide free certificates that are trusted by all browsers and applications.
2. **Access Kavita over HTTP locally.** If Obsidian and Kavita run on the same machine, use `http://localhost:5000` instead of HTTPS.
3. **Use a reverse proxy.** Place a reverse proxy (nginx, Caddy) in front of Kavita that handles SSL termination with a trusted certificate.

---

## Self-Hosted vs Remote Kavita

**Local (same machine):** Use `http://localhost:5000` or `http://127.0.0.1:5000`. This avoids network and firewall issues entirely.

**Local network (different machine):** Use the Kavita host's local IP address, e.g., `http://192.168.1.100:5000`. Ensure no firewall blocks the port.

**Remote server:** Use the public URL or domain name, e.g., `https://kavita.example.com`. A valid SSL certificate is strongly recommended for remote connections. Verify the server allows external connections on the relevant port.

**Docker:** If Kavita runs in Docker, use the host-mapped port, not the container's internal port. Ensure the Docker port mapping is configured (e.g., `-p 5000:5000`).

---

## Still Need Help?

If your issue is not covered here, or the steps above did not resolve it:

1. Check the [existing issues](https://github.com/davidlbowman/kavita-to-obsidian/issues) to see if someone has reported the same problem.
2. Open a [new issue](https://github.com/davidlbowman/kavita-to-obsidian/issues/new) with the following information:
   - The exact error message shown in Obsidian
   - Your Kavita server version (found in **Server Settings > About**)
   - Your Kavita-to-Obsidian plugin version (found in **Obsidian Settings > Community Plugins**)
   - Your operating system
   - Whether Kavita is self-hosted locally, on a remote server, or in Docker

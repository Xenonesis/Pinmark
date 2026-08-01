# Pinmark Privacy Policy

**Effective Date:** August 1, 2026

Pinmark ("we," "our," or "the Extension") is a developer tool built to respect your privacy and data ownership. This policy explains what data we collect, how it is used, and how it is stored when you use the Pinmark Chrome Extension.

## 1. Local-First Architecture
Pinmark is explicitly designed as a local-first, developer-centric tool. **We do not operate any centralized cloud servers, telemetry pipelines, or remote databases.** 

The fundamental purpose of Pinmark is to capture diagnostic data (DOM elements, network requests, performance metrics, and state snapshots) from the webpage you are actively inspecting and transmit it *exclusively* to your own locally running Model Context Protocol (MCP) server.

## 2. Data We Collect and Process
When you actively interact with the Pinmark extension (e.g., by dropping a "pin" on a webpage element), the extension temporarily collects the following diagnostic data from that specific webpage:

- **DOM Information:** Tag names, CSS selectors, and surrounding HTML context of the pinned element.
- **Network Activity:** Metadata of network requests (URLs, statuses, timing) that occurred near the time of interaction.
- **Console & Error Logs:** Runtime JavaScript errors captured on the page.
- **Application State:** Snapshots of detected state management libraries (e.g., Redux, Vuex) active on the page.
- **Performance Metrics:** Long tasks and frame rate drops.
- **Accessibility Metrics:** Basic WCAG contrast and structural checks.

## 3. How Data is Used and Stored
- **No Cloud Transmission:** The data collected is **never** sent to our servers, third-party analytics providers, or any remote cloud endpoints by the extension itself.
- **Local MCP Sync:** Data is transmitted exclusively to `http://localhost:4747` (or your configured local MCP server port). This enables your local AI agents to analyze the bugs.
- **Local Storage:** The extension utilizes `chrome.storage.local` to temporarily persist your pins so they can be reviewed in the extension popup. This data resides entirely on your local hard drive and is cleared when you delete a pin.

## 4. Permissions
To function correctly, Pinmark requests the following browser permissions:
- **`storage`**: Used exclusively for `chrome.storage.local` to save your pending pins and extension settings locally.
- **`activeTab` & `<all_urls>`**: Required to inject the visual annotation overlay and capture the necessary diagnostic context (network, console, state) from the pages you choose to debug.

## 5. Third-Party Sharing
We do not sell, rent, or share your data with any third parties. Because the extension does not transmit data off your device, there is no data for us to share.

## 6. Changes to This Policy
We may update this Privacy Policy from time to time. If we make significant changes regarding how local data is handled, we will notify users through the extension's release notes or our GitHub repository.

## 7. Contact Us
If you have any questions or concerns about this Privacy Policy or our local-first data practices, please open an issue on our official GitHub repository.

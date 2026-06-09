/**
 * The single source of truth for the running build's version.
 *
 * Both the UI client and the background session-server import this so the
 * client can notice when a freshly-installed binary is talking to an older,
 * still-running server (see the version handshake in the session snapshot).
 */
import packageJson from "../../package.json"

export const APP_VERSION: string = packageJson.version

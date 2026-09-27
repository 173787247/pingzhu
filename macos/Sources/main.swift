import Cocoa
import InputMethodKit

/**
 The input method server.
 *
 IMK finds this through `InputMethodConnectionName` and `InputMethodServerControllerClass`
 in Info.plist: the first is the Mach port the server listens on, the second is the
 controller class the system instantiates per client.
 */

/// Must match `InputMethodConnectionName` in Info.plist.
let connectionName = "tw.pingzhu.ime_Connection"

guard let server = IMKServer(name: connectionName, bundleIdentifier: Bundle.main.bundleIdentifier) else {
    NSLog("PingZhu: could not start the IMK server — is the connection name in Info.plist correct?")
    exit(1)
}

// Held for the process lifetime: releasing it would take the input method down
// with it the moment this scope ended.
withExtendedLifetime(server) {
    NSApplication.shared.run()
}

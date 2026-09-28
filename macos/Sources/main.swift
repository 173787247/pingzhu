import Cocoa
import InputMethodKit

/**
 The input method server.
 *
 IMK finds this through `InputMethodConnectionName` and `InputMethodServerControllerClass`
 in Info.plist: the first is the Mach port the server listens on, the second is the
 controller class the system instantiates per client.

 This file used to do only that, and the input method never appeared in the system's
 list. The missing half is in Registration.swift: an input method has to register
 itself, and this one never did.
 */

/// Must match `InputMethodConnectionName` in Info.plist.
let connectionName = "tw.pingzhu.ime_Connection"

// Before the server, register with the system.
//
// Order matters: registering first means that if the system refuses, the log says
// so before anything else happens, and the server still starts so the input method
// keeps working for anyone who already has it enabled.
Registration.registerIfNeeded()

guard let server = IMKServer(name: connectionName, bundleIdentifier: Bundle.main.bundleIdentifier) else {
    NSLog("PingZhu: could not start the IMK server — is the connection name in Info.plist correct?")
    exit(1)
}

// Held for the process lifetime: releasing it would take the input method down
// with it the moment this scope ended.
withExtendedLifetime(server) {
    NSApplication.shared.run()
}

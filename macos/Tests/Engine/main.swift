import Foundation

/**
 Exercises the engine through the C ABI, on macOS, for real.

 The build already proves it *links*; this proves it *runs*. Those are different
 claims and the difference is exactly the kind of thing that stays hidden until a
 user finds it: a core that links on Darwin and then returns an empty string
 because the language model could not be read looks identical to a core that
 works, until someone types.

 What it does not test: IMK. Enabling an input source and sending it keystrokes
 needs a logged-in GUI session, which a CI runner does not have. That part still
 needs a person and a Mac — but this narrows what that person has to check.

 usage: PingZhuEngineTest <data directory>
 */

func fail(_ message: String) -> Never {
    FileHandle.standardError.write("FAIL  \(message)\n".data(using: .utf8)!)
    exit(1)
}

let arguments = CommandLine.arguments
guard arguments.count > 1 else {
    fail("usage: PingZhuEngineTest <data directory containing bopomofo-lm.tsv>")
}
let dataDir = arguments[1]

guard let engine = Engine(dataDir: dataDir) else {
    fail("engine_create returned nil for \(dataDir) — the language model could not be read")
}

/// Types a string and returns what would be committed.
func type(_ keys: String) -> String {
    engine.reset()
    for key in keys {
        engine.feedKey(key)
    }
    return engine.sentence
}

var failures: [String] = []

func check(_ what: String, _ actual: String, _ expected: String) {
    if actual == expected {
        print("ok    \(what): \(actual)")
    } else {
        failures.append("\(what): expected \"\(expected)\", got \"\(actual)\"")
    }
}

// The three phrases the README promises. If these fail on macOS while passing on
// Windows and Android, the core is not as shared as it claims to be.
check("su3cl3", type("su3cl3"), "你好")
check("ji394su3", type("ji394su3"), "我愛你")
check("w96j0", type("w96j0"), "台灣")

// The candidate list comes from the same scores as the default, so the top
// candidate and the sentence must agree.
engine.reset()
for key in "su3cl3" { engine.feedKey(key) }
engine.openCandidates()
let first = engine.candidate(at: 0)
check("the first candidate is the default sentence", first, engine.sentence)
if engine.candidateCount == 0 {
    failures.append("the candidate list is empty")
}

// Output script: the engine is Traditional throughout, and this is a boundary
// transform. Verified here because it is the one feature that touches the data
// files the bundle ships.
if !engine.setOutputScript("simplified") {
    failures.append("setOutputScript(\"simplified\") was refused")
}
check("w96j0 in Simplified", type("w96j0"), "台湾")
if !engine.setOutputScript("traditional") {
    failures.append("setOutputScript(\"traditional\") was refused")
}
check("w96j0 back in Traditional", type("w96j0"), "台灣")

// A name that is not a script must be refused rather than silently accepted —
// a shell that misspells it should find out.
if engine.setOutputScript("Simplified") {
    failures.append("setOutputScript accepted \"Simplified\"; it should be case-sensitive")
}

// The user dictionary writes somewhere real on this platform.
let dictionaryPath = NSTemporaryDirectory() + "pingzhu-test-userdict.txt"
if engine.saveUserDictionary(path: dictionaryPath) {
    print("ok    the user dictionary writes to \(dictionaryPath)")
} else {
    failures.append("saveUserDictionary failed")
}

if !failures.isEmpty {
    for failure in failures {
        FileHandle.standardError.write("FAIL  \(failure)\n".data(using: .utf8)!)
    }
    fail("\(failures.count) engine checks failed on macOS")
}

print("ok    the engine runs on macOS")

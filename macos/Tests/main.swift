import Foundation

/**
 Reads `tools/routing-vectors.tsv` and checks the router against it.

 The vectors are shared, not written here. This project has four shells with four
 routers, and the way they stay honest is by being tested against one list rather
 than four lists that happen to agree today.

 Exits non-zero on the first failure, so CI treats it like any other test.
 */

func fail(_ message: String) -> Never {
    FileHandle.standardError.write("FAIL  \(message)\n".data(using: .utf8)!)
    exit(1)
}

/// Path to the vectors: an argument, or the build directory's sibling.
let arguments = CommandLine.arguments
guard arguments.count > 1 else {
    fail("usage: PingZhuSelfTest <path to routing-vectors.tsv>")
}
let vectorPath = arguments[1]

guard let contents = try? String(contentsOfFile: vectorPath, encoding: .utf8) else {
    fail("cannot read \(vectorPath)")
}

/// The escape spellings the file uses, so it stays readable in a diff.
func character(from field: String) -> Character {
    switch field {
    case "\\n": return "\n"
    case "\\b": return "\u{8}"
    case "\\e": return "\u{1b}"
    case "\\v": return "\u{0b}"   // the down arrow's marker
    case "\\f": return "\u{0c}"   // the up arrow's marker
    case "space": return " "
    default:
        guard let first = field.first else { fail("empty key field") }
        return first
    }
}

var checked = 0
var failures: [String] = []

for (index, line) in contents.split(separator: "\n", omittingEmptySubsequences: false).enumerated() {
    let text = String(line)
    if text.isEmpty || text.hasPrefix("#") || text.hasPrefix("key\t") { continue }

    let fields = text.split(separator: "\t", omittingEmptySubsequences: false).map(String.init)
    guard fields.count == 5 else {
        fail("line \(index + 1): expected 5 fields, got \(fields.count): \(text)")
    }

    let key = character(from: fields[0])
    let state = Router.State(
        composing: fields[1] == "1",
        windowOpen: fields[2] == "1",
        hasCandidates: fields[3] == "1",
    )
    let expected = fields[4]

    let actual = Router.route(key, state).rawValue
    checked += 1
    if actual != expected {
        failures.append(
            "line \(index + 1): key \(fields[0]) composing=\(fields[1]) window=\(fields[2]) "
                + "candidates=\(fields[3]) → expected \(expected), got \(actual)"
        )
    }
}

if !failures.isEmpty {
    for failure in failures {
        FileHandle.standardError.write("FAIL  \(failure)\n".data(using: .utf8)!)
    }
    fail("\(failures.count) of \(checked) routing vectors failed")
}

// The zero key is the tenth candidate, which is the one index that is not
// arithmetic on the character.
precondition(Router.candidateIndex("1") == 1)
precondition(Router.candidateIndex("9") == 9)
precondition(Router.candidateIndex("0") == 10)

print("ok    \(checked) routing vectors, and the candidate indices")

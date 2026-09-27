import Foundation

/**
 What the shell should do with a key.

 Deliberately the same vocabulary as the Windows, Android and reference
 implementations, because the rules that matter are not shell-specific: space
 commits a sentence when no candidate list is open and pages it when one is, and
 the digit keys compose until the list opens.

 That second rule is not theoretical. Getting it wrong is how the Windows version
 spent a release unable to type any word starting with ㄅ, ㄉ, ㄓ, ㄚ, ㄞ or ㄢ —
 the digits are Bopomofo keys, and six of the twenty-one consonants live on them.
 */
enum Action: String {
    case pass = "Pass"
    case compose = "Compose"
    case backspace = "Backspace"
    case commit = "Commit"
    case cancel = "Cancel"
    case openCandidates = "OpenCandidates"
    case closeCandidates = "CloseCandidates"
    case nextPage = "NextPage"
    case prevPage = "PrevPage"
    case selectCandidate = "SelectCandidate"
}

/**
 The key routing table, with no IMK dependency so it can be tested without a
 running input method — or a Mac.
 */
enum Router {

    /// The engine's view of the world, so the routing decision depends on nothing
    /// but these four values. Keeping it a value type is what makes the vectors
    /// in `tools/routing-vectors.tsv` sufficient to test it.
    struct State {
        var composing: Bool
        var windowOpen: Bool
        var hasCandidates: Bool
    }

    static func route(_ key: Character, _ state: State) -> Action {
        switch key {
        case "\r", "\n", "\u{3}":       // Return, Enter, and the numeric keypad's
            return .commit
        case "\u{1b}":                  // Escape
            return .cancel
        case "\u{8}", "\u{7f}":         // Delete (Backspace) and Forward Delete
            return .backspace
        case "\u{0b}":                  // the down arrow, remapped by the shell
            return .openCandidates
        case "\u{0c}":                 // the up arrow, remapped by the shell
            return .closeCandidates
        case " ":
            if state.composing && state.windowOpen { return .nextPage }
            if state.composing { return .commit }
            return .pass
        case "0"..."9":
            // The digits are Bopomofo keys — 1 is ㄅ, 2 is ㄉ, 5 is ㄓ — so they
            // may only select a candidate once the list is actually open.
            return (state.composing && state.windowOpen && state.hasCandidates)
                ? .selectCandidate
                : .compose
        default:
            return .compose
        }
    }

    /// One-based index for `.selectCandidate`; 10 means the `0` key.
    static func candidateIndex(_ key: Character) -> Int {
        key == "0" ? 10 : Int(String(key)) ?? 0
    }
}

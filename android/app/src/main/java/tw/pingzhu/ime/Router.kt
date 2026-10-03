package tw.pingzhu.ime

/**
 * What the shell should do with a key.
 *
 * Deliberately the same vocabulary as the Windows routers, because the rules
 * that matter are not shell-specific: space commits a sentence when no candidate
 * list is open and pages it when one is, and the digit keys compose until the
 * list opens. Getting those two wrong is how the Windows version spent a release
 * unable to type any word starting with ㄅ, ㄉ, ㄓ, ㄚ, ㄞ or ㄢ.
 */
enum class Action {
    Pass,
    Compose,
    Backspace,
    Commit,
    Cancel,
    OpenCandidates,
    CloseCandidates,
    NextPage,
    PrevPage,
    SelectCandidate,
}

/**
 * The key routing table, with no Android dependencies so it can be tested on the
 * JVM without an emulator.
 */
object Router {

    /**
     * @param key the character the key produces, lower-cased
     * @param composing whether the engine currently holds a partial reading
     * @param windowOpen whether the candidate list is showing
     * @param hasCandidates whether there is anything in it
     */
    fun route(
        key: Char,
        composing: Boolean,
        windowOpen: Boolean,
        hasCandidates: Boolean,
    ): Action = when (key) {
        '\n', '\r' -> Action.Commit
        '\u001b' -> Action.Cancel          // Escape
        // Only while composing. Outside one, Backspace belongs to whatever the
        // user is editing — a shell that swallows it makes the key stop
        // deleting, which is how this was found (the shared vectors).
        '\b', '\u007f' -> if (composing) Action.Backspace else Action.Pass
        // Nothing to browse without a composition to resolve.
        '\u000b' -> if (composing && hasCandidates) Action.OpenCandidates else Action.Pass
        '\u000c' -> Action.CloseCandidates // form feed: the up arrow
        // Space ends in an acceptance, but not on its first press. A first press
        // that committed would leave the second candidate unreachable unless the
        // user already knew to press the down arrow instead, so the first press
        // opens the list and the second takes what is on it. With nothing to
        // offer it accepts as before; outside a composition it is a space.
        ' ' -> when {
            !composing -> Action.Pass
            !windowOpen && hasCandidates -> Action.OpenCandidates
            else -> Action.Commit
        }
        // The digits are Bopomofo keys — 1 is ㄅ, 2 is ㄉ, 5 is ㄓ — so they may
        // only select a candidate once the list is actually open. Requiring the
        // key to *compose* before it could compose is the bug described above.
        in '0'..'9' -> if (composing && windowOpen && hasCandidates) {
            Action.SelectCandidate
        } else {
            Action.Compose
        }
        else -> Action.Compose
    }

    /** One-based index for [Action.SelectCandidate]; 10 means the '0' key. */
    fun candidateIndex(key: Char): Int = if (key == '0') 10 else key - '0'
}

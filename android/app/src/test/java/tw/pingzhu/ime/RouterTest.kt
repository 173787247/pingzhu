package tw.pingzhu.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test
import java.io.File

/**
 * The routing rules that the Windows version got wrong once already.
 *
 * These run on the JVM: routing has no Android dependencies precisely so that
 * the rules can be pinned without an emulator, an APK, or a device.
 *
 * The list of rules lives in `tools/routing-vectors.tsv`, shared with the
 * Windows and macOS suites, and [theSharedVectorsHold] reads it: a rule written
 * out once per shell will drift, and the down arrow's second half is the proof
 * — this file used to mention the vectors in a comment while testing its own
 * copy of the rules.
 */
class RouterTest {

    private fun idle(key: Char) = Router.route(key, composing = false, windowOpen = false, hasCandidates = false)

    private fun composing(key: Char) =
        Router.route(key, composing = true, windowOpen = false, hasCandidates = false)

    private fun choosing(key: Char) =
        Router.route(key, composing = true, windowOpen = true, hasCandidates = true)

    // ------------------------------------------------------ the shared vectors

    @Test
    fun theSharedVectorsHold() {
        // Gradle runs tests with the module directory as the working directory,
        // so the repository root is two levels up; the other candidates are
        // there for anyone running the class from somewhere else.
        val path = listOf(
            "../../tools/routing-vectors.tsv",
            "../tools/routing-vectors.tsv",
            "tools/routing-vectors.tsv",
        ).map(::File).firstOrNull { it.isFile }
        assertNotNull("cannot find tools/routing-vectors.tsv from ${File(".").absolutePath}", path)
        if (path == null) return

        val failures = mutableListOf<String>()
        var checked = 0
        path.readLines().forEachIndexed { number, line ->
            val text = line.trim()
            if (text.isEmpty() || text.startsWith("#") || text.startsWith("key\t")) return@forEachIndexed
            val fields = text.split('\t')
            if (fields.size != 5) {
                failures += "line ${number + 1}: expected five fields, found ${fields.size}"
                return@forEachIndexed
            }
            val actual = Router.route(
                key = unescape(fields[0]),
                composing = fields[1] == "1",
                windowOpen = fields[2] == "1",
                hasCandidates = fields[3] == "1",
            )
            checked++
            if (actual.name != fields[4]) {
                failures += "line ${number + 1}: ${fields[0]} ${fields[1]}/${fields[2]}/${fields[3]}" +
                    " → $actual, expected ${fields[4]}"
            }
        }

        assertEquals("no vectors were read from $path", true, checked > 0)
        assertEquals(failures.joinToString("\n"), 0, failures.size)
    }

    /** The escape spellings the vectors file uses, so it stays readable in a diff. */
    private fun unescape(field: String): Char = when (field) {
        "\\n" -> '\n'
        "\\e" -> '\u001b'
        "\\b" -> '\b'
        "\\v" -> '\u000b'
        "\\f" -> '\u000c'
        "space" -> ' '
        else -> field[0]
    }

    // ------------------------------------------------------------- the basics

    @Test
    fun lettersCompose() {
        assertEquals(Action.Compose, idle('s'))
        assertEquals(Action.Compose, idle('u'))
        assertEquals(Action.Compose, idle('3'))
    }

    @Test
    fun enterCommitsAndEscapeCancels() {
        assertEquals(Action.Commit, composing('\n'))
        assertEquals(Action.Cancel, composing('\u001b'))
    }

    @Test
    fun backspaceAndDeleteBothErase() {
        assertEquals(Action.Backspace, composing('\b'))
        assertEquals(Action.Backspace, composing('\u007f'))
    }

    // Only while composing. Outside one these belong to whatever the user is
    // editing; swallowing them makes the key stop working. Found by the shared
    // vectors in tools/routing-vectors.tsv, which is what they are for.
    @Test
    fun backspacePassesWhenNotComposing() {
        assertEquals(Action.Pass, idle('\b'))
        assertEquals(Action.Pass, idle('\u007f'))
    }

    // ------------------------------------------------------- digits are ㄅㄉㄓ

    /**
     * The regression that shipped in v0.6.0: the digit keys are Bopomofo keys,
     * and six of the twenty-one consonants live on them. A rule that only let a
     * digit compose when a composition was already running made every word
     * starting with ㄅ, ㄉ, ㄓ, ㄚ, ㄞ or ㄢ impossible to type — including 倒,
     * which the user was trying to type when they found it.
     */
    @Test
    fun digitsComposeBeforeAnythingElse() {
        for (key in '0'..'9') {
            assertEquals("digit $key from idle", Action.Compose, idle(key))
        }
    }

    @Test
    fun digitsStartAWordThatBeginsWithThem() {
        // 倒 = ㄉㄠˇ = 2 l 3
        assertEquals(Action.Compose, idle('2'))
        assertEquals(Action.Compose, composing('l'))
        assertEquals(Action.Compose, composing('3'))
    }

    @Test
    fun digitsSelectOnlyOnceTheListIsOpen() {
        assertEquals(Action.SelectCandidate, choosing('1'))
        assertEquals(Action.SelectCandidate, choosing('0'))
        // A composition with no list open still needs its digits.
        assertEquals(Action.Compose, composing('2'))
    }

    @Test
    fun digitsDoNotSelectFromAnEmptyList() {
        // windowOpen can be true with nothing in it, and selecting from an empty
        // list would swallow the key that should have composed.
        assertEquals(
            Action.Compose,
            Router.route('2', composing = true, windowOpen = true, hasCandidates = false),
        )
    }

    @Test
    fun theZeroKeyIsTheTenthCandidate() {
        assertEquals(1, Router.candidateIndex('1'))
        assertEquals(9, Router.candidateIndex('9'))
        assertEquals(10, Router.candidateIndex('0'))
    }

    // ------------------------------------------------------------ space is key

    // Space ends in an acceptance, but not on its first press. A first press
    // that committed would leave the second candidate reachable only by someone
    // who already knew to press the down arrow; a first press that paged would
    // make the most-pressed key in the input method scroll a list nobody asked
    // to scroll. So: open, then accept.

    @Test
    fun spaceCommitsWhenThereIsNothingToOffer() {
        assertEquals(Action.Commit, composing(' '))
    }

    @Test
    fun spaceOpensTheListWhenThereAreCandidates() {
        assertEquals(
            Action.OpenCandidates,
            Router.route(' ', composing = true, windowOpen = false, hasCandidates = true),
        )
    }

    @Test
    fun spaceAcceptsOnceTheListIsOpen() {
        assertEquals(Action.Commit, choosing(' '))
    }

    @Test
    fun spacePassesOutsideAComposition() {
        assertEquals(Action.Pass, idle(' '))
    }

    @Test
    fun spaceIsTheApplicationstWhenNothingIsComposing() {
        // Otherwise the user could not type a space at all.
        assertEquals(Action.Pass, idle(' '))
    }

    // ------------------------------------------------------------- arrow keys

    @Test
    fun theDownArrowOpensTheListAndUpClosesIt() {
        // There has to be something to browse: a composition to resolve.
        assertEquals(
            Action.OpenCandidates,
            Router.route('\u000b', composing = true, windowOpen = false, hasCandidates = true),
        )
        assertEquals(Action.CloseCandidates, choosing('\u000c'))
    }

    @Test
    fun theDownArrowPassesWithNothingToBrowse() {
        assertEquals(Action.Pass, composing('\u000b'))
        assertEquals(Action.Pass, idle('\u000b'))
    }

    @Test
    fun theDownArrowPagesOnceTheListIsOpen() {
        // One key for both halves of browsing, as on the desktop: with the list
        // already open the same press moves on ten instead of reopening the
        // first page. On a phone this is the only way to reach candidate eleven
        // — the board has no arrow keys to do it with.
        assertEquals(Action.NextPage, choosing('\u000b'))
    }
}

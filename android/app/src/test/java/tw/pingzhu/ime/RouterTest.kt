package tw.pingzhu.ime

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * The routing rules that the Windows version got wrong once already.
 *
 * These run on the JVM: routing has no Android dependencies precisely so that
 * the rules can be pinned without an emulator, an APK, or a device.
 */
class RouterTest {

    private fun idle(key: Char) = Router.route(key, composing = false, windowOpen = false, hasCandidates = false)

    private fun composing(key: Char) =
        Router.route(key, composing = true, windowOpen = false, hasCandidates = false)

    private fun choosing(key: Char) =
        Router.route(key, composing = true, windowOpen = true, hasCandidates = true)

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
        assertEquals(Action.OpenCandidates, composing('\u000b'))
        assertEquals(Action.CloseCandidates, choosing('\u000c'))
    }
}

/**
 * 平注的键盘面板。
 *
 * **键面不是写在这里的。** 这一页向引擎要（keyboardRows），因为画出来的键
 * 和看得懂的键必须来自同一张表——v0.6.0 那个「数字键」的回归就是这样发生的：
 * 两份判断，一份错了，而错误是安静的（倒、以及所有以 ㄅㄉㄓㄚㄞㄢ 开头的字
 * 都打不出来）。
 */
import pingzhu from 'libpingzhu.so';
import { Session } from '../model/Session';
import { BackspaceAction, routeBackspace } from '../model/Keys';
import { promptAction } from '@kit.ArkUI';

/**
 * The layouts the engine has, with the names the core knows. Order is the menu's
 * order: the two almost everyone uses first, then the rearranged ones.
 */
const LAYOUT_CHOICES: Array<[string, string]> = [
  ['standard', '大千式'],
  ['eten', '倚天式'],
  ['hsu', '許氏'],
  ['eten26', '倚天 26 鍵'],
  ['ibm', 'IBM'],
  ['ginyieh', '精業'],
  ['mitac', '神通'],
];

/** One key on the board. */
interface Key {
  letter: string;   // what pressing it sends, e.g. "1"
  label: string;    // what is drawn on it, e.g. "ㄅ" — empty for a key with no component
}

/**
 * The English board.
 *
 * A phone keyboard has to be able to type a URL, an address, a password — and
 * this one could not: every key on it is a Bopomofo component, and the engine
 * rejects what is not in the layout, so there was no way to produce a Latin
 * letter at all. Android handles this by switching to QWERTY for numeric,
 * phone and password fields; this board is switched by hand, because the
 * HarmonyOS editor attributes that would allow the automatic version are not
 * something a build without a device can verify.
 *
 * Same letters as Android's QWERTY_ROWS, so the two phones feel the same.
 */
const QWERTY_ROWS: Key[][] = [
  '1234567890'.split('').map((k: string): Key => ({ letter: k, label: k })),
  'qwertyuiop'.split('').map((k: string): Key => ({ letter: k, label: k })),
  'asdfghjkl'.split('').map((k: string): Key => ({ letter: k, label: k })),
  'zxcvbnm'.split('').map((k: string): Key => ({ letter: k, label: k })),
];

@Component
export struct KeyboardPanel {
  /** Rows of keys, from the engine. */
  @State private rows: Key[][] = [];
  @State private composing: string = '';
  @State private candidates: string[] = [];
  /** What the engine would commit, shown next to the reading. */
  @State private sentence: string = '';
  /** False when that sentence is a guess rather than a decode. */
  @State private faithful: boolean = true;
  @State private ready: boolean = false;
  @State private failure: string = '';
  /** "traditional" or "simplified" — what the decoder outputs, not how it decodes. */
  @State private script: string = 'traditional';
  /** The layout the engine was built with; a rebuild is how it changes. */
  @State private layout: string = 'standard';
  /** True while the English board is showing instead of Bopomofo. */
  @State private english: boolean = false;

  aboutToAppear(): void {
    this.load();
  }

  private load(): void {
    try {
      this.script = pingzhu.outputScript();
      // The layout the extension built the engine with. The board must be drawn
      // from the same name, or the keys say one thing and the decoder does
      // another — which is exactly what happened on Android.
      this.layout = Session.layout.length > 0 ? Session.layout : 'standard';
      // Pairs, not two parallel strings. The 倚天 layout has more keys in its
      // first row than it has Bopomofo components, so the two cannot be zipped
      // from separate runs — a test in core-rs/ caught that.
      const raw: string = pingzhu.keyboardRows(this.layout);
      const parsed: Key[][] = [];
      for (const line of raw.split('\n')) {
        const row: Key[] = [];
        for (const pair of line.split('|')) {
          const parts: string[] = pair.split(':');
          if (parts.length !== 2) continue;
          row.push({ letter: parts[0], label: parts[1] });
        }
        if (row.length > 0) parsed.push(row);
      }
      this.rows = parsed;
      this.ready = true;
    } catch (error) {
      // An input method that cannot reach its engine should say so and stay
      // usable rather than take the keyboard down with it.
      this.failure = `${error}`;
    }
  }

  private tap(letter: string): void {
    try {
      // Nothing here belongs to the input method when the English board is up.
      // Leaving the Bopomofo decoder live behind a Latin keyboard is how a phone
      // number field quietly fills with Chinese.
      if (this.english) {
        Session.insertText(letter);
        return;
      }
      pingzhu.feedKey(letter);
      this.syncFromEngine();
    } catch (error) {
      this.failure = `${error}`;
    }
  }

  /**
   * Writes the words the user has taught us.
   *
   * The words a user picks are the only training signal this input method has.
   * They used to live in memory only: a restart forgot every correction, and
   * nothing anywhere said so.
   */
  /**
   * Switches the output between traditional and simplified.
   *
   * The decoder always works in traditional — that is the design, not a
   * limitation — and the conversion happens at the output boundary. Every other
   * shell could choose; this keyboard could not, so its users got traditional
   * and nothing else.
   */
  /**
   * Pulls everything the board shows out of the engine in one place.
   *
   * These four used to be copied by hand at each call site, which is how the
   * sentence came to be fetched nowhere: `bestSentence()` existed in the napi table
   * from the start and no ArkTS line ever called it.
   */
  private syncFromEngine(): void {
    this.composing = pingzhu.composing();
    this.candidates = pingzhu.candidates();
    this.sentence = pingzhu.bestSentence();
    this.faithful = pingzhu.outputIsFaithful();
  }

  /**
   * The layout menu, attached to a long press on the script key.
   */
  @Builder
  layoutMenu() {
    Column() {
      ForEach(LAYOUT_CHOICES, (choice: [string, string]) => {
        Row({ space: 8 }) {
          Text(choice[0] === this.layout ? '✓' : '')
            .fontSize(13)
            .width(18)
          Text(choice[1])
            .fontSize(15)
        }
        .height(40)
        .width('100%')
        .padding({ left: 14, right: 14 })
        .onClick(() => { this.useLayout(choice[0], choice[1]); })
      }, (choice: [string, string]) => choice[0])
    }
    .width(180)
    .backgroundColor('#FFFFFF')
  }

  /**
   * Switches the layout by rebuilding the engine.
   *
   * A layout is fixed when the engine is built — the decoder is shaped around it —
   * so this is a rebuild, not a setting. napi's `create()` destroys the old engine
   * and makes a new one; the user dictionary and the output script have to be
   * reattached afterwards, because a fresh engine has neither.
   */
  private useLayout(id: string, label: string): void {
    if (id === this.layout) return;
    try {
      if (!pingzhu.create(Session.modelDir, id)) {
        this.failure = `布局載入失敗：${label}`;
        return;
      }
      pingzhu.loadUserDictionary(Session.userDictPath);
      pingzhu.setOutputScript(this.script);
      Session.saveLayout(id);
      // The composition was a reading in the old layout. In the new one those keys
      // mean something else, so keeping it would be worse than losing it.
      this.composing = '';
      this.load();
      this.syncFromEngine();
      promptAction.showToast({ message: `布局：${label}`, duration: 1500 });
    } catch (error) {
      this.failure = `${error}`;
    }
  }

  private toggleScript(): void {
    const next: string = this.script === 'simplified' ? 'traditional' : 'simplified';
    if (!pingzhu.setOutputScript(next)) return;
    this.script = next;
    this.syncFromEngine();
    Session.saveScript(next);
  }

  /**
   * Switches between the Bopomofo board and the English one.
   *
   * Turning it on clears any half-typed reading: the next key is Latin, and a
   * composition left behind would sit on the bar forever.
   */
  private toggleEnglish(): void {
    this.english = !this.english;
    if (this.english) {
      pingzhu.reset();
      this.composing = '';
      this.candidates = [];
      this.rows = QWERTY_ROWS;
    } else {
      this.load();
    }
  }

  private saveUserDictionary(): void {
    if (Session.userDictPath.length === 0) return;
    try {
      if (!pingzhu.saveUserDictionary(Session.userDictPath)) {
        this.failure = `詞典寫不進去（${Session.userDictPath}）`;
      }
    } catch (error) {
      this.failure = `${error}`;
    }
  }

  private commit(): void {
    try {
      const text: string = pingzhu.commit();
      this.composing = '';
      this.candidates = [];
      if (text.length === 0) return;
      this.saveUserDictionary();

      // Through the Session, not into this.composing.
      //
      // The first version wrote `this.composing = （已選：${text}）` and stopped
      // there — the word was decoded, selected, shown on the panel, and dropped.
      // The editor and the engine are different things, and this is the call
      // that carries text from one to the other.
      const sent: boolean = Session.insertText(text);
      if (!sent) {
        // Worth showing. Text that is decoded and then dropped looks exactly
        // like text that was never typed.
        this.composing = `沒有編輯器（${text}）`;
      }
    } catch (error) {
      this.failure = `${error}`;
    }
  }

  @Builder
  private CandidateBar() {
    if (this.candidates.length > 0) {
      Row({ space: 6 }) {
        // The whole page of candidates, scrollable, plus a key for the next one.
        //
        // This row used to draw `slice(0, 8)` of the engine's ten and nothing ever
        // asked for page two: the ninth and tenth candidates of every page could
        // not be tapped at all, and everything past the first page could not be
        // reached by any means. `pingzhu.nextPage` was exported and had no caller.
        Scroll() {
          Row({ space: 6 }) {
            ForEach(this.candidates, (item: string, index: number) => {
              Text(`${index + 1} ${item}`)
                .fontSize(15)
                .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                .backgroundColor('#FFFFFF')
                .borderRadius(4)
                // Picks the candidate that was tapped, not the default.
                //
                // The first version called commit() here, which commits the best
                // candidate — so tapping 妳好 gave 你好. Selecting by index is the
                // whole point of showing a list.
                .onClick(() => { this.pickCandidate(index + 1); })
            }, (item: string, index: number) => `${index}-${item}`)
          }
        }
        .scrollable(ScrollDirection.Horizontal)
        .layoutWeight(1)

        Text('▼')
          .fontSize(15)
          .padding({ left: 10, right: 10, top: 4, bottom: 4 })
          .backgroundColor('#FFFFFF')
          .borderRadius(4)
          .onClick(() => { this.nextPage(); })
      }
      .width('100%')
      .height(40)
      .padding({ left: 8, right: 8 })
      .backgroundColor('#E8E8E8')
    }
  }

  /// Moves on ten candidates. Silent on the last page: a key that reports success
  /// it did not have is worse than one that does nothing.
  private nextPage(): void {
    try {
      if (!pingzhu.nextPage()) return;
      this.candidates = pingzhu.candidates();
    } catch (error) {
      this.failure = `${error}`;
    }
  }

  private pickCandidate(oneBased: number): void {
    try {
      const text: string = pingzhu.selectCandidate(oneBased);
      this.composing = '';
      this.candidates = [];
      if (text.length === 0) return;
      // Choosing a word is what teaches the engine — the only training signal
      // this input method has. Persist it, or the next session starts having
      // forgotten every correction the user made.
      this.saveUserDictionary();
      if (!Session.insertText(text)) {
        this.composing = `沒有編輯器（${text}）`;
      }
    } catch (error) {
      this.failure = `${error}`;
    }
  }

  @Builder
  private KeyRow(row: Key[]) {
    Row({ space: 4 }) {
      ForEach(row, (key: Key) => {
        Text(key.label.length > 0 ? key.label : key.letter)
          .fontSize(18)
          .textAlign(TextAlign.Center)
          .layoutWeight(1)
          .height(46)
          .backgroundColor(key.label.length > 0 ? '#FFFFFF' : '#E0E0E0')
          .borderRadius(4)
          .onClick(() => { this.tap(key.letter); })
      }, (key: Key) => key.letter)
    }
    .width('100%')
    .padding({ left: 4, right: 4 })
  }

  build() {
    Column({ space: 4 }) {
      if (this.failure.length > 0) {
        Text(this.failure)
          .fontSize(11)
          .fontColor('#B00020')
          .padding(4)
      }

      if (this.composing.length > 0) {
        Row({ space: 8 }) {
          Text(this.composing)
            .fontSize(18)
            .fontColor('#333333')
          // Dim and italic when the engine is guessing, exactly as the Android
          // bar, the macOS candidates and the demo page do. A phone user who
          // cannot tell a decode from a guess has no reason to open the list.
          Text(this.sentence)
            .fontSize(18)
            .fontColor('#333333')
            .opacity(this.faithful ? 1 : 0.55)
            .fontStyle(this.faithful ? FontStyle.Normal : FontStyle.Italic)
        }
        .height(34)
        .width('100%')
        .justifyContent(FlexAlign.Center)
      }

      this.CandidateBar()

      if (!this.ready) {
        Text('键盘载入中…').fontSize(13).fontColor('#999999').height(120)
      } else {
        ForEach(this.rows, (row: Key[]) => { this.KeyRow(row) },
          (row: Key[]) => row.map((k: Key) => k.letter).join(''))
      }

      // The function row, which is not Bopomofo and therefore is written here:
      // commit, backspace, and the comma.
      Row({ space: 4 }) {
        Text('⌫')
          .fontSize(18).textAlign(TextAlign.Center).layoutWeight(1).height(46)
          .backgroundColor('#D0D0D0').borderRadius(4)
          .onClick(() => {
            // While composing this steps back one reading component — it does not
            // clear the composition, and it does not touch the editor.
            //
            // Before this it called reset() (throwing the whole composition away)
            // *and* Session.deleteBackward() (deleting a character the user had
            // already committed): one press, two wrong things, and nothing to
            // catch it — the rule had no name and this keyboard has no router.
            if (routeBackspace(this.composing.length > 0) === BackspaceAction.StepBackComponent) {
              pingzhu.backspace();
              this.composing = pingzhu.composing();
              this.candidates = pingzhu.candidates();
            } else {
              Session.deleteBackward();
            }
          })
        // The middle key changes meaning with the board: 送出 accepts the
        // composition, 空白 types a space. An English board with no space bar is
        // not a usable board.
        Text(this.english ? '空白' : '送出')
          .fontSize(16).textAlign(TextAlign.Center).layoutWeight(3).height(46)
          .backgroundColor('#D0D0D0').borderRadius(4)
          .onClick(() => {
            if (this.english) {
              Session.insertText(' ');
            } else {
              this.commit();
            }
          })
        Text('，')
          .fontSize(18).textAlign(TextAlign.Center).layoutWeight(1).height(46)
          .backgroundColor('#FFFFFF').borderRadius(4)
          .onClick(() => { this.tap(','); })
        // The label is the script in use, so pressing it is the switch. The other
        // shells call this 繁/简 in their own way; this keyboard had no way at all.
        Text(this.script === 'simplified' ? '简' : '繁')
          .fontSize(16).textAlign(TextAlign.Center).layoutWeight(1).height(46)
          .backgroundColor('#D0D0D0').borderRadius(4)
          .onClick(() => { this.toggleScript(); })
          // Long press: the keyboard layout. There is no settings screen on this
          // platform, and a phone board has no room for a seventh function key, so
          // the switch hangs off the key that is already about "which characters
          // come out". Short press still toggles the script.
          .bindContextMenu(this.layoutMenu, ResponseType.LongPress)
        // 英/中. Every key on the Bopomofo board is a reading; without this the
        // keyboard could not produce a single Latin letter, which rules out
        // URLs, addresses and passwords on a phone.
        Text(this.english ? '中' : '英')
          .fontSize(16).textAlign(TextAlign.Center).layoutWeight(1).height(46)
          .backgroundColor('#D0D0D0').borderRadius(4)
          .onClick(() => { this.toggleEnglish(); })
      }
      .width('100%')
      .padding({ left: 4, right: 4 })
    }
    .width('100%')
    .padding({ top: 4, bottom: 6 })
    .backgroundColor('#F2F2F2')
  }
}

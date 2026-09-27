/**
 * 平注的键盘面板。
 *
 * **键面不是写在这里的。** 这一页向引擎要（keyboardRows），因为画出来的键
 * 和看得懂的键必须来自同一张表——v0.6.0 那个「数字键」的回归就是这样发生的：
 * 两份判断，一份错了，而错误是安静的（倒、以及所有以 ㄅㄉㄓㄚㄞㄢ 开头的字
 * 都打不出来）。
 */
import pingzhu from 'libpingzhu.so';

/** One key on the board. */
interface Key {
  letter: string;   // what pressing it sends, e.g. "1"
  label: string;    // what is drawn on it, e.g. "ㄅ" — empty for a key with no component
}

@Component
export struct KeyboardPanel {
  /** Rows of keys, from the engine. */
  @State private rows: Key[][] = [];
  @State private composing: string = '';
  @State private candidates: string[] = [];
  @State private ready: boolean = false;
  @State private failure: string = '';

  aboutToAppear(): void {
    this.load();
  }

  private load(): void {
    try {
      // Pairs, not two parallel strings. The 倚天 layout has more keys in its
      // first row than it has Bopomofo components, so the two cannot be zipped
      // from separate runs — a test in core-rs/ caught that.
      const raw: string = pingzhu.keyboardRows('standard');
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
      pingzhu.feedKey(letter);
      this.composing = pingzhu.composing;
      this.candidates = pingzhu.candidates;
    } catch (error) {
      this.failure = `${error}`;
    }
  }

  private commit(): void {
    try {
      const text: string = pingzhu.commit();
      this.composing = '';
      this.candidates = [];
      if (text.length > 0) {
        // The extension sends it to the editor; until that is wired up the
        // panel shows what would have been committed rather than pretending.
        this.failure = '';
        this.composing = `（已選：${text}）`;
      }
    } catch (error) {
      this.failure = `${error}`;
    }
  }

  @Builder
  private CandidateBar() {
    if (this.candidates.length > 0) {
      Row({ space: 6 }) {
        ForEach(this.candidates.slice(0, 8), (item: string, index: number) => {
          Text(`${index + 1} ${item}`)
            .fontSize(15)
            .padding({ left: 8, right: 8, top: 4, bottom: 4 })
            .backgroundColor('#FFFFFF')
            .borderRadius(4)
            .onClick(() => { this.commit(); })
        }, (item: string, index: number) => `${index}-${item}`)
      }
      .width('100%')
      .height(40)
      .padding({ left: 8, right: 8 })
      .backgroundColor('#E8E8E8')
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
        Text(this.composing)
          .fontSize(18)
          .fontColor('#333333')
          .height(34)
      }

      this.CandidateBar()

      if (!this.ready) {
        Text('键盘载入中…').fontSize(13).fontColor('#999999').height(120)
      } else {
        ForEach(this.rows, (row: Key[]) => { this.KeyRow(row) },
          (row: Key[]) => row.map((k: Key) => k.letter).join(''))
      }

      // The function row, which is not Bopomofo and therefore is written here:
      // space (commit), backspace, and the candidate list.
      Row({ space: 4 }) {
        Text('⌫')
          .fontSize(18).textAlign(TextAlign.Center).layoutWeight(1).height(46)
          .backgroundColor('#D0D0D0').borderRadius(4)
          .onClick(() => { pingzhu.reset(); this.composing = ''; this.candidates = []; })
        Text('空白')
          .fontSize(16).textAlign(TextAlign.Center).layoutWeight(3).height(46)
          .backgroundColor('#D0D0D0').borderRadius(4)
          .onClick(() => { this.commit(); })
        Text('，')
          .fontSize(18).textAlign(TextAlign.Center).layoutWeight(1).height(46)
          .backgroundColor('#FFFFFF').borderRadius(4)
          .onClick(() => { this.tap(','); })
      }
      .width('100%')
      .padding({ left: 4, right: 4 })
    }
    .width('100%')
    .padding({ top: 4, bottom: 6 })
    .backgroundColor('#F2F2F2')
  }
}

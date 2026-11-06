# CODE QUEST

CとJavaを、ロボットを動かしながら学ぶブラウザアプリ。各8ミッション、クラスの体験ラボ、変数・参照の可視化を収録しています。

公開先: https://codequest.yugaku.me

## 動かす

HTML・CSS・JavaScriptのみの静的サイトです。ビルドやサーバー側の処理は不要です。

```sh
python3 -m http.server 8000
```

http://localhost:8000 を開きます。進捗はブラウザのローカルストレージに保存され、端末・ドメイン間の同期はありません。

## GitHub Pages

`main` ブランチのルート `/` を公開元に設定します。`.nojekyll` はJekyllによる処理を無効にし、`CNAME` はカスタムドメインを指定します。`main` に変更をプッシュすると再公開されます。

DNSは `codequest` のCNAMEを `yugakume.github.io` に向けます。CloudflareではDNS onlyを使用し、GitHub Pages側でHTTPSを有効にします。

## 実行環境の範囲

アプリ内の実行環境はC・Javaの一部構文を扱う学習用インタープリターです。GCC・Clang・JVM・javacの完全な代替ではありません。対応構文と制限はアプリ内の説明をご覧ください。

外部通信はフォントの読み込みと、利用者が開く公式資料へのリンクのみです。入力された学習コードはブラウザ内で処理されます。

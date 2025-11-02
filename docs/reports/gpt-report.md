プログラミング言語特化型AIエージェントの開発と最適化
1. プログラミング言語特化型AIエージェントの主な例

プログラミング言語特化型AIエージェントとは、特定のプログラミング言語やドメインに最適化された大規模言語モデル（LLM）を用いたコード支援エージェントです。近年、各種言語に特化したOSSモデルや商用サービスが登場しています。以下に主な例を挙げます。

    CodeLlama - Python（Meta社）: Metaが公開したLlama 2ベースのコード生成LLMで、Python向けに特化調整されたモデルです。CodeLlamaにはベースモデルの他、Pythonコードを追加学習したバリアント「CodeLlama-Python」があり
    e2enetworks.com
    、1000億トークン規模のPythonコードで追加訓練されているためPythonの高度な知識を持ちます
    e2enetworks.com
    。

    Solidity LLM（ChainGPT）: ブロックチェーン開発向けにChainGPTが公開したSolidity特化LLMです。SalesforceのCodeGen-2B（多言語版）をベースモデルとし、約10億トークンのSolidityコードデータで追加学習されています
    docs.chaingpt.org
    。スマートコントラクト生成に最適化されており、生成コードのコンパイル成功率は83%に達し（一般的なモデルより大幅に高い）
    docs.chaingpt.org
    、ガス効率やセキュリティ標準への準拠性も重視されています
    docs.chaingpt.org
    。出力は基本的にコンパイル可能で、脆弱性の少ない高品質なSolidityコードとなるよう調整されています
    chaingpt.org
    。このモデルはMITライセンスでオープンソース公開されており、Hugging Face上で誰でも利用できます
    chaingpt.org
    。

    PolyCoder（CMU）: カーネギーメロン大学の研究者らが開発したGPT-2ベースのオープンソースコード生成モデルです。C言語に特化して訓練されており、約249GBものオープンソースCコードデータで学習しています
    aitoolbook.ai
    。その結果、C言語のコード生成性能ではより大規模なGPT-Neoなどのモデルを上回る水準を示しました
    aitoolbook.ai
    。C言語以外はサポートしないものの、その分Cコードの文法的正確さやコンテキスト適合性で高い精度を発揮します。

    GitHub Copilot（OpenAI Codex）: OpenAIのCodexモデルを搭載した商用サービスで、Visual Studio CodeなどIDEに統合できるAIペアプログラマです。PythonやJavaScriptをはじめ多様な言語で高度な補完・生成を行います。特定言語専門ではありませんが、特にPythonなど人気言語のAPIや標準ライブラリ知識に長けています（標準ライブラリや一般的なフレームワークの使い方はかなり正確です
    reddit.com
    ）。コード補完の精度向上のため、ユーザのエディタ内でリアルタイムに構文チェック（例: PythonならRuff、TypeScriptならESLint）と連携しつつ使われるケースも多いです
    reddit.com
    。

    Amazon CodeWhisperer（AWS）: Amazonが提供するAIコード補助サービスで、こちらも複数言語対応ですがPythonやJava等で最適化されています。IDEプラグインを通じて利用でき、セキュリティ上問題のあるコードスニペットの検知や参考元コードの明示（出典表示）機能など、企業利用を意識した特徴があります。

    Replit Ghostwriter（Replit社）: オンラインIDE「Replit」向けのAIコード支援で、オープンソースのCodeLlamaを基に調整された独自モデルを使用しています。特定言語専用ではないものの、特にウェブ開発言語（JavaScript/HTML/CSS）やPython、さらにReplitで人気の高いRustにも強いサポートを持つよう最適化されています。

    Cursor（Cursor社）・Tabby（OSS）など: VS Codeライクなエディタに組み込めるAIコードアシスタントも登場しています。たとえばCursorは独自のコード特化LLMを搭載し、補完やインラインでのコード解説を行うツールです。他にもVoid、Pearといったエディタ拡張型のAIコーディング支援ツールが登場しています
    reddit.com
    。

なお、Rustのような比較的新しいシステム言語に完全特化した公開LLMは2025年時点では目立っていませんが、既存の多言語コードモデル（CodeLlamaやStarCoder等）はRustにも対応しており、コンパイルエラーの回避や標準ライブラリ使用法など一定の知識を持っています。またRustコミュニティでは、コンパイル時にLLMを呼び出してコード生成するマクロ「autorust」
github.com
のようなユニークな取り組みも見られます。これはRustコンパイラのマクロ展開フェーズでGPTに問い合わせてコードを自動生成する試みで、言語機能とLLMを統合した一例です。
2. 言語特化LLMの開発・学習方法

特定のプログラミング言語に特化したLLMを開発するには、ベースとなる事前学習モデルに対して対象言語のデータやタスクで追加訓練を行うのが一般的です。主な手法とポイントを以下にまとめます。

    事前学習モデルのファインチューニング: まず大規模な汎用LLM（例: Llama 2やGPT系、汎用コードモデルなど）を用意し、対象言語のコードデータで追加の学習（ファインチューニング）を行います。例えばMetaのCodeLlamaの場合、ベースは汎用のコードモデルですが、Python専用モデルはさらに1000億トークンものPythonコードで追加訓練されており
    e2enetworks.com
    、これによってPythonの文法・ライブラリ・イディオムに習熟したモデルになっています。同様にSalesforceのCodeGenモデルでは、「Mono」版と呼ばれるモデルがPythonコードデータのみで追加学習されており、Python特化性能を高めています（CodeGen-Mono 16Bはマルチ言語版16Bを初期値としてPythonデータセットで再学習したもので、71.7億トークンのPythonコードを追加訓練しています
    huggingface.co
    ）。このように、大規模モデルに対象言語の大規模コーパスを与えて再訓練することで、その言語に最適化された生成能力を獲得できます。特にSolidityのように一般のコーパスに含まれる量が少ない言語では、関連ドメイン（ブロックチェーン・スマートコントラクト）のコードと解説データを集中的に与えることで、汎用モデルにはない専門知識や文脈理解を身に付けさせています
    docs.chaingpt.org
    。なお、この追加学習には大規模計算資源が必要ですが、対象を絞ることでモデルサイズを抑えても高性能を出せる傾向があります
    chaingpt.org
    （ChainGPTによると、大規模モデルより小規模でもタスク特化学習で同等以上の結果を出せるケースが多い
    chaingpt.org
    ）。

    軽量化ファインチューニング（LoRA等）: 訓練コストを抑えるため、LoRA（Low-Rank Adaptation）やQLoRAといった手法でパラメータの一部のみを調整する方法も有効です。LoRAでは大規模モデルの重みを凍結し、小さな適応層を追加・学習することで、元モデルの知識を保ちながら新しい知識を安価に付与できます
    databricks.com
    nexla.com
    （参考: LoRAは追加メモリや計算量が少なくて済むため、個人レベルでもGPT-4クラスのモデルを特定ドメイン向けにチューニングする実験が盛んに行われています）。例えばSolidity LLMの開発でも、ベースモデルに対しSolidityコードデータで微調整する際にパラメータ効率の高い手法が検討された可能性があります（実際、ChainGPTはAlibaba CloudのGPUリソース協力のもと長期間学習を行ったと述べており
    chaingpt.org
    、膨大なデータでの微調整にはクラウドGPUを活用しています）。このようなリソースがない場合でも、LoRAを使えば限定的なGPU環境で特化モデル作成が現実的になります。

    Instructionチューニングとプロンプト工夫: 単にコードを学習させるだけでなく、ユーザからの指示（自然言語プロンプト）に的確に従うよう調整することも重要です。例えば「SolidityのERC20トークン契約を書いて」といった要求に適切に応答するには、対話形式での指示応答データや、コードスニペットに対する解説・生成のペアデータを学習させる（Instruction Fine-tuning）ことが効果的です
    docs.chaingpt.org
    。訓練データとして、人間開発者の要求とそれに対応するコード例（修正前→修正後、説明→コードなど）を数多く含めると、モデルはユーザ意図を汲んでコードを書く能力が向上します。また大規模な追加学習が難しい場合でも、プロンプトエンジニアリングによってモデルの動作を誘導できます。例えば「以下にSolidityコードのテンプレートがあります。それを基に要求に適合するコードを書いてください…」などと詳細な指示やひな形を与えると、汎用モデルでもより専門的な振る舞いをさせられます。特に、Chain-of-Thought（思考の連鎖）プロンプトや自己リフレクションプロンプトが有用です。自己リフレクションの一例として、Self-Refineというフレームワークでは、モデル自身に一度生成させたコードを振り返らせ問題点を自然言語で洗い出し、自己修正させるという手順を踏ませています
    arxiv.org
    。このようなプロンプトによる自己改善は追加訓練無しでも適用でき、コード生成の品質向上に効果があります。

    ツール統合による拡張: モデル単体で不足する能力を補うため、外部ツールを組み合わせることも有力な手法です
    arxiv.org
    。例えばコードエージェントにウェブ検索やAPIドキュメント閲覧機能を組み込めば、モデルが持っていない最新のライブラリ知識も取得できます。またコードの実行・テスト環境を与えれば、モデルが出力コードを実行して結果を確認し、バグ修正まで自動化することも可能です。研究例では、CodeAgentというシステムがLLMに5つのプログラミングツール（ウェブ検索、ドキュメント閲覧、コードシンボルナビゲーション、フォーマッタチェック、コード実行）を統合し、情報取得からコード実装・テストまで対話的に行えるようにしています
    arxiv.org
    。またROCODEという手法では、コード生成中にコンパイルを常時モニタリングし、構文エラーが出たら自動で生成を中断・バックトラックして修正を試みます
    arxiv.org
    。このようにコンパイラやリンタを組み合わせると、未完成なコードをモデルが自律的に修正しながら完成度を高めることができます。ツール統合はドメイン特化型でも有効で、たとえばSolidityエージェントにSolidityコンパイラやセキュリティ分析ツールを使わせることで、デプロイ前に脆弱性検査まで行わせることも可能です
    arxiv.org
    github.com
    。実際、ChainGPTのSolidity LLMの評価プロセスではSlither（Solidity向け静的解析セキュリティツール）を用いて生成コード中の脆弱性チェックを行い、問題が見つかったケースでは追加のプロンプトで修正を試みるという手法が取られました
    chaingpt.org
    。このようにエージェントにツール使用能力を与えることで、コードの信頼性や完成度を大幅に高めることができます。

3. エージェント最適化のためのルール整備・ワークフロー設計

言語特化型のAIエージェントを実運用レベルまで高性能化するには、モデル開発だけでなくエージェントの挙動を制御するルールや開発フローの設計が重要です
arxiv.org
。以下にベストプラクティスとなるポイントを整理します。
3.1 開発フローの分解と役割分担

人間の開発プロセスになぞらえて、エージェントにも段階的なフローや役割分担を与えると効果的です。単一のLLMに一度に複雑な要求を解決させようとするのではなく、タスクを細分化し順序立てて進めます
arxiv.org
。例えば次のようなアプローチがあります。

    マルチステップ・プランニング: まず要求を分析して計画を立て、それからコードを書く、テストする、修正するといったステップを踏ませます
    arxiv.org
    。LLMに「まずやるべきタスクを箇条書きにしてください」と促し、それを順に実行させることで、抜け漏れの少ない開発が可能です。研究例でも、要件分析→コード実装→テスト→デバッグという完全な開発ワークフローをシミュレートできるエージェントが提案されています
    arxiv.org
    。これにより一度では解決困難な複雑タスクも、対話を通じて徐々に完成度を高めることができます。

    役割ごとのLLMエージェント: 複数のLLMにそれぞれ異なる「役割」を割り当て、協調させる手法も注目されています。例えばMetaGPTというフレームワークでは、プロダクトマネージャー、アーキテクト、エンジニア、テスターといった架空のチームメンバーをそれぞれLLMエージェントとして動作させます
    docs.deepwisdom.ai
    。各エージェントはSOP（標準作業手順）に沿って情報をやり取りしながら、要求定義から設計、実装、テストまで進めます
    docs.deepwisdom.ai
    。このように役割分担することで、個々のLLMが専門分野に集中し、全体として整合性の取れた成果物を得やすくなります。実際、スマートコントラクトの自動監査を行うLLM-SmartAuditという研究では、プロジェクトマネージャ・コントラクト専門家・セキュリティ監査役など複数のエージェントに役割を与え協調させたところ、単一エージェントより精度の高い脆弱性検出が可能になったと報告されています
    arxiv.org
    。各エージェントが手順に沿って議論・相互検証することで、漏れの少ない包括的な解析が実現しています
    arxiv.org
    。

    自己評価・自己改善ループ: エージェント自身に振り返りのフェーズを設けるのも有効です。生成途中で「このままでは何が問題か？」とモデル自身に問いかけ、出てきた指摘を基に修正を行うReflection手法はコード生成で成功を収めています
    arxiv.org
    。例えばSelf-Iterationというアプローチでは、LLMに分析者、設計者、開発者、テスターの役を順番に演じさせ、各イテレーションで要件見直し→設計調整→コード修正→テスト評価を行わせます
    arxiv.org
    。これにより、一度では見つけにくい設計上の欠陥や論理エラーも段階的に洗い出し、修正できます。同様にSelf-Debugではモデルが自ら生成コードを一行ずつ説明しバグを探す「ラバーダッキング」的手法を導入しており、人手の介入なく自己デバッグが可能となっています
    arxiv.org
    。このような自己改善の仕組みは、コードの信頼性を向上させる上で強力なツールです。

3.2 コード検証ルールとセキュリティ対応

特化型エージェントであっても、生成コードの検証とセキュリティ確保は不可欠です。以下のベストプラクティスが考えられます。

    コンパイル & テストの自動ループ: 生成結果に対し自動でコンパイルやテストを実行し、失敗したらモデルにフィードバックして修正させるループを構築します。先述のROCODEのように、コンパイルエラー検知時にモデルが自律的にバックトラッキングして修正を試みる仕組みはその一例です
    arxiv.org
    。他にも、Devin AIというデモシステムは「コード生成→コンパイル/実行チェック→修正→…」を完全自動で繰り返し、最終的にテストを通るコードをコミットまでしてくれると報じられました
    reddit.com
    。オープンソースでもaider等が類似のアプローチを取っています
    reddit.com
    。エージェント導入時にはCI（継続的インテグレーション）的な検証ルールを組み込み、「コンパイルが通るまで次に進まない」「テストをすべてパスするまで反復する」といった動作規範を設定すると良いでしょう。

    リンタ・静的解析・型検査の活用: 人間のコードレビューで行うようなスタイルチェックや静的解析も自動化できます。例えば生成コードに対しESLintやPylint、型チェッカー（mypyなど）を走らせ、その警告メッセージをエージェントに渡して修正させることが可能です
    reddit.com
    reddit.com
    。実際、AIエージェントを“有能だが注意深さに欠ける新人プログラマ”とみなし、人間がリンタ結果や型エラーをフィードバックしてあげると考えると分かりやすいでしょう
    reddit.com
    。この手動フィードバックさえも自動化する方向で研究が進んでおり、モデル自身がエラーメッセージを読み取って修正案を出す試みも増えています。静的解析ツールも積極的に取り入れるべきです。特にSolidityやC言語等では専門の静的解析・検証ツール（SlitherやCoverityなど）があるため、エージェントにそれらを使わせて潜在バグや未定義動作を検知し、修正フェーズで考慮させると安全性が高まります
    chaingpt.org
    。

    セキュリティ脅威の検出: 特化型であってもセキュアである保証はないため、脆弱性パターンの検出と回避は重要なルールです。Solidityエージェントの場合、既知のセキュリティリスク（リエントランシー攻撃、整数オーバーフロー、未初期化変数など）については生成段階で警告を発する、あるいは安全なデザインパターン（OpenZeppelin準拠）を優先させるよう指示することが望ましいです
    chaingpt.org
    。実際、Solidity LLMはOpenZeppelin標準への準拠率を評価指標に含め、65%という高い遵守率を達成しています
    chaingpt.org
    。このように安全なコーディング規約をあらかじめ定め（例えば「外部呼び出し後に状態を更新せよ」等のルール）、モデルの出力をチェックする仕組みを組み込むことが推奨されます。加えて、出力コードに対してセキュリティ専用スキャナ（SolidityならSlitherやMythril、PythonならBanditなど）を走らせ、見つかった問題をエージェントにフィードバックして修正させることで、最終的なコードの安全性を高めることができます。LLM-SmartAuditのように、セキュリティ監査役エージェントを別途用意してコードを精査させるのも有効でしょう
    arxiv.org
    。

3.3 自然言語インターフェース設計とヒューマンガイド

エージェントがユーザ意図を正しく汲み取り、有用な支援を行うには、ユーザとエージェントのインターフェース（対話デザイン）も工夫が必要です。

    プロンプトガイドラインの整備: ユーザがどのように指示を出せば期待する応答が得られるのか、ガイドラインを用意すると効果的です。例えば「新しい関数を追加して」という曖昧な要求ではなく、「関数XにYの機能を追加してください。入力と出力は…」と具体的に書くよう促すなどです。またエージェント側も、曖昧な要求を受けたら勝手に決めつけず確認の質問をするよう訓練・設定するのが望ましいです。これにより誤解に基づく実装ミスを減らせます。

    コンテキスト共有とドキュメント: LLMは一度に扱えるコンテキスト長に限りがあるため、大規模プロジェクトでは全体像を常に参照できません。人間エンジニアが頭の中で設計を把握しているのと同様に、エージェントにも上位レベルの設計情報を与えることが重要です
    medium.com
    medium.com
    。具体的には、プロジェクトの要件やアーキテクチャ、現在のファイル構成、実装方針といった文書を整備し、エージェントにコード生成の前にそれらを読むよう促します
    medium.com
    。ある開発者は、新規プロジェクト開始時にまずAIに「アプリケーション要件」「設計指針」「ディレクトリ構造」「実装計画」のドキュメントを生成させ、人間がレビュー・修正した上でそれを土台にコードを書かせたところ、エージェントが常に設計方針を踏まえて実装できたと報告しています
    medium.com
    medium.com
    。エージェントには常に「最初にプロジェクト文書を読み、それから指示に従って実装しなさい」とプロンプトで指示し、コード中にも要件や設計に関するコメントを自動挿入させることで、コンテキストの一貫性が保たれました
    medium.com
    。このようなドキュメンテーション駆動のアプローチは、人間だと面倒で怠りがちな部分をAIが正確に補完してくれる利点もあります
    medium.com
    。

    人間の最終チェックとフィードバック: いかに高度なエージェントでも、人間エンジニアのレビューと判断を完全には省略できません
    arxiv.org
    。実運用では、AIが提案・生成したコードや設計を人間が精査し、問題があればフィードバックを与えるループを組み込むべきです。実際、大規模プロジェクトにAIエージェントを投入した事例では、「約4万行のコードをAIが書いたが、自分は一行も直接書かずに済んだ」という成功談がある一方で、その開発者は**「すべての成果物をレビューし、設計ミスがあれば必ず修正指示を出した」と述べています
    medium.com
    medium.com
    。AIは凡ミスは少ないものの、構造的な誤り（不要な重複実装やモジュール間の整合性の齟齬など）が時折あり、人間の目で設計意図に沿っているか判断する必要があったとのことです
    medium.com
    。このように「コードレビューは全て行う」**という方針で進めれば、AIエージェントは有能な助手となりますが、人間の関与を怠ると見えない不具合が蓄積する恐れがあります
    arxiv.org
    。エージェント開発者側も、最終成果物の品質担保のため「自動生成コードをそのまま本番投入しない」「必ず人間がテストとレビューを経てデプロイする」というルールを明示しています
    docs.chaingpt.org
    。ChainGPTのドキュメントでも、Solidity LLMの利用にあたり「生成コードをそのまま法的監査や本番利用に用いるべきでない。必ず人手で監査とテストを行え」と注意喚起されています
    docs.chaingpt.org
    docs.chaingpt.org
    。人間とAIの協調体制・責任分界を明確にし、最終的な意思決定は人間が行うことが、安全で効率的な運用につながります。

以上、プログラミング言語特化型のAIエージェントについて、代表例から開発手法、運用上のベストプラクティスまで概観しました。これらの特化型エージェントは、適切に調整・統合することでコーディングの生産性やコード品質の向上に大きく寄与します。しかし万能ではないため、最適な成果を得るにはモデルの適切な訓練だけでなく、ツールやルールによる補完、そして人間による監督が欠かせません
arxiv.org
docs.chaingpt.org
。今後、より洗練されたエージェントフレームワークやドメイン特化モデルが登場し、開発ワークフローに組み込まれていくことでしょう。それに伴い、今回述べたような垂直特化エージェントの設計指針がますます重要になると考えられます。

参考文献・ソース：本稿ではChainGPT公式ブログ・ドキュメント【2】【18】【19】、Meta社のCodeLlama発表【5】、オープンソースプロジェクトの情報【7】【10】、研究論文【22】【24】、開発者の実践報告【25】など、最新の資料を参照し議論しました。それぞれの出典は文中の該当箇所に【†】付きで示しています。専門的な詳細については引用元も併せてご確認ください。
引用

Top 8 Open-Source LLMs for Coding | E2E Networks Blog | E2E Networks
https://www.e2enetworks.com/blog/top-8-open-source-llms-for-coding

Top 8 Open-Source LLMs for Coding | E2E Networks Blog | E2E Networks
https://www.e2enetworks.com/blog/top-8-open-source-llms-for-coding

Solidity LLM (Open-Sourced) | ChainGPT Documentation
https://docs.chaingpt.org/dev-docs-b2b-saas-api-and-sdk/solidity-llm-open-sourced

Solidity LLM (Open-Sourced) | ChainGPT Documentation
https://docs.chaingpt.org/dev-docs-b2b-saas-api-and-sdk/solidity-llm-open-sourced

ChainGPT Launches Solidity LLM: The Fully Open-Source Solidity Smart Contract Generator
https://www.chaingpt.org/blog/chaingpt-launches-solidity-llm-the-fully-open-source-solidity-smart-contract-generator

ChainGPT Launches Solidity LLM: The Fully Open-Source Solidity Smart Contract Generator
https://www.chaingpt.org/blog/chaingpt-launches-solidity-llm-the-fully-open-source-solidity-smart-contract-generator

Polycoder Review - Everything You Need to Know
https://aitoolbook.ai/ai/polycoder

Polycoder Review - Everything You Need to Know
https://aitoolbook.ai/ai/polycoder

Current best open-source or commercial automated LLM coding agent? : r/LocalLLaMA
https://www.reddit.com/r/LocalLLaMA/comments/1gm3qtz/current_best_opensource_or_commercial_automated/

Current best open-source or commercial automated LLM coding agent? : r/LocalLLaMA
https://www.reddit.com/r/LocalLLaMA/comments/1gm3qtz/current_best_opensource_or_commercial_automated/

Current best open-source or commercial automated LLM coding agent? : r/LocalLLaMA
https://www.reddit.com/r/LocalLLaMA/comments/1gm3qtz/current_best_opensource_or_commercial_automated/

GitHub - jondot/awesome-rust-llm: A curated list of Rust tools, libraries, and frameworks for working with LLMs, GPT, AI
https://github.com/jondot/awesome-rust-llm

Salesforce/codegen-16B-mono · Hugging Face
https://huggingface.co/Salesforce/codegen-16B-mono

ChainGPT Launches Solidity LLM: The Fully Open-Source Solidity Smart Contract Generator
https://www.chaingpt.org/blog/chaingpt-launches-solidity-llm-the-fully-open-source-solidity-smart-contract-generator

Efficient Fine-Tuning with LoRA for LLMs | Databricks Blog
https://www.databricks.com/blog/efficient-fine-tuning-lora-guide-llms

Prompt Engineering vs. Fine-Tuning—Key Considerations and Best ...
https://nexla.com/ai-infrastructure/prompt-engineering-vs-fine-tuning/

ChainGPT Launches Solidity LLM: The Fully Open-Source Solidity Smart Contract Generator
https://www.chaingpt.org/blog/chaingpt-launches-solidity-llm-the-fully-open-source-solidity-smart-contract-generator

Solidity LLM (Open-Sourced) | ChainGPT Documentation
https://docs.chaingpt.org/dev-docs-b2b-saas-api-and-sdk/solidity-llm-open-sourced

A Survey on Code Generation with LLM-based Agents
https://arxiv.org/html/2508.00083v1

A Survey on Code Generation with LLM-based Agents
https://arxiv.org/html/2508.00083v1

A Survey on Code Generation with LLM-based Agents
https://arxiv.org/html/2508.00083v1

A Survey on Code Generation with LLM-based Agents
https://arxiv.org/html/2508.00083v1

LLM-SmartAudit: Advanced Smart Contract Vulnerability Detection
https://arxiv.org/html/2410.09381v1

denizumutdereli/smart-contract-langchain-advisor: The Solidity ...
https://github.com/denizumutdereli/smart-contract-langchain-advisor

ChainGPT Launches Solidity LLM: The Fully Open-Source Solidity Smart Contract Generator
https://www.chaingpt.org/blog/chaingpt-launches-solidity-llm-the-fully-open-source-solidity-smart-contract-generator

A Survey on Code Generation with LLM-based Agents
https://arxiv.org/html/2508.00083v1

MetaGPT: The Multi-Agent Framework | MetaGPT
https://docs.deepwisdom.ai/main/en/guide/get_started/introduction.html

LLM-SmartAudit: Advanced Smart Contract Vulnerability Detection
https://arxiv.org/html/2410.09381v1

A Survey on Code Generation with LLM-based Agents
https://arxiv.org/html/2508.00083v1

A Survey on Code Generation with LLM-based Agents
https://arxiv.org/html/2508.00083v1

Current best open-source or commercial automated LLM coding agent? : r/LocalLLaMA
https://www.reddit.com/r/LocalLLaMA/comments/1gm3qtz/current_best_opensource_or_commercial_automated/

Current best open-source or commercial automated LLM coding agent? : r/LocalLLaMA
https://www.reddit.com/r/LocalLLaMA/comments/1gm3qtz/current_best_opensource_or_commercial_automated/

Current best open-source or commercial automated LLM coding agent? : r/LocalLLaMA
https://www.reddit.com/r/LocalLLaMA/comments/1gm3qtz/current_best_opensource_or_commercial_automated/

ChainGPT Launches Solidity LLM: The Fully Open-Source Solidity Smart Contract Generator
https://www.chaingpt.org/blog/chaingpt-launches-solidity-llm-the-fully-open-source-solidity-smart-contract-generator

Coding Standards for AI Agents. AI code-generation agents have taken a… | by Chris Force | Medium
https://medium.com/@christianforce/coding-standards-for-ai-agents-cb5c80696f72

Coding Standards for AI Agents. AI code-generation agents have taken a… | by Chris Force | Medium
https://medium.com/@christianforce/coding-standards-for-ai-agents-cb5c80696f72

Coding Standards for AI Agents. AI code-generation agents have taken a… | by Chris Force | Medium
https://medium.com/@christianforce/coding-standards-for-ai-agents-cb5c80696f72

Coding Standards for AI Agents. AI code-generation agents have taken a… | by Chris Force | Medium
https://medium.com/@christianforce/coding-standards-for-ai-agents-cb5c80696f72

Coding Standards for AI Agents. AI code-generation agents have taken a… | by Chris Force | Medium
https://medium.com/@christianforce/coding-standards-for-ai-agents-cb5c80696f72

A Survey on Code Generation with LLM-based Agents
https://arxiv.org/html/2508.00083v1

Coding Standards for AI Agents. AI code-generation agents have taken a… | by Chris Force | Medium
https://medium.com/@christianforce/coding-standards-for-ai-agents-cb5c80696f72

Coding Standards for AI Agents. AI code-generation agents have taken a… | by Chris Force | Medium
https://medium.com/@christianforce/coding-standards-for-ai-agents-cb5c80696f72

Solidity LLM (Open-Sourced) | ChainGPT Documentation
https://docs.chaingpt.org/dev-docs-b2b-saas-api-and-sdk/solidity-llm-open-sourced

Solidity LLM (Open-Sourced) | ChainGPT Documentation
https://docs.chaingpt.org/dev-docs-b2b-saas-api-and-sdk/solidity-llm-open-sourced
すべての情報源
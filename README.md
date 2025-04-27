# UnixドメインソケットRPCサンプル (Node.js クライアント、Python サーバー)

このプロジェクトは、Unixドメインソケットを使用したシンプルなRPC (Remote Procedure Call) システムのサンプルです。Node.js クライアントがPythonサーバーと通信し、サーバー側で定義された関数を実行します。

## 特徴

*   **RPC通信:** クライアントからサーバー側の関数を実行します。
*   **Unixドメインソケット:** 同じマシン上での高性能なプロセス間通信を提供します。
*   **JSONプロトコル:** ストリームソケット上でJSONを使用してクライアントとサーバー間でデータを交換します。
*   **非同期クライアント:** Node.js クライアントはPromiseを使用してリクエストを非同期に扱います。
*   **マルチスレッドサーバー:** Pythonサーバーは、スレッドを使用して複数のクライアント接続を同時に処理します。
*   **基本的なリクエスト/レスポンス処理:** IDによる保留中のリクエスト管理、バッファされたデータの処理、関数結果またはエラーの処理ロジックが含まれています。
*   **提供されるメソッド:** 数学演算 (`floor`, `nroot`) および文字列操作 (`reverse`, `validAnagram`, `sort`) のRPCメソッド例が含まれています。

## 前提条件

*   Node.js (v14 以降推奨)
*   Python 3

## セットアップ

1.  Node.js のコードを `client.js` という名前で保存します。
2.  Python のコードを `server.py` という名前で保存します。
3.  両方のファイルが同じディレクトリにあることを確認してください。

Node.js クライアントおよび Python サーバーのどちらも外部ライブラリは必要ありません。それぞれ組み込みモジュール (`net`, `process` (Node.js); `socket`, `os`, `math`, `json`, `traceback`, `threading` (Python)) を使用します。

## 実行方法

1.  **2つのターミナルウィンドウを開きます。**

2.  **最初のターミナルで、Python RPCサーバーを起動します。**

    ```bash
    python server.py
    ```

    以下のような出力が表示されるはずです。

    ```
    Starting up on /tmp/python_rpc_socket
    Waiting for a connection...
    ```

    サーバーは、手動で停止するまで実行されます（例: `Ctrl+C`を押す）。

3.  **2番目のターミナルで、Node.js RPCクライアントを実行します。**

    ```bash
    node client.js
    ```

    クライアントはサーバーへの接続を試み、RPC呼び出しの例を実行し、結果を出力し、その後切断します。クライアントの出力として、接続ステータス、送信されたリクエスト、受信されたレスポンスが表示されます。

    ```
    Attempting to connect to /tmp/python_rpc_socket...
    Connected to server.
    RPC client connected.
    _callRpcMethod called for method: floor
    sent request 1: {"method":"floor","params":[10.99],"id":1}
    Calling floor(10.99)
    _callRpcMethod called for method: nroot
    sent request 2: {"method":"nroot","params":[3,27],"id":2}
    Calling nroot(3, 27)
    ... (レスポンス受信に伴うその他の出力)
    Complete message received:  {"result":10,"result_type":"int","id":1}
    Parsed response:  { result: 10, result_type: 'int', id: 1 }
    RPC Success response for request 1.
    floor result: 10
    Complete message received:  {"result":3.0,"result_type":"double","id":2}
    Parsed response:  { result: 3.0, result_type: 'double', id: 2 }
    RPC Success response for request 2.
    nroot result: 3
    ... (その他の結果)
    Disconnecting from server...
    Client finished.
    ```

    同時に、サーバーのターミナルには、リクエストを受け取ってレスポンスを送信したことを示す出力が表示されます。

    ```
    Connection from AF_UNIX client
    Received request: {'method': 'floor', 'params': [10.99], 'id': 1}
    Sending response: {'result': 10, 'result_type': 'int', 'id': 1}
    Received request: {'method': 'nroot', 'params': [3, 27], 'id': 2}
    Sending response: {'result': 3.0, 'result_type': 'double', 'id': 2}
    ... (その他のリクエストとレスポンス)
    Connection closed by AF_UNIX client
    Closing connection to AF_UNIX client
    ```

4.  **サーバーを停止します:** 最初のターミナルに戻り、`Ctrl+C`を押します。サーバーはソケットファイルをクリーンアップして終了します。

## 仕組み

*   **サーバー (`server.py`):**
    *   定義済みのパス (`/tmp/python_rpc_socket`) にUnixドメインソケットを作成します。
    *   ソケットにバインドし、着信接続を待ち受けます。
    *   `sock.accept()` を使用して新しい接続を受け入れ、接続用の新しいソケットオブジェクトを返します。
    *   受け入れられた各接続に対して、通信を同時に処理するための新しいスレッド (`client_handler`) を生成します。
    *   `client_handler` はソケットからバイトを読み取り、バッファに蓄積し、改行文字 (`\n`) で区切られた完全なメッセージを処理します。
    *   各メッセージは、RPCリクエスト (`{"method": "...", "params": [...], "id": ...}`) を表すJSON文字列であると想定しています。
    *   `handle_request` 関数はJSONを解析し、リクエスト構造を検証し、`RPC_METHODS` ディクショナリで要求されたメソッドを検索し、提供されたパラメータで対応するPython関数を呼び出し、結果または例外をJSONレスポンス (`{"result": ..., "id": ...}` または `{"error": "...", "id": ...}`) に整形します。
    *   JSONレスポンスは、再び改行文字で区切られてクライアントに送り返されます。
    *   JSON解析、メソッド検索、パラメータの型、および予期しない例外のための基本的なエラー処理が含まれています。

*   **クライアント (`client.js`):**
    *   `RpcClient` クラスが接続と保留中のリクエストを管理します。
    *   `connect()` メソッドは、Node.js の `net.createConnection` を使用して Unixドメインソケットへの接続を確立します。
    *   ソケットにはイベントリスナーがアタッチされます。
        *   `'connect'`: `connect` Promise を解決します。
        *   `'data'`: 受信したデータをバッファに追加し、`_processBuffer` を呼び出します。
        *   `'end'`: サーバーの切断を処理します。
        *   `'error'`: ソケットエラーを処理し、必要に応じて保留中のリクエストを拒否します。
    *   `_processBuffer` はバッファから読み取り、改行文字で分割して完全なメッセージを抽出します。
    *   `_handleResponse` は受信したJSONメッセージを解析します。`id` を持つレスポンスを期待します。`pendingRequests` Map (元のPromiseの `resolve` と `reject` 関数を格納しています) を使用して、対応する保留中のリクエストを見つけます。そして、レスポンスの内容に基づいて、Promiseを `result` で解決するか、`error` で拒否します。保留中のリクエストはMapから削除されます。
    *   `floor`、`nroot` などのメソッドは、`_callRpcMethod` を呼び出すラッパー関数です。
    *   `_callRpcMethod` はリクエスト用に一意の `id` を生成し、Promiseを作成し、その `resolve`/`reject` 関数を `pendingRequests` に `id` をキーとして格納し、JSONリクエスト文字列を整形し、ソケットに書き込みます。返されるPromiseにより、クライアントはその特定の呼び出しに対するサーバーのレスポンスを `await` できます。
    *   切断を適切に処理し、レスポンスを待っているリクエストを拒否するためのクリーンアップロジック (`_cleanup`, `_rejectAllPending`) が含まれています。

## 利用可能なRPCメソッド

Pythonサーバーは、以下のメソッドをRPC経由で公開しています。

*   `floor(x: float) -> int`: 与えられた浮動小数点数 `x` のフロア値を返します。
*   `nroot(n: int, x: int) -> float`: `x` の `n` 乗根を返します。`n` が奇数の場合の負の `x` を扱います。無効な入力（例: 負の数の偶数乗根、正でない `n`）に対してエラーを発生させます。
*   `reverse(s: str) -> str`: 入力文字列 `s` の反転を返します。
*   `validAnagram(str1: str, str2: str) -> bool`: `str1` と `str2` が互いにアナグラムであるかどうかをチェックします。
*   `sort(strArr: List[str]) -> List[str]`: 与えられた文字列のリスト `strArr` をアルファベット順にソートします。

## TODO / 潜在的な改善点

*   **タイムアウト処理:** クライアントには、リクエストのタイムアウトを実装するためのTODOがあります。現在、サーバーが応答しない場合、リクエストは無期限にハングする可能性があります。
*   **より堅牢なエラー処理:** RPCレスポンスで、より具体的なエラーコードや構造を実装します。
*   **接続再試行ロジック:** クライアントの `connect` メソッドに自動再試行の試みを加えます。
*   **シリアライズ/デシリアライズ:** 必要に応じて、より複雑なデータ型の扱いを実装します。
*   **サーバーのグレースフルシャットダウン:** サーバーで `Ctrl+C` をよりきれいに処理し、終了前にすべてのスレッドが結合されるようにします。（現在は、スレッドの `daemon=True` とメインの `finally` ブロックでの `sock.close()` によって処理されています）。
*   **ハートビート/キープアライブ:** 接続が切断されたことをより積極的に検出するメカニズムを実装します。
*   **ロギング:** クライアントとサーバーの両方で、適切なロギングライブラリを使用します。

---

このREADMEは、プロジェクトの包括的な概要、実行方法の説明、および内部動作の解説を提供します。
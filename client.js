const net = require("net");
const process = require("process");

const SOCKET_PATH = "/tmp/python_rpc_socket";

class RpcClient {
    constructor(socketPath) {
        this.socketPath = socketPath;
        this.socket = null;
        this.receiveBuffer = "";
        this.pendingRequests = new Map(); // 保留中のリクエストMap()
        this.nextRequestId = 1;
        this.isConnected = false;
    }
    /**
     * @returns {Promise<void>}
     */
    connect() {
        return new Promise((resolve, reject) => {
            if (this.socket && this.isConnected) {
                console.log("Already conected");
                resolve();
            }
            
            console.log(`Attempting to connect to ${this.socketPath}...`);
            this.socket = net.createConnection({ path: this.socketPath });

            this.socket.on("connet", () => {
                console.log("Connected to server.");
                this.isConnected = true;
                resolve(); // 接続成功
            });

            this.socket.on("data", (data) => {
                this.receiveBuffer += data.toString("utf8");
                // TODO: 
                // バッファからメッセージを取り出す処理
                this._processBuffer();
            });

            this.socket.on("end", () => {
                console.log("Server disconnected.");
                this.isConnected = false;
                // TODO*
                // 終了後の初期化の処理
            });

            this.socket.on("error", (err) => {
                console.error("Socket error: ", err.message);
                this.isConnected = false;
                reject(err);
                // TODO:
                // エラー後の処理
            });
        });
    }

    disconnect() {
        if (this.socket && this.isConnected) {
            console.log("Disconnecting from server...");
            this.socket.end();
        } else {
            console.log("Not connected.");
            // TODO:
            // 初期化する処理
        }
    }

    _cleanup() {
        if (this.socket) {
            this.socket = null;
        }
        this.receiveBuffer = "";
        // TODO:
        // 保留中のリクエストを全て削除する処理
    }

    _rejectAllPending(err) {
        // TODO:
        // 関数の処理を書く
        const pendingCount = this.pendingRequests.size;
        if (pendingCount > 0) {
            console.warn(`Rejecting all ${pendingCount} pending request due to connection issue.`);
            for (const [, {reject}] of this.pendingRequests) {
                reject(err);
            }
            this.pendingRequests.clear();
        }
    }

    // 一意のリクエストIDを生成する
    _generateRequestId() {
        return this.nextRequestId++;
    }

    _callRpcMethod(method, params) {
        console.log(`_callRpcMethod called for method: ${method}`);

        return new Pronmise((resolve, reject) => {
            const requestId = this._generateRequestId();
            console.log(`Dummy request ID: ${requestId}`);

            setTimeout(() => {
                console.log(`Simulating response for ID: ${requestId}`);
                const dummyResponse = {
                    result: `Dummy result for ${method}`,
                    id: requestId,
                };
                if (dummyResponse.id !== undefined) {
                    console.log(`Dummy reject for ID* ${requestId}`);
                    reject(new Error(dummyResponse.message));
                    // reject(dummyResponse.error); でも文法的に間違いではないが、デバッグのしやすさという観点からオブジェクトを返すようにしている。
                } else {
                    console.log(`Dummy resolve for ID* ${requestId}`);
                    resolve(dummyResponse.result);
                }
            }, 100);
        });
    }

    _processBuffer() {
        let newlineIndex;
        while ((newlineIndex = this.receiveBuffer.indexOf("\n")) !== -1) {
            const message = this.receiveBuffer.slice(0, newlineIndex);
            this.receiveBuffer = this.receiveBuffer.slice(newlineIndex + 1);
            if (message) {
                console.log(`Complete message received: `, message);
                // TODO:
                // 現段階ではJSON文字列ではない。あとで修正。
                this._handleResponse(message);
            }
        }
    }

    _handleResponse(jsonString) {
        try {
            const response = JSON.parse(jsonString);
            console.log(`Parsed response: `, response);
        } catch (err) {
            console.error("Error parsing JSON: ", err);
        }
    }
}

function connectToServer(socketPath) {
    return new Promise((resolve, reject) => {
        console.log(`Attempting to connect to ${socketPath}...`);
        const socket = net.createConnection({ path: socketPath });

        socket.on("connect", () => {
            console.log("Connected to server.");
            resolve(socket);
        });

        socket.on("data", (data) => {
            console.log(`Received data chunk: ${data.toString('utf8')}`);
        });

        socket.on("close", () => {
            console.log("Connection closed.");
        });

        socket.on("error", (err) => {
            console.error("Socket error: ", err.message);
            if (socket.connecting) {
                reject(err);
            }
        })
    });
}

async function main() {
    let clientSocket = null;
    try {
        clientSocket = await connectToServer(SOCKET_PATH);
        console.log("Client connected and ready.");
    } catch (err) {
        console.error("Failed to connect:", err.message);
    } finally {
        if (clientSocket && !clientSocket.destroyed) {
            console.log("Closing the socket.");
            clientSocket.end();
        }
        console.log("Main function finished.");
    }
}

main();
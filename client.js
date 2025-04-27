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

            this.socket.on("connect", () => {
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
                this._cleanup();
            });

            this.socket.on("error", (err) => {
                console.error("Socket error: ", err.message);
                this.isConnected = false;
                reject(err);
                if (this.socket && this.socket.connectiong) {
                    console.log("Error during connection atempt.");
                    reject(err);
                } else {
                    console.log("Error after connection.");
                    this._rejectAllPending(err);
                }
                this._cleanup();
            });
        });
    }

    disconnect() {
        if (this.socket && this.isConnected) {
            console.log("Disconnecting from server...");
            this.socket.end();
        } else {
            console.log("Not connected.");
            this._cleanup();
        }
    }

    _cleanup() {
        if (this.socket) {
            this.socket = null;
        }
        this.receiveBuffer = "";
        this._rejectAllPending(new Error("Connection closed unexpectedly."));
    }

    _rejectAllPending(err) {
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

        return new Promise((resolve, reject) => {
            const requestId = this._generateRequestId();
            console.log(`Dummy request ID: ${requestId}`);

            setTimeout(() => {
                console.log(`Simulating response for ID: ${requestId}`);
                const dummyResponse = {
                    result: `Dummy result for ${method}`,
                    id: requestId,
                };
                if (dummyResponse.id === undefined) {
                    console.log(`Dummy reject for ID: ${requestId}`);
                    reject(new Error(dummyResponse.message));
                    // reject(dummyResponse.error); でも文法的に間違いではないが、デバッグのしやすさという観点からオブジェクトを返すようにしている。
                } else {
                    console.log(`Dummy resolve for ID: ${requestId}`);
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

    async floor(x) {
        console.log(`Calling floor(${x})`);
        return this._callRpcMethod("floor", [x]);
    }

    async nroot(n, x) {
        console.log(`Calling nroot(${n}, ${x})`);
        return this._callRpcMethod("nroot", [n, x]);
    }

    async reverse(s) {
        console.log(`Calling reverse(${s})`);
        return this._callRpcMethod("reverse", [s]);
    }

    async validAnagram(str1, str2) {
        console.log(`Calling validAnagram(${str1}, ${str2})`);
        return this._callRpcMethod("validAnagram", [str1, str2]);
    }

    async sort(strArr) {
        console.log(`Calling sort(${strArr})`);
        return this._callRpcMethod("sort", [strArr]);
    }
}

async function main() {
    const client = new RpcClient(SOCKET_PATH);
    try {
        await client.connect();
        console.log("RPC client connected.");

        const floorResult = await client.floor(10.99);
        console.log(`floor result: ${floorResult}`);

        const nrootResult = await client.nroot(3, 27);
        console.log(`nroot result: ${nrootResult}`);

        const reverseResult = await client.reverse("hello");
        console.log(`reverse result: ${reverseResult}`);

        const validAnagramResult = await client.validAnagram("listen", "silent");
        console.log(`validAnagram result: ${validAnagramResult}`);

        const sortResult = await client.sort(["banana", "apple", "cherry"]);
        console.log(`sort result: ${sortResult}`);

    } catch (err) {
        console.error(`An error occurred: `, err);
    } finally {
        client.disconnect();
        console.log("\nClient finished.");
    }
}

main();
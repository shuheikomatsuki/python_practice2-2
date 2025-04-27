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
                if (this.socket && this.socket.connecting) {
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
    /**
     * 
     * @param {string} method 
     * @param {Array<any>} params 
     * @returns {Promise<any>}
     */

    _callRpcMethod(method, params) {
        console.log(`_callRpcMethod called for method: ${method}`);

        if (!this.isConnected || !this.socket) {
            return Promise.reject(new Error("Not connected to server. Call connect() first."));
        }

        return new Promise((resolve, reject) => {
            const requestId = this._generateRequestId();

            const request = {
                method: method,
                params: params,
                id: requestId,
            };
            const jsonString = JSON.stringify(request);
            const message = jsonString + "\n";

            // TODO: タイムアウト処理

            this.pendingRequests.set(requestId, { resolve, reject });

            try {
                this.socket.write(message, "utf8", (err) => {
                    if (err) {
                        console.error("`Failed to write to socket for request ${requestId}:", err);
                        const pending = this.pendingRequests.get(requestId);
                        if (pending) {
                            this.pendingRequests.delete(requestId);
                            pending.reject(new Error(`failed to send message: ${err.message}`));
                        } 
                    }
                    else {
                        console.log(`sent request ${requestId}: ${jsonString}`);
                    }
                });
            } catch (err) {
                console.error(`exception during socket write for request ${requestId}:`, err);
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    this.pendingRequests.delete(requestId);
                    pending.reject(err);
                }
            }
        });
    }

    _processBuffer() {
        let newlineIndex;
        while ((newlineIndex = this.receiveBuffer.indexOf("\n")) !== -1) {
            const message = this.receiveBuffer.slice(0, newlineIndex);
            this.receiveBuffer = this.receiveBuffer.slice(newlineIndex + 1);
            if (message) {
                console.log(`Complete message received: `, message);
                this._handleResponse(message);
            }
        }
    }
    /**
     * 
     * @param {string} jsonString 
     */
    _handleResponse(jsonString) {
        let responseObject;
        try {
            responseObject = JSON.parse(jsonString);
            console.log(`Parsed response: `, responseObject);

            // IDがない場合
            const requestId = responseObject.id;
            if (requestId === undefined) {
                console.error("Received response with no ID: ", responseObject);
                return;
            }

            // IDがある場合、対応するリクエストをMapから取得する
            const pending = this.pendingRequests.get(requestId);
            if (!pending) {
                console.warn(`Received response for unknown request ID: ${requestId}`, responseObject);
                return;
            }
            
            // 対応するリクエストが見つかったので、Mapから削除する
            this.pendingRequests.delete(requestId);

            // レスポンスにエラーが含まれている場合
            if (responseObject.error !== undefined) {
                console.error(`RPC Error response for request ${requestId}:`, responseObject.error);
                pending.reject(new Error(`RPC Error: ${responseObject.error}`));
            } else {
                if (responseObject.result === undefined) {
                    console.warn(`Received response for request ${requestId} with no result:`, responseObject);
                    pending.resolve(undefined);
                } else {
                    console.log((`RPC Success response for request ${requestId}.`));
                    pending.resolve(responseObject.result);
                }
            }

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
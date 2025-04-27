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
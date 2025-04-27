# Unix Domain Socket RPC Example (Node.js Client, Python Server)

This project demonstrates a simple Remote Procedure Call (RPC) system using Unix Domain Sockets. A Node.js client communicates with a Python server, executing predefined functions on the server side.

## Features

*   **RPC Communication:** Execute server-side functions from the client.
*   **Unix Domain Sockets:** High-performance inter-process communication on the same machine.
*   **JSON Protocol:** Data exchange between client and server using JSON over a stream socket.
*   **Asynchronous Client:** Node.js client handles requests asynchronously using Promises.
*   **Multi-threaded Server:** Python server handles multiple client connections concurrently using threads.
*   **Basic Request/Response Handling:** Includes logic for managing pending requests by ID, processing buffered data, and handling function results or errors.
*   **Provided Methods:** Includes example RPC methods for mathematical operations (`floor`, `nroot`) and string manipulation (`reverse`, `validAnagram`, `sort`).

## Prerequisites

*   Node.js (v14 or later recommended)
*   Python 3

## Setup

1.  Save the Node.js code as `client.js`.
2.  Save the Python code as `server.py`.
3.  Ensure both files are in the same directory.

No external libraries are required for either the Node.js client or the Python server, as they use built-in modules (`net`, `process` in Node.js; `socket`, `os`, `math`, `json`, `traceback`, `threading` in Python).

## How to Run

1.  **Open two terminal windows.**

2.  **In the first terminal, start the Python RPC server:**

    ```bash
    python server.py
    ```

    You should see output similar to:

    ```
    Starting up on /tmp/python_rpc_socket
    Waiting for a connection...
    ```

    The server will run until you manually stop it (e.g., by pressing `Ctrl+C`).

3.  **In the second terminal, run the Node.js RPC client:**

    ```bash
    node client.js
    ```

    The client will attempt to connect to the server, execute the example RPC calls, print the results, and then disconnect. You will see output from the client indicating connection status, sent requests, and received responses.

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
    ... (more output as responses are received)
    Complete message received:  {"result":10,"result_type":"int","id":1}
    Parsed response:  { result: 10, result_type: 'int', id: 1 }
    RPC Success response for request 1.
    floor result: 10
    Complete message received:  {"result":3.0,"result_type":"double","id":2}
    Parsed response:  { result: 3.0, result_type: 'double', id: 2 }
    RPC Success response for request 2.
    nroot result: 3
    ... (other results)
    Disconnecting from server...
    Client finished.
    ```

    Simultaneously, the server terminal will show output indicating it received requests and sent responses:

    ```
    Connection from AF_UNIX client
    Received request: {'method': 'floor', 'params': [10.99], 'id': 1}
    Sending response: {'result': 10, 'result_type': 'int', 'id': 1}
    Received request: {'method': 'nroot', 'params': [3, 27], 'id': 2}
    Sending response: {'result': 3.0, 'result_type': 'double', 'id': 2}
    ... (other requests and responses)
    Connection closed by AF_UNIX client
    Closing connection to AF_UNIX client
    ```

4.  **Stop the server:** Go back to the first terminal and press `Ctrl+C`. The server will clean up the socket file and exit.

## How it Works

*   **Server (`server.py`):**
    *   Creates a Unix Domain Socket at the predefined path (`/tmp/python_rpc_socket`).
    *   Binds to the socket and listens for incoming connections.
    *   Uses `sock.accept()` to accept new connections, which returns a new socket object for the connection.
    *   Spawns a new thread (`client_handler`) for each accepted connection to handle communication concurrently.
    *   The `client_handler` reads bytes from the socket, accumulates them in a buffer, and processes complete messages delimited by newline characters (`\n`).
    *   Each message is expected to be a JSON string representing an RPC request (`{"method": "...", "params": [...], "id": ...}`).
    *   The `handle_request` function parses the JSON, validates the request structure, looks up the requested method in the `RPC_METHODS` dictionary, calls the corresponding Python function with the provided parameters, and formats the result or any exceptions into a JSON response (`{"result": ..., "id": ...}` or `{"error": "...", "id": ...}`).
    *   The JSON response is sent back to the client, again delimited by a newline.
    *   Includes basic error handling for JSON parsing, method lookups, parameter types, and unexpected exceptions.

*   **Client (`client.js`):**
    *   The `RpcClient` class manages the connection and pending requests.
    *   The `connect()` method uses Node.js's `net.createConnection` to establish a connection to the Unix Domain Socket.
    *   Event listeners are attached to the socket:
        *   `'connect'`: Resolves the `connect` Promise.
        *   `'data'`: Appends received data to a buffer and calls `_processBuffer`.
        *   `'end'`: Handles server disconnection.
        *   `'error'`: Handles socket errors, rejecting pending requests if necessary.
    *   `_processBuffer` reads from the buffer, splitting it by newline characters to extract complete messages.
    *   `_handleResponse` parses a received JSON message. It expects a response with an `id`. It finds the corresponding pending request using the `pendingRequests` Map (which stores the `resolve` and `reject` functions for the original Promise). It then resolves the Promise with the `result` or rejects it with the `error` based on the response content. The pending request is removed from the Map.
    *   Methods like `floor`, `nroot`, etc., are wrapper functions that call `_callRpcMethod`.
    *   `_callRpcMethod` generates a unique `id` for the request, creates a Promise, stores its `resolve`/`reject` functions in `pendingRequests` keyed by the `id`, formats the JSON request string, and writes it to the socket. The Promise is returned, allowing the client to `await` the server's response for that specific call.
    *   Includes cleanup logic (`_cleanup`, `_rejectAllPending`) to handle disconnections gracefully and reject any requests still waiting for a response.

## RPC Methods Available

The Python server exposes the following methods via RPC:

*   `floor(x: float) -> int`: Returns the floor of the given floating-point number `x`.
*   `nroot(n: int, x: int) -> float`: Returns the `n`-th root of `x`. Handles negative `x` for odd `n`. Raises errors for invalid inputs (e.g., even root of negative number, non-positive `n`).
*   `reverse(s: str) -> str`: Returns the reverse of the input string `s`.
*   `validAnagram(str1: str, str2: str) -> bool`: Checks if `str1` and `str2` are anagrams of each other.
*   `sort(strArr: List[str]) -> List[str]`: Sorts the given list of strings `strArr` alphabetically.

## TODO / Potential Improvements

*   **Timeout Handling:** The client has a TODO to implement request timeouts. Currently, a request might hang indefinitely if the server doesn't respond.
*   **More Robust Error Handling:** Implement more specific error codes or structures in the RPC response.
*   **Connection Retry Logic:** Add automatic retry attempts in the client's `connect` method.
*   **Serialization/Deserialization:** Implement more complex data type handling if needed.
*   **Graceful Server Shutdown:** Handle `Ctrl+C` more cleanly on the server to ensure all threads are joined before exiting. (Currently handled by `daemon=True` for threads and `sock.close()` in the main `finally` block).
*   **Heartbeat/Keep-alive:** Implement a mechanism to detect broken connections more proactively.
*   **Logging:** Use a proper logging library in both client and server.

---

This README provides a comprehensive overview of the project, instructions on how to run it, and an explanation of its internal workings.
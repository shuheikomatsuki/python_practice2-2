import socket
import os
import math
import json
import traceback
import threading
from typing import Any, List, Dict, Tuple, Callable

# --- RPCとして提供する関数 ---
class Methods:
    @staticmethod
    def floor(x: float) -> int:
        if not isinstance(x, (int, float)):
            raise ValueError("Input must be an integer or a float.")
        return math.floor(x)
    
    @staticmethod
    def nroot(n: int, x: int) -> float:
        if not isinstance(n, int) or n <= 0:
            raise TypeError("n must be a positive integer.")
        if not isinstance(x, (int, float)):
            raise TypeError("x must be an integer or a float.")
        if x < 0:
            # 負の数のn乗根 (nが奇数の場合のみ実数解を持つ)
            # 複素数解は扱わないため、単純な計算で負の数を返す
            # 例: n=3, x=-8 -> (-8)^(1/3) = -2
            if n % 2 == 0:
                 raise ValueError("Cannot compute even root of a negative number.")
            return -((-x) ** (1/n))
        else:
            return x ** (1/n)
    
    @staticmethod
    def reverse(s: str) -> str:
        if not isinstance(s, str):
            raise TypeError("Input must be a string.")
        return s[::-1]
    
    @staticmethod
    def validAnagram(str1: str, str2: str) -> bool:
        if not isinstance(str1, str) or not isinstance(str2, str):
            raise TypeError("Both inputs must be strings.")
        return sorted(str1) == sorted(str2)
    
    @staticmethod
    def sort(strArr: List[str]) -> List[str]:
        if not isinstance(strArr, list) or not all(isinstance(s, str) for s in strArr):
            raise TypeError("Input must be a list of strings.")
        return sorted(strArr)
    
# --- RPCメソッドディスパッチャ ---
# メソッド名と実際の関数オブジェクト、引数の方をマッピング
RPC_METHODS: Dict[str, Tuple[Callable, List[type]]] = {
    "floor": (Methods.floor, [float]),
    "nroot": (Methods.nroot, [int, int]),
    "reverse": (Methods.reverse, [str]),
    "validAnagram": (Methods.validAnagram, [str, str]),
    "sort": (Methods.sort, [List[str]]),
}

# --- 型名をPythonの型にマッピング ---
TYPE_MAP = {
    "int": int,
    "double": float,
    "float": float,
    "string": str,
    "bool": bool,
    "string[]": list,
    "list": list,
}

# --- Pythonの型をJSONレスポンス用の型にマッピング ---
def get_type_name(value: Any) -> str:
    if isinstance(value, bool): return "bool"
    if isinstance(value, int): return "int"
    if isinstance(value, float): return "double"
    if isinstance(value, str): return "string"
    if isinstance(value, list): return "array"
    if value is None: return "null"
    return "unknown"

# --- リクエスト処理 ---
def handle_request(data: bytes) -> str:
    request_id = None # エラー時にもIDを返すために初期化
    try:
        request_str = data.decode("utf-8")
        request = json.loads(request_str)
        print(f"Received request: {request}")

        if not all(k in request for k in ["method", "params", "id"]):
            raise ValueError("Missing required fields in request (method, params, id)")
        request_id = request["id"]
        method_name = request["method"]
        params = request["params"]

        if not isinstance(params, list):
            raise TypeError("'params' must be a list.")

        if method_name not in RPC_METHODS:
            raise NameError(f"Method '{method_name}' not found.")
        
        func, expected_types = RPC_METHODS[method_name]

        # 引数の数をチェック
        if len(params) != len(expected_types):
            raise TypeError(f"Method '{method_name}' expects {len(expected_types)} arguments, but got {len(params)}.")
        
        result = func(*params)

        response = {
            "result": result,
            "result_type": get_type_name(result),
            "id": request_id,
        }

    # json.loads()が失敗した場合(送られたデータが有効なJSONでない場合)
    except json.JSONDecodeError:
        print("Error: Failed to decode JSON.")
        response = {
            "error": "Invalid JSON format.",
            "id": request_id,
        }

    # エラーメッセージ(e)をサーバコンソールに出力
    except (NameError, ValueError, TypeError) as e:
        print(f"Error processing request: {e}")
        response = {
            "error": str(e),
            "id": request_id,
        }

    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        traceback.print_exc() # 詳細なスタックトレースをサーバログに出力
        response = {
            "error": "An internal server error occurred",
            "id": request_id,
        }

    response_str = json.dumps(response) + "\n"
    print(f"Sending response: {response}")
    return response_str.encode("utf-8")

# --- クライアント接続処理 ---
def client_handler(connection: socket.socket, client_address: str):
    print(f"Connection from {client_address}")
    buffer = b"" # 空のバイト列で初期化
    try:
        while True: # クライアントが接続を切断するか、エラーが発生するまでデータの受信と処理を繰り返す無限ループ
            data_chunk = connection.recv(1024)
            if not data_chunk: # 空のバイト列を返した場合、クライアントが正常に接続を閉じた(EOFを受信した)とみなす
                print(f"Connection closed by {client_address}")
                break # クライアントが接続を閉じた

            buffer += data_chunk # 受信したデータをバッファに追加
            while b"\n" in buffer:
                message, buffer = buffer.split(b"\n", 1) # 最後の改行で分割
                if message:
                    response_data = handle_request(message)
                    connection.sendall(response_data)

    # クライアントが突然接続を切断した場合
    except ConnectionResetError:
        print(f"Connection reset by {client_address}")

    except Exception as e:
        print(f"Error handling client {client_address}: {e}")
        traceback.print_exc()

    finally:
        print(f"Closing connection to {client_address}")
        connection.close()

# --- サーバメイン処理 ---
def main():
    server_address = "/tmp/python_rpc_socket"
    sock_family = socket.AF_UNIX
    sock_type = socket.SOCK_STREAM

    try:
        os.unlink(server_address) # 以前のソケットファイルを削除
    except FileNotFoundError:
        pass

    sock = socket.socket(sock_family, sock_type)
    print(f"Starting up on {server_address}")
    sock.bind(server_address) #ソケットに指定したアドレスをバインド

    sock.listen(5)

    print("Waiting for a connection...")

    try:
        while True:
            connection, client_address = sock.accept()
            client_thread = threading.Thread(
                target=client_handler,
                args=(connection, client_address if client_address else "AF_UNIX client")
            )
            client_thread.daemon = True # メインスレッド終了時に終了
            client_thread.start()
    except KeyboardInterrupt:
        print("\nServer shutting down...")

    finally:
        print("Closing server socket")
        sock.close()
        try:
            os.unlink(server_address)
            print(f"Removed socket file: {server_address}")
        except OSError:
            pass

if __name__ == "__main__":
    main()
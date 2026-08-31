export interface SocketData {
    userId: string;
}

export interface SocketErrorDetails {
    code: string;
    message: string;
    details?: unknown;
}

export interface SocketSuccessResponse<T = unknown> {
    success: true;
    data: T;
}

export interface SocketErrorResponse {
    success: false;
    error: SocketErrorDetails;
}

export type SocketResponse<T = unknown> = SocketSuccessResponse<T> | SocketErrorResponse;

export type SocketAckCallback<T = unknown> = (response: SocketResponse<T>) => void;

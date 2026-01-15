export interface User {
    id: number;
    email: string;
    username: string;
    full_name?: string;
    role: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
}

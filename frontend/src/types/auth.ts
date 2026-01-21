export interface User {
    id: number;
    email: string;
    username: string;
    full_name?: string;
    role: string;
    is_active: boolean;
    line_user_id?: string;
    receive_notifications: boolean;
    created_at?: string;
    last_login?: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
}

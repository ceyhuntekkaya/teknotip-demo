type AuthCookies = {
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
};

export type ServerAuth = {
  getAccessToken(): Promise<string | undefined>;
  getRefreshToken(): Promise<string | undefined>;
  setAuthCookies(tokens: AuthCookies): Promise<void>;
  clearAuthCookies(): Promise<void>;
};

let serverAuth: ServerAuth | undefined;

export function bindServerAuth(auth: ServerAuth): void {
  serverAuth = auth;
}

export function getServerAuth(): ServerAuth | undefined {
  return serverAuth;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  expiresInSeconds: number;
}

import { operations } from './schema.d.ts'

type TokenCreate = operations['api_token_create']['requestBody']['content']['application/json']
type TokenRefresh = operations['api_token_refresh_create']['requestBody']['content']['application/json']


export interface LoginFormTypes {
  username?: string;
  password?: string;
  remember?: boolean;
  providerName?: string;
  redirectPath?: string;
}
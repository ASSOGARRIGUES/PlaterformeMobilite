import {components, operations} from './schema.d.ts'

type TokenCreate = operations['api_token_create']['requestBody']['content']['application/json']
type TokenRefresh = operations['api_token_refresh_create']['requestBody']['content']['application/json']

type WhoAmI = operations['api_whoami_list']['responses']['200']['content']['application/json']
type User = operations['api_user_list']['responses']['200']['content']['application/json']


export interface LoginFormTypes {
  username?: string;
  password?: string;
  remember?: boolean;
  providerName?: string;
  redirectPath?: string;
}


import {AuthProvider, HttpError, useApiUrl} from "@refinedev/core";
import axios from "axios";
import {TokenCreate} from "../types/auth";
import {ACCESS_TOKEN_KEY, API_URL, REFRESH_TOKEN_KEY} from "../constants";
import {AuthActionResponse} from "@refinedev/core/dist/contexts/auth/types";
import {axiosInstance} from "./rest-data-provider/utils";



export const authProvider: AuthProvider = {
  login: async ({email, password}) => {
    // Query /token endpoint with username and password
    try {
      const {data} = await axios.post<any, TokenCreate, TokenCreate>(`${API_URL}/token/`, {email, password});

      // Save the token to the local storage
      localStorage.setItem(ACCESS_TOKEN_KEY, data.access);
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh);

      return {
        success: true, // or false if the login is not successful
        redirectTo: "/",
      };
    }catch (e: any) {


      if (e.response && e.response.status === 401) {
        console.log(e.response.data)
        return {
          success: false, // or false if the login is not successful
          error: {
            name: "Erreur de connexion",
            message: e.response.data.detail || "Nom d'utilisateur ou mot de passe incorrect"
          }
        };
      }

      return {
          success: false, // or false if the login is not successful
          error: e
        };
    }
  },

  check: async (params) => {

    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

    if (!accessToken || !refreshToken) {
      return {
        authenticated: false,
      };
    }

    return {
      authenticated: true, // or false if the user is not authenticated
    };

  },

  logout: async (props) => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);

    return {
      success: true,
      redirectTo: props?.redirectPath || "/login",
    };
  },

  onError: async (error) => {
    // Handle error to refresh token
    if(error.statusCode !== 401 && error.statusCode !== 403) {
      return {};
    }

    //Try to refresh token
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      return {
        logout: true,
        redirectTo: "/login",
      };
    }

    try {
      console.log("refreshing token")
      const {data} = await axios.post<any, TokenCreate, TokenCreate>(`${API_URL}/token/refresh/`, {refresh: refreshToken});

      localStorage.setItem(ACCESS_TOKEN_KEY, data.access);

      return {
        retry: true,
      };
    } catch (e) {

      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);

      return {
        logout: true,
        redirectTo: "/login",
      };
    }

  },


  register: async (params) => {
    console.log("register is no implemented");
    return {
      success: false, // or false if the register is not successful
      redirectTo: "/",
    };
  },

  forgotPassword: async (params) => {
    console.log("forgotPassword is not implemented");

    return {
      success: false, // or false if the forgot password is not successful
    };
  },

  updatePassword: async (params) => {
    console.log("updatePassword is not implemented", params);

    return {
      success: false, // or false if the update password is not successful
      redirectTo: "/login",
    };
  },

  getPermissions: async (params) => {
    console.log("getPermissions", params);

    // TODO: send request to the API to get permissions

    return {
      permissions: [],
    };
  },

  getIdentity: async (params) => {
    const {data} = await axiosInstance["get"](`${API_URL}/whoami/`)

    if (!data) {
      return undefined;
    }

    return {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone,
        email: data.email,
        avatar: data.avatar,
    };
  },


};

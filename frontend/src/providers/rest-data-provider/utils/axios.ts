import {HttpError, useOnError} from "@refinedev/core";
import axios from "axios";
import {ACCESS_TOKEN_KEY} from "../../../constants";
import {authProvider} from "../../auth-provider";

const axiosInstance = axios.create();

axiosInstance.interceptors.request.use((config) => {
  const access_token = localStorage.getItem(ACCESS_TOKEN_KEY);

  if (access_token) {
    config.headers.Authorization = `Bearer ${access_token}`;
  }

  return config;
});

axiosInstance.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error) => {

      let customError: HttpError = {
        ...error,
        message: error.response?.data?.message,
        statusCode: error.response?.status,
      };

      if (customError.statusCode === 401) {
        if(localStorage.getItem(ACCESS_TOKEN_KEY)) {
          localStorage.removeItem(ACCESS_TOKEN_KEY);

          console.log("Calling authProvider onError")

          const onErrorResponse = await authProvider.onError(customError);

        }
      }

      return Promise.reject(customError);
    }
);

export { axiosInstance };

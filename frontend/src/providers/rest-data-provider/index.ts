import {CrudFilters, DataProvider} from "@refinedev/core";
import { axiosInstance, generateSort, generateFilter } from "./utils";
import { AxiosInstance } from "axios";
import { stringify } from "query-string";
import {ACCESS_TOKEN_KEY} from "../../constants";

type MethodTypes = "get" | "delete" | "head" | "options";
type MethodTypesWithBody = "post" | "put" | "patch";

export const dataProvider = (
    apiUrl: string,
    httpClient: AxiosInstance = axiosInstance
): Omit<
    Required<DataProvider>,
    "createMany" | "updateMany" | "deleteMany"
> => {

  return ({
    getList: async ({ resource, pagination, filters, sorters, meta }) => {
      const url = `${apiUrl}/${resource}/`;

      const { current = 1, pageSize = 10, mode = "server" } = pagination ?? {};

      const { headers: headersFromMeta, method } = meta ?? {};
      const requestMethod = (method as MethodTypes) ?? "get";

      const queryFilters = generateFilter(filters);

      const query: {
        limit?: number;
        offset?: number;
        ordering?: string;
      } = {};

      if (mode === "server") {
        query.limit = current * pageSize;
        query.offset = (current - 1) * pageSize;
      }

      const generatedSort = generateSort(sorters);
      if (generatedSort) {
        const { ordering } = generatedSort;
        query.ordering = ordering.join(",");
      }

      const combinedQuery = { ...query, ...queryFilters };
      const urlWithQuery = Object.keys(combinedQuery).length
          ? `${url}?${stringify(combinedQuery)}`
          : url;

      const { data, headers } = await httpClient[requestMethod](urlWithQuery, {
        headers: headersFromMeta,
      });

      const total = data.count

      return {
        data: data.results,
        total: total || data.length,
      };
    },

    getMany: async ({ resource, ids, meta }) => {
      const { headers, method } = meta ?? {};
      const requestMethod = (method as MethodTypes) ?? "get";

      const filters: CrudFilters = [{ field: "id", operator: "in", value: ids }];
      const queryFilters = generateFilter(filters);

      const { data } = await httpClient[requestMethod](
          `${apiUrl}/${resource}/?${stringify(queryFilters)}`,
          { headers }
      );

      return {
        data: data.results,
      };
    },

    create: async ({ resource, variables, meta }) => {
      const url = `${apiUrl}/${resource}/`;

      const { headers, method } = meta ?? {};
      const requestMethod = (method as MethodTypesWithBody) ?? "post";

      const { data } = await httpClient[requestMethod](url, variables, {
        headers,
      });

      return {
        data,
      };
    },

    update: async ({ resource, id, variables, meta }) => {

      const specialActionUrl = meta?.special_action ? `${meta.special_action}/` : "";

      const url = `${apiUrl}/${resource}/${id}/${specialActionUrl}`;

      const { headers, method } = meta ?? {};
      const requestMethod = (method as MethodTypesWithBody) ?? "patch";


      const { data } = await httpClient[requestMethod](url, variables, {
        headers,
      });

      return {
        data,
      };
    },

    getOne: async ({ resource, id, meta }) => {
      const specialActionUrl = meta?.special_action ? `${meta.special_action}/` : "";

      const url = `${apiUrl}/${resource}/${id}/${specialActionUrl}`;

      const { headers, method } = meta ?? {};
      const requestMethod = (method as MethodTypes) ?? "get";

      const { data } = await httpClient[requestMethod](url, { headers });

      return {
        data,
      };
    },

    deleteOne: async ({ resource, id, variables, meta }) => {
      const specialActionUrl = meta?.special_action ? `${meta.special_action}/` : "";

      const url = `${apiUrl}/${resource}/${id}/${specialActionUrl}`;

      const { headers, method } = meta ?? {};
      const requestMethod = (method as MethodTypesWithBody) ?? "delete";

      const { data } = await httpClient[requestMethod](url, {
        data: variables,
        headers,
      });

      return {
        data,
      };
    },

    getApiUrl: () => {
      return apiUrl;
    },

    custom: async ({
                     url,
                     method,
                     filters,
                     sorters,
                     payload,
                     query,
                     headers,
                   }) => {
      let requestUrl = `${url}?`;

      if (sorters) {
        const generatedSort = generateSort(sorters);
        if (generatedSort) {
          const { ordering } = generatedSort;
          const sortQuery = {
            ordering: ordering.join(","),
          };
          requestUrl = `${requestUrl}&${stringify(sortQuery)}`;
        }
      }

      if (filters) {
        const filterQuery = generateFilter(filters);
        requestUrl = `${requestUrl}&${stringify(filterQuery)}`;
      }

      if (query) {
        requestUrl = `${requestUrl}&${stringify(query)}`;
      }

      let axiosResponse;
      switch (method) {
        case "put":
        case "post":
        case "patch":
          axiosResponse = await httpClient[method](url, payload, {
            headers,
          });
          break;
        case "delete":
          axiosResponse = await httpClient.delete(url, {
            data: payload,
            headers: headers,
          });
          break;
        default:
          axiosResponse = await httpClient.get(requestUrl, {
            headers,
          });
          break;
      }

      const { data } = axiosResponse;

      return Promise.resolve({ data });
    },
  })
};

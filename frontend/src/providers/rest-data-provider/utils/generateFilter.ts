import { CrudFilters } from "@refinedev/core";
import { mapOperator } from "./mapOperator";

export const generateFilter = (filters?: CrudFilters) => {
  const queryFilters: { [key: string]: string } = {};

  if (filters) {
    filters.map((filter) => {
      if (filter.operator === "or" || filter.operator === "and") {
        throw new Error(
          `[@refinedev/simple-rest]: \`operator: ${filter.operator}\` is not supported. You can create custom data provider. https://refine.dev/docs/api-reference/core/providers/data-provider/#creating-a-data-provider`
        );
      }

      if(!filter.value){
        return;
      }

      if ("field" in filter) {
        const { field, operator, value } = filter;
        let filterValue = value;

        if (field === "q") {
          queryFilters[field] = value;
          return;
        }

        if(operator === "in" || operator === "nin") {
          //check if value is an array
            if(!Array.isArray(value)){
                throw new Error(
                    `[@refinedev/simple-rest]: \`value\` should be an array for operator: ${operator}.`
                );
            }
            filterValue = value.join(",");
        }

        const mappedOperator = mapOperator(operator);
        queryFilters[`${field}${mappedOperator}`] = filterValue;
      }
    });
  }

  return queryFilters;
};

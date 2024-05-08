import { CrudFilters } from "@refinedev/core";
import { mapOperator } from "./mapOperator";

export const generateFilter = (filters?: CrudFilters) => {
  let queryFilters: { [key: string]: string } = {};

  if (filters) {
    filters.map((filter) => {
      if (filter.operator === "and") {
        throw new Error(
            `[@refinedev/simple-rest]: \`operator: ${filter.operator}\` is not supported. You can create custom data provider. https://refine.dev/docs/api-reference/core/providers/data-provider/#creating-a-data-provider`
        );
      }


      if(!filter.value){
        return;
      }

      //If Field is present, then the filter is a Logical Filter : {field: "field", operator: "operation", value: "value"}
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

      }else{
        //If Field is not present, then the filter is a Logical Filter : {operator: "or | and", value: "LogicalFilter | ConditionFilter"}
        const { operator, value } = filter;

        if(operator === "or"){
          value.forEach((filter) => {
              if(filter.operator !== "eq"){
                throw new Error("Only eq operator is supported for or operator");
              }

                queryFilters[`${filter.field}__or`] = filter.value;
          });
        }
      }


    });
  }

  return queryFilters;
};

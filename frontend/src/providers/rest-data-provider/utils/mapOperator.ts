import { CrudOperators } from "@refinedev/core";

export const mapOperator = (operator: CrudOperators): string => {
  switch (operator) {
    case "ne":
    case "gte":
    case "lte":
    case "lt":
    case "gt":
    case "in":
      return `__${operator}`;
    case "contains":
      return "_like";
    default:
      return "";
  }
};

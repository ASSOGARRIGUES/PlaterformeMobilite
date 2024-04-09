import { CrudSorting } from "@refinedev/core";

export const generateSort = (sorters?: CrudSorting) => {
  if (sorters && sorters.length > 0) {
    const ordering: string[] = [];

    sorters.map((item) => {
      const dir = item.order === "desc" ? "-" : "";
      ordering.push(dir+item.field);
    });

    return {
      ordering,
    };
  }

  return;
};
